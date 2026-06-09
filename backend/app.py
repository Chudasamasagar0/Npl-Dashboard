from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
from transformers import pipeline
import re

app = Flask(__name__)
CORS(app)

# Load Sentiment Analysis Model
sentiment_pipeline = pipeline(
    "sentiment-analysis",
    model="distilbert-base-uncased-finetuned-sst-2-english"
)

NEUTRAL_PHRASES = [
    'okay', 'ok', 'fine', 'normal', 'nothing special', 'average', 'moderate', 'so-so', 'decent'
]

POSITIVE_WORDS = [
    'love', 'great', 'excellent', 'wonderful', 'fantastic', 'amazing', 'best', 'awesome', 'good', 'happy', 'pleased', 'perfect', 'perfectly', 'recommend', 'highly'
]

NEGATIVE_WORDS = [
    'worst', 'bad', 'terrible', 'disappointed', 'disappointment', 'crash', 'crashing', 'broken', 'useless', 'unusable', 'poor', 'hate', 'annoyed', 'frustrated', 'ridiculous', 'upset', 'fail', 'failed'
]

def is_linguistically_neutral(text):
    clean_text = str(text).lower().strip()
    
    # 1. Direct neutral phrases
    for phrase in NEUTRAL_PHRASES:
        if phrase in clean_text:
            return True
            
    # 2. Objective context patterns
    objective_patterns = [
        r'\b(schedule|scheduled|meeting|appointment|tomorrow|today|yesterday|date|time|clock|calendar)\b',
        r'\b(file|report|document|attachment|pdf|csv)\b',
        r'\b(status|info|information|details)\b',
        r'\b(is attached|has been sent|is scheduled|please find)\b'
    ]
    
    has_objective_context = any(re.search(pattern, clean_text) for pattern in objective_patterns)
    
    # Clean words list
    words = re.sub(r'[^a-z\s]', ' ', clean_text).split()
    
    pos_count = sum(1 for w in words if w in POSITIVE_WORDS)
    neg_count = sum(1 for w in words if w in NEGATIVE_WORDS)
    
    # Factual/No emotion
    if pos_count == 0 and neg_count == 0:
        return True
        
    if has_objective_context and pos_count <= 1 and neg_count == 0:
        return True
        
    return False

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

            if is_linguistically_neutral(text_str) or score < 0.60:
                label = "NEUTRAL"
                score = 0.50
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