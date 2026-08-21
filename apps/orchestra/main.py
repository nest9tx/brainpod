import os
from typing import Literal, Optional

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

WorkMode = Literal["brainstorm", "assist", "construct"]


class DirectRequest(BaseModel):
    director_prompt: str
    prior_context: Optional[str] = None
    mode: Optional[WorkMode] = "construct"


@app.get("/")
def root():
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

    return run_swarm_cycle(
        director_prompt=request.director_prompt,
        prior_context=request.prior_context or "",
        mode=request.mode or "construct",
    )
