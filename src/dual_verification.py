"""Dual Verification (Paralaks) Algorithm.

Inspired by the parallax method used to measure star distances -
instead of trusting a single data point, verify from two different angles.

The algorithm:
1. Generate a response using RAG (first angle)
2. Ask a separate verification LLM call to cross-check the response
   against the retrieved context (second angle)
3. If verification fails, regenerate with corrections

This prevents hallucinations by ensuring the AI's response is consistent
with the actual knowledge base, not fabricated.
"""

from typing import List, Optional

from openai import OpenAI

import config
from src.persona import VERIFICATION_PROMPT


class DualVerifier:
    """Parallax-style dual verification to catch hallucinations."""

    def __init__(self, api_key: str = ""):
        self.api_key = api_key or config.OPENAI_API_KEY
        self.client = OpenAI(api_key=self.api_key)

    def verify(
        self,
        question: str,
        answer: str,
        context_chunks: List[str],
    ) -> dict:
        """Verify an answer against context using a second LLM pass.

        Args:
            question: the original question
            answer: the generated answer to verify
            context_chunks: the retrieved context documents

        Returns:
            dict with keys:
                - verified: bool
                - result: "DOĞRULANDI" or correction details
                - corrected_answer: optional corrected answer
        """
        context_text = "\n\n---\n\n".join(context_chunks)

        prompt = VERIFICATION_PROMPT.format(
            context=context_text,
            answer=answer,
            question=question,
        )

        response = self.client.chat.completions.create(
            model=config.OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "Sen tarihsel doğruluk kontrolü yapan bir uzman sistemsin. "
                    "Verilen cevabı bağlam bilgisiyle karşılaştır ve doğrula.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.1,  # Low temperature for more deterministic verification
            max_tokens=512,
        )

        result_text = response.choices[0].message.content.strip()

        if "DOĞRULANDI" in result_text:
            return {
                "verified": True,
                "result": result_text,
                "corrected_answer": None,
            }
        else:
            return {
                "verified": False,
                "result": result_text,
                "corrected_answer": self._extract_correction(result_text),
            }

    def _extract_correction(self, verification_result: str) -> Optional[str]:
        """Extract the suggested correction from verification result."""
        # Look for text after "DÜZELTME GEREKLİ:"
        marker = "DÜZELTME GEREKLİ:"
        idx = verification_result.find(marker)
        if idx != -1:
            return verification_result[idx + len(marker):].strip()
        return None

    def verified_ask(self, rag_engine, question: str, conversation_history=None, max_attempts: int = 2) -> dict:
        """Ask a question with dual verification.

        Generates a response, verifies it, and retries if needed.

        Args:
            rag_engine: RAGEngine instance
            question: user question
            conversation_history: chat history
            max_attempts: max generation attempts before accepting

        Returns:
            dict with keys:
                - answer: final answer string
                - verified: whether answer passed verification
                - attempts: number of generation attempts
                - context: retrieved context chunks
        """
        context_chunks = rag_engine.retrieve(question)

        for attempt in range(1, max_attempts + 1):
            answer = rag_engine.generate_response(
                question, context_chunks, conversation_history
            )

            verification = self.verify(question, answer, context_chunks)

            if verification["verified"]:
                return {
                    "answer": answer,
                    "verified": True,
                    "attempts": attempt,
                    "context": context_chunks,
                }

            # If not verified and we have a correction, use it as guidance
            if verification["corrected_answer"] and attempt < max_attempts:
                # Add correction guidance to context for next attempt
                context_chunks.append(
                    f"[Doğrulama Notu]: {verification['corrected_answer']}"
                )

        # Return last answer even if not fully verified
        return {
            "answer": answer,
            "verified": False,
            "attempts": max_attempts,
            "context": context_chunks,
        }
