cmake_minimum_required(VERSION 3.22.1)
project("whisper_android" C CXX)

# whisper.cpp source directory
set(WHISPER_DIR ${CMAKE_CURRENT_SOURCE_DIR}/whisper.cpp)

# Check if whisper.cpp exists
if(NOT EXISTS "${WHISPER_DIR}/include/whisper.h")
    message(FATAL_ERROR
        "whisper.cpp source not found at ${WHISPER_DIR}\n"
        "Run ./setup_whisper.sh from the project root to download it."
    )
endif()

# Compile flags
set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -O3 -DNDEBUG")
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -O3 -DNDEBUG -std=c++17")

# ggml core sources
set(GGML_SOURCES
    ${WHISPER_DIR}/ggml/src/ggml.c
    ${WHISPER_DIR}/ggml/src/ggml-alloc.c
    ${WHISPER_DIR}/ggml/src/ggml-backend.cpp
    ${WHISPER_DIR}/ggml/src/ggml-backend-reg.cpp
    ${WHISPER_DIR}/ggml/src/ggml-opt.cpp
    ${WHISPER_DIR}/ggml/src/ggml-quants.c
    ${WHISPER_DIR}/ggml/src/ggml-threading.cpp
)

# ggml CPU backend sources
set(GGML_CPU_SOURCES
    ${WHISPER_DIR}/ggml/src/ggml-cpu/ggml-cpu.c
    ${WHISPER_DIR}/ggml/src/ggml-cpu/ggml-cpu.cpp
    ${WHISPER_DIR}/ggml/src/ggml-cpu/ggml-cpu-aarch64.cpp
    ${WHISPER_DIR}/ggml/src/ggml-cpu/ggml-cpu-quants.c
    ${WHISPER_DIR}/ggml/src/ggml-cpu/ggml-cpu-traits.cpp
    ${WHISPER_DIR}/ggml/src/ggml-cpu/llamafile/sgemm.cpp
)

# whisper sources
set(WHISPER_SOURCES
    ${WHISPER_DIR}/src/whisper.cpp
)

# Build ggml library
add_library(ggml STATIC ${GGML_SOURCES} ${GGML_CPU_SOURCES})
target_include_directories(ggml PUBLIC
    ${WHISPER_DIR}/ggml/include
    ${WHISPER_DIR}/ggml/src
    ${WHISPER_DIR}/ggml/src/ggml-cpu
)
target_compile_definitions(ggml PRIVATE
    GGML_USE_CPU
    _GNU_SOURCE
)

# Build whisper library
add_library(whisper STATIC ${WHISPER_SOURCES})
target_include_directories(whisper PUBLIC
    ${WHISPER_DIR}/include
    ${WHISPER_DIR}/src
    ${WHISPER_DIR}/ggml/include
)
target_link_libraries(whisper ggml)

# Build JNI bridge
add_library(whisper_jni SHARED whisper_jni.cpp)
target_include_directories(whisper_jni PRIVATE
    ${WHISPER_DIR}/include
    ${WHISPER_DIR}/ggml/include
)
target_link_libraries(whisper_jni
    whisper
    ggml
    android
    log
)
