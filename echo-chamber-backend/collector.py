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
COMPANIES_TO_TRACK = [
    # Top 20 International (US-Listed)
    {'ticker': 'MSFT', 'name': 'Microsoft'}, {'ticker': 'AAPL', 'name': '"Apple Inc."'},
    {'ticker': 'NVDA', 'name': 'Nvidia'}, {'ticker': 'GOOGL', 'name': 'Alphabet Google'},
    {'ticker': 'AMZN', 'name': 'Amazon'}, {'ticker': 'META', 'name': 'Meta Platforms'},
    {'ticker': 'BRK-B', 'name': 'Berkshire Hathaway'}, {'ticker': 'LLY', 'name': 'Eli Lilly'},
    {'ticker': 'TSM', 'name': 'TSMC'}, {'ticker': 'AVGO', 'name': 'Broadcom'},
    {'ticker': 'NVO', 'name': 'Novo Nordisk'}, {'ticker': 'V', 'name': 'Visa'},
    {'ticker': 'JPM', 'name': 'JPMorgan Chase'}, {'ticker': 'WMT', 'name': 'Walmart'},
    {'ticker': 'XOM', 'name': 'Exxon Mobil'}, {'ticker': 'UNH', 'name': 'UnitedHealth Group'},
    {'ticker': 'MA', 'name': 'Mastercard'}, {'ticker': 'TSLA', 'name': 'Tesla'},
    {'ticker': 'PG', 'name': 'Procter & Gamble'}, {'ticker': 'JNJ', 'name': 'Johnson & Johnson'},
    # Top 20 Indian
    {'ticker': 'RELIANCE.NS', 'name': 'Reliance Industries'}, {'ticker': 'TCS.NS', 'name': 'Tata Consultancy Services'},
    {'ticker': 'HDFCBANK.NS', 'name': 'HDFC Bank'}, {'ticker': 'ICICIBANK.NS', 'name': 'ICICI Bank'},
    {'ticker': 'BHARTIARTL.NS', 'name': 'Bharti Airtel'}, {'ticker': 'SBIN.NS', 'name': 'State Bank of India'},
    {'ticker': 'INFY.NS', 'name': 'Infosys'}, {'ticker': 'LICI.NS', 'name': 'Life Insurance Corporation of India'},
    {'ticker': 'HINDUNILVR.NS', 'name': 'Hindustan Unilever'}, {'ticker': 'ITC.NS', 'name': 'ITC Limited'},
    {'ticker': 'LT.NS', 'name': 'Larsen & Toubro'}, {'ticker': 'BAJFINANCE.NS', 'name': 'Bajaj Finance'},
    {'ticker': 'HCLTECH.NS', 'name': 'HCL Technologies'}, {'ticker': 'KOTAKBANK.NS', 'name': 'Kotak Mahindra Bank'},
    {'ticker': 'MARUTI.NS', 'name': 'Maruti Suzuki'}, {'ticker': 'SUNPHARMA.NS', 'name': 'Sun Pharmaceutical'},
    {'ticker': 'ADANIENT.NS', 'name': 'Adani Enterprises'}, {'ticker': 'TITAN.NS', 'name': 'Titan Company'},
    {'ticker': 'ONGC.NS', 'name': 'ONGC'}, {'ticker': 'TATAMOTORS.NS', 'name': 'Tata Motors'},
]

# --- Database and Sentiment Functions (Unchanged) ---
def setup_database():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    try:
        cursor.execute("ALTER TABLE daily_sentiment ADD COLUMN positive_count INTEGER NOT NULL DEFAULT 0")
        cursor.execute("ALTER TABLE daily_sentiment ADD COLUMN negative_count INTEGER NOT NULL DEFAULT 0")
    except sqlite3.OperationalError: pass
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS daily_sentiment (
            id INTEGER PRIMARY KEY AUTOINCREMENT, record_date DATE NOT NULL, ticker TEXT NOT NULL,
            sentiment_score REAL NOT NULL, article_count INTEGER NOT NULL,
            positive_count INTEGER NOT NULL DEFAULT 0, negative_count INTEGER NOT NULL DEFAULT 0,
            UNIQUE(record_date, ticker)
        )
    """)
    conn.commit()
    conn.close()
    print("Database setup complete.")

async def get_sentiment(text: str, client: httpx.AsyncClient) -> float:
    if not text: return 0.0
    try:
        truncated_text = text[:512]
        response = await client.post(SENTIMENT_MODEL_URL, headers=HEADERS, json={"inputs": truncated_text})
        response.raise_for_status()
        result = response.json()
        scores = {item['label']: item['score'] for item in result[0]}
        positive_score = scores.get('LABEL_2', 0.0)
        negative_score = scores.get('LABEL_0', 0.0)
        return positive_score - negative_score
    except Exception: return 0.0

# --- Main Collection Logic (Modified with a longer delay) ---
async def collect_daily_data():
    print(f"Starting daily sentiment collection for {len(COMPANIES_TO_TRACK)} companies...")
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    today = date.today()

    async with httpx.AsyncClient(timeout=30) as client:
        for company in COMPANIES_TO_TRACK:
            ticker = company['ticker']
            search_query = company['name']
            print(f"--- Processing {ticker} ({search_query}) ---")
            
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
                    await asyncio.sleep(15) # Still wait even if no articles
                    continue
                
                tasks = [get_sentiment(a.get('title',''), client) for a in articles[:20] if a.get('title')]
                sentiments = await asyncio.gather(*tasks)
                if not sentiments:
                    print(f"Sentiment analysis failed for {ticker}. Skipping.")
                    await asyncio.sleep(15) # Still wait even if analysis fails
                    continue

                avg_sentiment = sum(sentiments) / len(sentiments)
                positive_count = sum(1 for s in sentiments if s > 0.1)
                negative_count = sum(1 for s in sentiments if s < -0.1)
                
                print(f"Storing data for {ticker}: Score={avg_sentiment:.3f}, Pos={positive_count}, Neg={negative_count}")
                cursor.execute("""
                    INSERT OR REPLACE INTO daily_sentiment 
                    (record_date, ticker, sentiment_score, article_count, positive_count, negative_count)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (today, ticker, avg_sentiment, article_count, positive_count, negative_count))
                conn.commit()

            except httpx.HTTPStatusError as e:
                # If we get a rate limit error, print it and stop the script for today
                if e.response.status_code == 429:
                    print("!!! Rate limit hit. Stopping collector for today. Please try again later. !!!")
                    break # Exit the for loop
                else:
                    print(f"Failed to process data for {ticker}: {e}")
            except Exception as e:
                print(f"An unexpected error occurred for {ticker}: {e}")
            
            # --- THIS IS THE FIX ---
            # Wait for 15 seconds before processing the next company
            print("Waiting 15 seconds to respect API rate limits...")
            await asyncio.sleep(15)
            # --- END FIX ---
    
    conn.close()
    print("Daily sentiment collection finished.")

# --- Run the Collector ---
if __name__ == "__main__":
    setup_database()
    asyncio.run(collect_daily_data())