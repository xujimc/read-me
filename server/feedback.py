from typing import Dict
from langchain_google_genai import ChatGoogleGenerativeAI

llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.4)

def generate_feedback(article_text: str, answers: Dict[str, str]) -> Dict[str, str]:
    feedback = {}

    for question, user_answer in answers.items():
        prompt = f"""
You are an expert tutor. Read the article and evaluate the user's answer.

ARTICLE:
{article_text}

QUESTION:
{question}

USER ANSWER:
{user_answer}

Respond EXACTLY in this format:
Correctness: <correct/incorrect/partially correct>
Explanation: <1-3 sentences>
Improvement: <1 concrete suggestion>
"""
        resp = llm.invoke(prompt)
        feedback[question] = (resp.content or "").strip()

    return feedback
