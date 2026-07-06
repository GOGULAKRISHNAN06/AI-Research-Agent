import os
import json
import google.generativeai as genai

METADATA_SYSTEM_INSTRUCTION = (
    "You are a scholarly metadata extractor. "
    "Analyze the provided document text and extract the research metadata, "
    "the top keywords, and the bibliography list of references. "
    "For the bibliography, extract up to 20 references from the bibliography/reference section, "
    "splitting them into Title, Authors, and Year. "
    "For keywords, extract the top 20-30 keywords as simple string tags. "
    "Ensure all fields are filled accurately from the document. If a field cannot be found, leave it null or empty."
)

METADATA_SCHEMA_PROMPT = """
You must output a JSON object matching this exact structure:
{
  "metadata": {
    "title": "string (Title of the paper)",
    "authors": "string (Comma-separated authors list)",
    "year": "string (Publication year)",
    "journal": "string or null (Journal name if published in a journal)",
    "conference": "string or null (Conference name if published in a conference)",
    "doi": "string or null (Digital Object Identifier)",
    "abstract": "string (The abstract of the paper or a 100-word generated summary of the introduction if no abstract exists)"
  },
  "keywords": ["string (tag 1)", "string (tag 2)"],
  "references": [
    {
      "title": "string (title of reference paper)",
      "authors": "string (authors of reference)",
      "year": "string (year of reference publication)"
    }
  ]
}
"""

def extract_metadata(pages: list[dict], api_key=None, model_name="gemini-1.5-flash") -> dict:
    """Extracts research metadata, keywords, and bibliography from the PDF text."""
    try:
        # Sample text: first 2 pages (contains abstract, authors, title) 
        # and last 2 pages (contains bibliography/references)
        page_count = len(pages)
        sample_pages = []
        
        # First 2 pages
        for i in range(min(2, page_count)):
            sample_pages.append(f"--- Page {pages[i]['page']} ---\n{pages[i]['text']}")
            
        # Last 2 pages
        if page_count > 2:
            start_last = max(2, page_count - 2)
            for i in range(start_last, page_count):
                sample_pages.append(f"--- Page {pages[i]['page']} ---\n{pages[i]['text']}")
                
        context_str = "\n\n".join(sample_pages)
        
        prompt = (
            f"Extract academic metadata, keywords, and reference list from this text:\n\n"
            f"{context_str[:25000]}\n\n" # limit size
            f"{METADATA_SCHEMA_PROMPT}"
        )
        
        # Configure Gemini
        if not api_key:
            api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("Gemini API key is missing. Please set it in Settings.")
            
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(
            model_name=model_name,
            system_instruction=METADATA_SYSTEM_INSTRUCTION
        )
        
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        
        try:
            return json.loads(response.text)
        except Exception:
            return {
                "metadata": {"title": "Unknown Title", "authors": "Unknown", "year": "Unknown", "journal": None, "conference": None, "doi": None, "abstract": ""},
                "keywords": [],
                "references": []
            }
            
    except Exception as e:
        return {
            "error": str(e),
            "metadata": {"title": "Error", "authors": str(e), "year": "", "journal": None, "conference": None, "doi": None, "abstract": ""},
            "keywords": [],
            "references": []
        }
