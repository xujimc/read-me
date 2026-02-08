from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()
from rag import store_article
from questions import generate_questions
from feedback import generate_feedback


app = Flask(__name__)
CORS(app, origins="*")  # Enable CORS for Chrome extension requests


@app.post("/articles")
def articles():
    body = request.get_json() or {}
    article_text = body.get("article_text", "")

    if not article_text:
        return jsonify({"error": "article_text required"}), 400

    chunks = store_article(article_text)
    questions = generate_questions(article_text)

    return jsonify({
        "stored_chunks": chunks,
        "questions": questions,
    })


@app.post("/feedback")
def feedback():
    body = request.get_json() or {}
    article_text = body.get("article_text", "")
    answers = body.get("answers", {})

    if not article_text or not answers:
        return jsonify({"error": "article_text and answers required"}), 400

    fb = generate_feedback(article_text, answers)
    return jsonify({"feedback": fb})


if __name__ == "__main__":
    app.run(debug=True, port=8000)
