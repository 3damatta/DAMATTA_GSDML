"""
object_counter.py - Módulo de Contagem e Filtragem de Objetos (Blobs)
"""

class ObjectCounter:
    def __init__(self):
        pass

    def evaluate_count(self, detected_objects: list, min_count: int = 1, max_count: int = 100) -> dict:
        """
        Avalia a contagem total de objetos e determina o status de inspeção (PASS/FAIL).
        """
        count = len(detected_objects)
        is_pass = (min_count <= count <= max_count)

        return {
            "object_count": count,
            "min_count": min_count,
            "max_count": max_count,
            "is_pass": is_pass,
        }
