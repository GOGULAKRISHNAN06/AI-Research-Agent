import os
import json
import google.generativeai as genai

FLASHCARD_SYSTEM_INSTRUCTION = (
    "You are a study card creator. "
    "Identify key terms, core methodologies, essential equations, definitions, "
    "and findings in the text, and format them into concise Q&A flashcards. "
    "Keep the front of the card (the question/concept) clear and short. "
    "Keep the back of the card (the answer/definition) precise, informative, and easy to memorize."
)

FLASHCARD_SCHEMA_PROMPT = """
You must output a JSON object containing a list of flashcards:
{
  "flashcards": [
    {
      "front": "string (the question or concept, e.g., 'What is Backpropagation?')",
      "back": "string (the answer or definition, e.g., 'An algorithm used to calculate the gradient of the loss function in neural networks, moving backwards from output to inputs.')"
    }
  ]
}
"""

def generate_flashcards(pages: list[dict], api_key=None, model_name="gemini-1.5-flash") -> dict:
    """Generates study flashcards (Question/Answer format) based on the document."""
    try:
        # Sample text: first 2 pages + middle page + conclusion page
        page_count = len(pages)
        sample_pages = []
        
        sample_pages.append(pages[0])
        if page_count > 1:
            sample_pages.append(pages[1])
        if page_count > 4:
            sample_pages.append(pages[page_count // 2])
        if page_count > 2:
            sample_pages.append(pages[-1])
            
        context_str = "\n\n".join([f"--- Page {p['page']} ---\n{p['text']}" for p in sample_pages])
        
        prompt = (
            f"Generate 10 key flashcards based on this text:\n\n"
            f"{context_str[:20000]}\n\n"
            f"{FLASHCARD_SCHEMA_PROMPT}"
        )
        
        # Configure Gemini
        if not api_key:
            api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("Gemini API key is missing. Please set it in Settings.")
            
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(
            model_name=model_name,
            system_instruction=FLASHCARD_SYSTEM_INSTRUCTION
        )
        
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        
        try:
            return json.loads(response.text)
        except Exception:
            return {"flashcards": []}
            
    except Exception as e:
        return {"error": str(e), "flashcards": []}
