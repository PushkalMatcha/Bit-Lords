import sys
import os
import asyncio
from dotenv import load_dotenv

# Load env vars early so all imported modules (routes/services) can read them.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_ENV_PATH = os.path.join(os.path.dirname(BASE_DIR), ".env")
BACKEND_ENV_PATH = os.path.join(BASE_DIR, ".env")

load_dotenv(BACKEND_ENV_PATH)
load_dotenv(ROOT_ENV_PATH)

# Critical Windows Fix: Uvicorn/FastAPI drop the Proactor event loop required by Playwright subprocess execution causing NotImplementedError
if sys.platform == "win32" or sys.platform == "cygwin":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

# Ensure the parent directory is in the path to allow imports from database and backend natively
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routes import stories, test_run

app = FastAPI(title="AI Tester Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Router Inclusions
app.include_router(stories.router, prefix="/api/stories", tags=["Stories"])
app.include_router(test_run.router, tags=["Test Runs"])

@app.get("/")
def read_root():
    return {"message": "Welcome to AI Tester Agent API"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
