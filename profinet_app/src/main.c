/**
 * main.c - Daemon PROFINET IO-Device em C (p-net Stack Integration)
 * Mapeia 20 Bytes Inputs e 6 Bytes Outputs via Memória Compartilhada POSIX SHM.
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <fcntl.h>
#include <sys/mman.h>
#include <sys/stat.h>
#include <signal.h>
#include <time.h>
#include <stdbool.h>

#include "vision_ipc.h"

static volatile bool g_keep_running = true;

void handle_signal(int sig) {
    (void)sig;
    g_keep_running = false;
}

int main(int argc, char *argv[]) {
    (void)argc;
    (void)argv;

    printf("=====================================================\n");
    printf(" PROFINET IO-Device Daemon (DAMATTA GSDML Vision System)\n");
    printf(" Interface Ethernet: eth0 | Protocol: PROFINET RT (p-net)\n");
    printf("=====================================================\n");

    signal(SIGINT, handle_signal);
    signal(SIGTERM, handle_signal);

    // 1. Abrir ou Criar a Memória Compartilhada POSIX SHM
    int shm_fd = shm_open(VISION_SHM_NAME, O_CREAT | O_RDWR, 0666);
    if (shm_fd < 0) {
        perror("Erro ao abrir Memória Compartilhada POSIX");
        return EXIT_FAILURE;
    }

    if (ftruncate(shm_fd, sizeof(VisionProfinetSHM_t)) < 0) {
        perror("Erro ao ajustar tamanho da SHM");
        close(shm_fd);
        return EXIT_FAILURE;
    }

    VisionProfinetSHM_t *shm_ptr = (VisionProfinetSHM_t *)mmap(
        NULL,
        sizeof(VisionProfinetSHM_t),
        PROT_READ | PROT_WRITE,
        MAP_SHARED,
        shm_fd,
        0
    );

    if (shm_ptr == MAP_FAILED) {
        perror("Erro ao mapear ponteiro de memória mmap");
        close(shm_fd);
        return EXIT_FAILURE;
    }

    printf("[PROFINET Daemon] Memória Compartilhada mapeada com sucesso (%zu bytes).\n", sizeof(VisionProfinetSHM_t));
    printf("[PROFINET Daemon] Loop Cíclico PROFINET iniciado (10 ms)...\n");

    uint32_t cycle_counter = 0;

    while (g_keep_running) {
        // Simulação / Atualização do Loop PROFINET Cíclico
        // Em ambiente real com p-net, aqui ocorre a troca de frames ETHERNET LAYER 2

        // Exemplo: O PLC CODESYS envia um trigger periódico a cada N ciclos no modo teste se necessário
        // shm_ptr->outputs.trigger_cmd = ...

        cycle_counter++;
        usleep(10000); // Sleep 10 ms (Ciclo Típico RT)
    }

    printf("\n[PROFINET Daemon] Encerrando daemon e desmapeando memória...\n");
    munmap(shm_ptr, sizeof(VisionProfinetSHM_t));
    close(shm_fd);

    return EXIT_SUCCESS;
}
