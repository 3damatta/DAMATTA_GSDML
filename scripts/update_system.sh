#!/bin/bash
# ==============================================================================
# update_system.sh - Script de Atualização Completa do DAMATTA Vision System
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

echo "[2/6] Liberando porta 8000 e encerrando processos antigos..."
sudo fuser -k 8000/tcp || true
pkill -f "main.py" || true
pkill -f "profinet_app" || true
pkill -f "vision_worker.py" || true
sleep 1

echo "[3/6] Limpando cache de bytecode do Python..."
find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true

echo "[4/6] Compilando Daemon PROFINET C (profinet_app)..."
mkdir -p profinet_app/build
cd profinet_app/build
cmake ..
make -j$(nproc)
sudo setcap cap_net_raw,cap_net_admin=eip profinet_app || true
cd "$REPO_DIR"

echo "[5/6] Verificando Ambiente Virtual Python (venv)..."
if [ ! -d "venv" ]; then
    echo "Criando ambiente virtual venv..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r vision_engine/requirements.txt fastapi uvicorn pydantic
else
    source venv/bin/activate
fi

echo "[6/6] Reiniciando Daemon PROFINET C e Servidor Web HMI..."
nohup ./profinet_app/build/profinet_app > /dev/null 2>&1 &
nohup venv/bin/python3 web_app/backend/main.py > /dev/null 2>&1 &

echo "=========================================================="
echo "   ATUALIZACAO CONCLUIDA COM SUCESSO!                     "
echo "   Daemon PROFINET C & Web HMI ativos em 172.20.10.22    "
echo "=========================================================="
