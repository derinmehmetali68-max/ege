cmake_minimum_required(VERSION 3.22.1)
project("whisper_android" C CXX)

# whisper.cpp source directory (downloaded via setup_whisper.sh)
set(WHISPER_DIR ${CMAKE_CURRENT_SOURCE_DIR}/whisper.cpp)

# Check if whisper.cpp exists
if(NOT EXISTS "${WHISPER_DIR}/whisper.h")
    message(FATAL_ERROR
        "whisper.cpp source not found at ${WHISPER_DIR}\n"
        "Run ./setup_whisper.sh from the project root to download it."
    )
endif()

# ggml core sources
set(GGML_SOURCES
    ${WHISPER_DIR}/ggml/src/ggml.c
    ${WHISPER_DIR}/ggml/src/ggml-alloc.c
    ${WHISPER_DIR}/ggml/src/ggml-backend.c
    ${WHISPER_DIR}/ggml/src/ggml-backend-reg.cpp
    ${WHISPER_DIR}/ggml/src/ggml-opt.cpp
    ${WHISPER_DIR}/ggml/src/ggml-quants.c
    ${WHISPER_DIR}/ggml/src/ggml-threading.cpp
    ${WHISPER_DIR}/ggml/src/ggml-cpu/ggml-cpu.c
    ${WHISPER_DIR}/ggml/src/ggml-cpu/ggml-cpu.cpp
    ${WHISPER_DIR}/ggml/src/ggml-cpu/ggml-cpu-aarch64.cpp
    ${WHISPER_DIR}/ggml/src/ggml-cpu/ggml-cpu-quants.c
    ${WHISPER_DIR}/ggml/src/ggml-cpu/ggml-cpu-traits.cpp
    ${WHISPER_DIR}/ggml/src/ggml-cpu/amx/amx.cpp
    ${WHISPER_DIR}/ggml/src/ggml-cpu/amx/mmq.cpp
)

# whisper.cpp sources
set(WHISPER_SOURCES
    ${WHISPER_DIR}/src/whisper.cpp
)

# Compile flags
set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -O3 -DNDEBUG -pthread")
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -O3 -DNDEBUG -std=c++17 -pthread")

# Build ggml library
add_library(ggml STATIC ${GGML_SOURCES})
target_include_directories(ggml PUBLIC
    ${WHISPER_DIR}/ggml/include
    ${WHISPER_DIR}/ggml/src
    ${WHISPER_DIR}/ggml/src/ggml-cpu
)
target_compile_definitions(ggml PRIVATE
    GGML_USE_CPU
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
