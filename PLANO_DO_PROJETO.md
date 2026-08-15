# Documento de Execução: Dispositivo PROFINET com Visão Computacional e Interface Web de Configuração (Raspberry Pi + CODESYS)

---

## 1. Visão Geral e Arquitetura do Sistema

O sistema integra no Raspberry Pi uma solução completa de visão industrial autônoma com:

* **Pipeline de Visão Computacional Modular:** Módulos de reconhecimento de formas geométricas, segmentação de cores (HSV/CIELAB), contagem/clusterização de objetos e OCR/código de barras via Câmera USB (V4L2 com OpenCV).
* **Interface Web HTTP Integrada (Leve):** Painel HTML5 Vanilla + CSS + Canvas API (sem dependências pesadas de frameworks no RPi) para streaming de vídeo ao vivo, anotação visual de ROI (*Region of Interest*), ajuste de parâmetros/thresholds, calibração dimensional (pixels $\rightarrow$ mm) e gestão de receitas.
* **Ponte IPC em Memória Compartilhada:** Troca de dados ultra-rápida entre os processos Python (Web/Visão) e o binário C (Stack PROFINET).
* **PROFINET IO-Device (C / p-net):** Comunicação de campo determinística com PLC CODESYS via porta Ethernet (`eth0`).
* **Deploy em 1 Comando (Zero-Friction):** Todo o projeto é clonado do GitHub e provisionado automaticamente via script `setup_system.sh`, sem necessidade de passos manuais complexos no Raspberry Pi.

### Diagrama de Blocos da Solução

```
┌───────────────────────────────────────────────────────────┐
│                     INTERFACE WEB                         │
│   (HTML5 Vanilla + Canvas API - Visualização e ROI Editor)│
└─────────────────────────────▲─────────────────────────────┘
                              │ HTTP / WebSocket
┌─────────────────────────────▼─────────────────────────────┐
│                 BACKEND PYTHON (FastAPI)                  │
│  ├── Servidor Web & API REST                              │
│  ├── Gerenciador de Receitas (JSON/SQLite)                │
│  └── Engine de Visão (OpenCV / V4L2 USB Cam 640x480)      │
│      ├── Detecção de Cores (HSV Masks)                    │
│      ├── Detecção de Formas & Contornos                   │
│      └── Contagem & Calibração Dimensional (px -> mm)     │
└─────────────────────────────┬─────────────────────────────┘
                              │ Memória Compartilhada (POSIX SHM)
┌─────────────────────────────▼─────────────────────────────┐
│              PROFINET IO-DEVICE (C / p-net)               │
│  ├── Leitura/Escrita Cíclica de I/O                       │
│  └── Interface Ethernet Layer 2 (eth0)                    │
└─────────────────────────────┬─────────────────────────────┘
                              │ PROFINET RT (Cabo Ethernet)
┌─────────────────────────────▼─────────────────────────────┐
│                       PLC CODESYS                         │
└─────────────────────────────┴─────────────────────────────┘
```

---

## 2. Estrutura do Repositório / Entregáveis

```
DAMATTA_GSDML/
├── gsdml/
│   └── GSDML-V2.42-Custom-VisionDevice-20260814.xml
├── shm_common/
│   └── vision_ipc.h              # Layout de memória C/Python (Alinhado 1-byte)
├── web_app/
│   ├── static/                   # Frontend SPA (HTML5 Vanilla + Canvas API + CSS)
│   │   ├── index.html
│   │   ├── js/                   # app.js, canvas_roi.js, stream.js
│   │   └── css/                  # style.css
│   └── backend/                  # FastAPI + Uvicorn
│       ├── main.py               # Endpoints REST e WebSocket (Stream MJPEG 640x480)
│       ├── recipes/              # Arquivos de receita em JSON
│       └── services/             # Bridge SHM, Calibração, Autenticação
├── vision_engine/
│   ├── vision_worker.py          # Processo de inspeção em loop fechado (USB Cam)
│   ├── modules/
│   │   ├── color_detector.py     # Pipeline de segmentação de cores
│   │   ├── shape_detector.py     # Aproximação poligonal e momentos de Hu
│   │   ├── object_counter.py     # Contagem, blobs e overlap filter
│   │   └── calibration.py        # Conversão homográfica pixel -> mm
│   └── requirements.txt
├── profinet_app/
│   ├── CMakeLists.txt
│   └── src/
│       ├── main.c                # Daemon p-net
│       └── profinet_dap.c
├── config/
│   └── default_recipes.json
├── scripts/
│   ├── setup_system.sh           # Instalação automatizada completa em 1 clique
│   └── profinet-vision.service   # Configuração systemd multi-serviço
└── README.md
```

---

## 3. Funcionalidades da Interface Web HTTP

### A. Monitoramento e Calibração
* **Stream de Vídeo em Tempo Real:** Visualização fluida via WebSocket/MJPEG (Resolução padrão $640\times 480$ a 30 FPS para resposta ultra-rápida $< 25\text{ ms}$).
* **Calibração de Escala (Pixel $\rightarrow$ Milímetro):** Ferramenta de régua virtual no Canvas HTML5 ou detecção automática de marcador (ArUco / Tabuleiro) para matriz de transformação homogênea.
* **Ajuste de Câmera USB:** Controle V4L2 de exposição, ganho, balanço de branco, foco e contraste.

### B. Módulos de Treinamento / Configuração de Inspeção
* **Reconhecimento de Cores:**
  * Seletor de cores interativo na imagem (Eye Dropper / Pipeta em Canvas).
  * Geração automática de faixas de tolerância no espaço HSV/Lab.
  * Multi-filtros (% de presença de cor dentro de cada ROI).
* **Reconhecimento de Formas & Geometrias:**
  * Detecção de círculos (*Hough Transform*), polígonos (triângulos, retângulos, hexágonos via *Douglas-Peucker*) e contornos livres.
  * Cálculo de área, perímetro, circularidade, aspecto e momentos invariantes.
* **Contagem de Objetos:**
  * Segmentação por *Blob Detection* / *Watershed*.
  * Definição de regras de agregação (mínimo, máximo e limites de tolerância para alarmes ao PLC).
* **Ferramentas Úteis Industriais:**
  * **Inspeção de Presença/Ausência:** Threshold de área mínima para aprovação.
  * **OCR e Código de Barras / QR Code:** Leitura leve com `pyzbar` / OpenCV.
  * **Editor de ROI (Regiões de Interesse):** Definição visual no Canvas de múltiplas zonas vinculadas a regras específicas.

### C. Gestão de Receitas (Recipes)
* Criação, edição, exportação e importação de perfis em formato JSON.
* Seleção automática de receita controlada pelo PLC (via byte `recipe_cmd` do PROFINET) ou forçada manualmente via Web.

---

## 4. Especificação de I/O PROFINET e Memória Compartilhada

### Inputs (Visão $\rightarrow$ CODESYS | Total: 20 Bytes)

| Offset | Tipo | Nome | Descrição |
| :--- | :--- | :--- | :--- |
| **0..1** | `UINT16` | `status_flags` | Bit 0: Ready, Bit 1: Target Found, Bit 2: Pass (OK), Bit 3: Fail (NOK), Bit 4: Processing, **Bit 5: Trigger Ack** |
| **2..3** | `UINT16` | `class_id` | ID da forma/cor/classe detectada |
| **4..5** | `UINT16` | `object_count` | Quantidade total de objetos contados |
| **6..9** | `FLOAT32` | `pos_x_mm` | Posição X da peça/centroide principal (mm) |
| **10..13** | `FLOAT32` | `pos_y_mm` | Posição Y da peça/centroide principal (mm) |
| **14..17** | `FLOAT32` | `angle_deg` | Ângulo de rotação (-180.0° a +180.0°) |
| **18..19** | `UINT16` | `active_recipe` | Confirmação da receita em execução |

### Outputs (CODESYS $\rightarrow$ Visão | Total: 6 Bytes)

| Offset | Tipo | Nome | Descrição |
| :--- | :--- | :--- | :--- |
| **0** | `UINT8` | `trigger_cmd` | 1 = Disparo de captura/processamento (borda de subida) |
| **1** | `UINT8` | `recipe_cmd` | ID da receita solicitada pelo PLC |
| **2** | `UINT8` | `mode_cmd` | 0 = Modo Automático (PLC), 1 = Modo Calibração/Pausa |
| **3** | `UINT8` | `reset_fault` | 1 = Reset de alarmes e falhas |
| **4..5** | `UINT16` | `reserved` | Expansão futura |

---

## 5. Melhorias Técnicas Incorporadas ao Projeto

1. **Handshake Seguro de Trigger (Trigger Ack)**
   * Incluído o **Bit 5 (`Trigger Ack`)** em `status_flags` para evitar múltiplos acionamentos falso-positivos em ciclos rápidos do CODESYS. O Python sinaliza a recepção do disparo e confirma ao PLC quando o ciclo de visão é concluído.
2. **Empacotamento Estrito de Memória (`#pragma pack(push, 1)`)**
   * Estrutura C em `vision_ipc.h` usando alinhamento estrito de 1 byte para bater exatamente com a descompactação Python (`ctypes.Structure` / `struct.unpack`), prevenindo desalinhamentos em arquiteturas ARM (Raspberry Pi).
3. **Tratamento Transparente de Endianness**
   * Leitura e escrita na SHM convertidas explicitamente entre *Little-Endian* (Raspberry Pi ARM) e *Big-Endian* (PROFINET Network Byte Order) para tipos `UINT16` e `FLOAT32` (IEEE 754).
4. **Interface Web Leve (Zero Build Step)**
   * Frontend em HTML5 Vanilla + CSS puro + Canvas API nativa do navegador, garantindo baixíssimo consumo de RAM/CPU no Raspberry Pi e eliminação de processos de compilação complexos (Node/npm).

---

## 6. Procedimento de Instalação e Deploy Automático (1 Comando)

Toda a instalação no Raspberry Pi é realizada clonando o repositório e executando o script automatizado:

```bash
# 1. Clonar o repositório do GitHub no Raspberry Pi
git clone https://github.com/SEU_USUARIO/DAMATTA_GSDML.git
cd DAMATTA_GSDML

# 2. Executar o script de instalação (instala pacotes, compila o C, cria o venv Python e registra o serviço systemd)
sudo chmod +x scripts/setup_system.sh
sudo ./scripts/setup_system.sh
```

### O que o `setup_system.sh` faz automaticamente:
* Instala as dependências de sistema (`cmake`, `build-essential`, `python3-pip`, `python3-venv`, `libopencv-dev`, `libv4l-dev`).
* Cria o ambiente virtual Python (`venv`) e instala os pacotes (`fastapi`, `uvicorn`, `opencv-python-headless`, `numpy`, `pyzbar`).
* Compila a aplicação C (`profinet_app`) via CMake com a stack `p-net`.
* Aplica permissões de acesso de baixo nível à placa Ethernet sem precisar rodar como root total (`setcap cap_net_raw,cap_net_admin=eip bin/profinet_app`).
* Registra e ativa o serviço `profinet-vision.service` no `systemd` para inicialização automática no boot do Raspberry Pi.

---

## 7. Fases de Execução e Implementação

* **Fase 1: Arquitetura IPC & Estruturas de Dados**
  * Criar `shm_common/vision_ipc.h` contendo o cabeçalho C com alinhamento de 1 byte, variáveis I/O PROFINET, semáforo POSIX e buffer atômico.
  * Criar wrapper Python utilizando `multiprocessing.shared_memory` ou `posix_ipc` para escrita/leitura sem bloqueio.

* **Fase 2: Backend e Interface Web HTTP Leve**
  * Backend (FastAPI): Endpoint de streaming `/api/stream` (MJPEG em 640x480), endpoints CRUD de receitas `/api/recipes`, endpoint de calibração dimensional `/api/calibrate`.
  * Frontend (HTML5 Vanilla + Canvas API): Editor visual de ROIs, sliders de threshold HSV e visualização fluida de diagnóstico em tempo real.

* **Fase 3: Motores de Visão Computacional (Python Modules)**
  * *Captura USB:* Pipeline OpenCV V4L2 em thread dedicada.
  * *Shape Module:* Implementar `cv2.findContours`, `cv2.approxPolyDP` e cálculo de momentos.
  * *Color Module:* Implementar pipeline com conversão `cv2.COLOR_BGR2HSV`, máscaras `inRange` e densidade de cor.
  * *Count & Filter Module:* Segmentação por tamanho de área para rejeição de ruídos.
  * *Lógica de Triggering:* Thread dedicada com Handshake Ack monitorando SHM e concluindo a inspeção em $< 25\text{ ms}$.

* **Fase 4: Integração PROFINET C (p-net) e GSDML**
  * Configurar os slots na aplicação C da p-net (20 Bytes In / 6 Bytes Out).
  * Criar descritor XML GSDML v2.42 parametrizando subslots e tipos de dados.
  * Configurar permissões de rede com `setcap cap_net_raw,cap_net_admin=eip`.

* **Fase 5: Script de Instalação e Testes em Campo (CODESYS)**
  * Implementar `scripts/setup_system.sh` e `scripts/profinet-vision.service`.
  * Instalação do arquivo GSDML no CODESYS Device Repository.
  * Atribuição de IP e Name of Station via DCP.
  * Testes integrados de disparo, receitas e calibração web.