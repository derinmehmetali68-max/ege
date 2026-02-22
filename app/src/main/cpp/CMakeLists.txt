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

# Disable GPU backends and extras - CPU only for Android
set(GGML_CUDA OFF CACHE BOOL "" FORCE)
set(GGML_METAL OFF CACHE BOOL "" FORCE)
set(GGML_VULKAN OFF CACHE BOOL "" FORCE)
set(GGML_SYCL OFF CACHE BOOL "" FORCE)
set(GGML_RPC OFF CACHE BOOL "" FORCE)
set(GGML_KOMPUTE OFF CACHE BOOL "" FORCE)
set(GGML_CANN OFF CACHE BOOL "" FORCE)
set(GGML_BLAS OFF CACHE BOOL "" FORCE)
set(GGML_HIPBLAS OFF CACHE BOOL "" FORCE)
set(GGML_OPENMP OFF CACHE BOOL "" FORCE)
set(GGML_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(GGML_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(WHISPER_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(WHISPER_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(WHISPER_BUILD_SERVER OFF CACHE BOOL "" FORCE)
set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)

# Compile flags
set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -O3 -DNDEBUG")
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -O3 -DNDEBUG -std=c++17")

# Use whisper.cpp's own build system
add_subdirectory(${WHISPER_DIR} whisper.cpp.build)

# Build JNI bridge
add_library(whisper_jni SHARED whisper_jni.cpp)
target_include_directories(whisper_jni PRIVATE
    ${WHISPER_DIR}/include
    ${WHISPER_DIR}/ggml/include
)
target_link_libraries(whisper_jni
    whisper
    android
    log
)
