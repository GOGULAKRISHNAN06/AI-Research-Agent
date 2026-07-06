import pdfplumber
import re
import os

def clean_text(text: str) -> str:
    """Cleans up raw text extracted from PDF, joining broken lines and removing excess whitespace."""
    if not text:
        return ""
    # Fix hyphenated words at line boundaries (e.g. "deve- \nlopment" -> "development")
    text = re.sub(r'(\w+)-\s*\n\s*(\w+)', r'\1\2', text)
    # Normalize unicode spaces and clean up characters
    text = text.replace('\xa0', ' ')
    
    # Split text into paragraphs based on double newlines
    paragraphs = text.split('\n\n')
    cleaned_paragraphs = []
    
    for p in paragraphs:
        # replace single newlines with space, and double spaces with single space
        p_clean = re.sub(r'\s+', ' ', p).strip()
        if p_clean:
            cleaned_paragraphs.append(p_clean)
            
    return "\n\n".join(cleaned_paragraphs)

def extract_pdf_data(file_path: str):
    """Extracts text page-by-page, extracts headings, paragraphs, and estimates readability statistics."""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")
        
    pages_data = []
    total_words = 0
    
    try:
        with pdfplumber.open(file_path) as pdf:
            if not pdf.pages:
                raise ValueError("The uploaded PDF is empty or corrupted.")
                
            for idx, page in enumerate(pdf.pages):
                page_num = idx + 1
                text = page.extract_text() or ""
                cleaned = clean_text(text)
                
                # Word count for this page
                words = len(cleaned.split())
                total_words += words
                
                # Simple heading extraction: lines starting with section numbers or short uppercase lines
                headings = []
                lines = text.split('\n')
                for line in lines:
                    line = line.strip()
                    # Match headers like "1. Introduction", "1.1 Background", "I. INTRODUCTION", "ABSTRACT"
                    if (re.match(r'^([0-9\.]+|[I|V|X|L|C|D|M]+\.?)\s+[A-Z\w]', line) or 
                        (line.isupper() and len(line) < 60 and len(line) > 3)):
                        headings.append(line)
                
                # Split into paragraphs
                paragraphs = [p for p in cleaned.split('\n\n') if p.strip()]
                
                pages_data.append({
                    "page": page_num,
                    "text": cleaned,
                    "headings": headings,
                    "paragraphs": paragraphs,
                    "word_count": words
                })
    except Exception as e:
        raise ValueError(f"Failed to parse PDF: {str(e)}")
        
    if not pages_data or sum(len(p["text"]) for p in pages_data) == 0:
        raise ValueError("No text could be extracted from this PDF. It might be scanned, empty, or corrupted.")
        
    # Calculate stats
    page_count = len(pages_data)
    reading_time_min = max(1, round(total_words / 200))
    
    # Estimate difficulty level
    all_sentences = []
    long_words_count = 0
    all_words = []
    for p in pages_data:
        p_text = p["text"]
        sentences = re.split(r'[\.\!\?]\s+', p_text)
        all_sentences.extend([s for s in sentences if s.strip()])
        w_list = p_text.split()
        all_words.extend(w_list)
        for w in w_list:
            # strip punctuation and check length
            w_clean = re.sub(r'\W', '', w)
            if len(w_clean) > 8:
                long_words_count += 1
                
    avg_sentence_len = len(all_words) / max(1, len(all_sentences))
    pct_long_words = (long_words_count / max(1, len(all_words))) * 100
    
    if avg_sentence_len < 14 and pct_long_words < 18:
        difficulty = "Easy"
    elif avg_sentence_len > 22 or pct_long_words > 25:
        difficulty = "Hard"
    else:
        difficulty = "Medium"
        
    return {
        "pages": pages_data,
        "page_count": page_count,
        "word_count": total_words,
        "reading_time_minutes": reading_time_min,
        "difficulty": difficulty
    }
