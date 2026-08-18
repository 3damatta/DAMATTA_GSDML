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

echo "[1/5] Baixando ultimas alteracoes do GitHub..."
git fetch origin main
git reset --hard origin/main

echo "[2/5] Liberando porta 8000 e encerrando processos antigos..."
sudo fuser -k 8000/tcp || true
pkill -f "main.py" || true
pkill -f "vision_worker.py" || true
sleep 1

echo "[3/5] Limpando cache de bytecode do Python..."
find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true

echo "[4/5] Verificando Ambiente Virtual Python (venv)..."
if [ ! -d "venv" ]; then
    echo "Criando ambiente virtual venv..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r vision_engine/requirements.txt fastapi uvicorn pydantic
else
    source venv/bin/activate
fi

echo "[5/5] Reiniciando Servidor Web HMI..."
if systemctl is-active --quiet profinet-vision.service 2>/dev/null; then
    sudo systemctl restart profinet-vision.service
    echo "Servico systemd profinet-vision.service reiniciado!"
else
    nohup venv/bin/python3 web_app/backend/main.py > /dev/null 2>&1 &
    echo "Servidor Web HMI iniciado com venv/bin/python3 na porta 8000!"
fi

echo "=========================================================="
echo "   ATUALIZACAO CONCLUIDA COM SUCESSO!                     "
echo "   Acesse: http://$(hostname -I | awk '{print $1}'):8000  "
echo "   (Pressione Ctrl + F5 no navegador para limpar o cache) "
echo "=========================================================="
