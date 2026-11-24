The FTM web app uses the solver in `app/(ftm)/web/python/optimize.py`.

- Local Next.js development invokes that Python script directly. Install the
	packages in `app/(ftm)/web/python/requirements.txt` in the local Python
	environment.
- Vercel deploys the FastAPI wrapper in `app/(ftm)/web/python/ortools_api.py`
	as the internal `ftm_ortools` service declared in
	`app/(ftm)/web/vercel.json`. The Next.js service calls it through a private
	deployment binding; no Render service URL or public optimizer endpoint is
	required.
- If OSRM is unavailable, the Python solver builds haversine costs and still
	runs OR-Tools. A failed OR-Tools solve is returned as an error, never as a
	heuristic result labeled `or-tools`.

The FastAPI application in this directory is a legacy standalone copy and is
not used by the active FTM web route planner.
