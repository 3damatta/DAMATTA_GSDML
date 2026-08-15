"""
calibration.py - Módulo de Calibração Dimensional (Pixel -> Milímetro)
Calcula a matriz de transformação perspectiva/homográfica para conversão de coordenadas.
"""

import cv2
import numpy as np
import logging

logger = logging.getLogger("CalibrationModule")

class CameraCalibration:
    def __init__(self):
        # Matriz 3x3 de Homografia (padrão identidade = 1 px : 1 mm)
        self.homography_matrix = np.eye(3, dtype=np.float32)
        self.px_per_mm_scale = 1.0
        self.is_calibrated = False

    def set_scale_factor(self, px_per_mm: float):
        """Define escala linear simples (pixels por milímetro)."""
        if px_per_mm > 0:
            self.px_per_mm_scale = px_per_mm
            self.homography_matrix = np.diag([1.0 / px_per_mm, 1.0 / px_per_mm, 1.0]).astype(np.float32)
            self.is_calibrated = True

    def calibrate_from_points(self, src_pts_px: list, dst_pts_mm: list) -> bool:
        """
        Calcula a matriz de homografia usando 4 ou mais pontos correspondentes (pixels -> mm).
        src_pts_px: [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] na imagem em pixels
        dst_pts_mm: [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] em milímetros no mundo real
        """
        try:
            src = np.array(src_pts_px, dtype=np.float32)
            dst = np.array(dst_pts_mm, dtype=np.float32)
            if len(src) >= 4 and len(dst) >= 4:
                H, _ = cv2.findHomography(src, dst)
                if H is not None:
                    self.homography_matrix = H
                    self.is_calibrated = True
                    logger.info("Matriz de Homografia calculada com sucesso.")
                    return True
        except Exception as e:
            logger.error(f"Erro no cálculo de calibração: {e}")
        return False

    def pixel_to_mm(self, px_x: float, px_y: float) -> tuple:
        """Converte uma coordenada de imagem (px_x, px_y) em milímetros no mundo real (mm_x, mm_y)."""
        pt = np.array([px_x, px_y, 1.0], dtype=np.float32)
        res = np.dot(self.homography_matrix, pt)
        if res[2] != 0:
            return float(res[0] / res[2]), float(res[1] / res[2])
        return float(px_x / self.px_per_mm_scale), float(px_y / self.px_per_mm_scale)
