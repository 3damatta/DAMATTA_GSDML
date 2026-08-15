# Tutorial Completo de Configuração, Programação e Uso: DAMATTA GSDML

Este guia fornece o passo a passo detalhado para instalar, configurar, programar no CODESYS e utilizar a solução industrial de visão computacional integrada via **PROFINET IO-Device** no Raspberry Pi.

---

## 📋 1. Requisitos do Sistema

### Hardware Necessário:
* **Raspberry Pi 4 ou 5** (recomendado 2 GB+ RAM, rodando Raspberry Pi OS 64-bit).
* **Câmera USB Industrial ou Webcam UVC** (resolução mínima 640x480).
* **Cabo Ethernet RJ45** (conexão direta da porta `eth0` do RPi ao PLC ou Switch industrial).
* **PLC / Controlador CODESYS** (ex: CODESYS Control Win V3, CODESYS em Raspberry Pi, Schneider, WAGO, Festo, Eaton, etc.).

### Software Necessário:
* **CODESYS Development System V3.5** (com pacote PROFINET Master instalado).
* Navegador Web moderno (Chrome, Edge ou Firefox).

---

## 🚀 2. Instalação Automatizada no Raspberry Pi

Abra o terminal no seu Raspberry Pi e execute o comando único de instalação:

```bash
# 1. Clonar o repositório oficial do GitHub
git clone https://github.com/3damatta/DAMATTA_GSDML.git

# 2. Entrar na pasta do projeto
cd DAMATTA_GSDML

# 3. Dar permissão e rodar a instalação automatizada
sudo chmod +x scripts/setup_system.sh
sudo ./scripts/setup_system.sh
```

### O que o script realiza automaticamente:
1. Instala dependências nativas (`cmake`, `build-essential`, `libopencv-dev`, `libv4l-dev`).
2. Cria o ambiente virtual Python (`venv`) e instala os pacotes (`fastapi`, `uvicorn`, `opencv-python-headless`, `numpy`, `pyzbar`).
3. Compila a aplicação PROFINET C (`profinet_app`).
4. Atribui permissões de soquete Ethernet de camada 2 (`setcap cap_net_raw,cap_net_admin=eip`).
5. Registra e inicia o serviço `systemd` (`profinet-vision.service`) no boot.

---

## 🛠️ 3. Configuração do Dispositivo no CODESYS

### Passo 3.1: Importar o Descritor GSDML
1. Abra o **CODESYS Development System**.
2. Vá no menu superior: **Tools** $\rightarrow$ **Device Repository...**
3. Clique no botão **Install...**.
4. Navegue até a pasta do projeto e selecione o arquivo:
   `DAMATTA_GSDML/gsdml/GSDML-V2.42-Custom-VisionDevice-20260814.xml`
5. Confirme a instalação. O dispositivo aparecerá na categoria **Fieldbusses $\rightarrow$ PROFINET IO $\rightarrow$ I/O $\rightarrow$ Vision Systems $\rightarrow$ DAMATTA Automation**.

### Passo 3.2: Adicionar o Dispositivo à Árvore do PLC
1. Clique com o botão direito na interface Ethernet do seu PLC no CODESYS e selecione **Add Device**.
2. Adicione um **PROFINET IO Master** (se ainda não houver).
3. Sob o **PROFINET IO Master**, clique com o botão direito e selecione **Add Device**.
4. Selecione o **Raspberry Pi Vision DAP** (`DAMATTA Automation`).

### Passo 3.3: Configuração de Nome da Estação (Name of Station) e IP
1. Dê um duplo clique no dispositivo **Raspberry Pi Vision DAP**.
2. Na aba **PROFINET General**:
   * **Station Name:** `rpi-vision-device`
   * **IP Address:** Informe o mesmo IP da porta Ethernet do Raspberry Pi (ex: `192.168.1.50`).

### Passo 3.4: Mapeamento de Variáveis de I/O em Structured Text (ST)

Crie um programa `PRG_Vision_Control` em texto estruturado (ST) no CODESYS:

```pascal
PROGRAM PRG_Vision_Control
VAR
    // Saídas para a Visão (6 Bytes PLC -> RPi)
    bTriggerCmd   AT %QB0 : BYTE;  // Offset 0: 1 = Disparo de Captura
    bRecipeCmd    AT %QB1 : BYTE;  // Offset 1: ID da Receita Desejada (1, 2, 3...)
    bModeCmd      AT %QB2 : BYTE;  // Offset 2: 0 = Auto, 1 = Calibração/Pausa
    bResetFault   AT %QB3 : BYTE;  // Offset 3: 1 = Reset de Falha

    // Entradas da Visão (20 Bytes RPi -> PLC)
    wStatusFlags  AT %IW0 : WORD;  // Offset 0..1: Flags (Bit 0: Ready, Bit 1: Target, Bit 2: PASS, Bit 5: Trigger Ack)
    wClassID      AT %IW2 : WORD;  // Offset 2..3: Classe Detectada (1=Círculo, 2=Retângulo, 3=Triângulo)
    wObjectCount  AT %IW4 : WORD;  // Offset 4..5: Quantidade Contada
    rPosX_mm      AT %ID6 : REAL;  // Offset 6..9: Posição X em mm
    rPosY_mm      AT %ID10 : REAL; // Offset 10..13: Posição Y em mm
    rAngleDeg     AT %ID14 : REAL; // Offset 14..17: Ângulo de Rotação (graus)
    wActiveRecipe AT %IW18 : WORD; // Offset 18..19: Receita Ativa no RPi

    // Variáveis Internas do PLC
    bStartInspection : BOOL;
    bInspectionDone  : BOOL;
    bInspectionOK    : BOOL;
END_VAR

// -------------------------------------------------------------
// Lógica de Disparo e Handshake Seguro (Edge Trigger & Ack)
// -------------------------------------------------------------

// Selecionar Receita 1
bRecipeCmd := 1;
bModeCmd   := 0; // Modo Automático

// 1. Comando de Disparo
IF bStartInspection AND NOT (wStatusFlags.5) THEN
    bTriggerCmd := 1; // Envia o sinal de trigger para o RPi
END_IF;

// 2. Confirmação do Handshake (Trigger Ack do RPi)
IF (wStatusFlags.5) THEN
    bTriggerCmd := 0;      // Reseta a borda de disparo no PLC
    bInspectionDone := TRUE;
    
    // Verificar resultado da Inspeção
    bInspectionOK := (wStatusFlags.2); // Bit 2: PASS (OK)
END_IF;
```

---

## 🌐 4. Operação da Interface Web HTTP

Abra o navegador em qualquer PC, Tablet ou Smartphone conectado à rede:

```text
http://<IP_DO_RASPBERRY>:8000
```

### Funcionalidades do Painel Web:
1. **Visualização ao Vivo:** Streaming MJPEG em $640\times 480$ 30 FPS com overlays de bounding boxes, centroides e labels de status.
2. **Desenho de ROI (Região de Interesse):** Clique no botão **✏️ Desenhar ROI**, depois clique e arraste com o mouse sobre a imagem da câmera para limitar a área de inspeção.
3. **Ajuste Fino de Cores HSV:** Utilize os sliders duplos de **Hue**, **Saturation** e **Value** para filtrar exatamente a cor do objeto desejado.
4. **Gestão de Receitas:** Selecione receitas salvas, ajuste limites mínimos e máximos de contagem e clique em **💾 Salvar Receita** ou **▶️ Ativar Receita**.
5. **Telemetria PROFINET em Tempo Real:** Acompanhe na tabela os 20 Bytes transmitidos para a memória compartilhada e para o PLC a cada 100 ms.

---

## 🔍 5. Diagnóstico e Resolução de Problemas

* **Verificar o Status do Serviço no Raspberry Pi:**
  ```bash
  sudo systemctl status profinet-vision.service
  ```
* **Ver logs em tempo real:**
  ```bash
  sudo journalctl -u profinet-vision.service -f
  ```
* **Testar a API REST manualmente:**
  ```bash
  curl http://localhost:8000/api/status
  ```
