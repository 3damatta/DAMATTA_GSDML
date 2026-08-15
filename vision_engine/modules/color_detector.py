"""
color_detector.py - Módulo de Segmentação e Reconhecimento de Cores (HSV / CIELAB)
"""

import cv2
import numpy as np

class ColorDetector:
    def __init__(self):
        pass

    def create_hsv_mask(
        self,
        frame: np.ndarray,
        h_min: int, s_min: int, v_min: int,
        h_max: int, s_max: int, v_max: int,
        roi_rect: list = None
    ) -> tuple:
        """
        Gera uma máscara binária no espaço de cores HSV.
        Retorna (mask, percent_density).
        """
        if frame is None:
            return None, 0.0

        # Se houver ROI especificada: [x, y, w, h]
        if roi_rect and len(roi_rect) == 4:
            rx, ry, rw, rh = roi_rect
            h_img, w_img = frame.shape[:2]
            rx = max(0, min(rx, w_img - 1))
            ry = max(0, min(ry, h_img - 1))
            rw = max(1, min(rw, w_img - rx))
            rh = max(1, min(rh, h_img - ry))
            cropped = frame[ry:ry+rh, rx:rx+rw]
        else:
            cropped = frame

        hsv = cv2.cvtColor(cropped, cv2.COLOR_BGR2HSV)
        lower = np.array([h_min, s_min, v_min], dtype=np.uint8)
        upper = np.array([h_max, s_max, v_max], dtype=np.uint8)

        mask = cv2.inRange(hsv, lower, upper)
        
        # Filtros de ruído morfológico
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

        total_pixels = mask.size
        count_white = cv2.countNonZero(mask)
        density = (count_white / total_pixels) * 100.0 if total_pixels > 0 else 0.0

        return mask, density

    @staticmethod
    def sample_color_at_pixel(frame: np.ndarray, px_x: int, px_y: int, radius: int = 3) -> dict:
        """Amostra a cor HSV e RGB em torno de um ponto (Pipeta / Eye Dropper)."""
        if frame is None:
            return {}
        
        h_img, w_img = frame.shape[:2]
        x1 = max(0, px_x - radius)
        x2 = min(w_img, px_x + radius + 1)
        y1 = max(0, px_y - radius)
        y2 = min(h_img, px_y + radius + 1)

        patch = frame[y1:y2, x1:x2]
        if patch.size == 0:
            return {}

        bgr_mean = cv2.mean(patch)[:3]
        bgr_patch = np.uint8([[bgr_mean]])
        hsv_mean = cv2.cvtColor(bgr_patch, cv2.COLOR_BGR2HSV)[0][0]

        return {
            "hsv": [int(hsv_mean[0]), int(hsv_mean[1]), int(hsv_mean[2])],
            "bgr": [int(bgr_mean[0]), int(bgr_mean[1]), int(bgr_mean[2])],
            "rgb": [int(bgr_mean[2]), int(bgr_mean[1]), int(bgr_mean[0])],
        }
