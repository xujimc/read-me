from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()
from questions import generate_questions
from feedback import generate_feedback
from tts import text_to_speech, get_stt_token
from cache import get_cached_questions, cache_questions
from config import MODEL_NAME


app = Flask(__name__)
CORS(app, origins="*")


@app.get("/model")
def get_model():
    return jsonify({"model": MODEL_NAME})


@app.post("/articles")
def articles():
    body = request.get_json() or {}
    article_text = body.get("article_text", "")

    if not article_text:
        return jsonify({"error": "article_text required"}), 400

    # Check cache for questions
    questions = get_cached_questions(article_text)
    cached = questions is not None

    if cached:
        print(f"[/articles] Cache HIT - returning cached questions")
    else:
        print(f"[/articles] Cache MISS - calling LLM...")
        questions = generate_questions(article_text)
        cache_questions(article_text, questions)
        print(f"[/articles] Generated {len(questions)} questions")

    return jsonify({
        "questions": questions,
        "cached": cached,
    })


@app.post("/feedback")
def feedback():
    body = request.get_json() or {}
    article_text = body.get("article_text", "")
    answers = body.get("answers", {})

    if not article_text or not answers:
        return jsonify({"error": "article_text and answers required"}), 400

    print(f"[/feedback] Calling LLM for {len(answers)} answers...")
    fb = generate_feedback(article_text, answers)
    print(f"[/feedback] Done")
    return jsonify({"feedback": fb})


@app.post("/tts")
def tts():
    body = request.get_json() or {}
    text = body.get("text", "")

    if not text:
        return jsonify({"error": "text required"}), 400

    print(f"[/tts] Converting {len(text)} chars to speech...")
    audio = text_to_speech(text)
    print(f"[/tts] Done")
    return jsonify({"audio": audio})


@app.get("/stt-token")
def stt_token():
    """Generate a single-use token for ElevenLabs real-time STT."""
    print("[/stt-token] Generating STT token...")
    token = get_stt_token()
    print("[/stt-token] Done")
    return jsonify({"token": token})


if __name__ == "__main__":
    app.run(debug=False, port=8000)
