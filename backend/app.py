from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
from transformers import pipeline

app = Flask(__name__)
CORS(app)

# Load Sentiment Analysis Model
sentiment_pipeline = pipeline(
    "sentiment-analysis",
    model="distilbert-base-uncased-finetuned-sst-2-english"
)

@app.route("/")
def home():
    return jsonify({
        "message": "NLP Text Analytics API Running"
    })

# Sentiment Analysis API
@app.route("/analyze", methods=["POST"])
def analyze_text():

    data = request.json

    if "text" not in data:
        return jsonify({
            "error": "Text is required"
        }), 400

    text = data["text"]

    result = sentiment_pipeline(text)

    return jsonify(result)

# CSV Analysis API
@app.route("/upload", methods=["POST"])
def upload_file():

    if "file" not in request.files:
        return jsonify({
            "error": "No file uploaded"
        })

    file = request.files["file"]

    df = pd.read_csv(file)

    sentiments = []

    for text in df["text"]:
        result = sentiment_pipeline(str(text))[0]
        sentiments.append(result["label"])

    df["sentiment"] = sentiments

    positive = sentiments.count("POSITIVE")
    negative = sentiments.count("NEGATIVE")

    return jsonify({
        "total_records": len(df),
        "positive": positive,
        "negative": negative
    })

if __name__ == "__main__":
    app.run(debug=True)