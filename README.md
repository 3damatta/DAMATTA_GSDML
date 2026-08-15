# DAMATTA GSDML - Dispositivo PROFINET com Visão Computacional (Raspberry Pi + CODESYS)

Sistema industrial autônomo de visão computacional integrado com comunicação de campo **PROFINET IO-Device** via **p-net (C)** para CLPs CODESYS e interface web HTTP de calibração leve em **HTML5 Vanilla + Canvas API**.

---

## 🚀 Instalação Rápida no Raspberry Pi (1 Comando)

No terminal do seu Raspberry Pi, execute:

```bash
git clone https://github.com/SEU_USUARIO/DAMATTA_GSDML.git
cd DAMATTA_GSDML
sudo chmod +x scripts/setup_system.sh
sudo ./scripts/setup_system.sh
```

O script `setup_system.sh` fará automaticamente a instalação de todas as dependências, compilação da aplicação C, criação do ambiente Python e inicialização do serviço no `systemd`.

---

## 💻 Acesso à Interface Web de Configuração

Abra o navegador em qualquer dispositivo conectado à mesma rede:

```
http://<IP_DO_RASPBERRY_PI>:8000
```

### Funcionalidades:
- **Stream MJPEG ao vivo** em $640\times 480$ a 30 FPS com baixíssima latência.
- **Editor visual de ROI** com desenho em Canvas interativo (clique e arraste sobre o vídeo).
- **Ajuste fino de filtros de cor HSV** com sliders e atualização em tempo real.
- **Painel de telemetria PROFINET I/O** exibindo os 20 Bytes de entrada e 6 Bytes de saída em tempo real.
- **Gerenciador de Receitas** armazenadas em formato JSON.

---

## 🛠️ Importação do Arquivo GSDML no CODESYS / MasterTool IEC XE (Altus NX325)

> 📘 **Guia Dedicado Altus MasterTool:** Veja o [Tutorial Completo para MasterTool IEC XE & CLP Altus NX325](TUTORIAL_MASTERTOOL_NEXUS325.md).

1. Abra o **CODESYS** ou **MasterTool IEC XE**.
2. Vá no menu **Tools** $\rightarrow$ **Device Repository...**
3. Clique em **Install...** e selecione o arquivo:
   `gsdml/GSDML-V2.42-Custom-VisionDevice-20260814.xml`
4. Na árvore de dispositivos do seu projeto PLC, adicione o dispositivo sob o nó **PROFINET I/O Master**.
5. Configure o **Name of Station** e o IP do Raspberry Pi via DCP / CODESYS.

---

## 📋 Mapeamento de I/O PROFINET (20B In / 6B Out)

### Entradas (Visão $\rightarrow$ PLC | 20 Bytes)
- **Offset 0..1:** `UINT16 status_flags` (Ready, Target Found, Pass, Fail, Processing, Trigger Ack)
- **Offset 2..3:** `UINT16 class_id` (Círculo=1, Retângulo=2, Triângulo=3, Polígono=4)
- **Offset 4..5:** `UINT16 object_count` (Total de objetos contados)
- **Offset 6..9:** `FLOAT32 pos_x_mm` (Posição X em mm)
- **Offset 10..13:** `FLOAT32 pos_y_mm` (Posição Y em mm)
- **Offset 14..17:** `FLOAT32 angle_deg` (Ângulo de rotação em graus)
- **Offset 18..19:** `UINT16 active_recipe` (Receita em execução)

### Saídas (PLC $\rightarrow$ Visão | 6 Bytes)
- **Offset 0:** `UINT8 trigger_cmd` (1 = Disparo de inspeção)
- **Offset 1:** `UINT8 recipe_cmd` (ID da receita solicitada)
- **Offset 2:** `UINT8 mode_cmd` (0 = Auto, 1 = Calibração)
- **Offset 3:** `UINT8 reset_fault` (1 = Reset de falhas)
- **Offset 4..5:** `UINT16 reserved`

---

## 📁 Estrutura de Arquivos

```
DAMATTA_GSDML/
├── gsdml/                        # Arquivo XML GSDML v2.42 para CODESYS
├── shm_common/                   # Definição C de Memória Compartilhada (vision_ipc.h)
├── web_app/                      # Interface Web (FastAPI + HTML5 Vanilla + Canvas)
├── vision_engine/                # Motor de Visão Computacional (OpenCV + V4L2)
├── profinet_app/                 # Aplicação Daemon PROFINET em C (CMake)
├── config/                       # Perfis de receita padrão JSON
└── scripts/                      # Script de instalação e serviço systemd
```
