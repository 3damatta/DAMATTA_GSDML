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

echo "[1/4] Baixando ultimas alteracoes do GitHub..."
git fetch origin main
git reset --hard origin/main

echo "[2/4] Limpando cache de bytecode do Python..."
find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true

echo "[3/4] Atualizando permissoes de execucao..."
chmod +x scripts/*.sh

echo "[4/4] Reiniciando servicos de visao e web (Systemd)..."
if systemctl is-active --quiet profinet-vision.service 2>/dev/null; then
    sudo systemctl restart profinet-vision.service
    echo "Servico profinet-vision.service reiniciado com sucesso!"
else
    echo "Servico systemd nao ativo. Reiniciando processos python em background..."
    pkill -f "main.py" || true
    pkill -f "vision_worker.py" || true
    sleep 1
    if [ -d "venv" ]; then
        source venv/bin/activate
    fi
    python3 web_app/backend/main.py > /dev/null 2>&1 &
    echo "Servidor Web HMI reiniciado em background!"
fi

echo "=========================================================="
echo "   ATUALIZACAO CONCLUIDA COM SUCESSO!                     "
echo "   Acesse: http://$(hostname -I | awk '{print $1}'):8000  "
echo "   (Pressione Ctrl + F5 no navegador para limpar o cache) "
echo "=========================================================="
