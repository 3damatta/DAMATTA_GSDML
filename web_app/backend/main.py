"""
main.py - Servidor Backend FastAPI da Interface Web HTTP
Servidor REST, Streaming MJPEG e Diagnóstico PROFINET em tempo real.
"""

import sys
import os
import cv2
import json
import time
import asyncio
import logging
from fastapi import FastAPI, HTTPException, Response
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Adicionar diretório pai ao sys.path para importar vision_worker e shm_bridge
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "vision_engine")))

from shm_bridge import SHMBridge
from vision_worker import VisionWorker

logger = logging.getLogger("WebBackend")

app = FastAPI(title="PROFINET Vision System RPi", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Instâncias dos serviços
vision_worker = VisionWorker(camera_id=0)
shm_bridge = SHMBridge(create_if_missing=True)

# Diretórios estáticos
STATIC_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "static"))
RECIPES_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "config", "default_recipes.json"))

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

class RecipeModel(BaseModel):
    id: str
    name: str
    description: str = ""
    hsv_min: list
    hsv_max: list
    min_count: int = 1
    max_count: int = 100
    roi: list

class ScaleCalibrationModel(BaseModel):
    px_per_mm: float

@app.on_event("startup")
async def startup_event():
    logger.info("Iniciando serviço de background do motor de visão...")
    import threading
    worker_thread = threading.Thread(target=vision_worker.run, daemon=True)
    worker_thread.start()

@app.get("/")
async def get_index():
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "PROFINET Vision API em execução. Frontend estático não localizado."}

def generate_mjpeg_stream():
    """Gerador de stream de vídeo MJPEG em tempo real."""
    while True:
        frame = vision_worker.latest_annotated_frame
        if frame is not None:
            ret, buffer = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
            if ret:
                frame_bytes = buffer.tobytes()
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        time.sleep(0.033)  # ~30 FPS

@app.get("/api/stream")
async def video_feed():
    """Endpoint de streaming MJPEG de vídeo."""
    return StreamingResponse(generate_mjpeg_stream(), media_type="multipart/x-mixed-replace; boundary=frame")

@app.get("/api/status")
async def get_system_status():
    """Retorna o estado das variáveis da Memória Compartilhada (SHM) e PROFINET."""
    outputs = shm_bridge.get_outputs()
    inputs = shm_bridge.struct_ptr.inputs

    return {
        "inputs_profinet": {
            "status_flags": inputs.status_flags,
            "class_id": inputs.class_id,
            "object_count": inputs.object_count,
            "pos_x_mm": round(inputs.pos_x_mm, 2),
            "pos_y_mm": round(inputs.pos_y_mm, 2),
            "angle_deg": round(inputs.angle_deg, 2),
            "active_recipe": inputs.active_recipe,
        },
        "outputs_profinet": outputs,
        "heartbeat": shm_bridge.struct_ptr.heartbeat_counter,
    }

@app.get("/api/recipes")
async def get_recipes():
    """Retorna a lista de todas as receitas salvas."""
    return vision_worker.recipes

@app.post("/api/recipes")
async def save_recipe(recipe: RecipeModel):
    """Cria ou atualiza uma receita de inspeção."""
    vision_worker.recipes[recipe.id] = recipe.dict()
    try:
        with open(RECIPES_FILE, "w", encoding="utf-8") as f:
            json.dump(vision_worker.recipes, f, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Erro ao salvar arquivo de receita: {e}")
    return {"status": "success", "recipe_id": recipe.id}

@app.post("/api/recipes/select/{recipe_id}")
async def select_recipe(recipe_id: int):
    """Seleciona manualmente a receita ativa."""
    if str(recipe_id) in vision_worker.recipes:
        vision_worker.active_recipe_id = recipe_id
        return {"status": "success", "active_recipe_id": recipe_id}
    raise HTTPException(status_code=404, detail="Receita não encontrada")

@app.post("/api/calibrate")
async def calibrate_scale(data: ScaleCalibrationModel):
    """Atualiza o fator de escala de calibração dimensional (px/mm)."""
    if data.px_per_mm > 0:
        vision_worker.calibration.set_scale_factor(data.px_per_mm)
        return {"status": "success", "px_per_mm": data.px_per_mm}
    raise HTTPException(status_code=400, detail="Fator de escala inválido")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
