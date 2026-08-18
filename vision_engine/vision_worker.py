"""
vision_worker.py - Daemon do Motor de Visão Computacional
Loop fechado de captura V4L2 USB, inspeção de receitas e sincronização SHM com PROFINET.
"""

import cv2
import numpy as np
import time
import json
import os
import threading
import logging

from shm_bridge import SHMBridge, STATUS_FLAG_READY, STATUS_FLAG_TARGET_FOUND, STATUS_FLAG_PASS, STATUS_FLAG_FAIL, STATUS_FLAG_PROCESSING, STATUS_FLAG_TRIGGER_ACK
from modules.color_detector import ColorDetector
from modules.shape_detector import ShapeDetector
from modules.object_counter import ObjectCounter
from modules.calibration import CameraCalibration

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("VisionWorker")

DEFAULT_RECIPE_PATH = os.path.join(os.path.dirname(__file__), "..", "config", "default_recipes.json")

class VisionWorker:
    def __init__(self, camera_id: int = 0):
        self.camera_id = camera_id
        self.cap = None
        self.running = False
        
        self.shm = SHMBridge(create_if_missing=True)
        self.color_detector = ColorDetector()
        self.shape_detector = ShapeDetector(min_area=150.0)
        self.object_counter = ObjectCounter()
        self.calibration = CameraCalibration()
        
        # Padrão: 10 pixels por mm
        self.calibration.set_scale_factor(10.0)

        self.latest_frame = None
        self.latest_annotated_frame = None
        self.frame_lock = threading.Lock()

        self.active_recipe_id = 1
        self.recipes = self._load_recipes()

        self.last_trigger_cmd = 0

    def _load_recipes(self) -> dict:
        try:
            if os.path.exists(DEFAULT_RECIPE_PATH):
                with open(DEFAULT_RECIPE_PATH, "r", encoding="utf-8") as f:
                    return json.load(f)
        except Exception as e:
            logger.error(f"Erro ao carregar arquivo de receitas: {e}")
        
        # Receita padrão fallback
        return {
            "1": {
                "name": "Default Inspection",
                "hsv_min": [0, 100, 100],
                "hsv_max": [10, 255, 255],
                "min_count": 1,
                "max_count": 10,
                "roi": [50, 50, 540, 380]
            }
        }

    def init_camera(self) -> bool:
        logger.info(f"Inicializando Câmera USB ID: {self.camera_id}...")
        self.cap = cv2.VideoCapture(self.camera_id, cv2.CAP_V4L2 if hasattr(cv2, 'CAP_V4L2') else cv2.CAP_ANY)
        if not self.cap.isOpened():
            logger.error(f"Não foi possível abrir a Câmera USB {self.camera_id}.")
            return False

        # Configurar resolução fluida 640x480
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        self.cap.set(cv2.CAP_PROP_FPS, 30)

        logger.info("Câmera USB aberta com sucesso em 640x480 30 FPS.")
        return True

    def process_frame(self, frame: np.ndarray) -> dict:
        """Executa a inspeção da receita ativa na imagem capturada."""
        recipe_key = str(self.active_recipe_id)
        recipe = self.recipes.get(recipe_key, list(self.recipes.values())[0])

        hsv_min = recipe.get("hsv_min", [0, 50, 50])
        hsv_max = recipe.get("hsv_max", [180, 255, 255])
        roi = recipe.get("roi", [0, 0, 640, 480])

        # 1. Segmentação de Cores
        mask, _ = self.color_detector.create_hsv_mask(
            frame,
            hsv_min[0], hsv_min[1], hsv_min[2],
            hsv_max[0], hsv_max[1], hsv_max[2],
            roi_rect=roi
        )

        # 2. Detecção de Formas
        min_area = float(recipe.get("min_area", 150.0))
        self.shape_detector.min_area = min_area

        shapes = self.shape_detector.detect_shapes(mask)

        # Filtrar por área máxima se configurado
        max_area = float(recipe.get("max_area", 1000000.0))
        shapes = [s for s in shapes if s["area_px"] <= max_area]

        # Sobrescrever class_id da receita se especificado
        recipe_class_id = int(recipe.get("class_id", 1))
        for s in shapes:
            s["class_id"] = recipe_class_id

        # Offset do ROI para ajuste de coordenadas globais
        rx, ry = roi[0], roi[1]
        for s in shapes:
            s["cx_px"] += rx
            s["cy_px"] += ry
            bx, by, bw, bh = s["bounding_box"]
            s["bounding_box"] = [bx + rx, by + ry, bw, bh]

        # 3. Avaliação da Contagem
        eval_res = self.object_counter.evaluate_count(
            shapes,
            min_count=recipe.get("min_count", 1),
            max_count=recipe.get("max_count", 100)
        )

        # Peça/Alvo principal (maior área)
        main_target = shapes[0] if len(shapes) > 0 else None
        
        pos_x_mm = 0.0
        pos_y_mm = 0.0
        angle_deg = 0.0
        class_id = recipe_class_id if len(shapes) > 0 else 0
        target_found = False

        if main_target:
            target_found = True
            angle_deg = main_target["angle_deg"]
            pos_x_mm, pos_y_mm = self.calibration.pixel_to_mm(main_target["cx_px"], main_target["cy_px"])

        return {
            "target_found": target_found,
            "is_pass": eval_res["is_pass"],
            "class_id": class_id,
            "object_count": eval_res["object_count"],
            "pos_x_mm": pos_x_mm,
            "pos_y_mm": pos_y_mm,
            "angle_deg": angle_deg,
            "shapes": shapes,
            "roi": roi,
        }

    def _draw_overlay(self, frame: np.ndarray, result: dict) -> np.ndarray:
        annotated = frame.copy()
        
        # Desenhar ROI
        roi = result.get("roi", [0, 0, 640, 480])
        cv2.rectangle(annotated, (roi[0], roi[1]), (roi[0]+roi[2], roi[1]+roi[3]), (255, 255, 0), 2)
        cv2.putText(annotated, "ROI Inspeção", (roi[0], max(15, roi[1] - 5)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 1)

        # Desenhar Bounding Boxes e Alvos
        for idx, s in enumerate(result.get("shapes", [])):
            bx, by, bw, bh = s["bounding_box"]
            color = (0, 255, 0) if result["is_pass"] else (0, 0, 255)
            cv2.rectangle(annotated, (bx, by), (bx + bw, by + bh), color, 2)
            
            label = f"#{idx+1} {s['shape_name']}"
            cv2.putText(annotated, label, (bx, max(15, by - 5)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)
            
            # Centroide
            cx, cy = int(s["cx_px"]), int(s["cy_px"])
            cv2.circle(annotated, (cx, cy), 4, (0, 0, 255), -1)

        # Status Geral
        status_txt = "PASS (OK)" if result["is_pass"] else "FAIL (NOK)"
        status_col = (0, 255, 0) if result["is_pass"] else (0, 0, 255)
        cv2.putText(annotated, f"Status: {status_txt}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, status_col, 2)
        cv2.putText(annotated, f"Objetos: {result['object_count']} | Recipe: {self.active_recipe_id}", (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)

        return annotated

    def run(self):
        self.running = True
        if not self.cap and not self.init_camera():
            logger.warning("Operando em modo simulado sem câmera física.")

        logger.info("Motor de visão iniciado. Entrando no loop principal...")
        
        while self.running:
            frame = None
            if self.cap and self.cap.isOpened():
                ret, frame = self.cap.read()
                if not ret:
                    time.sleep(0.01)
                    continue
            else:
                # Gerar imagem de teste sintética
                frame = np.zeros((480, 640, 3), dtype=np.uint8)
                cv2.putText(frame, "Sem Câmera - Simulação RPi", (150, 240), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
                time.sleep(0.03)

            # 1. Ler comandos do PLC via SHM
            outputs = self.shm.get_outputs()
            trigger_cmd = outputs["trigger_cmd"]
            recipe_cmd = outputs["recipe_cmd"]

            # Atualizar receita solicitada pelo PLC
            if recipe_cmd > 0 and recipe_cmd != self.active_recipe_id:
                self.active_recipe_id = recipe_cmd
                logger.info(f"Troca de Receita acionada pelo PLC -> ID: {self.active_recipe_id}")

            # Detectar Borda de Subida no Trigger (0 -> 1)
            is_triggered = (trigger_cmd == 1 and self.last_trigger_cmd == 0)
            self.last_trigger_cmd = trigger_cmd

            # Sinalizar status Processing na SHM durante inspeção
            if is_triggered:
                self.shm.set_flag(STATUS_FLAG_PROCESSING, True)
                self.shm.set_flag(STATUS_FLAG_TRIGGER_ACK, False)

            # Executar inspeção
            res = self.process_frame(frame)

            # Desenhar Overlays para a Interface Web
            annotated_frame = self._draw_overlay(frame, res)

            with self.frame_lock:
                self.latest_frame = frame
                self.latest_annotated_frame = annotated_frame

            # 2. Atualizar Memória Compartilhada para o PROFINET C Daemon
            status_flags = STATUS_FLAG_READY
            if res["target_found"]:
                status_flags |= STATUS_FLAG_TARGET_FOUND
            if res["is_pass"]:
                status_flags |= STATUS_FLAG_PASS
            else:
                status_flags |= STATUS_FLAG_FAIL

            if is_triggered or trigger_cmd == 1:
                status_flags |= STATUS_FLAG_TRIGGER_ACK

            self.shm.update_inputs(
                status_flags=status_flags,
                class_id=res["class_id"],
                object_count=res["object_count"],
                pos_x_mm=res["pos_x_mm"],
                pos_y_mm=res["pos_y_mm"],
                angle_deg=res["angle_deg"],
                active_recipe=self.active_recipe_id
            )

            time.sleep(0.01)

    def stop(self):
        self.running = False
        if self.cap:
            self.cap.release()
        self.shm.close()

if __name__ == "__main__":
    worker = VisionWorker(camera_id=0)
    try:
        worker.run()
    except KeyboardInterrupt:
        logger.info("Encerrando motor de visão...")
        worker.stop()
