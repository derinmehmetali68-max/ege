"""Embedding utilities using OpenAI's text-embedding model."""

from typing import List

from openai import OpenAI

import config


def get_embeddings(texts: List[str], api_key: str = "") -> List[List[float]]:
    """Generate embeddings for a list of texts using OpenAI API.

    Args:
        texts: list of text strings to embed
        api_key: OpenAI API key (falls back to config)

    Returns:
        List of embedding vectors
    """
    key = api_key or config.OPENAI_API_KEY
    if not key:
        raise ValueError("OpenAI API key is required. Set OPENAI_API_KEY in .env")

    client = OpenAI(api_key=key)

    # OpenAI recommends replacing newlines for better embedding quality
    cleaned = [t.replace("\n", " ") for t in texts]

    response = client.embeddings.create(
        input=cleaned,
        model=config.EMBEDDING_MODEL,
    )

    return [item.embedding for item in response.data]


def get_single_embedding(text: str, api_key: str = "") -> List[float]:
    """Generate embedding for a single text."""
    return get_embeddings([text], api_key)[0]
