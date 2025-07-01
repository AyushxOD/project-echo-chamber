# collector.py

import os
import httpx
import traceback
import asyncio
import sqlite3
from datetime import date
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# --- Configuration ---
HF_TOKEN = os.getenv("HF_TOKEN")
NEWS_API_KEY = os.getenv("NEWS_API_KEY")
SENTIMENT_MODEL_URL = "https://api-inference.huggingface.co/models/cardiffnlp/twitter-roberta-base-sentiment"
HEADERS = {"Authorization": f"Bearer {HF_TOKEN}"}
DB_NAME = "sentiment_history.db"
TICKERS_TO_TRACK = ["AAPL", "GOOGL", "MSFT", "NVDA", "TSLA", "AMZN"]

# --- Database Setup ---
def setup_database():
    """Creates the database and table if they don't exist."""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS daily_sentiment (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            record_date DATE NOT NULL,
            ticker TEXT NOT NULL,
            sentiment_score REAL NOT NULL,
            article_count INTEGER NOT NULL,
            UNIQUE(record_date, ticker)
        )
    """)
    conn.commit()
    conn.close()
    print("Database setup complete.")

# --- Get Sentiment Function (Same as in main.py but synchronous) ---
async def get_sentiment(text: str, client: httpx.AsyncClient) -> float:
    if not text:
        return 0.0
    try:
        truncated_text = text[:512]
        response = await client.post(SENTIMENT_MODEL_URL, headers=HEADERS, json={"inputs": truncated_text})
        response.raise_for_status() # Will raise for 4xx/5xx errors
        result = response.json()
        scores = {item['label']: item['score'] for item in result[0]}
        positive_score = scores.get('LABEL_2', 0.0)
        negative_score = scores.get('LABEL_0', 0.0)
        return positive_score - negative_score
    except Exception:
        print(f"Error analyzing sentiment for: '{text}'")
        traceback.print_exc()
        return 0.0

# --- Main Collection Logic ---
async def collect_daily_data():
    """Fetches and stores sentiment data for all tracked tickers."""
    print("Starting daily sentiment collection...")
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    today = date.today()

    async with httpx.AsyncClient(timeout=30) as client:
        for ticker in TICKERS_TO_TRACK:
            print(f"--- Processing {ticker} ---")
            
            # 1. Fetch news
            search_query = f'"{ticker}" AND (stock OR finance)' if ticker == 'AAPL' else ticker
            url = (f"https://newsapi.org/v2/everything?"
                   f"q={search_query}&language=en&sortBy=publishedAt&apiKey={NEWS_API_KEY}")
            
            try:
                news_response = await client.get(url)
                news_response.raise_for_status()
                data = news_response.json()
                articles = data.get("articles", [])
                article_count = len(articles)

                if not articles:
                    print(f"No articles found for {ticker}. Skipping.")
                    continue
                
                # 2. Analyze sentiment
                print(f"Analyzing {len(articles[:20])} articles for {ticker}...")
                tasks = [get_sentiment(a.get('title',''), client) for a in articles[:20] if a.get('title')]
                sentiments = await asyncio.gather(*tasks)
                
                if not sentiments:
                    print(f"Sentiment analysis failed for {ticker}. Skipping.")
                    continue

                avg_sentiment = sum(sentiments) / len(sentiments)
                
                # 3. Store in database
                print(f"Storing data for {ticker}: Date={today}, Score={avg_sentiment:.3f}, Articles={article_count}")
                cursor.execute("""
                    INSERT OR REPLACE INTO daily_sentiment (record_date, ticker, sentiment_score, article_count)
                    VALUES (?, ?, ?, ?)
                """, (today, ticker, avg_sentiment, article_count))
                conn.commit()

            except Exception as e:
                print(f"Failed to process data for {ticker}: {e}")
    
    conn.close()
    print("Daily sentiment collection finished.")

# --- Run the Collector ---
if __name__ == "__main__":
    setup_database()
    asyncio.run(collect_daily_data())