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
    try:
        if "file" not in request.files:
            return jsonify({
                "error": "No file uploaded"
            }), 400

        file = request.files["file"]

        if file.filename == "":
            return jsonify({
                "error": "No selected file"
            }), 400

        if not file.filename.endswith(".csv"):
            return jsonify({
                "error": "Invalid file type. Please upload a CSV file."
            }), 400

        try:
            df = pd.read_csv(file)
        except Exception as e:
            return jsonify({
                "error": f"Failed to parse CSV file: {str(e)}"
            }), 400

        if df.empty:
            return jsonify({
                "error": "The uploaded CSV file is empty."
            }), 400

        # Find the text column. Look for common text column names (case-insensitive)
        text_column = None
        common_columns = ["text", "content", "review", "comment", "message", "feedback", "body", "tweet"]
        df_cols_lower = [str(col).lower().strip() for col in df.columns]

        for common in common_columns:
            if common in df_cols_lower:
                idx = df_cols_lower.index(common)
                text_column = df.columns[idx]
                break

        # Fallback to the first object/string column if none of the common names match
        if not text_column:
            for col in df.columns:
                if df[col].dtype == "object":
                    text_column = col
                    break

        # Fallback to the first column if no object column is found
        if not text_column:
            text_column = df.columns[0]

        # Process sentiments
        results = []
        positive_count = 0
        negative_count = 0
        neutral_count = 0

        for text_val in df[text_column]:
            # Skip empty or NaN values
            if pd.isna(text_val) or str(text_val).strip() == "":
                continue

            text_str = str(text_val).strip()
            # Predict sentiment using pipeline (enable truncation to prevent token limit errors)
            pred = sentiment_pipeline(text_str, truncation=True)[0]
            label = pred["label"]
            score = pred["score"]

            if score < 0.60:
                label = "NEUTRAL"
                neutral_count += 1
            elif label == "POSITIVE":
                positive_count += 1
            elif label == "NEGATIVE":
                negative_count += 1

            results.append({
                "text": text_str,
                "label": label,
                "score": score
            })

        if not results:
            return jsonify({
                "error": f"No valid text records found in column '{text_column}'."
            }), 400

        return jsonify({
            "total_records": len(results),
            "positive": positive_count,
            "negative": negative_count,
            "neutral": neutral_count,
            "results": results
        })

    except Exception as e:
        return jsonify({
            "error": f"An unexpected error occurred during processing: {str(e)}"
        }), 500

if __name__ == "__main__":
    app.run(debug=True)