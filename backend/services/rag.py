import os
import faiss
import numpy as np
import pickle

class RecursiveCharacterTextSplitter:
    """Recursively splits text into chunks using hierarchical separators."""
    def __init__(self, chunk_size=1000, chunk_overlap=200, separators=None):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.separators = separators or ["\n\n", "\n", " ", ""]

    def split_text(self, text: str) -> list[str]:
        if len(text) <= self.chunk_size:
            return [text]

        # Find appropriate separator
        separator = self.separators[-1]
        for s in self.separators:
            if s in text:
                separator = s
                break

        # Split text
        splits = text.split(separator) if separator else list(text)

        # Recombine splits into chunks
        chunks = []
        current_chunk = []
        current_length = 0

        for split in splits:
            split_len = len(split)
            # Add separator length if not first item
            sep_len = len(separator) if current_chunk else 0
            if current_length + split_len + sep_len <= self.chunk_size:
                current_chunk.append(split)
                current_length += split_len + sep_len
            else:
                # Save previous chunk
                if current_chunk:
                    chunks.append(separator.join(current_chunk))
                
                # Backtrack for overlap
                overlap_chunk = []
                overlap_len = 0
                for prev in reversed(current_chunk):
                    prev_len = len(prev)
                    sep_len_overlap = len(separator) if overlap_chunk else 0
                    if overlap_len + prev_len + sep_len_overlap <= self.chunk_overlap:
                        overlap_chunk.insert(0, prev)
                        overlap_len += prev_len + sep_len_overlap
                    else:
                        break
                
                current_chunk = overlap_chunk + [split]
                current_length = sum(len(x) for x in current_chunk) + (len(separator) * (len(current_chunk) - 1))

        if current_chunk:
            chunks.append(separator.join(current_chunk))

        # Recursively split any chunk that is still too large
        final_chunks = []
        for chunk in chunks:
            if len(chunk) > self.chunk_size:
                final_chunks.extend(self.split_text(chunk))
            else:
                final_chunks.append(chunk)

        return final_chunks

class VectorStore:
    """Manages local FAISS index and metadata storage for a specific document."""
    def __init__(self, dimension: int):
        self.dimension = dimension
        self.index = faiss.IndexFlatL2(dimension)
        self.metadata = []  # Stores: [{"page": page_num, "text": chunk_text}]

    def add_texts(self, texts: list[str], embeddings: list[list[float]], metadatas: list[dict]):
        if not texts or not embeddings:
            return
        vectors = np.array(embeddings).astype('float32')
        self.index.add(vectors)
        self.metadata.extend(metadatas)

    def similarity_search(self, query_embedding: list[float], k=4) -> list[dict]:
        if self.index.ntotal == 0:
            return []
        vector = np.array([query_embedding]).astype('float32')
        distances, indices = self.index.search(vector, k)
        
        results = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx == -1 or idx >= len(self.metadata):
                continue
            meta = self.metadata[idx]
            results.append({
                "page": meta["page"],
                "text": meta["text"],
                "score": float(dist)
            })
        return results

    def save(self, filepath: str):
        # Serialize FAISS index to byte array and dump with pickle
        index_bytes = faiss.serialize_index(self.index)
        directory = os.path.dirname(filepath)
        if directory and not os.path.exists(directory):
            os.makedirs(directory, exist_ok=True)
            
        with open(filepath, 'wb') as f:
            pickle.dump({
                "index_bytes": index_bytes,
                "dimension": self.dimension,
                "metadata": self.metadata
            }, f)

    @classmethod
    def load(cls, filepath: str):
        with open(filepath, 'rb') as f:
            data = pickle.load(f)
        index = faiss.deserialize_index(data["index_bytes"])
        store = cls(data["dimension"])
        store.index = index
        store.metadata = data["metadata"]
        return store
