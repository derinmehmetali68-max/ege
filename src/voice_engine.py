"""Voice Engine: ElevenLabs integration for Atatürk voice cloning.

The voice cloning process (as described in the video):
1. Clean historical audio recordings (remove noise/music with Vocal Remover)
2. Enhance audio clarity (Adobe Enhance or similar)
3. Clone voice using ElevenLabs API
4. Use conversational tone recordings (not formal Nutuk tone)
5. Synthetic data loop: generate samples, pick best ones, re-feed to model

This module handles the text-to-speech conversion using a pre-cloned voice.
"""

import io
from typing import Optional

import config

# ElevenLabs is optional - voice features only work if installed and configured
try:
    from elevenlabs import ElevenLabs

    ELEVENLABS_AVAILABLE = True
except ImportError:
    ELEVENLABS_AVAILABLE = False


class VoiceEngine:
    """Text-to-speech using ElevenLabs cloned Atatürk voice."""

    def __init__(self, api_key: str = "", voice_id: str = ""):
        self.api_key = api_key or config.ELEVENLABS_API_KEY
        self.voice_id = voice_id or config.ELEVENLABS_VOICE_ID
        self.client = None

        if ELEVENLABS_AVAILABLE and self.api_key:
            self.client = ElevenLabs(api_key=self.api_key)

    @property
    def available(self) -> bool:
        """Check if voice engine is properly configured."""
        return self.client is not None and bool(self.voice_id)

    def text_to_speech(self, text: str) -> Optional[bytes]:
        """Convert text to speech using the cloned Atatürk voice.

        Args:
            text: Turkish text to convert to speech

        Returns:
            Audio bytes (MP3 format) or None if not available
        """
        if not self.available:
            return None

        audio_generator = self.client.text_to_speech.convert(
            voice_id=self.voice_id,
            text=text,
            model_id="eleven_multilingual_v2",
            output_format="mp3_44100_128",
        )

        # Collect audio bytes from generator
        audio_bytes = b""
        for chunk in audio_generator:
            audio_bytes += chunk

        return audio_bytes

    def text_to_speech_stream(self, text: str):
        """Stream audio generation for real-time playback.

        Yields audio chunks as they're generated.
        """
        if not self.available:
            return

        audio_generator = self.client.text_to_speech.convert(
            voice_id=self.voice_id,
            text=text,
            model_id="eleven_multilingual_v2",
            output_format="mp3_44100_128",
        )

        yield from audio_generator

    def list_voices(self) -> list:
        """List available voices (useful for finding cloned voice IDs)."""
        if not self.client:
            return []

        response = self.client.voices.get_all()
        return [
            {"name": v.name, "voice_id": v.voice_id, "category": v.category}
            for v in response.voices
        ]
