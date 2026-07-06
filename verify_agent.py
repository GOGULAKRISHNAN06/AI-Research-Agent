import os
import sys

# Add root folder to sys.path so we can import services correctly
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from backend.services.pdf_parser import extract_pdf_data
from backend.services.rag import RecursiveCharacterTextSplitter, VectorStore
from backend.services.embeddings import get_embedding_model

def create_test_pdf(filename="test_paper.pdf"):
    print(f"Creating test PDF: {filename}...")
    doc = SimpleDocTemplate(filename, pagesize=letter)
    styles = getSampleStyleSheet()
    story = []
    
    # Title
    story.append(Paragraph("AI-Agent Pothole Detection and Road Surveying Systems", styles["Heading1"]))
    story.append(Spacer(1, 12))
    
    # Abstract
    story.append(Paragraph("<b>Abstract</b>: This paper introduces an advanced neural model designed for detecting road potholes from mobile phone camera inputs in real-time. By integrating a ResNet backbone with lightweight classification heads, the model achieves a detection accuracy of 92.4% on municipal asphalt surfaces under varied lighting conditions.", styles["Normal"]))
    story.append(Spacer(1, 12))
    
    # Methodology
    story.append(Paragraph("<b>1. Methodology</b>", styles["Heading2"]))
    story.append(Paragraph("Our system utilizes a dataset of 5,000 labeled road distress images. The image frames are preprocessed by resizing to 512x512 pixels. The feature extractor employs a convolutional neural network (CNN) trained with a binary cross-entropy loss function. Inference takes less than 15 milliseconds on a consumer mobile GPU.", styles["Normal"]))
    story.append(Spacer(1, 12))
    
    # Results
    story.append(Paragraph("<b>2. Experimental Results</b>", styles["Heading2"]))
    story.append(Paragraph("We evaluated our system against standard baseline models. The results indicate a significant increase in precision (89.5%) and recall (95.3%) compared to traditional thresholding methods. The model successfully detects anomalies under shadows and wet pavement conditions.", styles["Normal"]))
    story.append(Spacer(1, 12))

    # Bibliography
    story.append(Paragraph("<b>References</b>", styles["Heading2"]))
    story.append(Paragraph("[1] A. Smith, 'Neural Networks for Civil Infrastructure,' Journal of Concrete Computing, 2024.", styles["Normal"]))
    story.append(Paragraph("[2] B. Jones, 'Mobile Pavement Defect Classification,' IEEE Conf. on Robotics, 2025.", styles["Normal"]))
    
    doc.build(story)
    print("Test PDF created successfully.")

def test_pipeline():
    test_pdf = "test_paper.pdf"
    if not os.path.exists(test_pdf):
        create_test_pdf(test_pdf)
        
    print("\n--- Testing PDF Parser ---")
    data = extract_pdf_data(test_pdf)
    print(f"Page Count: {data['page_count']}")
    print(f"Word Count: {data['word_count']}")
    print(f"Reading Time (min): {data['reading_time_minutes']}")
    print(f"Estimated Difficulty: {data['difficulty']}")
    print(f"First page headings: {data['pages'][0]['headings']}")
    
    print("\n--- Testing Text Chunking ---")
    splitter = RecursiveCharacterTextSplitter(chunk_size=200, chunk_overlap=50)
    all_chunks = []
    for p in data["pages"]:
        chunks = splitter.split_text(p["text"])
        all_chunks.extend(chunks)
        print(f"Page {p['page']} split into {len(chunks)} chunks.")
        
    print(f"Total chunks: {len(all_chunks)}")
    print(f"Sample chunk: '{all_chunks[0][:100]}...'")
    
    print("\n--- Testing FAISS Local Indexing ---")
    # Generate mock embeddings for offline testing
    print("Generating mock embedding vectors for local FAISS test...")
    embeddings = [[0.05] * 384 for _ in all_chunks]
    print(f"Generated {len(embeddings)} mock embeddings of dimension 384.")
    
    # Store in FAISS
    store = VectorStore(384)
    metadatas = [{"page": 1, "text": c} for c in all_chunks]
    store.add_texts(all_chunks, embeddings, metadatas)
    
    # Run similarity search
    query = "pothole detection accuracy"
    query_emb = [0.05] * 384
    results = store.similarity_search(query_emb, k=2)
    
    print(f"\nSimilarity Search Results for query: '{query}'")
    for r in results:
        print(f"- Page {r['page']} (Distance Score: {r['score']:.4f}):")
        print(f"  '{r['text']}'")
        
    # Clean up test file
    if os.path.exists(test_pdf):
        os.remove(test_pdf)
        print("\nCleaned up test PDF.")

if __name__ == "__main__":
    try:
        test_pipeline()
        print("\nAll pipeline components verified successfully!")
    except Exception as e:
        print(f"\nPipeline verification failed: {str(e)}")
