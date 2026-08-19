import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from agents.graph import run_swarm_cycle

load_dotenv()

app = FastAPI(title="Brainpod Orchestra")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("ORCHESTRA_ALLOWED_ORIGIN", "http://localhost:3000")],
    allow_methods=["POST"],
    allow_headers=["Content-Type"],
)


class DirectRequest(BaseModel):
    director_prompt: str


@app.get("/")
def root():
    # Render's default health check hits "/"; without this it just logs harmless 404s.
    return {"service": "brainpod-orchestra", "status": "ok"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/direct")
def direct(request: DirectRequest):
    if not os.environ.get("OPENAI_API_KEY"):
        raise HTTPException(
            status_code=503,
            detail="orchestra_not_configured: OPENAI_API_KEY is not set yet",
        )

    return run_swarm_cycle(request.director_prompt)
