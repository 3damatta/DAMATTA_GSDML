"""
test_system.py - Suíte de Testes Automatizados para Validação Local
Testa o SHM Bridge, os Módulos de Visão, a Calibração e a API FastAPI.
"""

import sys
import os
import unittest
import ctypes
import numpy as np

# Adicionar diretórios do projeto ao path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.append(os.path.join(PROJECT_ROOT, "vision_engine"))
sys.path.append(os.path.join(PROJECT_ROOT, "web_app", "backend"))

from shm_bridge import SHMBridge, VisionProfinetSHMCtypes, STATUS_FLAG_READY, STATUS_FLAG_PASS, STATUS_FLAG_TRIGGER_ACK
from modules.calibration import CameraCalibration
from modules.color_detector import ColorDetector
from modules.shape_detector import ShapeDetector, CLASS_ID_CIRCLE, CLASS_ID_RECTANGLE, CLASS_ID_TRIANGLE
from modules.object_counter import ObjectCounter
from vision_worker import VisionWorker


class TestSHMBridge(unittest.TestCase):
    def setUp(self):
        self.shm = SHMBridge(create_if_missing=True)

    def tearDown(self):
        self.shm.close()

    def test_struct_size_and_alignment(self):
        """Valida se o tamanho exato da estrutura é 30 bytes (20B In + 6B Out + 4B Heartbeat)."""
        expected_size = 20 + 6 + 4
        actual_size = ctypes.sizeof(VisionProfinetSHMCtypes)
        self.assertEqual(actual_size, expected_size, f"Tamanho da estrutura SHM incorreto: {actual_size}B (esperado {expected_size}B)")

    def test_write_and_read_inputs(self):
        """Valida escrita e leitura de variáveis de entrada na memória compartilhada."""
        self.shm.update_inputs(
            status_flags=STATUS_FLAG_READY | STATUS_FLAG_PASS | STATUS_FLAG_TRIGGER_ACK,
            class_id=CLASS_ID_RECTANGLE,
            object_count=3,
            pos_x_mm=125.5,
            pos_y_mm=250.75,
            angle_deg=45.0,
            active_recipe=2
        )

        inp = self.shm.struct_ptr.inputs
        self.assertEqual(inp.status_flags, STATUS_FLAG_READY | STATUS_FLAG_PASS | STATUS_FLAG_TRIGGER_ACK)
        self.assertEqual(inp.class_id, CLASS_ID_RECTANGLE)
        self.assertEqual(inp.object_count, 3)
        self.assertAlmostEqual(inp.pos_x_mm, 125.5, places=2)
        self.assertAlmostEqual(inp.pos_y_mm, 250.75, places=2)
        self.assertAlmostEqual(inp.angle_deg, 45.0, places=2)
        self.assertEqual(inp.active_recipe, 2)


class TestCalibrationModule(unittest.TestCase):
    def setUp(self):
        self.calib = CameraCalibration()

    def test_linear_scale(self):
        """Valida a conversão linear de escala pixel para mm."""
        self.calib.set_scale_factor(10.0)  # 10 px = 1 mm
        mm_x, mm_y = self.calib.pixel_to_mm(100.0, 200.0)
        self.assertAlmostEqual(mm_x, 10.0, places=2)
        self.assertAlmostEqual(mm_y, 20.0, places=2)


class TestVisionModules(unittest.TestCase):
    def setUp(self):
        self.color_det = ColorDetector()
        self.shape_det = ShapeDetector(min_area=50.0)
        self.counter = ObjectCounter()

    def test_color_mask_and_eyedropper(self):
        """Valida a detecção de cor e pipeta de amostragem."""
        # Criar imagem sintética vermelha
        img_red = np.zeros((100, 100, 3), dtype=np.uint8)
        img_red[:, :] = [0, 0, 255]  # BGR Vermelho

        mask, density = self.color_det.create_hsv_mask(img_red, 0, 100, 100, 10, 255, 255)
        self.assertGreater(density, 90.0, "Densidade de cor vermelha menor do que o esperado")

        sample = self.color_det.sample_color_at_pixel(img_red, 50, 50)
        self.assertIn("hsv", sample)
        self.assertAlmostEqual(sample["rgb"][0], 255, delta=2)
        self.assertEqual(sample["rgb"][1], 0)
        self.assertEqual(sample["rgb"][2], 0)

    def test_shape_detection_synthetic_circle(self):
        """Valida a detecção de círculo sintético."""
        img = np.zeros((200, 200), dtype=np.uint8)
        import cv2
        cv2.circle(img, (100, 100), 40, 255, -1)

        shapes = self.shape_det.detect_shapes(img)
        self.assertGreaterEqual(len(shapes), 1)
        self.assertEqual(shapes[0]["class_id"], CLASS_ID_CIRCLE)
        self.assertAlmostEqual(shapes[0]["cx_px"], 100.0, delta=2.0)
        self.assertAlmostEqual(shapes[0]["cy_px"], 100.0, delta=2.0)

    def test_shape_detection_synthetic_rectangle(self):
        """Valida a detecção de retângulo sintético."""
        img = np.zeros((200, 200), dtype=np.uint8)
        import cv2
        cv2.rectangle(img, (50, 50), (150, 120), 255, -1)

        shapes = self.shape_det.detect_shapes(img)
        self.assertGreaterEqual(len(shapes), 1)
        self.assertEqual(shapes[0]["class_id"], CLASS_ID_RECTANGLE)


class TestVisionWorkerSynthetic(unittest.TestCase):
    def setUp(self):
        self.worker = VisionWorker(camera_id=-1)

    def tearDown(self):
        self.worker.stop()

    def test_synthetic_frame_processing(self):
        """Valida o processamento de um frame sintético no motor de visão."""
        img = np.zeros((480, 640, 3), dtype=np.uint8)
        res = self.worker.process_frame(img)

        self.assertIn("target_found", res)
        self.assertIn("is_pass", res)
        self.assertIn("object_count", res)


try:
    import fastapi
    HAS_FASTAPI = True
except ImportError:
    HAS_FASTAPI = False

class TestFastAPIEndpoints(unittest.TestCase):
    @unittest.skipIf(not HAS_FASTAPI, "Biblioteca FastAPI não instalada no ambiente global")
    def test_routes_exist(self):
        """Valida se os endpoints da API FastAPI estão registrados e acessíveis."""
        from main import app
        routes = [r.path for r in app.routes]
        self.assertIn("/api/status", routes)
        self.assertIn("/api/recipes", routes)
        self.assertIn("/api/stream", routes)
        self.assertIn("/api/calibrate", routes)


if __name__ == "__main__":
    unittest.main()
