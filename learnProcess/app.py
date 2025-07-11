from fastapi import FastAPI
from fastapi.responses import HTMLResponse
import httpx

app = FastAPI(title="Learn Process API", description="A separate FastAPI app for learnProcess module.", version="1.0.0")

@app.get("/")
def read_root():
    return {"message": "Welcome to the Learn Process API!"}

@app.get("/words", response_class=HTMLResponse)
async def get_words():
    # Fetch words from the main app
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get("http://localhost:8000/words/?limit=20")
            response.raise_for_status()
            words = response.json()
        except Exception as e:
            return HTMLResponse(f"<h1>Error fetching words: {e}</h1>", status_code=500)

    # Render a simple HTML page
    html = """
    <html>
        <head><title>Words from Main App</title></head>
        <body>
            <h1>Words from Main App</h1>
            <ul>
    """
    for word in words:
        html += f"<li>{word.get('kazakh_word', '')} ({word.get('kazakh_cyrillic', '')}) - {word.get('primary_translation', '')}</li>"
    html += """
            </ul>
        </body>
    </html>
    """
    return HTMLResponse(content=html)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=9000) 