# Tutorial Passo a Passo: Configuração PROFINET no MasterTool IEC XE (Altus Nexto NX325 / XP325 + Raspberry Pi)

Este tutorial descreve o procedimento completo de configuração do **MasterTool IEC XE**, a instalação do descritor **GSDML**, a montagem da árvore de dispositivos PROFINET e o programa em **Texto Estruturado (ST)** para contabilização e somatória de peças no CLP.

---

## 📌 1. Instalação do Arquivo GSDML no Repositório do MasterTool

1. No MasterTool IEC XE, acesse o menu superior: **Ferramentas (Tools)** $\rightarrow$ **Repositório de Dispositivos... (Device Repository)**.
2. Clique em **Instalar...**.
3. Selecione o arquivo: **`GSDML-V2.31-DAMATTA-VisionDevice-20260814.xml`** (disponível na pasta `gsdml/`).
4. O dispositivo **Raspberry Pi Vision DAP** será registrado sob a categoria **Fieldbusses / PROFINET IO / I/O / DAMATTA**.

---

## 🌳 2. Montagem da Árvore de Comunicação PROFINET

No MasterTool, monte a estrutura de dispositivos seguindo a hierarquia abaixo:

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

### Passo a Passo dos Cliques:
1. Clique com o botão direito na porta física **`NET 1`** $\rightarrow$ **Adicionar Dispositivo...** $\rightarrow$ selecione **Adaptador Ethernet / Ethernet**.
2. Clique com o botão direito no nó **`Ethernet`** recém-criado $\rightarrow$ **Adicionar Dispositivo...** $\rightarrow$ selecione **PROFINET Controller**.
3. Clique com o botão direito no **`PN_Controller`** $\rightarrow$ **Adicionar Dispositivo...** $\rightarrow$ expanda **DAMATTA** $\rightarrow$ selecione **`Raspberry Pi Vision DAP`**.
4. Clique com o botão direito em **`Raspberry_Pi_Vision_DAP`** $\rightarrow$ **Adicionar Dispositivo...**:
   - Adicione o módulo **`Vision Inputs 20B`** no Slot 1.
   - Adicione o módulo **`Vision Outputs 6B`** no Slot 2.

---

## 🌐 3. Configuração de IP e Nome da Estação PROFINET

Dê um duplo clique no nó **`Raspberry_Pi_Vision_DAP`**:
- **Nome da estação (Station Name):** `rpi-vision-device`
- **Endereço IP:** `192.168.0.231` (ou o IP do Raspberry Pi na sua rede)
- **Máscara de sub-rede:** `255.255.255.0`

---

## 📊 4. Mapeamento de Variáveis E/S (PNIO I/O Mapping)

Dê um duplo clique no módulo **`Vision_Inputs_20B`** (Slot 1) $\rightarrow$ aba **PNIO Module I/O Mapping**:

| Endereço Byte | Tipo de Dado | Canal | Descrição |
| :--- | :--- | :--- | :--- |
| `%IW0` | `UINT` | `Status Flags` | Bit 0: Ready, Bit 1: Error, Bit 5: Trigger Ack |
| `%IW2` | `UINT` | `Class ID` | ID da Classe (1 = Peça Vermelha, 2 = Verde, 3 = Azul) |
| `%IW4` | `UINT` | `Object Count` | Quantidade de objetos contados NA FOTO ATUAL |
| `%ID6` | `REAL` | `Pos X mm` | Posição X em milímetros da peça na foto |
| `%ID10` | `REAL` | `Pos Y mm` | Posição Y em milímetros da peça na foto |
| `%ID14` | `REAL` | `Angle Deg` | Ângulo da peça em graus |
| `%IW18` | `UINT` | `Active Recipe` | ID da Receita Ativa |

Dê um duplo clique no módulo **`Vision_Outputs_6B`** (Slot 2) $\rightarrow$ aba **PNIO Module I/O Mapping**:

| Endereço Byte | Tipo de Dado | Canal | Descrição |
| :--- | :--- | :--- | :--- |
| `%QB0` | `USINT` | `Trigger Cmd` | Comando para disparar foto (1 = Disparar foto) |
| `%QB1` | `USINT` | `Recipe Cmd` | Comando de seleção de receita |
| `%QB2` | `USINT` | `Mode Cmd` | Modo de operação (0 = Automático, 1 = Calibração) |
| `%QB3` | `USINT` | `Reset Fault` | Reset de alarmes da visão |

---

## 💻 5. Programa em Texto Estruturado (ST) - Somatória Acumulada no CLP

A câmera responde estritamente a quantidade de peças daquela foto (`g_ObjectCount`). O programa abaixo no CLP lê o resultado de cada foto e **contabiliza/soma acumuladamente no CLP**:

### Bloco de Variáveis (`VAR`):
```iecst
PROGRAM UserPrg
VAR
    (* --- ENTRADAS PROFINET DA VISÃO (ENTREGUES PELA CÂMERA NA FOTO ATUAL) --- *)
    g_StatusFlags       : UINT;     (* Status Flags (Bit 5: Trigger Ack) *)
    g_ClassID           : UINT;     (* ID da Classe (1 = Peça Vermelha) *)
    g_ObjectCount       : UINT;     (* Quantidade de peças encontradas EXATAMENTE NA FOTO ATUAL *)
    g_PosX_mm           : REAL;     (* Posição X em mm *)
    g_PosY_mm           : REAL;     (* Posição Y em mm *)
    g_Angle_deg         : REAL;     (* Ângulo em graus *)
    g_ActiveRecipe      : UINT;     (* Receita ativa na câmera *)

    (* --- SAÍDAS PROFINET PARA A VISÃO --- *)
    g_TriggerCmd        : BYTE;     (* Comando para disparar foto (1 = Tirar foto) *)
    g_RecipeCmd         : BYTE;     (* Comando para trocar receita *)
    g_ResetFault        : BYTE;     (* Reset de falha *)

    (* --- CONTROLE DE EXECUÇÃO NO CLP --- *)
    bStartInspection    : BOOL := FALSE; (* Alterne para TRUE para disparar a foto *)
    bResetTotalCounter  : BOOL := FALSE; (* Ligue para zerar a contagem acumulada no CLP *)
    bResetFaultCmd      : BOOL := FALSE; (* Reset de falha *)
    nRecipeToSelect     : BYTE := 1;     (* ID da Receita selecionada pelo CLP *)

    (* --- CONTABILIZAÇÃO E SOMATÓRIA ACUMULADA NO CLP --- *)
    nTotalRedPartsCount : UDINT := 0;    (* CONTADOR TOTAL ACUMULADO SOMADO PELO CLP *)
    nPartsInCurrentPhoto: UINT := 0;     (* Peças encontradas na foto do disparo atual *)
    bIsRedPart          : BOOL := FALSE; (* TRUE se a classe da peça for Vermelha (Class 1) *)

    (* --- BITS DE STATUS E BORDA DE SUBIDA DO DISPARO --- *)
    bSystemOK           : BOOL;
    bInspectionError    : BOOL;
    bTriggerAck         : BOOL;
    bTriggerAckOld      : BOOL := FALSE; (* Memória de borda para evitar dupla contagem *)
END_VAR
```

### Bloco de Código ST:
```iecst
(* ========================================================================= *)
(*    PROGRAMA CLP: CONTABILIZAÇÃO E SOMATÓRIA DE PEÇAS VERMELHAS (ST)      *)
(* ========================================================================= *)

(* 1. DECODIFICAÇÃO DE STATUS DA VISÃO *)
bSystemOK        := (g_StatusFlags AND 16#0001) <> 0; (* Bit 0: Sistema OK *)
bInspectionError := (g_StatusFlags AND 16#0002) <> 0; (* Bit 1: Erro de inspeção *)
bTriggerAck      := (g_StatusFlags AND 16#0020) <> 0; (* Bit 5: Confirmação de foto concluída *)

(* 2. IDENTIFICAÇÃO DA CLASSE (Classe 1 = Peça Vermelha) *)
bIsRedPart := (g_ClassID = 1);

(* 3. CONTABILIZAÇÃO E SOMATÓRIA ACUMULADA NO CLP NA BORDA DA FOTO *)
IF bTriggerAck AND NOT bTriggerAckOld THEN
    (* Na borda de subida do Ack, a câmera concluiu o processamento da foto *)
    IF bIsRedPart THEN
        nPartsInCurrentPhoto := g_ObjectCount; (* Lê a contagem da foto atual *)
        nTotalRedPartsCount  := nTotalRedPartsCount + nPartsInCurrentPhoto; (* SOMATÓRIA ACUMULADA NO CLP *)
    ELSE
        nPartsInCurrentPhoto := 0;
    END_IF
END_IF
bTriggerAckOld := bTriggerAck; (* Memória de borda *)

(* 4. RESETA A CONTABILIZAÇÃO ACUMULADA DO CLP QUANDO SOLICITADO *)
IF bResetTotalCounter THEN
    nTotalRedPartsCount  := 0;
    nPartsInCurrentPhoto := 0;
    bResetTotalCounter   := FALSE;
END_IF

(* 5. SELEÇÃO DE RECEITA E DISPARO DE FOTO COM HANDSHAKE *)
g_RecipeCmd := nRecipeToSelect;

IF bStartInspection THEN
    g_TriggerCmd := 1; (* Envia o pulso PROFINET para a câmera tirar a foto *)
    
    IF bTriggerAck THEN
        g_TriggerCmd := 0;
        bStartInspection := FALSE; (* Conclui o disparo *)
    END_IF
ELSE
    g_TriggerCmd := 0;
END_IF

(* 6. RESET DE FALHAS DA CÂMERA *)
IF bResetFaultCmd THEN
    g_ResetFault := 1;
    bResetFaultCmd := FALSE;
ELSE
    g_ResetFault := 0;
END_IF
```

---

## 🧪 6. Testes em Modo Simulação vs CLP Físico

- **Modo Simulação (PC):**
  - No modo Simulação do MasterTool, o programa em Texto Estruturado roda na memória do PC. O aviso `⚠️ The bus is not running` é normal pois o computador não envia pacotes de rede física.
  - Para testar na simulação, altere `bStartInspection` para `TRUE` e force valores em `g_ClassID`, `g_ObjectCount` e `g_StatusFlags` com **Ctrl + F7**.

- **Modo Real (CLP Físico + Raspberry Pi):**
  - Conecte o cabo Ethernet entre o CLP e o Raspberry Pi (`192.168.0.231`).
  - Desmarque o modo Simulação, faça o **Login** (**Alt + F8**) e **Start** (**F5**).
  - O aviso sumirá, a luz do PROFINET ficará verde e a contagem ocorrerá em tempo real a cada disparo! 📷✨
