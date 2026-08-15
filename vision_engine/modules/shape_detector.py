"""
shape_detector.py - Módulo de Reconhecimento de Formas Geométricas e Geometria
Classifica contornos (Círculo, Retângulo, Triângulo, Polígono) e extrai posição X, Y e Ângulo.
"""

import cv2
import numpy as np
import math

CLASS_ID_UNKNOWN   = 0
CLASS_ID_CIRCLE    = 1
CLASS_ID_RECTANGLE = 2
CLASS_ID_TRIANGLE  = 3
CLASS_ID_POLYGON   = 4

class ShapeDetector:
    def __init__(self, min_area: float = 100.0):
        self.min_area = min_area

    def detect_shapes(self, mask_or_gray: np.ndarray) -> list:
        """
        Detecta contornos na imagem/máscara binária e retorna lista de objetos detectados:
        [
            {
                "class_id": int,
                "shape_name": str,
                "cx_px": float, "cy_px": float,
                "angle_deg": float,
                "area_px": float,
                "perimeter_px": float,
                "circularity": float,
                "contour": np.ndarray,
                "bounding_box": [x, y, w, h]
            }, ...
        ]
        """
        results = []
        if mask_or_gray is None:
            return results

        contours, _ = cv2.findContours(mask_or_gray, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < self.min_area:
                continue

            perimeter = cv2.arcLength(cnt, True)
            if perimeter == 0:
                continue

            circularity = (4.0 * math.pi * area) / (perimeter * perimeter)

            # Cálculo do Centroide via Momentos
            M = cv2.moments(cnt)
            if M["m00"] != 0:
                cx = M["m10"] / M["m00"]
                cy = M["m01"] / M["m00"]
            else:
                continue

            # Aproximação Poligonal
            approx = cv2.approxPolyDP(cnt, 0.03 * perimeter, True)
            num_vertices = len(approx)

            # Cálculo de Orientação / Ângulo via minAreaRect
            rect = cv2.minAreaRect(cnt)
            (rx, ry), (rw, rh), angle = rect
            
            # Normaliza o ângulo no intervalo [-180, 180]
            if rw < rh:
                angle = angle - 90.0

            # Classificação
            if circularity > 0.78 or num_vertices > 8:
                class_id = CLASS_ID_CIRCLE
                shape_name = "Circle"
            elif num_vertices == 3:
                class_id = CLASS_ID_TRIANGLE
                shape_name = "Triangle"
            elif num_vertices == 4:
                class_id = CLASS_ID_RECTANGLE
                shape_name = "Rectangle"
            else:
                class_id = CLASS_ID_POLYGON
                shape_name = "Polygon"

            bx, by, bw, bh = cv2.boundingRect(cnt)

            results.append({
                "class_id": class_id,
                "shape_name": shape_name,
                "cx_px": float(cx),
                "cy_px": float(cy),
                "angle_deg": float(angle),
                "area_px": float(area),
                "perimeter_px": float(perimeter),
                "circularity": float(circularity),
                "contour": cnt,
                "bounding_box": [int(bx), int(by), int(bw), int(bh)],
            })

        # Ordenar por maior área primeiro
        results.sort(key=lambda item: item["area_px"], reverse=True)
        return results
