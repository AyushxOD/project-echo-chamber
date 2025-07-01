# AI Sentiment Battle

This is a real-time, AI-powered stock market sentiment visualizer. The application fetches live news headlines for two competing stock tickers, performs sentiment analysis on each, and visualizes the result as a "tug-of-war" between two glowing orbs. Users can click on an orb to get a deep, AI-generated summary of the news driving the sentiment.

## Core Features

- **Real-Time Sentiment Analysis:** Uses a Hugging Face model to analyze news headlines instantly.
- **Comparative Visualization:** Pits two stocks against each other in a "Market Battle."
- **AI Analyst:** Uses the Gemini API to provide intelligent summaries of the news.
- **3D Interface:** Built with React Three Fiber for a fluid, visually impressive UI.

## Tech Stack

- **Backend:** Python, FastAPI, WebSockets
- **Frontend:** React, Vite, Three.js / React Three Fiber
- **AI:** Google Gemini & Hugging Face Inference APIs
- **Data:** NewsAPI

## How to Run

1.  **Backend Setup:**
    ```bash
    cd echo-chamber-backend
    pip install -r requirements.txt
    uvicorn main:app --reload
    ```
2.  **Frontend Setup:**
    ```bash
    cd echo-chamber-frontend
    npm install
    npm run dev
    ```
