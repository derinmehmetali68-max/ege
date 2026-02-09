"""RAG Engine: ChromaDB vector store + OpenAI GPT-4 for Atatürk persona chatbot.

This is a custom RAG implementation (no LangChain) as described in the video -
LangChain was removed due to performance issues and summarization loops corrupting data.
"""

import os
from typing import List, Optional

import chromadb
from openai import OpenAI

import config
from src.document_loader import load_all_documents
from src.embeddings import get_embeddings, get_single_embedding
from src.persona import ATATURK_SYSTEM_PROMPT


class RAGEngine:
    """Custom RAG engine using ChromaDB + OpenAI (no LangChain).

    Architecture:
    1. Documents are chunked and embedded into ChromaDB
    2. User queries are embedded and matched against stored vectors
    3. Top-K relevant chunks are retrieved as context
    4. GPT-4 generates a response using Atatürk persona + retrieved context
    """

    def __init__(self, api_key: str = ""):
        self.api_key = api_key or config.OPENAI_API_KEY
        if not self.api_key:
            raise ValueError("OpenAI API key required. Set OPENAI_API_KEY in .env")

        self.openai_client = OpenAI(api_key=self.api_key)

        # Initialize ChromaDB (persistent storage)
        self.chroma_client = chromadb.Client(
            chromadb.Settings(
                persist_directory=config.CHROMA_PERSIST_DIR,
                anonymized_telemetry=False,
            )
        )

        self.collection = self.chroma_client.get_or_create_collection(
            name=config.COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )

        self._initialized = False

    def initialize(self, data_dir: str = "") -> int:
        """Load documents into ChromaDB if not already loaded.

        Returns the number of chunks in the collection.
        """
        data_dir = data_dir or config.DATA_DIR

        # Skip if collection already has data
        if self.collection.count() > 0:
            self._initialized = True
            return self.collection.count()

        # Load and chunk documents
        chunks, metadatas = load_all_documents(
            data_dir,
            chunk_size=config.CHUNK_SIZE,
            chunk_overlap=config.CHUNK_OVERLAP,
        )

        if not chunks:
            raise ValueError(f"No documents found in {data_dir}")

        # Generate embeddings
        embeddings = get_embeddings(chunks, self.api_key)

        # Store in ChromaDB
        ids = [f"chunk_{i}" for i in range(len(chunks))]
        self.collection.add(
            ids=ids,
            documents=chunks,
            embeddings=embeddings,
            metadatas=metadatas,
        )

        self._initialized = True
        return len(chunks)

    def retrieve(self, query: str, top_k: int = 0) -> List[str]:
        """Retrieve the most relevant document chunks for a query.

        Args:
            query: user's question
            top_k: number of results to return (default from config)

        Returns:
            List of relevant text chunks
        """
        if not self._initialized:
            self.initialize()

        top_k = top_k or config.TOP_K_RESULTS
        query_embedding = get_single_embedding(query, self.api_key)

        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
        )

        # ChromaDB returns nested lists
        documents = results.get("documents", [[]])[0]
        return documents

    def generate_response(
        self,
        question: str,
        context_chunks: Optional[List[str]] = None,
        conversation_history: Optional[List[dict]] = None,
    ) -> str:
        """Generate a response as Atatürk using retrieved context.

        Args:
            question: user's question
            context_chunks: pre-retrieved context (if None, retrieves automatically)
            conversation_history: previous messages for multi-turn conversation

        Returns:
            Atatürk's response as a string
        """
        if context_chunks is None:
            context_chunks = self.retrieve(question)

        # Build context string from retrieved chunks
        context_text = "\n\n---\n\n".join(context_chunks) if context_chunks else ""

        # Build messages
        messages = [{"role": "system", "content": ATATURK_SYSTEM_PROMPT}]

        if context_text:
            messages.append({
                "role": "system",
                "content": f"Aşağıdaki bağlam bilgisini cevap verirken referans olarak kullan:\n\n{context_text}",
            })

        # Add conversation history if available
        if conversation_history:
            messages.extend(conversation_history)

        messages.append({"role": "user", "content": question})

        response = self.openai_client.chat.completions.create(
            model=config.OPENAI_MODEL,
            messages=messages,
            temperature=0.7,
            max_tokens=1024,
        )

        return response.choices[0].message.content

    def ask(
        self,
        question: str,
        conversation_history: Optional[List[dict]] = None,
    ) -> str:
        """High-level method: retrieve context + generate response.

        This is the main entry point for the chatbot.
        """
        if not self._initialized:
            self.initialize()

        context_chunks = self.retrieve(question)
        return self.generate_response(question, context_chunks, conversation_history)

    def reset(self):
        """Clear the vector database and reset state."""
        self.chroma_client.delete_collection(config.COLLECTION_NAME)
        self.collection = self.chroma_client.get_or_create_collection(
            name=config.COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
        self._initialized = False
