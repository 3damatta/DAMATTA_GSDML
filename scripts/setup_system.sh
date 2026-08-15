#!/bin/bash
# =====================================================================
# setup_system.sh - Instalação Automatizada do DAMATTA PROFINET Vision
# Executado com: sudo ./scripts/setup_system.sh
# =====================================================================

set -e

echo "-------------------------------------------------------------"
echo " Starting Automated Installation: DAMATTA PROFINET Vision    "
echo "-------------------------------------------------------------"

# Verificar permissão de root
if [ "$EUID" -ne 0 ]; then
  echo "ERRO: Por favor, execute como root (sudo ./scripts/setup_system.sh)"
  exit 1
fi

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "Diretório do projeto: $PROJECT_DIR"

# 1. Atualizar Pacotes do Sistema e Instalar Dependências
echo "[1/5] Instalando dependências de sistema (CMake, OpenCV, V4L2)..."
apt-get update
apt-get install -y \
    cmake \
    build-essential \
    python3 \
    python3-pip \
    python3-venv \
    libopencv-dev \
    libv4l-dev \
    libcap2-bin \
    git

# 2. Criar Ambiente Virtual Python
echo "[2/5] Configurando ambiente virtual Python (venv)..."
if [ ! -d "$PROJECT_DIR/venv" ]; then
    python3 -m venv "$PROJECT_DIR/venv"
fi

"$PROJECT_DIR/venv/bin/pip" install --upgrade pip
"$PROJECT_DIR/venv/bin/pip" install -r "$PROJECT_DIR/vision_engine/requirements.txt"

# 3. Compilar a Aplicação PROFINET C
echo "[3/5] Compilando aplicação C (p-net PROFINET Daemon)..."
mkdir -p "$PROJECT_DIR/profinet_app/build"
cd "$PROJECT_DIR/profinet_app/build"
cmake ..
make -j$(nproc)

# 4. Atribuir Permissões de Rede Layer 2 ao Binário C
echo "[4/5] Aplicando permissões setcap para soquetes Ethernet Layer 2..."
if [ -f "$PROJECT_DIR/profinet_app/build/profinet_app" ]; then
    setcap cap_net_raw,cap_net_admin=eip "$PROJECT_DIR/profinet_app/build/profinet_app"
    echo "Permissões aplicadas ao executável profinet_app."
fi

# 5. Instalar e Registrar Serviço Systemd
echo "[5/5] Registrando serviço no systemd (profinet-vision.service)..."
TARGET_DIR="/opt/DAMATTA_GSDML"

if [ "$PROJECT_DIR" != "$TARGET_DIR" ]; then
    mkdir -p "$TARGET_DIR"
    cp -r "$PROJECT_DIR/"* "$TARGET_DIR/"
    PROJECT_DIR="$TARGET_DIR"
fi

cp "$PROJECT_DIR/scripts/profinet-vision.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable profinet-vision.service
systemctl restart profinet-vision.service

echo "-------------------------------------------------------------"
echo " Instalação Concluída com Sucesso!                           "
echo " Interface Web disponível em: http://<IP_DO_RASPBERRY>:8000  "
echo " Status do Serviço: systemctl status profinet-vision.service "
echo "-------------------------------------------------------------"
