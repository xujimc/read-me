from typing import Dict
import re
from langchain_google_genai import ChatGoogleGenerativeAI

llm = ChatGoogleGenerativeAI(
    model="gemma-3-12b-it",
    temperature=0.4,
)

def generate_feedback(article_text: str, answers: Dict[str, str]) -> Dict[str, str]:
    # Build all Q&A pairs into one prompt
    qa_block = "\n\n".join(
        f"Q{i+1}: {q}\nAnswer: {a}"
        for i, (q, a) in enumerate(answers.items())
    )

    prompt = f"""You are an expert tutor. Evaluate each answer based on the article.

For EACH question, respond in this exact format:
[Q1]
Correctness: <correct / partially correct / incorrect>
Explanation: <1-3 sentences>
Improvement: <1 concrete suggestion>

[Q2]
...and so on for each question.

Article:
{article_text}

Questions and Answers:
{qa_block}
"""

    response = llm.invoke(prompt)
    raw = (response.content or "").strip()

    # Parse response back into dict
    feedback = {}
    questions = list(answers.keys())

    # Split by [Q1], [Q2], etc.
    parts = re.split(r'\[Q(\d+)\]', raw)

    for i in range(1, len(parts), 2):
        idx = int(parts[i]) - 1
        if 0 <= idx < len(questions):
            feedback[questions[idx]] = parts[i + 1].strip()

    # Fallback: if parsing failed, return raw for first question
    if not feedback and questions:
        feedback[questions[0]] = raw

    return feedback
