"""
shm_bridge.py - Ponte de Comunicação via Memória Compartilhada (POSIX SHM)
Mapeia a estrutura 'VisionProfinetSHM_t' do arquivo vision_ipc.h usando ctypes.
"""

import sys
import os
import ctypes
import logging
import mmap

logger = logging.getLogger("SHMBridge")

# Definições de Mascaras de Bits de Status (Inputs)
STATUS_FLAG_READY        = (1 << 0)
STATUS_FLAG_TARGET_FOUND = (1 << 1)
STATUS_FLAG_PASS         = (1 << 2)
STATUS_FLAG_FAIL         = (1 << 3)
STATUS_FLAG_PROCESSING   = (1 << 4)
STATUS_FLAG_TRIGGER_ACK  = (1 << 5)

MODE_AUTOMATIC   = 0
MODE_CALIBRATION = 1

class VisionInputsCtypes(ctypes.Structure):
    _pack_ = 1
    _fields_ = [
        ("status_flags",   ctypes.c_uint16),
        ("class_id",       ctypes.c_uint16),
        ("object_count",   ctypes.c_uint16),
        ("pos_x_mm",       ctypes.c_float),
        ("pos_y_mm",       ctypes.c_float),
        ("angle_deg",      ctypes.c_float),
        ("active_recipe",  ctypes.c_uint16),
    ]

class VisionOutputsCtypes(ctypes.Structure):
    _pack_ = 1
    _fields_ = [
        ("trigger_cmd",    ctypes.c_uint8),
        ("recipe_cmd",     ctypes.c_uint8),
        ("mode_cmd",       ctypes.c_uint8),
        ("reset_fault",    ctypes.c_uint8),
        ("reserved",       ctypes.c_uint16),
    ]

class VisionProfinetSHMCtypes(ctypes.Structure):
    _pack_ = 1
    _fields_ = [
        ("inputs",            VisionInputsCtypes),
        ("outputs",           VisionOutputsCtypes),
        ("heartbeat_counter", ctypes.c_uint32),
    ]

SHM_NAME = "/vision_profinet_shm"
SHM_SIZE = ctypes.sizeof(VisionProfinetSHMCtypes)

class SHMBridge:
    def __init__(self, create_if_missing: bool = True):
        self.shm_buf = None
        self.struct_ptr = None
        self.is_windows = sys.platform.startswith("win")
        self._init_shm(create_if_missing)

    def _init_shm(self, create_if_missing: bool):
        try:
            if self.is_windows:
                # No Windows, usa mmap com arquivo temporário ou tag de memória simulada
                tag_name = "Local\\vision_profinet_shm"
                self.shm_buf = mmap.mmap(-1, SHM_SIZE, tagname=tag_name)
            else:
                # No Linux / Raspberry Pi, usa POSIX SHM em /dev/shm
                shm_path = f"/dev/shm{SHM_NAME}"
                if not os.path.exists(shm_path) and create_if_missing:
                    fd = os.open(shm_path, os.O_CREAT | os.O_RDWR, 0o666)
                    os.ftruncate(fd, SHM_SIZE)
                    os.close(fd)
                
                fd = os.open(shm_path, os.O_RDWR)
                self.shm_buf = mmap.mmap(fd, SHM_SIZE, mmap.MAP_SHARED, mmap.PROT_READ | mmap.PROT_WRITE)
                os.close(fd)

            self.struct_ptr = VisionProfinetSHMCtypes.from_buffer(self.shm_buf)
            logger.info(f"Ponte SHM inicializada com sucesso (Tamanho: {SHM_SIZE} bytes).")
        except Exception as e:
            logger.error(f"Erro ao inicializar Memória Compartilhada: {e}")
            # Em caso de falha severa, mantém objeto simulado em RAM local
            self.struct_ptr = VisionProfinetSHMCtypes()

    def get_outputs(self) -> dict:
        """Lê os comandos enviados pelo PLC CODESYS."""
        out = self.struct_ptr.outputs
        return {
            "trigger_cmd": out.trigger_cmd,
            "recipe_cmd": out.recipe_cmd,
            "mode_cmd": out.mode_cmd,
            "reset_fault": out.reset_fault,
        }

    def update_inputs(
        self,
        status_flags: int,
        class_id: int,
        object_count: int,
        pos_x_mm: float,
        pos_y_mm: float,
        angle_deg: float,
        active_recipe: int
    ):
        """Atualiza todas as variáveis de entrada enviadas para o PROFINET / CODESYS."""
        inp = self.struct_ptr.inputs
        inp.status_flags = status_flags
        inp.class_id = class_id
        inp.object_count = object_count
        inp.pos_x_mm = pos_x_mm
        inp.pos_y_mm = pos_y_mm
        inp.angle_deg = angle_deg
        inp.active_recipe = active_recipe
        self.struct_ptr.heartbeat_counter += 1

    def set_flag(self, flag_bit: int, value: bool):
        """Ativa ou desativa uma flag específica de status."""
        current = self.struct_ptr.inputs.status_flags
        if value:
            self.struct_ptr.inputs.status_flags = current | flag_bit
        else:
            self.struct_ptr.inputs.status_flags = current & (~flag_bit)

    def is_flag_set(self, flag_bit: int) -> bool:
        return bool(self.struct_ptr.inputs.status_flags & flag_bit)

    def close(self):
        self.struct_ptr = None
        if self.shm_buf:
            try:
                self.shm_buf.close()
            except Exception:
                pass

