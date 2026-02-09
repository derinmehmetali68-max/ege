"""Configuration for the Atatürk AI Chatbot."""

import os
from dotenv import load_dotenv

load_dotenv()

# OpenAI
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4")
EMBEDDING_MODEL = "text-embedding-3-small"

# ChromaDB
CHROMA_PERSIST_DIR = os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")
COLLECTION_NAME = "ataturk_knowledge"

# ElevenLabs
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "")

# RAG Settings
CHUNK_SIZE = 500
CHUNK_OVERLAP = 50
TOP_K_RESULTS = 5

# Dual Verification
VERIFICATION_THRESHOLD = 0.7

# Data path
DATA_DIR = os.path.join(os.path.dirname(__file__), "data", "ataturk_knowledge")
