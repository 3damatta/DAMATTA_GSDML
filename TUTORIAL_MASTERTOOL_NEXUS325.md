# Tutorial de Configuração e Uso: MasterTool IEC XE & CLP Altus (Série Nexto / Hadron NX325)

Este guia prático ensina passo a passo como integrar o sistema de visão **DAMATTA PROFINET** no ambiente **MasterTool IEC XE** (Altus) utilizando o CLP **Altus NX325 / Série Nexto**.

---

## 🛠️ 1. Pré-Requisitos

### Hardware:
* **CLP Altus NX325** (ou CPU Nexto NX3005 / NX3010 / NX3020 / NX3030 com interface PROFINET Controller ativada na porta `NET1` ou `NET2`).
* **Raspberry Pi 4 ou 5** com o sistema DAMATTA instalado via `setup_system.sh`.
* **Câmera USB** conectada ao Raspberry Pi.
* **Cabo de Rede Ethernet RJ45** conectando a porta `NET1/NET2` do CLP NX325 à porta `eth0` do Raspberry Pi.

### Software:
* **MasterTool IEC XE** (Versão 3.30 ou superior).
* Descritor XML `GSDML-V2.42-Custom-VisionDevice-20260814.xml` (localizado na pasta `gsdml/` do repositório).

---

## 📂 2. Importação do GSDML no MasterTool IEC XE

1. Abra o **MasterTool IEC XE**.
2. No menu superior, vá em **Ferramentas (Tools)** $\rightarrow$ **Repositório de Dispositivos (Device Repository...)**.
3. Na janela que se abre, clique no botão **Instalar (Install...)**.
4. Selecione o arquivo XML do projeto:
   `DAMATTA_GSDML/gsdml/GSDML-V2.42-Custom-VisionDevice-20260814.xml`
5. Confirme a instalação. O dispositivo ficará registrado sob:
   `Fieldbusses -> PROFINET IO -> I/O -> Vision Systems -> DAMATTA Automation -> Raspberry Pi Vision DAP`.

---

## 🎛️ 3. Configuração do Hardware no Projeto MasterTool

### Passo 3.1: Adicionar o PROFINET Controller na CPU NX325
1. Na árvore de dispositivos (**Device Tree**), localize a CPU **NX325**.
2. Clique com o botão direito na interface Ethernet desejada (ex: **NET 1**) e selecione **Adicionar Dispositivo (Add Device...)**.
3. Escolha **PROFINET IO Controller** e confirme.

### Passo 3.2: Adicionar o Raspberry Pi Vision DAP
1. Clique com o botão direito sobre o **PROFINET IO Controller** recém-criado.
2. Selecione **Adicionar Dispositivo (Add Device...)**.
3. Expanda a árvore e selecione **Raspberry Pi Vision DAP** (`DAMATTA Automation`).
4. Clique em **Adicionar Dispositivo**.

### Passo 3.3: Parametrizar IP e Nome da Estação (Name of Station)
1. Dê um duplo clique no dispositivo **Raspberry Pi Vision DAP** na árvore do projeto.
2. Na aba **PROFINET General**:
   * **Nome da Estação (Station Name):** `rpi-vision-device`
   * **Endereço IP (IP Address):** Defina o IP fixo da rede do Raspberry Pi (exemplo: `190.201.200.50` ou `192.168.1.50`).
   * **Máscara de Sub-rede:** `255.255.255.0`

---

## 💻 4. Programação em Texto Estruturado (ST) para o CLP NX325

Crie uma nova POU no MasterTool IEC XE chamada `POU_Visao_NX325` (Linguagem: **ST - Structured Text**):

### Código de Declaração de Variáveis (VAR):

```pascal
PROGRAM POU_Visao_NX325
VAR
    // -----------------------------------------------------------------
    // MAPEAMENTO DE SAÍDAS (6 Bytes: CLP NX325 -> Raspberry Pi)
    // -----------------------------------------------------------------
    bTriggerCmd   AT %QB0 : BYTE;  // Offset 0: 1 = Disparo de Captura (Borda de Subida)
    bRecipeCmd    AT %QB1 : BYTE;  // Offset 1: ID da Receita (1=Peça Vermelha, 2=Peça Azul)
    bModeCmd      AT %QB2 : BYTE;  // Offset 2: 0 = Modo Automático, 1 = Modo Pausa
    bResetFault   AT %QB3 : BYTE;  // Offset 3: 1 = Reset de Falhas

    // -----------------------------------------------------------------
    // MAPEAMENTO DE ENTRADAS (20 Bytes: Raspberry Pi -> CLP NX325)
    // -----------------------------------------------------------------
    wStatusFlags  AT %IW0 : WORD;  // Offset 0..1: Flags de Status (Bit 0=Ready, Bit 2=PASS, Bit 5=Ack)
    wClassID      AT %IW2 : WORD;  // Offset 2..3: Classe Detectada (1=Círculo, 2=Retângulo)
    wObjectCount  AT %IW4 : WORD;  // Offset 4..5: Quantidade de Objetos
    rPosX_mm      AT %ID6 : REAL;  // Offset 6..9: Posição X (mm)
    rPosY_mm      AT %ID10 : REAL; // Offset 10..13: Posição Y (mm)
    rAngleDeg     AT %ID14 : REAL; // Offset 14..17: Ângulo (graus)
    wActiveRecipe AT %IW18 : WORD; // Offset 18..19: Receita Ativa Confirmada

    // -----------------------------------------------------------------
    // VARIÁVEIS DE CONTROLE DO PROCESSO
    // -----------------------------------------------------------------
    bComandoInspeção : BOOL;       // Sensor físico ou comando do ciclo de máquina
    bInspeçãoConcluida: BOOL;      // Sinaliza fim da inspeção para a máquina
    bPeçaAprovada    : BOOL;       // Peça Aprovada (PASS)
    bPeçaReprovada   : BOOL;       // Peça Reprovada (FAIL)
    
    xTriggerAck      : BOOL;       // Bit 5 de wStatusFlags
END_VAR
```

### Código de Execução (ST Body):

```pascal
// =====================================================================
// LÓGICA DE CONTROLE DE VISÃO PROFINET - CLP ALTUS NX325
// =====================================================================

// Extração do Bit 5 (Trigger Ack) do Word de Status
xTriggerAck := (wStatusFlags AND 16#0020) <> 0;

// Configuração Padrão da Receita
bRecipeCmd := 1; // Seleciona Receita 1
bModeCmd   := 0; // Modo Automático

// ---------------------------------------------------------------------
// 1. DISPARO DA INSPEÇÃO (Borda de Subida)
// ---------------------------------------------------------------------
IF bComandoInspeção AND NOT xTriggerAck THEN
    bTriggerCmd := 1;           // Envia ordem de disparo ao Raspberry Pi
    bInspeçãoConcluida := FALSE;
END_IF;

// ---------------------------------------------------------------------
// 2. RESPOSTA E HANDSHAKE DO RASPBERRY PI (Trigger Ack Recebido)
// ---------------------------------------------------------------------
IF xTriggerAck THEN
    bTriggerCmd := 0;           // Reseta a ordem de disparo no PLC
    bInspeçãoConcluida := TRUE; // Sinaliza fim do ciclo
    
    // Leitura das Flags de Resultado
    bPeçaAprovada  := (wStatusFlags AND 16#0004) <> 0; // Bit 2: PASS (OK)
    bPeçaReprovada := (wStatusFlags AND 16#0008) <> 0; // Bit 3: FAIL (NOK)
END_IF;

// ---------------------------------------------------------------------
// 3. USO DOS DADOS DA PEÇA NO CLP (Exemplo de Atuação)
// ---------------------------------------------------------------------
IF bInspeçãoConcluida AND bPeçaAprovada THEN
    // Posições X e Y prontas para envio ao robô ou atuador servo:
    // rPosX_mm -> Posição X da peça em milímetros
    // rPosY_mm -> Posição Y da peça em milímetros
    // rAngleDeg -> Rotação da peça
END_IF;
```

---

## 🌐 5. Teste e Validação com a Interface Web

1. Conecte seu PC no mesmo Switch da rede do CLP NX325 e do Raspberry Pi.
2. Abra o navegador em: `http://<IP_DO_RASPBERRY>:8000`.
3. Na interface web:
   * Observe o painel **Telemetria I/O PROFINET**.
   * Quando o CLP NX325 acionar a variável `bComandoInspeção`, você verá o bit de disparo ser ativado e os valores de **Posição X**, **Posição Y** e **Status** sendo atualizados instantaneamente no MasterTool e na tela Web.

---

## ❓ 6. Dúvidas Frequentes (Troubleshooting)

* **O MasterTool indica falha de comunicação PROFINET no nó RPi:**
  1. Verifique se o comando `sudo ./scripts/setup_system.sh` foi executado no Raspberry Pi.
  2. Confirme se o campo **Station Name** no MasterTool está exatamente como `rpi-vision-device`.
  3. Verifique se os IPs do CLP NX325 e do Raspberry Pi pertencem à mesma sub-rede (ex: `192.168.1.X`).
