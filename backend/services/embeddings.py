import os
import google.generativeai as genai

class LocalEmbeddings:
    """Offline embedding generator using sentence-transformers (all-MiniLM-L6-v2)."""
    def __init__(self, model_name="all-MiniLM-L6-v2"):
        try:
            from sentence_transformers import SentenceTransformer
            self.model = SentenceTransformer(model_name)
        except ImportError:
            raise ImportError(
                "Local sentence-transformers package is not installed. "
                "Please run 'pip install sentence-transformers' in your virtual environment, "
                "or switch to 'Gemini API' embeddings in the Settings tab."
            )
        
    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        embeddings = self.model.encode(texts, show_progress_bar=False)
        return embeddings.tolist()
        
    def embed_query(self, text: str) -> list[float]:
        embedding = self.model.encode([text], show_progress_bar=False)[0]
        return embedding.tolist()

class GeminiEmbeddings:
    """Online embedding generator using Gemini's text-embedding-004 model."""
    def __init__(self, api_key: str):
        genai.configure(api_key=api_key)
        
    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        # Gemini API supports batching
        try:
            result = genai.embed_content(
                model="models/text-embedding-004",
                content=texts,
                task_type="retrieval_document"
            )
            return result['embedding']
        except Exception as e:
            raise ValueError(f"Gemini Embedding API failed: {str(e)}")
            
    def embed_query(self, text: str) -> list[float]:
        try:
            result = genai.embed_content(
                model="models/text-embedding-004",
                content=text,
                task_type="retrieval_query"
            )
            return result['embedding'][0] if isinstance(result['embedding'][0], list) else result['embedding']
        except Exception as e:
            raise ValueError(f"Gemini Embedding API failed: {str(e)}")

def get_embedding_model(model_type="local", api_key=None):
    """Factory function to retrieve selected embedding model."""
    resolved_api_key = api_key or os.getenv("GEMINI_API_KEY")
    if model_type == "gemini" and resolved_api_key:
        return GeminiEmbeddings(api_key=resolved_api_key)
    # Default fallback is local sentence-transformers
    return LocalEmbeddings()
