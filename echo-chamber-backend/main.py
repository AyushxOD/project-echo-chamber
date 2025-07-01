import os
import httpx
import traceback
import google.generativeai as genai
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from dotenv import load_dotenv
import asyncio
from fastapi.middleware.cors import CORSMiddleware
import sqlite3 # Make sure this is at the top of your file


# Load environment variables
load_dotenv()

# --- API Configuration ---
NEWS_API_KEY = os.getenv("NEWS_API_KEY")
HF_TOKEN = os.getenv("HF_TOKEN")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
SENTIMENT_MODEL_URL = "https://api-inference.huggingface.co/models/cardiffnlp/twitter-roberta-base-sentiment"
HEADERS = {"Authorization": f"Bearer {HF_TOKEN}"}
genai.configure(api_key=GEMINI_API_KEY)
gemini_model = genai.GenerativeModel('gemini-1.5-flash')

# --- FastAPI App Initialization ---
app = FastAPI()

origins = ["http://localhost:5173"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def get_sentiment(text: str, client: httpx.AsyncClient) -> float:
    if not text:
        return 0.0
    
    retries = 3
    delay = 2 
    for attempt in range(retries):
        try:
            truncated_text = text[:512]
            response = await client.post(SENTIMENT_MODEL_URL, headers=HEADERS, json={"inputs": truncated_text})
            if response.status_code >= 500:
                response.raise_for_status()
            result = response.json()
            scores = {item['label']: item['score'] for item in result[0]}
            positive_score = scores.get('LABEL_2', 0.0)
            negative_score = scores.get('LABEL_0', 0.0)
            return positive_score - negative_score
        except httpx.HTTPStatusError as e:
            if e.response.status_code >= 500 and attempt < retries - 1:
                await asyncio.sleep(delay)
                delay *= 2
                continue
            else:
                traceback.print_exc()
                return 0.0
        except Exception:
            traceback.print_exc()
            return 0.0
    return 0.0

@app.get("/summarize/{ticker}")
async def summarize(ticker: str):
    print(f"Fetching news for GENIUS summarization: {ticker}")
    
    # --- FINAL FIX: Use a more specific search query for AAPL ---
    search_query = ticker
    if ticker.upper() == 'AAPL':
        search_query = '"Apple Inc." AND (stock OR finance)'
    # --- END FIX ---

    url = (f"https://newsapi.org/v2/everything?"
           f"q={search_query}&language=en&sortBy=publishedAt&apiKey={NEWS_API_KEY}")
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            news_response = await client.get(url)
            news_response.raise_for_status()
            data = news_response.json()
            articles = data.get("articles", [])
            
            headlines_text = "\n- ".join([a['title'] for a in articles[:15] if a.get('title')])
            
            if not headlines_text:
                return {"summary": f"No relevant headlines found for {ticker}."}

            prompt = f"""
            Act as a senior financial analyst. I will give you a list of recent news headlines for the stock ticker {ticker}.
            Read all of them, synthesize the information, and write a single, insightful paragraph summarizing the key narrative.
            Do not just list the headlines. Create a fluid, well-written summary in your own words.

            HEADLINES:
            {headlines_text}
            """
            
            print("Sending headlines to Gemini for high-level analysis...")
            response = await gemini_model.generate_content_async(prompt)
            return {"summary": response.text}
    except Exception:
        traceback.print_exc()
        return {"summary": "Failed to generate summary due to an error."}
    
    
@app.get("/history/{ticker}")
async def get_history(ticker: str):
    """
    Retrieves the sentiment history for a given ticker from the database.
    """
    DB_NAME = "sentiment_history.db"
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row # This makes the output a dictionary
    cursor = conn.cursor()

    print(f"Fetching history for {ticker} from database...")
    cursor.execute("""
        SELECT record_date, sentiment_score FROM daily_sentiment
        WHERE ticker = ? ORDER BY record_date ASC
    """, (ticker,))

    history_data = [dict(row) for row in cursor.fetchall()]
    
    conn.close()
    return history_data


@app.websocket("/ws/sentiment/{ticker}")
async def websocket_endpoint(websocket: WebSocket, ticker: str):
    await websocket.accept()
    print(f"WebSocket connection established for ticker: {ticker}")
    
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            while True:
                print(f"Fetching news for {ticker}...")
                
                # --- FINAL FIX: Use a more specific search query for AAPL ---
                search_query = ticker
                if ticker.upper() == 'AAPL':
                    search_query = '"Apple Inc." AND (stock OR finance)'
                # --- END FIX ---

                url = (f"https://newsapi.org/v2/everything?"
                       f"q={search_query}&language=en&sortBy=publishedAt&apiKey={NEWS_API_KEY}")
                
                articles = []
                try:
                    news_response = await client.get(url)
                    news_response.raise_for_status()
                    data = news_response.json()
                    articles = data.get("articles", [])
                except httpx.RequestError as e:
                    print(f"HTTPX Error fetching news: {e}")
                
                sentiments = []
                if articles:
                    print(f"Analyzing sentiment for {len(articles[:20])} articles instantly...")
                    tasks = [get_sentiment(article.get('title',''), client) for article in articles[:20] if article.get('title','') and len(article.get('title','').split()) > 3]
                    sentiments = await asyncio.gather(*tasks)

                if sentiments:
                    average_sentiment = sum(sentiments) / len(sentiments)
                else:
                    average_sentiment = 0.0

                live_data = {
                    "averageSentiment": round(average_sentiment, 3),
                    "articleCount": len(articles)
                }

                print(f"Broadcasting data: {live_data}")
                await websocket.send_json(live_data)

                print("Waiting for next cycle...")
                await asyncio.sleep(900)
        except WebSocketDisconnect:
            print(f"Client disconnected for ticker: {ticker}")
        except Exception:
            print("--- UNEXPECTED ERROR IN WEBSOCKET ---")
            traceback.print_exc()
            await websocket.close(code=1011, reason="An unexpected server error occurred.")