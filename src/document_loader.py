"""Document loader: reads text/PDF files and splits them into chunks."""

import os
from typing import List


def load_text_file(file_path: str) -> str:
    """Read a text file and return its contents."""
    with open(file_path, "r", encoding="utf-8") as f:
        return f.read()


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> List[str]:
    """Split text into overlapping chunks by character count.

    Uses sentence-aware splitting: tries to break at sentence boundaries
    within the chunk_size window to avoid cutting mid-sentence.
    """
    if not text.strip():
        return []

    chunks = []
    start = 0
    text_len = len(text)

    while start < text_len:
        end = start + chunk_size

        if end < text_len:
            # Try to find a sentence boundary (period, newline) near the end
            boundary = text.rfind(".", start, end)
            if boundary == -1 or boundary <= start:
                boundary = text.rfind("\n", start, end)
            if boundary > start:
                end = boundary + 1

        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)

        start = end - overlap if end < text_len else text_len

    return chunks


def load_all_documents(data_dir: str, chunk_size: int = 500, chunk_overlap: int = 50) -> tuple[List[str], List[dict]]:
    """Load all .txt files from data_dir, chunk them, return (chunks, metadatas).

    Returns:
        chunks: list of text chunks
        metadatas: list of dicts with source filename for each chunk
    """
    chunks = []
    metadatas = []

    if not os.path.isdir(data_dir):
        raise FileNotFoundError(f"Data directory not found: {data_dir}")

    for filename in sorted(os.listdir(data_dir)):
        if not filename.endswith(".txt"):
            continue

        file_path = os.path.join(data_dir, filename)
        text = load_text_file(file_path)
        file_chunks = chunk_text(text, chunk_size, chunk_overlap)

        for i, chunk in enumerate(file_chunks):
            chunks.append(chunk)
            metadatas.append({"source": filename, "chunk_index": i})

    return chunks, metadatas
