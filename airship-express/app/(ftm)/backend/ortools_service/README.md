OR-Tools microservice

Quick start (Windows / macOS / Linux):

1. Create a virtualenv and install dependencies:

```bash
python -m venv .venv
.venv\Scripts\activate   # Windows
# or `source .venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
```

2. Run the service:

```bash
python optimize_service.py
```

The service will listen on port 8000 by default and expose POST /optimize.
Request payload: { depot: {lat,lng,name}, stops: [{lat,lng,name}, ...] }
