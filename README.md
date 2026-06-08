# NLP Dashboard

This repository contains a simple NLP dashboard project with a Flask backend and a React frontend.

## Project structure

- `backend/` - Flask API server for sentiment analysis and CSV upload processing.
- `frontend/` - React application built with Create React App and Tailwind CSS.

## Backend setup

1. Create a Python virtual environment.
2. Install dependencies:
   ```bash
   pip install -r backend/req.txt
   ```
3. Run the backend server:
   ```bash
   python backend/app.py
   ```
4. The API will be available at `http://127.0.0.1:5000`.

## Frontend setup

1. Install dependencies:
   ```bash
   cd frontend
   npm install
   ```
2. Start the frontend:
   ```bash
   npm start
   ```
3. The React app will run at `http://localhost:3000`.

## Notes

- The backend uses the Hugging Face `distilbert-base-uncased-finetuned-sst-2-english` sentiment model.
- Make sure the backend is running before using the frontend.
- If you need to rebuild the frontend production bundle, run `npm run build` inside `frontend/`.
