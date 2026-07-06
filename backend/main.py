import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
backend_env = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
if os.path.exists(backend_env):
    load_dotenv(backend_env)

import uuid
import json
import shutil
from typing import Optional, List
from fastapi import FastAPI, File, UploadFile, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, FileResponse as FastAPIFileResponse
from pydantic import BaseModel

# Services imports
from backend.services.pdf_parser import extract_pdf_data
from backend.services.embeddings import get_embedding_model
from backend.services.rag import RecursiveCharacterTextSplitter, VectorStore
from backend.services.chat import generate_rag_answer
from backend.services.summary import generate_summaries
from backend.services.quiz import generate_quiz
from backend.services.flashcards import generate_flashcards
from backend.services.metadata import extract_metadata
from backend.services.comparison import compare_documents
from backend.services.export import format_text_data, export_to_docx, export_to_pdf

# Directories
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_DIR = os.path.join(BASE_DIR, "backend", "uploads")
VECTOR_DB_DIR = os.path.join(BASE_DIR, "backend", "vector_db")
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(VECTOR_DB_DIR, exist_ok=True)
os.makedirs(FRONTEND_DIR, exist_ok=True)

app = FastAPI(title="AI Research Assistant Agent API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Key Header parsing utility
def get_api_key(api_key: Optional[str] = Header(None, alias="X-Gemini-API-Key")):
    return api_key

# Request Schemas
class ChatRequest(BaseModel):
    doc_id: str
    question: str
    beginner_mode: bool = False
    embedding_type: str = "local"
    api_key: Optional[str] = None

class SummaryRequest(BaseModel):
    doc_id: str
    api_key: Optional[str] = None

class QuizRequest(BaseModel):
    doc_id: str
    num_questions: int = 5
    api_key: Optional[str] = None

class FlashcardsRequest(BaseModel):
    doc_id: str
    api_key: Optional[str] = None

class MetadataRequest(BaseModel):
    doc_id: str
    api_key: Optional[str] = None

class ExportRequest(BaseModel):
    doc_id: str
    format: str # "pdf", "docx", "txt"
    title: str
    summary: Optional[dict] = None
    quiz: Optional[List[dict]] = None
    flashcards: Optional[List[dict]] = None
    key_points: Optional[List[str]] = None

# History Manager Helpers
HISTORY_FILE = os.path.join(UPLOAD_DIR, "history.json")

def load_history() -> list:
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, 'r') as f:
                return json.load(f)
        except Exception:
            return []
    return []

def save_history(history: list):
    with open(HISTORY_FILE, 'w') as f:
        json.dump(history, f, indent=2)

# Endpoints
@app.post("/upload")
async def upload_pdf(
    file: UploadFile = File(...),
    api_key: Optional[str] = Header(None, alias="X-Gemini-API-Key"),
    embedding_type: Optional[str] = Header(None, alias="X-Embedding-Type")
):
    # Security: File type check
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
        
    # Security: File size check (50 MB limit)
    max_size = 50 * 1024 * 1024
    size = 0
    doc_id = str(uuid.uuid4())
    temp_pdf_path = os.path.join(UPLOAD_DIR, f"{doc_id}.pdf")
    
    try:
        with open(temp_pdf_path, 'wb') as buffer:
            while chunk := await file.read(8192):
                size += len(chunk)
                if size > max_size:
                    # Clean up incomplete file
                    buffer.close()
                    os.remove(temp_pdf_path)
                    raise HTTPException(status_code=413, detail="File size exceeds maximum limit of 50MB.")
                buffer.write(chunk)
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
        
    # Parse PDF text & compute initial metadata/readability
    try:
        parsed_data = extract_pdf_data(temp_pdf_path)
    except ValueError as e:
        # Delete invalid PDF
        if os.path.exists(temp_pdf_path):
            os.remove(temp_pdf_path)
        raise HTTPException(status_code=400, detail=str(e))
        
    # Save parsed data to avoid parsing on every request
    parsed_json_path = os.path.join(UPLOAD_DIR, f"{doc_id}_data.json")
    with open(parsed_json_path, 'w') as f:
        json.dump(parsed_data, f, indent=2)
        
    # Initialize Vector DB (FAISS)
    try:
        # Step 1: Chunk the text
        splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        chunks = []
        metadatas = []
        for p in parsed_data["pages"]:
            page_chunks = splitter.split_text(p["text"])
            for c in page_chunks:
                if c.strip():
                    chunks.append(c)
                    metadatas.append({"page": p["page"], "text": c})
                    
        # Step 2: Embed chunks (Detect selections and check availability)
        selected_embedding = embedding_type or "local"
        resolved_api_key = api_key or os.getenv("GEMINI_API_KEY")
        
        if selected_embedding == "local":
            try:
                from sentence_transformers import SentenceTransformer
            except ImportError:
                # If local sentence-transformers isn't installed, fall back to gemini if we have a key
                if resolved_api_key:
                    selected_embedding = "gemini"
                else:
                    raise HTTPException(
                        status_code=400, 
                        detail="Local embedding model is not installed. Please set your Gemini API key in Settings first so the server can fall back to Gemini embeddings."
                    )
        
        try:
            embed_model = get_embedding_model(model_type=selected_embedding, api_key=resolved_api_key)
            embeddings = embed_model.embed_documents(chunks)
        except ValueError as ve:
            # Handle invalid/inactive api key errors or Gemini API failures cleanly
            raise HTTPException(
                status_code=400,
                detail=f"Embedding generation failed. Please verify that your Gemini API key is valid and active in Settings. (Details: {str(ve)})"
            )
        
        # Step 3: Write to FAISS Index
        if embeddings:
            dimension = len(embeddings[0])
            store = VectorStore(dimension)
            store.add_texts(chunks, embeddings, metadatas)
            vector_db_path = os.path.join(VECTOR_DB_DIR, f"{doc_id}.faiss")
            store.save(vector_db_path)
    except Exception as e:
        # Log error and raise
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Error indexing PDF for semantic search: {str(e)}")
        
    # Append to history
    history = load_history()
    history.append({
        "doc_id": doc_id,
        "filename": file.filename,
        "title": file.filename.replace(".pdf", ""),
        "page_count": parsed_data["page_count"],
        "word_count": parsed_data["word_count"],
        "reading_time_minutes": parsed_data["reading_time_minutes"],
        "difficulty": parsed_data["difficulty"],
        "upload_time": parsed_data.get("upload_time", "")
    })
    save_history(history)
    
    return {
        "doc_id": doc_id,
        "filename": file.filename,
        "page_count": parsed_data["page_count"],
        "word_count": parsed_data["word_count"],
        "reading_time_minutes": parsed_data["reading_time_minutes"],
        "difficulty": parsed_data["difficulty"]
    }

@app.get("/history")
async def get_upload_history():
    return load_history()

@app.get("/document/{doc_id}")
async def get_document_data(doc_id: str):
    data_path = os.path.join(UPLOAD_DIR, f"{doc_id}_data.json")
    if not os.path.exists(data_path):
        raise HTTPException(status_code=404, detail="Document text data not found.")
    try:
        with open(data_path, 'r') as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read document data: {str(e)}")

@app.delete("/history/{doc_id}")
async def delete_history_item(doc_id: str):
    # Security: delete related files
    pdf_path = os.path.join(UPLOAD_DIR, f"{doc_id}.pdf")
    data_path = os.path.join(UPLOAD_DIR, f"{doc_id}_data.json")
    analysis_path = os.path.join(UPLOAD_DIR, f"{doc_id}_analysis.json")
    vector_path = os.path.join(VECTOR_DB_DIR, f"{doc_id}.faiss")
    
    for path in [pdf_path, data_path, analysis_path, vector_path]:
        if os.path.exists(path):
            if os.path.isdir(path):
                shutil.rmtree(path)
            else:
                os.remove(path)
                
    history = load_history()
    updated_history = [item for item in history if item["doc_id"] != doc_id]
    save_history(updated_history)
    return {"status": "success", "message": f"Document {doc_id} deleted."}

@app.post("/summary")
async def get_document_summary(
    req: SummaryRequest,
    model_name: Optional[str] = Header("gemini-1.5-flash", alias="X-Gemini-Model")
):
    data_path = os.path.join(UPLOAD_DIR, f"{req.doc_id}_data.json")
    if not os.path.exists(data_path):
        raise HTTPException(status_code=404, detail="Parsed PDF data not found.")
        
    analysis_path = os.path.join(UPLOAD_DIR, f"{req.doc_id}_analysis.json")
    
    # Return cached analysis if summaries already exist
    if os.path.exists(analysis_path):
        with open(analysis_path, 'r') as f:
            analysis = json.load(f)
            if "summary" in analysis:
                return analysis["summary"]
                
    # Else, generate it
    with open(data_path, 'r') as f:
        parsed_data = json.load(f)
        
    api_key = req.api_key or os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="Gemini API Key is missing. Please set it in Settings.")
        
    summaries = generate_summaries(parsed_data["pages"], api_key=api_key, model_name=model_name)
    
    # Save cache
    analysis = {}
    if os.path.exists(analysis_path):
        with open(analysis_path, 'r') as f:
            analysis = json.load(f)
    analysis["summary"] = summaries
    with open(analysis_path, 'w') as f:
        json.dump(analysis, f, indent=2)
        
    return summaries

@app.post("/chat")
async def chat_with_pdf(
    req: ChatRequest,
    model_name: Optional[str] = Header("gemini-1.5-flash", alias="X-Gemini-Model")
):
    vector_db_path = os.path.join(VECTOR_DB_DIR, f"{req.doc_id}.faiss")
    api_key = req.api_key or os.getenv("GEMINI_API_KEY")
    
    if not api_key:
        raise HTTPException(status_code=400, detail="Gemini API Key is missing. Please set it in Settings.")
        
    answer_data = generate_rag_answer(
        question=req.question,
        vector_db_path=vector_db_path,
        embedding_type=req.embedding_type,
        api_key=api_key,
        beginner_mode=req.beginner_mode,
        model_name=model_name
    )
    return answer_data

@app.post("/quiz")
async def generate_document_quiz(
    req: QuizRequest,
    model_name: Optional[str] = Header("gemini-1.5-flash", alias="X-Gemini-Model")
):
    data_path = os.path.join(UPLOAD_DIR, f"{req.doc_id}_data.json")
    if not os.path.exists(data_path):
        raise HTTPException(status_code=404, detail="Document data not found.")
        
    api_key = req.api_key or os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="Gemini API Key is missing. Please set it in Settings.")
        
    with open(data_path, 'r') as f:
        parsed_data = json.load(f)
        
    quiz_data = generate_quiz(parsed_data["pages"], num_questions=req.num_questions, api_key=api_key, model_name=model_name)
    return quiz_data

@app.post("/flashcards")
async def generate_document_flashcards(
    req: FlashcardsRequest,
    model_name: Optional[str] = Header("gemini-1.5-flash", alias="X-Gemini-Model")
):
    data_path = os.path.join(UPLOAD_DIR, f"{req.doc_id}_data.json")
    if not os.path.exists(data_path):
        raise HTTPException(status_code=404, detail="Document data not found.")
        
    analysis_path = os.path.join(UPLOAD_DIR, f"{req.doc_id}_analysis.json")
    
    # Return cached flashcards if they exist
    if os.path.exists(analysis_path):
        with open(analysis_path, 'r') as f:
            analysis = json.load(f)
            if "flashcards" in analysis:
                return analysis["flashcards"]
                
    api_key = req.api_key or os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="Gemini API Key is missing. Please set it in Settings.")
        
    with open(data_path, 'r') as f:
        parsed_data = json.load(f)
        
    flashcards_data = generate_flashcards(parsed_data["pages"], api_key=api_key, model_name=model_name)
    
    # Save cache
    analysis = {}
    if os.path.exists(analysis_path):
        with open(analysis_path, 'r') as f:
            analysis = json.load(f)
    analysis["flashcards"] = flashcards_data
    with open(analysis_path, 'w') as f:
        json.dump(analysis, f, indent=2)
        
    return flashcards_data

@app.post("/metadata")
async def generate_document_metadata(
    req: MetadataRequest,
    model_name: Optional[str] = Header("gemini-1.5-flash", alias="X-Gemini-Model")
):
    data_path = os.path.join(UPLOAD_DIR, f"{req.doc_id}_data.json")
    if not os.path.exists(data_path):
        raise HTTPException(status_code=404, detail="Document data not found.")
        
    analysis_path = os.path.join(UPLOAD_DIR, f"{req.doc_id}_analysis.json")
    
    # Return cached metadata if they exist
    if os.path.exists(analysis_path):
        with open(analysis_path, 'r') as f:
            analysis = json.load(f)
            if "metadata_extracted" in analysis:
                return analysis["metadata_extracted"]
                
    api_key = req.api_key or os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="Gemini API Key is missing. Please set it in Settings.")
        
    with open(data_path, 'r') as f:
        parsed_data = json.load(f)
        
    meta_data = extract_metadata(parsed_data["pages"], api_key=api_key, model_name=model_name)
    
    # Save cache
    analysis = {}
    if os.path.exists(analysis_path):
        with open(analysis_path, 'r') as f:
            analysis = json.load(f)
    analysis["metadata_extracted"] = meta_data
    with open(analysis_path, 'w') as f:
        json.dump(analysis, f, indent=2)
        
    return meta_data

@app.post("/compare")
async def compare_two_documents(
    file1: UploadFile = File(...),
    file2: UploadFile = File(...),
    api_key: Optional[str] = Header(None, alias="X-Gemini-API-Key"),
    model_name: Optional[str] = Header("gemini-1.5-flash", alias="X-Gemini-Model")
):
    if not file1.filename.endswith('.pdf') or not file2.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Both documents must be PDFs.")
        
    if not api_key:
        api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="Gemini API Key is missing. Please set it in Settings.")
        
    # Temporary paths
    temp1 = os.path.join(UPLOAD_DIR, f"temp_{uuid.uuid4()}.pdf")
    temp2 = os.path.join(UPLOAD_DIR, f"temp_{uuid.uuid4()}.pdf")
    
    try:
        # Save both files
        with open(temp1, 'wb') as f:
            f.write(await file1.read())
        with open(temp2, 'wb') as f:
            f.write(await file2.read())
            
        # Parse both files
        parsed1 = extract_pdf_data(temp1)
        parsed2 = extract_pdf_data(temp2)
        
        # Call comparison LLM
        comparison_data = compare_documents(parsed1["pages"], parsed2["pages"], api_key=api_key, model_name=model_name)
        
        # Override titles if needed
        if "doc1" in comparison_data:
            comparison_data["doc1"]["title"] = file1.filename.replace(".pdf", "")
        if "doc2" in comparison_data:
            comparison_data["doc2"]["title"] = file2.filename.replace(".pdf", "")
            
        return comparison_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compare documents: {str(e)}")
    finally:
        # Clean up temporary PDFs
        for path in [temp1, temp2]:
            if os.path.exists(path):
                os.remove(path)

@app.post("/export")
async def export_results(req: ExportRequest):
    doc_id = req.doc_id
    export_format = req.format.lower()
    
    # Construct formatting input data
    export_data = {
        "title": req.title,
        "summary": req.summary,
        "quiz": req.quiz,
        "flashcards": req.flashcards,
        "key_points": req.key_points
    }
    
    temp_export_path = os.path.join(UPLOAD_DIR, f"export_{doc_id}.{export_format}")
    
    try:
        if export_format == "txt":
            raw_text = format_text_data(export_data)
            with open(temp_export_path, 'w', encoding='utf-8') as f:
                f.write(raw_text)
            media_type = "text/plain"
        elif export_format == "docx":
            export_to_docx(export_data, temp_export_path)
            media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        elif export_format == "pdf":
            export_to_pdf(export_data, temp_export_path)
            media_type = "application/pdf"
        else:
            raise HTTPException(status_code=400, detail="Invalid export format. Supported: pdf, docx, txt")
            
        return FileResponse(
            temp_export_path, 
            media_type=media_type, 
            filename=f"research_summary_{doc_id}.{export_format}"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate export file: {str(e)}")
    # We should delete the temp export file *after* it's downloaded, but FastAPI's FileResponse blocks until read.
    # We can clean up old temp files periodically, or serve via background task.

# Serve index.html at root
@app.get("/")
async def read_index():
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if not os.path.exists(index_path):
        return {"message": "AI Research Assistant Backend is running. Frontend index.html not found yet."}
    return FileResponse(index_path)

# Mount frontend directory for static JS/CSS assets
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")
