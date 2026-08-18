# DAMATTA Vision Device - Sistema de Visão Industrial PROFINET IO

[![PROFINET IO-Device](https://img.shields.io/badge/PROFINET-IO--Device-blue.svg)](https://www.profibus.com)
[![CODESYS V3.5 / MasterTool](https://img.shields.io/badge/CODESYS-v3.5%20%7C%20MT8500-orange.svg)](https://www.altus.com.br)
[![Raspberry Pi](https://img.shields.io/badge/Hardware-Raspberry%20Pi-red.svg)](https://www.raspberrypi.com)
[![OpenCV / FastAPI](https://img.shields.io/badge/Software-OpenCV%20%7C%20FastAPI-green.svg)](https://fastapi.tiangolo.com)

Sistema de visão computacional industrial integrado a rede **PROFINET RT (Real-Time)** para Raspberry Pi, desenvolvido para comunicação nativa com CLPs da linha **Altus Nexto (NX325 / XP325)** e controladores **CODESYS V3.5 / MasterTool IEC XE**.

---

## 🌟 Recursos Principais

- **Comunicação PROFINET RT Nascida para Automação:** Transmissão determinística via pilha `p-net` em C com suporte a **20 Bytes de Entrada** (Status, Classe, Contagem, Posição X/Y mm, Ângulo e Receita Ativa) e **6 Bytes de Saída** (Trigger, Receita, Modo e Reset de Falha).
- **Processamento de Visão em Tempo Real:** Captura contínua de câmeras USB (V4L2) a 640x480 @ 30 FPS via OpenCV, com calibração de escala pixel-para-milímetro.
- **Detecção de Cores e Formas Geométricas:** Classificação por cor (Vermelho, Verde, Azul) e forma (Círculo, Retângulo, Triângulo, Polígono) com cálculo de centroide e orientação.
- **Interface Web HMI Industrial (HTML5 / Canvas):** Dashboard em tempo real na porta `8000` para calibração interativa de cursores HSV, edição visual de ROI (Region of Interest) e visualização de streaming MJPEG.
- **Descritor GSDML Totalmente Homologado XSD:** Arquivo `GSDML-V2.31-DAMATTA-VisionDevice-20260814.xml` validado perante a norma ISO 15745-4 (incluindo `TimingProperties`, `MAUTypes=16` e `SupportedMIB2_Groups`).
- **Programa ST para Contagem de Peças Vermelhas:** Exemplo completo em Texto Estruturado (ST) pronto para copiar e rodar no MasterTool IEC XE com lógica de *handshake* e contagem acumulada.

---

## 📁 Estrutura do Repositório

```text
DAMATTA_GSDML/
├── gsdml/                                # Arquivos Descritores PROFINET IO (GSDML XML)
│   ├── GSDML-V2.31-DAMATTA-VisionDevice-20260814.xml # Versão GSDML V2.31 Oficial
│   ├── GSDML-V2.3-DAMATTA-VisionDevice-20260814.xml  # Versão GSDML V2.3 Compatível
│   └── GSDML-V2.42-Custom-VisionDevice-20260814.xml# Versão GSDML V2.42 Custom
├── profinet_app/                         # Daemon PROFINET RT em C (p-net)
│   ├── CMakeLists.txt
│   └── src/main.c
├── shm_common/                           # Cabeçalhos IPC de Memória Compartilhada
│   └── vision_ipc.h                      # Structs alinhadas de 20B In / 6B Out
├── vision_engine/                        # Motor de Visão Computacional (Python / OpenCV)
│   ├── modules/                          # Módulos de Calibração, Cores, Formas e Contagem
│   ├── shm_bridge.py                     # Ponte Ctypes/Mmap com a SHM
│   ├── vision_worker.py                  # Loop principal da câmera V4L2
│   └── requirements.txt
├── web_app/                              # Interface Web HMI (FastAPI + HTML5 Canvas)
│   ├── backend/main.py
│   └── static/                           # index.html, style.css, app.js
├── scripts/                              # Scripts de Instalação e Serviços Systemd
│   ├── setup_system.sh                   # Script de implantação em 1 comando
│   └── profinet-vision.service
├── TUTORIAL_MASTERTOOL_NEXUS325.md       # Guia Passo a Passo no MasterTool IEC XE
├── TUTORIAL.md                           # Tutorial Geral de Uso e Arquitetura
├── PLANO_DO_PROJETO.md                   # Plano Arquitetural e Requisitos
└── README.md                             # Documentação Principal
```

---

## 🗺️ Arquitetura de Comunicação PROFINET E/S

### Módulo de Entradas (Slot 1: `Vision Inputs 20B` - Visão $\rightarrow$ CLP)
| Byte Offset | Tipo de Dado | Nome da Variável no PLC | Descrição |
| :--- | :--- | :--- | :--- |
| `%IW0` | `UINT` | `g_StatusFlags` | Bit 0: Ready, Bit 1: Error, Bit 5: Trigger Ack |
| `%IW2` | `UINT` | `g_ClassID` | ID da Classe (1 = Peça Vermelha, 2 = Verde, 3 = Azul) |
| `%IW4` | `UINT` | `g_ObjectCount` | Contagem total de objetos detectados na foto |
| `%ID6` | `REAL` | `g_PosX_mm` | Posição X do objeto principal em milímetros |
| `%ID10` | `REAL` | `g_PosY_mm` | Posição Y do objeto principal em milímetros |
| `%ID14` | `REAL` | `g_Angle_deg` | Ângulo de rotação da peça em graus (-180° a +180°) |
| `%IW18` | `UINT` | `g_ActiveRecipe` | ID da receita ativa no Raspberry Pi |

### Módulo de Saídas (Slot 2: `Vision Outputs 6B` - CLP $\rightarrow$ Visão)
| Byte Offset | Tipo de Dado | Nome da Variável no PLC | Descrição |
| :--- | :--- | :--- | :--- |
| `%QB0` | `BYTE` | `g_TriggerCmd` | Comando de disparo de foto (1 = Capturar foto) |
| `%QB1` | `BYTE` | `g_RecipeCmd` | ID da receita a ser carregada pelo Raspberry Pi |
| `%QB2` | `BYTE` | `g_ModeCmd` | Modo de operação (0 = Automático, 1 = Calibração) |
| `%QB3` | `BYTE` | `g_ResetFault` | Reset de alarmes/falhas |
| `%QW4` | `WORD` | `g_Reserved` | Reservado para expansão futura |

---

## ⚡ Instalação e Execução no Raspberry Pi

Para instalar todo o sistema no Raspberry Pi com **apenas 1 comando**:

```bash
git clone https://github.com/3damatta/DAMATTA_GSDML.git
cd DAMATTA_GSDML
chmod +x scripts/setup_system.sh
./scripts/setup_system.sh
```

Acesse a interface de calibração no navegador:
`http://<IP_DO_RASPBERRY>:8000` (Exemplo: `http://192.168.0.231:8000`)

---

## 🏭 Configuração no MasterTool IEC XE (Altus Nexto NX325 / XP325)

### Hierarquia da Árvore de Dispositivos:
```text
Configuration (Config)
  └── XP325 / NX325 (CPU)
        └── NET 1 (Interface Ethernet Física)
              └── Ethernet (Adaptador Ethernet)
                    └── PN_Controller (PROFINET Controller)
                          └── Raspberry_Pi_Vision_DAP (IO-Device)
                                ├── Slot 1: Vision Inputs 20B
                                └── Slot 2: Vision Outputs 6B
```

Para o passo a passo completo com telas e código em Texto Estruturado (ST), consulte o guia:
👉 **[`TUTORIAL_MASTERTOOL_NEXUS325.md`](file:///c:/Users/PC/OneDrive/Documentos/PROJETOS/Nova%20pasta/DAMATTA_GSDML/TUTORIAL_MASTERTOOL_NEXUS325.md)**
