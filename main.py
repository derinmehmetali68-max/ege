"""Atatürk AI Chatbot - Streamlit Interface.

A RAG-based chatbot that emulates Mustafa Kemal Atatürk's personality,
decision-making, and (optionally) voice using AI.

Usage:
    streamlit run main.py
"""

import base64
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(__file__))

import streamlit as st

import config
from src.rag_engine import RAGEngine
from src.dual_verification import DualVerifier
from src.voice_engine import VoiceEngine


def init_engines():
    """Initialize RAG engine, verifier, and voice engine (cached in session)."""
    if "rag_engine" not in st.session_state:
        try:
            engine = RAGEngine()
            chunk_count = engine.initialize()
            st.session_state.rag_engine = engine
            st.session_state.chunk_count = chunk_count
        except ValueError as e:
            st.error(f"Hata: {e}")
            st.stop()

    if "verifier" not in st.session_state:
        st.session_state.verifier = DualVerifier()

    if "voice_engine" not in st.session_state:
        st.session_state.voice_engine = VoiceEngine()

    if "messages" not in st.session_state:
        st.session_state.messages = []

    if "use_verification" not in st.session_state:
        st.session_state.use_verification = True

    if "use_voice" not in st.session_state:
        st.session_state.use_voice = False


def render_sidebar():
    """Render the settings sidebar."""
    with st.sidebar:
        st.title("Ayarlar")

        st.session_state.use_verification = st.checkbox(
            "Çift Doğrulama (Paralaks)",
            value=st.session_state.use_verification,
            help="Halüsinasyonları engellemek için cevabı ikinci bir LLM çağrısıyla doğrula",
        )

        voice_available = st.session_state.voice_engine.available
        st.session_state.use_voice = st.checkbox(
            "Ses Çıktısı (ElevenLabs)",
            value=st.session_state.use_voice,
            disabled=not voice_available,
            help="ElevenLabs ile klonlanmış Atatürk sesiyle cevap ver"
            + ("" if voice_available else " (API anahtarı gerekli)"),
        )

        st.divider()
        st.caption(f"Bilgi tabanı: {st.session_state.get('chunk_count', 0)} parça")
        st.caption(f"Model: {config.OPENAI_MODEL}")

        if st.button("Sohbeti Sıfırla"):
            st.session_state.messages = []
            st.rerun()

        st.divider()
        st.markdown(
            "### Hakkında\n"
            "Bu chatbot, Mustafa Kemal Atatürk'ün kişiliğini ve düşünce yapısını "
            "RAG (Retrieval Augmented Generation) teknolojisi ile simüle eder.\n\n"
            "**Teknolojiler:**\n"
            "- GPT-4 + ChromaDB (RAG)\n"
            "- Paralaks çift doğrulama\n"
            "- ElevenLabs ses klonlama\n"
        )


def get_conversation_history() -> list:
    """Convert session messages to OpenAI format for context."""
    history = []
    for msg in st.session_state.messages:
        role = "user" if msg["role"] == "user" else "assistant"
        history.append({"role": role, "content": msg["content"]})
    return history


def main():
    st.set_page_config(
        page_title="Atatürk AI Chatbot",
        page_icon="🇹🇷",
        layout="wide",
    )

    st.title("Atatürk AI Chatbot")
    st.caption(
        "Mustafa Kemal Atatürk'ün kişiliğini, düşünce yapısını ve karar mekanizmasını "
        "yapay zeka ile canlandıran bir sohbet botu."
    )

    init_engines()
    render_sidebar()

    # Display chat history
    for msg in st.session_state.messages:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])
            if msg.get("audio"):
                st.audio(msg["audio"], format="audio/mp3")
            if msg.get("verified") is not None:
                if msg["verified"]:
                    st.caption("✓ Doğrulandı (Paralaks)")
                else:
                    st.caption("⚠ Doğrulanamadı")

    # Chat input
    if prompt := st.chat_input("Atatürk'e bir soru sorun..."):
        # Display user message
        st.session_state.messages.append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)

        # Generate response
        with st.chat_message("assistant"):
            with st.spinner("Düşünüyorum..."):
                history = get_conversation_history()[:-1]  # Exclude current message
                rag = st.session_state.rag_engine

                if st.session_state.use_verification:
                    verifier = st.session_state.verifier
                    result = verifier.verified_ask(rag, prompt, history)
                    answer = result["answer"]
                    verified = result["verified"]
                else:
                    answer = rag.ask(prompt, history)
                    verified = None

            st.markdown(answer)

            # Voice output
            audio_bytes = None
            if st.session_state.use_voice and st.session_state.voice_engine.available:
                with st.spinner("Ses oluşturuluyor..."):
                    audio_bytes = st.session_state.voice_engine.text_to_speech(answer)
                    if audio_bytes:
                        st.audio(audio_bytes, format="audio/mp3")

            if verified is not None:
                if verified:
                    st.caption("✓ Doğrulandı (Paralaks)")
                else:
                    st.caption("⚠ Doğrulanamadı")

            # Save to history
            st.session_state.messages.append({
                "role": "assistant",
                "content": answer,
                "verified": verified,
                "audio": audio_bytes,
            })


if __name__ == "__main__":
    main()
