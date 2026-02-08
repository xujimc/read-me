from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()
from rag import store_article
from questions import generate_questions
from feedback import generate_feedback
from cache import get_cached_questions, cache_questions, is_article_stored, mark_article_stored


app = Flask(__name__)
CORS(app, origins="*")  # Enable CORS for Chrome extension requests


@app.post("/articles")
def articles():
    body = request.get_json() or {}
    article_text = body.get("article_text", "")

    if not article_text:
        return jsonify({"error": "article_text required"}), 400

    # Check cache for questions
    questions = get_cached_questions(article_text)
    chunks = 0

    if questions is None:
        # Not cached - store article and generate questions
        if not is_article_stored(article_text):
            chunks = store_article(article_text)
            mark_article_stored(article_text)

        questions = generate_questions(article_text)
        cache_questions(article_text, questions)

    return jsonify({
        "stored_chunks": chunks,
        "questions": questions,
        "cached": chunks == 0,
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
