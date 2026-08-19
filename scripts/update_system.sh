#!/bin/bash
# ==============================================================================
# update_system.sh - Script de Atualização Completa do DAMATTA Vision System
# Atualiza o código no repositório local e na pasta do serviço systemd (/opt/DAMATTA_GSDML)
# ==============================================================================

set -e

echo "=========================================================="
echo "   Iniciando Atualizacao do DAMATTA Vision System (RPi)  "
echo "=========================================================="

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

echo "[1/6] Baixando ultimas alteracoes do GitHub..."
git fetch origin main
git reset --hard origin/main

TARGET_DIR="/opt/DAMATTA_GSDML"

# Se o sistema estiver instalado em /opt/DAMATTA_GSDML, sincroniza os arquivos novos
if [ -d "$TARGET_DIR" ] && [ "$REPO_DIR" != "$TARGET_DIR" ]; then
    echo "[2/6] Sincronizando arquivos novos para $TARGET_DIR..."
    sudo cp -r "$REPO_DIR/"* "$TARGET_DIR/" 2>/dev/null || true
    cd "$TARGET_DIR"
fi

echo "[3/6] Liberando porta 8000 e encerrando processos antigos..."
sudo fuser -k 8000/tcp || true
sudo pkill -f "main.py" || true
sudo pkill -f "profinet_app" || true
sudo pkill -f "vision_worker.py" || true
sleep 1

echo "[4/6] Limpando cache de bytecode do Python..."
find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true

echo "[5/6] Compilando Daemon PROFINET C (profinet_app)..."
mkdir -p profinet_app/build
cd profinet_app/build
cmake ..
make -j$(nproc)
sudo setcap cap_net_raw,cap_net_admin=eip profinet_app || true
cd "$TARGET_DIR" 2>/dev/null || cd "$REPO_DIR"

echo "[6/6] Verificando e Reiniciando Servico Systemd (profinet-vision.service)..."
if [ ! -d "venv" ]; then
    echo "Criando ambiente virtual venv..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r vision_engine/requirements.txt fastapi uvicorn pydantic
fi

if systemctl is-active --quiet profinet-vision.service 2>/dev/null || [ -f "/etc/systemd/system/profinet-vision.service" ]; then
    sudo systemctl restart profinet-vision.service
    echo "Servico systemd profinet-vision.service reiniciado permanentemente!"
else
    nohup ./profinet_app/build/profinet_app > /dev/null 2>&1 &
    nohup venv/bin/python3 web_app/backend/main.py > /dev/null 2>&1 &
    echo "Servidor Web HMI iniciado em background com venv!"
fi

echo "=========================================================="
echo "   ATUALIZACAO CONCLUIDA E PERSISTIDA NO REBOOT!          "
echo "   Acesse: http://$(hostname -I | awk '{print $1}'):8000  "
echo "=========================================================="
