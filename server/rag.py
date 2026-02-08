import os
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

# Persistent storage directory
PERSIST_DIR = os.path.join(os.path.dirname(__file__), '.vectorstore')

# Chunking config
splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,
    chunk_overlap=80,
)

# Gemini embeddings model
embeddings = GoogleGenerativeAIEmbeddings(
    model="models/gemini-embedding-001"
)

# Persistent vector store using Chroma
vector_store = Chroma(
    persist_directory=PERSIST_DIR,
    embedding_function=embeddings,
    collection_name="articles",
)

def store_article(article_text: str) -> int:
    chunks = splitter.split_text(article_text)
    docs = [Document(page_content=chunk) for chunk in chunks]
    vector_store.add_documents(docs)
    return len(docs)
