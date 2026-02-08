from dotenv import load_dotenv
load_dotenv()

from flask import Flask, request, jsonify
from questions import generate_questions
from feedback import generate_feedback

app = Flask(__name__)

@app.post("/articles")
def ingest_article():
    body = request.get_json() or {}
    text = body.get("article_text", "")
    if not text:
        return jsonify({"error": "article_text required"}), 400

    questions = generate_questions(text)
    return jsonify({"questions": questions})

@app.post("/feedback")
def feedback_endpoint():
    body = request.get_json() or {}
    article_text = body.get("article_text", "")
    answers = body.get("answers", {})

    if not article_text or not answers:
        return jsonify({"error": "article_text and answers required"}), 400

    fb = generate_feedback(article_text, answers)
    return jsonify({"feedback": fb})

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=8000)
