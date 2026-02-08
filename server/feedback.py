from typing import Dict
from langchain_google_genai import ChatGoogleGenerativeAI

llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    temperature=0.4,
)

def generate_feedback(article_text: str, answers: Dict[str, str]) -> Dict[str, str]:
    feedback = {}

    for question, answer in answers.items():
        prompt = f"""You are an expert tutor. Use the article below to evaluate the user's answer.

Respond EXACTLY in this format:
Correctness: <correct / partially correct / incorrect>
Explanation: <1-3 sentences>
Improvement: <1 concrete suggestion>

Article:
{article_text}

Question:
{question}

User answer:
{answer}
"""
        response = llm.invoke(prompt)
        feedback[question] = (response.content or "").strip()

    return feedback
