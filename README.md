# AI Research Assistant Agent

A modern, high-end AI Research Assistant that allows researchers, students, and professionals to upload PDF documents (papers, manuals, textbooks) and interact with them using Retrieval-Augmented Generation (RAG) powered by Gemini.

---

## 🌟 Key Features

1. **Upload & Parse PDF:** Extracts text and structures (headings, paragraphs, page numbers) cleanly. Enforces a 50MB size limit and runs readability evaluations (difficulty, word counts, reading time).
2. **Tabbed AI Summaries:** Generates **Short (50-100w)**, **Medium (~250w)**, and **Detailed (500w+)** summaries simultaneously in one API call.
3. **Advanced Q&A (RAG Chat):** Answers user questions using only the uploaded PDF context, completely avoiding hallucinations. Features page-wise citations and clickable hover snippets.
4. **Explain Like I'm a Beginner:** Simplifies complex concepts, using bullet points, analogies, and simple language.
5. **Comprehension Quiz Generator:** Compiles interactive multiple-choice tests (5, 10, 15 items) with immediate correctness feedback and step-by-step explanatory text.
6. **Study Flashcards Deck:** Renders revision cards that flip with 3D rotation animations.
7. **Scholarly Metadata & References:** Extracts DOI, journal/conference info, publication year, authors, abstract, keywords, and parses the bibliography section.
8. **Instant Search Inside PDF:** High-speed client-side text keyword scanning and matching word highlights with page number jumps.
9. **Document Comparison Matrix:** Compares two uploaded PDF papers side-by-side on goals, methods, and results.
10. **Structured Report Exporter:** Download summary, quiz, and study takeaways in TXT, Word (DOCX), or ReportLab-formatted PDF layouts.

---

## 🛠️ Architecture & Tech Stack

### Backend
- **Python FastAPI:** Robust web API server.
- **pdfplumber & pypdf:** Extracts layout-aware page text and structures.
- **FAISS (vector-cpu):** Local vector similarity index search database.
- **Sentence Transformers:** Local embedding model (`all-MiniLM-L6-v2`) running fully offline.
- **Gemini API:** Generative AI for structured summary, metadata, QA, and quizzes in JSON mode.

### Frontend
- **Zero-Build SPA React:** No Node/NPM required. Utilizes native browser ES6 Modules.
- **htm (Hypertext Markup):** Zero-overhead compilerless template binder linking tags to React.
- **Tailwind CSS CDN:** Generates styling classes dynamically, featuring a rich, glassmorphic dark theme.
- **Axios:** Handles asynchronous API requests.

---

## 🚀 How to Run Locally

### 1. Prerequisite
Ensure Python (version 3.12+) is installed.

### 2. Set Up Virtual Environment & Dependencies
Open PowerShell or your command line in the project folder and run:
```powershell
# Create virtual environment
python -m venv .venv

# Install dependencies
.\.venv\Scripts\pip install -r requirements.txt
```

### 3. Configure Gemini API Key
You can configure your key in two ways:
- **Server `.env` file:** Create a file named `.env` in the `backend/` folder:
  ```env
  GEMINI_API_KEY=AIzaSy...
  ```
- **UI Settings Panel:** Open the app, navigate to **Settings**, paste your key, and click **Save**. It is stored securely in your browser's local storage.

### 4. Run the Server
Start the FastAPI server:
```powershell
.\.venv\Scripts\python -m uvicorn backend.main:app --reload
```
Once running, open your browser and navigate to:
👉 **[http://localhost:8000](http://localhost:8000)**

---

## 🧪 Pipeline Verification Script
You can verify the extraction, local embedding model, and FAISS indexing locally by running:
```powershell
.\.venv\Scripts\python verify_agent.py
```
This generates a mock PDF paper, parses it, chunks it, embeds it, and performs a local vector search.
