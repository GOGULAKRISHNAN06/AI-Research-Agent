import os
import json
import google.generativeai as genai

COMPARISON_SYSTEM_INSTRUCTION = (
    "You are a comparative literature and research analyst. "
    "Compare the two provided document texts and produce a structured JSON comparison matrix. "
    "Identify their respective research objectives, methods/methodology, key results, and conclusions, "
    "and write a concise comparison for each section highlighting similarities, differences, and strengths."
)

COMPARISON_SCHEMA_PROMPT = """
You must output a JSON object matching this exact structure:
{
  "doc1": {
    "title": "string (Title of first document)",
    "objectives": "string (Objectives of first document)",
    "methods": "string (Methods used in first document)",
    "results": "string (Key results of first document)",
    "conclusions": "string (Main conclusions of first document)"
  },
  "doc2": {
    "title": "string (Title of second document)",
    "objectives": "string (Objectives of second document)",
    "methods": "string (Methods used in second document)",
    "results": "string (Key results of second document)",
    "conclusions": "string (Main conclusions of second document)"
  },
  "comparison": {
    "objectives_diff": "string (Synthesized comparison of objectives)",
    "methods_diff": "string (Synthesized comparison of methods)",
    "results_diff": "string (Synthesized comparison of results)",
    "conclusions_diff": "string (Synthesized comparison of conclusions)"
  }
}
"""

def compare_documents(pages1: list[dict], pages2: list[dict], api_key=None, model_name="gemini-1.5-flash") -> dict:
    """Generates a side-by-side comparative analysis of two parsed document objects."""
    try:
        # Generate outline for document 1 (first 2 and last page)
        doc1_sample = []
        for i in range(min(2, len(pages1))):
            doc1_sample.append(pages1[i]["text"])
        if len(pages1) > 2:
            doc1_sample.append(pages1[-1]["text"])
        doc1_text = "\n\n".join(doc1_sample)
        
        # Generate outline for document 2 (first 2 and last page)
        doc2_sample = []
        for i in range(min(2, len(pages2))):
            doc2_sample.append(pages2[i]["text"])
        if len(pages2) > 2:
            doc2_sample.append(pages2[-1]["text"])
        doc2_text = "\n\n".join(doc2_sample)
        
        prompt = (
            f"--- Document 1 ---:\n{doc1_text[:12000]}\n\n"
            f"--- Document 2 ---:\n{doc2_text[:12000]}\n\n"
            f"Please compare the two documents side-by-side.\n"
            f"{COMPARISON_SCHEMA_PROMPT}"
        )
        
        # Configure Gemini
        if not api_key:
            api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("Gemini API key is missing. Please set it in Settings.")
            
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(
            model_name=model_name,
            system_instruction=COMPARISON_SYSTEM_INSTRUCTION
        )
        
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        
        try:
            return json.loads(response.text)
        except Exception:
            return {
                "doc1": {"title": "Doc 1", "objectives": "", "methods": "", "results": "", "conclusions": ""},
                "doc2": {"title": "Doc 2", "objectives": "", "methods": "", "results": "", "conclusions": ""},
                "comparison": {"objectives_diff": "Failed to parse comparative JSON.", "methods_diff": "", "results_diff": "", "conclusions_diff": ""}
            }
            
    except Exception as e:
        return {
            "error": str(e),
            "doc1": {"title": "Error", "objectives": "", "methods": "", "results": "", "conclusions": ""},
            "doc2": {"title": "Error", "objectives": "", "methods": "", "results": "", "conclusions": ""},
            "comparison": {"objectives_diff": str(e), "methods_diff": "", "results_diff": "", "conclusions_diff": ""}
        }
