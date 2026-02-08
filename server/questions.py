from langchain_google_genai import ChatGoogleGenerativeAI

llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.7)

def generate_questions(article_text: str) -> list[str]:
    prompt = f"""
You are a helpful tutor. Read the article below and generate 5 high-quality
comprehension questions that test key ideas and details.

Return ONE question per line. No extra commentary.

ARTICLE:
{article_text}
"""
    resp = llm.invoke(prompt)
    raw = (resp.content or "").strip()
    return [line.strip() for line in raw.split("\n") if line.strip()]
