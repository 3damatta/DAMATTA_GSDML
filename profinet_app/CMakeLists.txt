cmake_minimum_required(VERSION 3.16)
project(profinet_vision_daemon C)

set(CMAKE_C_STANDARD 99)
set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -Wall -Wextra -pthread")

# Diretórios de Include
include_directories(
    ${CMAKE_CURRENT_SOURCE_DIR}/../shm_common
    ${CMAKE_CURRENT_SOURCE_DIR}/src
)

# Executável do Daemon PROFINET C
add_executable(profinet_app
    src/main.c
)

# Linkar com biblioteca RT e Threads
target_link_libraries(profinet_app
    rt
    pthread
)
