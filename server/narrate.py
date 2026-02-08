from langchain_google_genai import ChatGoogleGenerativeAI

llm = ChatGoogleGenerativeAI(
    model="gemma-3-12b-it",
    temperature=0.8,
)


def generate_narration(article_text: str) -> str:
    prompt = f"""You are a captivating public speaker and master storyteller. Transform the following blog article into an engaging speech designed for text-to-speech delivery.

Guidelines:
- Use vivid, memorable language and rhetorical techniques
- Add audio-only delivery cues in brackets (e.g. [pause], [brief pause], [emphasize], [slowly])
- Do not include any visual, physical, or stage directions
- Make it conversational and engaging, as if speaking directly to the audience
- Keep the core information accurate while making it impactful
- Start with a strong hook and end with a powerful conclusion

Article:

{article_text}
"""
    response = llm.invoke(prompt)
    return (response.content or "").strip()
