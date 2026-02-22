package com.voicenotes.app

import android.content.Context
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.io.RandomAccessFile
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Converts audio files (M4A, AAC, etc.) to WAV format
 * compatible with whisper.cpp (16kHz, 16-bit, mono PCM).
 */
object AudioConverter {

    private const val TAG = "AudioConverter"
    private const val TARGET_SAMPLE_RATE = 16000
    private const val TARGET_CHANNELS = 1
    private const val TARGET_BIT_DEPTH = 16

    /**
     * Convert an audio file to 16kHz mono 16-bit WAV.
     *
     * @param context Android context
     * @param inputPath Path to input audio file (M4A, AAC, etc.)
     * @return Path to converted WAV file, or null on failure
     */
    suspend fun convertToWav(context: Context, inputPath: String): String? =
        withContext(Dispatchers.IO) {
            try {
                Log.i(TAG, "Converting: $inputPath")

                val inputFile = File(inputPath)
                if (!inputFile.exists()) {
                    Log.e(TAG, "Input file not found: $inputPath")
                    return@withContext null
                }

                // Output WAV path
                val cacheDir = File(context.cacheDir, "wav_cache")
                if (!cacheDir.exists()) cacheDir.mkdirs()
                val outputPath = File(cacheDir, "converted_${System.currentTimeMillis()}.wav")
                    .absolutePath

                // Decode audio to raw PCM
                val pcmData = decodeAudioToPcm(inputPath) ?: return@withContext null

                // Resample if needed and write WAV
                writeWavFile(outputPath, pcmData.samples, pcmData.sampleRate, pcmData.channels)

                Log.i(TAG, "Conversion complete: $outputPath")
                outputPath
            } catch (e: Exception) {
                Log.e(TAG, "Conversion failed", e)
                null
            }
        }

    /**
     * Decode audio file to raw PCM using Android MediaCodec.
     */
    private fun decodeAudioToPcm(inputPath: String): PcmData? {
        val extractor = MediaExtractor()

        try {
            extractor.setDataSource(inputPath)

            // Find audio track
            var audioTrackIndex = -1
            var audioFormat: MediaFormat? = null
            for (i in 0 until extractor.trackCount) {
                val format = extractor.getTrackFormat(i)
                val mime = format.getString(MediaFormat.KEY_MIME) ?: ""
                if (mime.startsWith("audio/")) {
                    audioTrackIndex = i
                    audioFormat = format
                    break
                }
            }

            if (audioTrackIndex < 0 || audioFormat == null) {
                Log.e(TAG, "No audio track found")
                return null
            }

            extractor.selectTrack(audioTrackIndex)

            val mime = audioFormat.getString(MediaFormat.KEY_MIME) ?: return null
            val sampleRate = audioFormat.getInteger(MediaFormat.KEY_SAMPLE_RATE)
            val channels = audioFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT)

            Log.i(TAG, "Input: mime=$mime, rate=$sampleRate, channels=$channels")

            // Create decoder
            val codec = MediaCodec.createDecoderByType(mime)
            codec.configure(audioFormat, null, null, 0)
            codec.start()

            val allSamples = mutableListOf<Short>()
            val bufferInfo = MediaCodec.BufferInfo()
            var isEOS = false
            var inputDone = false

            while (!isEOS) {
                // Feed input
                if (!inputDone) {
                    val inputBufferIndex = codec.dequeueInputBuffer(10000)
                    if (inputBufferIndex >= 0) {
                        val inputBuffer = codec.getInputBuffer(inputBufferIndex)!!
                        val sampleSize = extractor.readSampleData(inputBuffer, 0)

                        if (sampleSize < 0) {
                            codec.queueInputBuffer(
                                inputBufferIndex, 0, 0, 0,
                                MediaCodec.BUFFER_FLAG_END_OF_STREAM
                            )
                            inputDone = true
                        } else {
                            codec.queueInputBuffer(
                                inputBufferIndex, 0, sampleSize,
                                extractor.sampleTime, 0
                            )
                            extractor.advance()
                        }
                    }
                }

                // Read output
                val outputBufferIndex = codec.dequeueOutputBuffer(bufferInfo, 10000)
                if (outputBufferIndex >= 0) {
                    val outputBuffer = codec.getOutputBuffer(outputBufferIndex)!!
                    val shortBuffer = outputBuffer.order(ByteOrder.LITTLE_ENDIAN).asShortBuffer()
                    val samples = ShortArray(shortBuffer.remaining())
                    shortBuffer.get(samples)
                    allSamples.addAll(samples.toList())

                    codec.releaseOutputBuffer(outputBufferIndex, false)

                    if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
                        isEOS = true
                    }
                }
            }

            codec.stop()
            codec.release()
            extractor.release()

            Log.i(TAG, "Decoded ${allSamples.size} samples at ${sampleRate}Hz, $channels ch")
            return PcmData(allSamples.toShortArray(), sampleRate, channels)

        } catch (e: Exception) {
            Log.e(TAG, "Decode error", e)
            extractor.release()
            return null
        }
    }

    /**
     * Resample and write PCM data as a WAV file (16kHz, mono, 16-bit).
     */
    private fun writeWavFile(
        outputPath: String,
        samples: ShortArray,
        sourceSampleRate: Int,
        sourceChannels: Int
    ) {
        // Step 1: Convert to mono if stereo
        val monoSamples = if (sourceChannels > 1) {
            val mono = ShortArray(samples.size / sourceChannels)
            for (i in mono.indices) {
                var sum = 0L
                for (c in 0 until sourceChannels) {
                    sum += samples[i * sourceChannels + c]
                }
                mono[i] = (sum / sourceChannels).toInt().toShort()
            }
            mono
        } else {
            samples
        }

        // Step 2: Resample to 16kHz if needed
        val resampled = if (sourceSampleRate != TARGET_SAMPLE_RATE) {
            resample(monoSamples, sourceSampleRate, TARGET_SAMPLE_RATE)
        } else {
            monoSamples
        }

        Log.i(TAG, "Writing WAV: ${resampled.size} samples at ${TARGET_SAMPLE_RATE}Hz")

        // Step 3: Write WAV file
        val dataSize = resampled.size * 2 // 16-bit = 2 bytes per sample
        val fileSize = 36 + dataSize

        RandomAccessFile(outputPath, "rw").use { raf ->
            // RIFF header
            raf.writeBytes("RIFF")
            raf.writeIntLE(fileSize)
            raf.writeBytes("WAVE")

            // fmt chunk
            raf.writeBytes("fmt ")
            raf.writeIntLE(16)                    // chunk size
            raf.writeShortLE(1)                   // PCM format
            raf.writeShortLE(TARGET_CHANNELS)     // mono
            raf.writeIntLE(TARGET_SAMPLE_RATE)    // sample rate
            raf.writeIntLE(TARGET_SAMPLE_RATE * TARGET_CHANNELS * TARGET_BIT_DEPTH / 8) // byte rate
            raf.writeShortLE(TARGET_CHANNELS * TARGET_BIT_DEPTH / 8) // block align
            raf.writeShortLE(TARGET_BIT_DEPTH)    // bits per sample

            // data chunk
            raf.writeBytes("data")
            raf.writeIntLE(dataSize)

            // Write PCM samples
            val buffer = ByteBuffer.allocate(resampled.size * 2)
                .order(ByteOrder.LITTLE_ENDIAN)
            for (sample in resampled) {
                buffer.putShort(sample)
            }
            raf.write(buffer.array())
        }
    }

    /**
     * Simple linear interpolation resampling.
     */
    private fun resample(input: ShortArray, fromRate: Int, toRate: Int): ShortArray {
        if (fromRate == toRate) return input

        val ratio = fromRate.toDouble() / toRate.toDouble()
        val outputSize = (input.size / ratio).toInt()
        val output = ShortArray(outputSize)

        for (i in output.indices) {
            val srcIndex = i * ratio
            val index = srcIndex.toInt()
            val fraction = srcIndex - index

            if (index + 1 < input.size) {
                val sample = input[index] * (1.0 - fraction) + input[index + 1] * fraction
                output[i] = sample.toInt().coerceIn(Short.MIN_VALUE.toInt(), Short.MAX_VALUE.toInt()).toShort()
            } else if (index < input.size) {
                output[i] = input[index]
            }
        }

        return output
    }

    // Helper extensions for writing little-endian
    private fun RandomAccessFile.writeIntLE(value: Int) {
        write(value and 0xFF)
        write((value shr 8) and 0xFF)
        write((value shr 16) and 0xFF)
        write((value shr 24) and 0xFF)
    }

    private fun RandomAccessFile.writeShortLE(value: Int) {
        write(value and 0xFF)
        write((value shr 8) and 0xFF)
    }

    /**
     * Clean up cached WAV files.
     */
    fun cleanCache(context: Context) {
        val cacheDir = File(context.cacheDir, "wav_cache")
        if (cacheDir.exists()) {
            cacheDir.listFiles()?.forEach { it.delete() }
        }
    }

    private data class PcmData(
        val samples: ShortArray,
        val sampleRate: Int,
        val channels: Int
    )
}
