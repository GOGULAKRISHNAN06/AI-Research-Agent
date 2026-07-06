import os
import json
import google.generativeai as genai
from backend.services.embeddings import get_embedding_model
from backend.services.rag import VectorStore

SYSTEM_INSTRUCTION = (
    "You are a strict, citation-aware AI Research Assistant. "
    "Answer the user's question using ONLY the provided document context. "
    "If the answer to the user's question cannot be found or reasonably inferred from the context, you MUST "
    "respond with the exact phrase: 'I couldn't find this information in the uploaded document.' "
    "Do not use external knowledge. Do not hallucinate or speculate. "
    "Provide a detailed, helpful answer if the context contains it. "
    "For each fact you state, extract the exact short text snippet and the page number where it occurs, "
    "and list them under citations. "
    "Provide a confidence score (from 0.0 to 1.0) indicating how directly the context supports the answer."
)

JSON_SCHEMA_PROMPT = """
You must output a JSON object matching this schema:
{
  "answer": "string (the answer text, or 'I couldn't find this information in the uploaded document.')",
  "citations": [
    {
      "page": "integer (the page number)",
      "snippet": "string (the exact exact sentence/phrase from the context that supports the answer)"
    }
  ],
  "confidence_score": "float (between 0.0 and 1.0)"
}
"""

def generate_rag_answer(
    question: str, 
    vector_db_path: str, 
    embedding_type="local", 
    api_key=None,
    beginner_mode=False,
    model_name="gemini-1.5-flash"
) -> dict:
    """Retrieves relevant chunks and sends them along with the query to Gemini to generate a citation-aware answer."""
    if not os.path.exists(vector_db_path):
        return {
            "answer": "I couldn't find this information in the uploaded document (vector database not found).",
            "citations": [],
            "confidence_score": 0.0
        }
        
    try:
        # Load embedding model and vector store
        embed_model = get_embedding_model(embedding_type, api_key)
        store = VectorStore.load(vector_db_path)
        
        # Get query embedding and search similar chunks
        query_vector = embed_model.embed_query(question)
        relevant_chunks = store.similarity_search(query_vector, k=5)
        
        if not relevant_chunks:
            return {
                "answer": "I couldn't find this information in the uploaded document.",
                "citations": [],
                "confidence_score": 0.0
            }
            
        # Format the context
        context_str = ""
        for i, chunk in enumerate(relevant_chunks):
            context_str += f"--- Chunk {i+1} (Source: Page {chunk['page']}) ---\n"
            context_str += f"{chunk['text']}\n\n"
            
        # Configure Gemini
        if not api_key:
            api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("Gemini API key is missing. Please set it in Settings.")
            
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(
            model_name=model_name,
            system_instruction=SYSTEM_INSTRUCTION
        )
        
        # Formulate query
        user_prompt = f"Context from the document:\n{context_str}\n"
        if beginner_mode:
            user_prompt += "User instruction: Explain the answer in simple English suitable for a beginner. Use analogies, examples, and simple bullet points. Avoid complex jargon.\n"
            
        user_prompt += f"Question: {question}\n\n{JSON_SCHEMA_PROMPT}"
        
        # Call Gemini in JSON mode
        response = model.generate_content(
            user_prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        
        try:
            result = json.loads(response.text)
        except Exception:
            # Fallback if LLM output was slightly malformed
            result = {
                "answer": response.text,
                "citations": [],
                "confidence_score": 0.5
            }
            
        # Double check: if similarity score is extremely poor and LLM gave high confidence, reduce it
        # In FAISS IndexFlatL2, distance is squared L2. A distance > 1.6 usually means poor match for normalized vectors
        if len(relevant_chunks) > 0 and relevant_chunks[0]['score'] > 1.8 and result["confidence_score"] > 0.4:
            # Check if LLM gave fallback answer
            if "couldn't find" in result["answer"].lower():
                result["confidence_score"] = 0.0
                
        return result
        
    except Exception as e:
        return {
            "answer": f"Error during answer generation: {str(e)}",
            "citations": [],
            "confidence_score": 0.0
        }
