# Tutorial Passo a Passo: Configuração PROFINET no MasterTool IEC XE / CODESYS 3.5 (Altus NX325 + Raspberry Pi)

Este tutorial detalha o procedimento idêntico ao fluxo de configuração do **CODESYS 3.5 & PROFINET**, adaptado para o **MasterTool IEC XE (Altus Nexto NX325)** e a câmera industrial **Raspberry Pi (DAMATTA Vision System)**.

---

## 📋 Pré-requisitos
1. **MasterTool IEC XE** v3.75 ou superior instalado no PC.
2. CLP Altus **Nexto NX325** (ou similar da série Nexto) conectado na rede Ethernet.
3. Arquivo descritor PROFINET: **`GSDML-V2.31-DAMATTA-VisionDevice-20260814.xml`**.
4. Sistema de Visão (Raspberry Pi) executando o daemon `profinet_app` (p-net).

---

## 🚀 Passo 1: Instalação do Arquivo GSDML no Repositório de Dispositivos

1. No MasterTool IEC XE, acesse o menu superior: **Ferramentas (Tools)** $\rightarrow$ **Repositório de Dispositivos... (Device Repository)**.
2. Na janela que abrir, certifique-se de que a localização esteja em **User Repository** ou **System Repository**.
3. Clique no botão **Instalar... (Install...)**.
4. Navegue até a pasta onde salvou o arquivo `GSDML-V2.31-DAMATTA-VisionDevice-20260814.xml` (ou `GSDML-V2.3-DAMATTA-VisionDevice-20260814.xml`).
5. Clique em **Abrir**. O dispositivo **Raspberry Pi Vision DAP** aparecerá sob a categoria **Fieldbusses / PROFINET IO / I/O / DAMATTA**.
6. Clique em **Fechar**.

---

## 🌐 Passo 2: Configuração da Interface Ethernet e do PROFINET Controller no Projeto

1. Na árvore de dispositivos (lado esquerdo), clique com o botão direito no nó **Device (NX325)** e selecione **Adicionar Dispositivo... (Add Device...)**.
2. Expanda **Ethernet Adapter** $\rightarrow$ selecione **Ethernet** e clique em **Adicionar Dispositivo**.
3. Dobre o clique no item **Ethernet** adicionado na árvore.
4. Na aba **Configurações de Ethernet**, clique no botão **Navegar...** e selecione a interface de rede física (ex: `eth0` ou a placa de rede do CLP/PC).
5. Clique com o botão direito no nó **Ethernet** na árvore $\rightarrow$ **Adicionar Dispositivo...**.
6. Selecione **PROFINET IO Master / Controller** $\rightarrow$ **PROFINET Controller** e clique em **Adicionar Dispositivo**.

---

## 📷 Passo 3: Adição do Dispositivo de Visão (Raspberry Pi) ao PROFINET Controller

1. Na árvore do projeto, clique com o botão direito sobre o **PROFINET Controller** recém-criado $\rightarrow$ **Adicionar Dispositivo...**.
2. Na janela de busca de dispositivos, navegue até:
   **PROFINET IO** $\rightarrow$ **I/O** $\rightarrow$ **DAMATTA** $\rightarrow$ **Raspberry Pi Vision DAP**.
3. Clique em **Adicionar Dispositivo**.

---

## 📦 Passo 4: Inserção dos Módulos de Entrada (20 Bytes) e Saída (6 Bytes)

1. Expanda o dispositivo **Raspberry Pi Vision DAP** na árvore do projeto.
2. Dobre o clique no dispositivo para abrir a configuração de Slots.
3. No **Slot 1**: Clique com o botão direito ou selecione na lista o módulo **`Vision Inputs 20B`** (20 Bytes In).
4. No **Slot 2**: Clique com o botão direito ou selecione na lista o módulo **`Vision Outputs 6B`** (6 Bytes Out).

---

## 🔗 Passo 5: Mapeamento de Variáveis E/S (PROFINET I/O Mapping)

Na aba **Mapeamento de E/S PROFINET** de cada módulo, vincule os canais de hardware às variáveis globais da sua aplicação:

### Entradas (Módulo 20 Bytes In - Slot 1):
| Endereço Byte | Tipo de Dado | Nome da Variável no PLC | Descrição |
| :--- | :--- | :--- | :--- |
| `%IW0` | `UINT` | `g_StatusFlags` | Flags (Bit 0: OK, Bit 1: Error, Bit 5: Trigger Ack) |
| `%IW2` | `UINT` | `g_ClassID` | Classe identificada (ex: 1 = Peça A, 2 = Peça B) |
| `%IW4` | `UINT` | `g_ObjectCount` | Contagem total de objetos inspecionados |
| `%ID6` | `REAL` | `g_PosX_mm` | Posição X em milímetros na esteira |
| `%ID10` | `REAL` | `g_PosY_mm` | Posição Y em milímetros na esteira |
| `%ID14` | `REAL` | `g_Angle_deg` | Ângulo de rotação da peça em graus |
| `%IW18` | `UINT` | `g_ActiveRecipe` | ID da receita ativa no Raspberry Pi |

### Saídas (Módulo 6 Bytes Out - Slot 2):
| Endereço Byte | Tipo de Dado | Nome da Variável no PLC | Descrição |
| :--- | :--- | :--- | :--- |
| `%QB0` | `BYTE` | `g_TriggerCmd` | Comando de disparo de foto (Pulso Bit 0) |
| `%QB1` | `BYTE` | `g_RecipeCmd` | Troca de receita enviada pelo PLC |
| `%QB2` | `BYTE` | `g_ModeCmd` | Modo de operação (0: Contínuo, 1: Trigger) |
| `%QB3` | `BYTE` | `g_ResetFault` | Reset de falha da visão |
| `%QW4` | `WORD` | `g_Reserved` | Reservado para expansão futura |

---

## 🧪 Passo 6: Compilação, Login e Testes (Forçamento via Ctrl+F7)

1. Pressione **F11** para compilar o projeto (*Build*). Certifique-se de que não haja erros de compilação.
2. Conecte ao CLP clicando em **Online** $\rightarrow$ **Login** ($\text{Alt}+\text{F8}$).
3. Coloque o CLP em modo de execução ($\text{F5}$ - *Start*).
4. Para testar o disparo de foto via **Forçamento de Valores**:
   - Na lista de variáveis ou no programa em LADDER/ST, mude o valor preparado de `g_TriggerCmd` para `1`.
   - Pressione **Ctrl + F7** para escrever/forçar o valor no CLP.
   - Observe o pulso em `g_StatusFlags` (Bit 5: Trigger Ack) confirmando que a foto foi processada!
