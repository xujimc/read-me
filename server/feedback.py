from typing import Dict

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate

from rag import vector_store


llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    temperature=0.4,
)

retriever = vector_store.as_retriever(search_kwargs={"k": 4})


def _format_docs(docs) -> str:
    return "\n\n".join(d.page_content for d in docs)


prompt = ChatPromptTemplate.from_messages([
    ("system", """
You are an expert tutor. Use the article context to evaluate the user's answer.

Respond EXACTLY in this format:
Correctness: <correct / partially correct / incorrect>
Explanation: <1–3 sentences>
Improvement: <1 concrete suggestion>

Article context:
{context}
"""),
    ("human", """
Question:
{question}

User answer:
{answer}
""")
])


feedback_chain = (
    {
        "context": retriever | _format_docs,
        "question": lambda x: x["question"],
        "answer": lambda x: x["answer"],
    }
    | prompt
    | llm
    | StrOutputParser()
)


def generate_feedback(
    article_text: str,
    answers: Dict[str, str],
) -> Dict[str, str]:

    feedback = {}

    for question, answer in answers.items():
        feedback[question] = feedback_chain.invoke({
            "question": question,
            "answer": answer,
        })

    return feedback
