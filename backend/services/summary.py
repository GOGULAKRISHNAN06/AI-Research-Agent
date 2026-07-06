import os
import json
import google.generativeai as genai

SUMMARY_SYSTEM_INSTRUCTION = (
    "You are an expert research synthesiser. "
    "Analyze the provided document text and generate three distinct summaries:\n"
    "1. A Short Summary (50-100 words): Focusing on the core objective and main contribution.\n"
    "2. A Medium Summary (~250 words): Describing the purpose, method, key results, and conclusion.\n"
    "3. A Detailed Summary (500+ words): A comprehensive breakdown highlighting background, method, results, formulas, findings, limitations, and impact."
)

SUMMARY_SCHEMA_PROMPT = """
You must output a JSON object with this exact structure:
{
  "short": "string (50-100 words summary)",
  "medium": "string (~250 words summary)",
  "detailed": "string (500+ words comprehensive summary)"
}
"""

def generate_summaries(pages: list[dict], api_key=None, model_name="gemini-1.5-flash") -> dict:
    """Smart-compiles text from the document and generates three summary styles in one LLM call."""
    try:
        # Create a representative document outline to avoid blowing up token limits on very long PDFs
        # while keeping crucial parts (Intro, Outro, Headings)
        page_count = len(pages)
        summary_context = ""
        
        # Collect all headings first
        headings = []
        for p in pages:
            headings.extend(p.get("headings", []))
        
        unique_headings = []
        for h in headings:
            if h not in unique_headings:
                unique_headings.append(h)
                
        headings_summary = "\n".join(unique_headings[:40]) # limit to first 40 headings
        
        # Compile text sample: first 3 pages + last 2 pages
        text_samples = []
        
        # First 3 pages (usually Abstract + Introduction)
        for i in range(min(3, page_count)):
            text_samples.append(f"--- Page {pages[i]['page']} ---\n{pages[i]['text']}")
            
        # Middle page if pages > 5
        if page_count > 5:
            mid_idx = page_count // 2
            text_samples.append(f"--- Page {pages[mid_idx]['page']} (Mid-section) ---\n{pages[mid_idx]['text'][:1000]}...")
            
        # Last 2 pages (usually Results + Conclusion)
        if page_count > 3:
            start_last = max(3, page_count - 2)
            for i in range(start_last, page_count):
                text_samples.append(f"--- Page {pages[i]['page']} ---\n{pages[i]['text']}")
                
        document_sample = "\n\n".join(text_samples)
        
        # Compose prompt
        prompt = (
            f"Document Headings:\n{headings_summary}\n\n"
            f"Document Key Text Excerpts:\n{document_sample}\n\n"
            f"Please generate the short, medium, and detailed summaries as requested.\n"
            f"{SUMMARY_SCHEMA_PROMPT}"
        )
        
        # Configure Gemini
        if not api_key:
            api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("Gemini API key is missing. Please set it in Settings.")
            
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(
            model_name=model_name,
            system_instruction=SUMMARY_SYSTEM_INSTRUCTION
        )
        
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        
        try:
            return json.loads(response.text)
        except Exception:
            return {
                "short": "Failed to parse short summary in JSON format.",
                "medium": "Failed to parse medium summary in JSON format.",
                "detailed": response.text
            }
            
    except Exception as e:
        return {
            "short": f"Error: {str(e)}",
            "medium": f"Error: {str(e)}",
            "detailed": f"Error generating summary: {str(e)}"
        }
