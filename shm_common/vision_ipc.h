#ifndef VISION_IPC_H
#define VISION_IPC_H

#include <stdint.h>

#define VISION_SHM_NAME "/vision_profinet_shm"

// Bits de Status (Inputs: Visão -> PLC)
#define STATUS_FLAG_READY        (1 << 0)  // Sistema Pronto
#define STATUS_FLAG_TARGET_FOUND (1 << 1)  // Peça/Alvo Localizado
#define STATUS_FLAG_PASS         (1 << 2)  // Inspeção Aprovada (OK)
#define STATUS_FLAG_FAIL         (1 << 3)  // Inspeção Reprovada (NOK)
#define STATUS_FLAG_PROCESSING   (1 << 4)  // Inspeção em Execução
#define STATUS_FLAG_TRIGGER_ACK  (1 << 5)  // Confirmação de Recepção do Disparo

// Modos de Operação (Outputs: PLC -> Visão)
#define MODE_AUTOMATIC   0  // Controle Cíclico pelo PLC
#define MODE_CALIBRATION 1  // Modo Pausa / Calibração Web

#pragma pack(push, 1)

/**
 * Estrutura de Entradas (Visão -> PLC CODESYS) - Total: 20 Bytes
 */
typedef struct {
    uint16_t status_flags;   // Offset 0..1: Flags de status e handshake
    uint16_t class_id;       // Offset 2..3: ID da classe/cor/forma detectada
    uint16_t object_count;   // Offset 4..5: Quantidade total de objetos contados
    float    pos_x_mm;       // Offset 6..9: Posição X em milímetros
    float    pos_y_mm;       // Offset 10..13: Posição Y em milímetros
    float    angle_deg;      // Offset 14..17: Ângulo de rotação em graus (-180.0 a +180.0)
    uint16_t active_recipe;  // Offset 18..19: ID da receita em execução
} VisionInputs_t;

/**
 * Estrutura de Saídas (PLC CODESYS -> Visão) - Total: 6 Bytes
 */
typedef struct {
    uint8_t  trigger_cmd;    // Offset 0: 1 = Disparo de captura/processamento (Borda de subida)
    uint8_t  recipe_cmd;     // Offset 1: ID da receita solicitada pelo PLC
    uint8_t  mode_cmd;       // Offset 2: 0 = Automático, 1 = Calibração / Pausa
    uint8_t  reset_fault;    // Offset 3: 1 = Reset de falhas/alarmes
    uint16_t reserved;       // Offset 4..5: Reservado para expansão futura
} VisionOutputs_t;

/**
 * Estrutura Completa de Memória Compartilhada POSIX
 */
typedef struct {
    VisionInputs_t  inputs;   // 20 Bytes (Visão -> PROFINET)
    VisionOutputs_t outputs;  // 6 Bytes  (PROFINET -> Visão)
    uint32_t        heartbeat_counter; // Contador de vida entre processos
} VisionProfinetSHM_t;

#pragma pack(pop)

#endif // VISION_IPC_H
