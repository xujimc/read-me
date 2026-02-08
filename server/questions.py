from langchain_google_genai import ChatGoogleGenerativeAI
from config import MODEL_NAME

llm = ChatGoogleGenerativeAI(
    model=MODEL_NAME,
    temperature=0.7,
)

def generate_questions(article_text: str) -> list[str]:
    prompt = f"""You are a helpful tutor. Read the article below and generate 5 high-quality comprehension questions that test key ideas and details.

Rules:
- One question per line
- No numbering or bullet points
- No extra commentary

Article:
{article_text}
"""
    response = llm.invoke(prompt)
    raw = (response.content or "").strip()
    return [line.strip() for line in raw.split("\n") if line.strip()]
