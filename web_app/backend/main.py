"""
main.py - Servidor Backend FastAPI da Interface Web HTTP
Servidor REST, Streaming MJPEG, Diagnóstico PROFINET, Calibração de Escala, Configuração de Rede e Atualização Automática via GitHub.
"""

import sys
import os
import cv2
import json
import time
import socket
import subprocess
import logging
from fastapi import FastAPI, HTTPException, Response
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Adicionar diretório pai ao sys.path para importar vision_worker e shm_bridge
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "vision_engine")))

from vision_worker import VisionWorker

logger = logging.getLogger("WebBackend")

app = FastAPI(title="PROFINET Vision System RPi", version="2.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Instância única do motor de visão (contém a ponte SHM interna)
vision_worker = VisionWorker(camera_id=0)

# Diretórios estáticos e arquivos de configuração
STATIC_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "static"))
RECIPES_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "config", "default_recipes.json"))
REPO_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

class RecipeModel(BaseModel):
    id: str
    name: str
    description: str = ""
    class_id: int = 1
    hsv_min: list
    hsv_max: list
    min_area: float = 100.0
    max_area: float = 50000.0
    min_count: int = 1
    max_count: int = 100
    expected_shape: str = "any"
    roi: list

class ScaleCalibrationModel(BaseModel):
    px_per_mm: float

class DistanceCalibrationModel(BaseModel):
    pixel_distance: float
    real_distance_mm: float

class NetworkConfigModel(BaseModel):
    ip_address: str
    subnet_mask: str = "255.255.255.0"
    gateway: str = "192.168.0.1"

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
    """Retorna o estado das variáveis da Memória Compartilhada (SHM) e PROFINET diretamente do VisionWorker."""
    shm = vision_worker.shm
    outputs = shm.get_outputs()
    inputs = shm.struct_ptr.inputs

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
        "heartbeat": shm.struct_ptr.heartbeat_counter,
        "calibration": {
            "px_per_mm": vision_worker.calibration.px_per_mm_scale
        }
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

@app.delete("/api/recipes/{recipe_id}")
async def delete_recipe(recipe_id: str):
    """Exclui uma receita pelo ID."""
    if recipe_id in vision_worker.recipes:
        del vision_worker.recipes[recipe_id]
        try:
            with open(RECIPES_FILE, "w", encoding="utf-8") as f:
                json.dump(vision_worker.recipes, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Erro ao atualizar receitas após exclusão: {e}")
        return {"status": "success", "deleted_id": recipe_id}
    raise HTTPException(status_code=404, detail="Receita não encontrada")

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

@app.post("/api/calibrate/distance")
async def calibrate_from_distance(data: DistanceCalibrationModel):
    """Calcula e atualiza o fator de escala a partir da medição de uma distância conhecida."""
    if data.pixel_distance > 0 and data.real_distance_mm > 0:
        px_per_mm = data.pixel_distance / data.real_distance_mm
        vision_worker.calibration.set_scale_factor(px_per_mm)
        return {
            "status": "success",
            "pixel_distance": data.pixel_distance,
            "real_distance_mm": data.real_distance_mm,
            "px_per_mm": round(px_per_mm, 4)
        }
    raise HTTPException(status_code=400, detail="Valores de distância inválidos")

@app.get("/api/network")
async def get_network_config():
    """Retorna as configurações de IP atuais da interface de rede."""
    hostname = socket.gethostname()
    ip_addr = "192.168.0.231"
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip_addr = s.getsockname()[0]
        s.close()
    except Exception:
        pass

    return {
        "hostname": hostname,
        "ip_address": ip_addr,
        "subnet_mask": "255.255.255.0",
        "gateway": "192.168.0.1",
        "profinet_station_name": "rpi-vision-device"
    }

@app.post("/api/network")
async def set_network_config(config: NetworkConfigModel):
    """Salva e simula a alteração de endereço IP do Raspberry Pi."""
    logger.info(f"Nova configuração de rede recebida: IP={config.ip_address}, Mask={config.subnet_mask}, GW={config.gateway}")
    return {
        "status": "success",
        "message": f"Endereço IP atualizado para {config.ip_address}. Reiniciando interface...",
        "config": config.dict()
    }

@app.get("/api/system/update-check")
async def check_github_updates():
    """Verifica se existem novos commits no repositório GitHub remoto."""
    try:
        subprocess.run(["git", "fetch"], cwd=REPO_DIR, check=True, capture_output=True, text=True)
        res = subprocess.run(["git", "status", "-uno"], cwd=REPO_DIR, check=True, capture_output=True, text=True)
        output = res.stdout
        
        has_updates = "behind" in output.lower() or "atrás" in output.lower()
        return {
            "status": "success",
            "has_updates": has_updates,
            "message": "Novas atualizações disponíveis no GitHub!" if has_updates else "Sistema atualizado."
        }
    except Exception as e:
        logger.error(f"Erro ao verificar atualizações do Git: {e}")
        return {"status": "error", "has_updates": False, "message": str(e)}

@app.post("/api/system/update")
async def perform_github_update():
    """Executa o git pull origin main e recarrega os arquivos do sistema."""
    try:
        res = subprocess.run(["git", "pull", "origin", "main"], cwd=REPO_DIR, check=True, capture_output=True, text=True)
        logger.info(f"Git pull executado com sucesso: {res.stdout}")
        
        # Reload recipes from disk
        vision_worker.recipes = vision_worker._load_recipes()
        
        return {
            "status": "success",
            "message": "Sistema atualizado com sucesso a partir do GitHub!",
            "output": res.stdout
        }
    except Exception as e:
        logger.error(f"Erro ao executar git pull: {e}")
        raise HTTPException(status_code=500, detail=f"Erro na atualização do Git: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
