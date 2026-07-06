import os
import json
import random
import google.generativeai as genai

QUIZ_SYSTEM_INSTRUCTION = (
    "You are an academic test generator. Generate high-quality multiple-choice questions "
    "to test a reader's comprehension of the provided document text. "
    "Each question must be factual and directly answered by the document. "
    "Each question must have exactly 4 choices, only one of which is correct. "
    "Provide a detailed, helpful academic explanation for the correct choice."
)

QUIZ_SCHEMA_PROMPT = """
You must output a JSON object containing a list of questions:
{
  "quizzes": [
    {
      "question": "string (the question content)",
      "options": ["string (Option A)", "string (Option B)", "string (Option C)", "string (Option D)"],
      "correct_answer": "string (the exact matching string of the correct option from the options list)",
      "explanation": "string (detailed explanation of why the correct option is correct based on the text)"
    }
  ]
}
"""

def generate_quiz(pages: list[dict], num_questions: int, api_key=None, model_name="gemini-1.5-flash") -> dict:
    """Generates a multiple choice quiz based on document content."""
    try:
        # Create context sample
        page_count = len(pages)
        sample_size = min(8, page_count)
        
        # Randomly sample up to 8 pages to gather questions from different parts of the document
        sampled_pages = sorted(random.sample(pages, sample_size), key=lambda x: x["page"])
        context_str = "\n\n".join([f"--- Page {p['page']} ---\n{p['text']}" for p in sampled_pages])
        
        prompt = (
            f"Generate exactly {num_questions} multiple choice questions from this text:\n\n"
            f"{context_str[:25000]}\n\n" # limit to ~25k chars for prompt safety
            f"{QUIZ_SCHEMA_PROMPT}"
        )
        
        # Configure Gemini
        if not api_key:
            api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("Gemini API key is missing. Please set it in Settings.")
            
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(
            model_name=model_name,
            system_instruction=QUIZ_SYSTEM_INSTRUCTION
        )
        
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        
        try:
            return json.loads(response.text)
        except Exception:
            return {"quizzes": []}
            
    except Exception as e:
        return {"error": str(e), "quizzes": []}
