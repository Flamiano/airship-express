"""FastAPI entrypoint for the FTM's colocated Vercel Python service."""

import logging
import hmac
import os
import sys
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, Header, HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parent))
from optimize import solve

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ftm-ortools")
app = FastAPI(title="FTM OR-Tools Runtime")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/optimize-route")
def optimize_route(payload: dict[str, Any], authorization: Optional[str] = Header(None)):
    shared_secret = os.getenv("FTM_ORTOOLS_SHARED_SECRET")
    if not shared_secret:
        raise HTTPException(status_code=503, detail="Optimizer authentication is not configured")
    if not hmac.compare_digest(authorization or "", f"Bearer {shared_secret}"):
        raise HTTPException(status_code=401, detail="Unauthorized")

    try:
        result = solve(payload)
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=f"Invalid OR-Tools request: {exc}") from exc
    except Exception as exc:
        logger.exception("OR-Tools route solve failed")
        raise HTTPException(status_code=500, detail=f"OR-Tools route solve failed: {exc}") from exc

    if result.get("engine") != "or-tools":
        logger.error("Solver returned without confirming an OR-Tools solve: %s", result.get("engine"))
        raise HTTPException(status_code=500, detail="OR-Tools did not produce a solution")
    return result
