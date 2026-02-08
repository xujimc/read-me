from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser

from rag import vector_store


llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    temperature=0.7,
)

retriever = vector_store.as_retriever(search_kwargs={"k": 5})


def _format_docs(docs) -> str:
    return "\n\n".join(d.page_content for d in docs)


prompt = ChatPromptTemplate.from_messages([
    ("system", """
You are a helpful tutor. Using the provided article context,
generate 5 high-quality comprehension questions.

Rules:
- One question per line
- No extra commentary

Context:
{context}
"""),
    ("human", "{input}")
])


question_chain = (
    {
        "context": retriever | _format_docs,
        "input": RunnablePassthrough(),
    }
    | prompt
    | llm
    | StrOutputParser()
)


def generate_questions(article_text: str) -> list[str]:
    raw = (question_chain.invoke(article_text) or "").strip()
    return [line.strip() for line in raw.split("\n") if line.strip()]
