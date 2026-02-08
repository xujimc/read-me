from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_core.vectorstores import InMemoryVectorStore
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

# Chunking config
splitter = RecursiveCharacterTextSplitter(
    chunk_size=800,
    chunk_overlap=120,
)

# Gemini embeddings model
embeddings = GoogleGenerativeAIEmbeddings(
    model="models/gemini-embedding-001"
)

# In-memory vector store
vector_store = InMemoryVectorStore(embeddings)

def store_article(article_text: str) -> int:
    chunks = splitter.split_text(article_text)
    docs = [Document(page_content=chunk) for chunk in chunks]
    vector_store.add_documents(docs)
    return len(docs)
