# Legacy OR-Tools Service

This directory contains the former standalone FastAPI implementation. The
active FTM route planner no longer uses or requires this service.

The active solver is `app/(ftm)/web/python/optimize.py`. Local Next.js calls it
directly; Vercel packages its FastAPI wrapper as an internal service in the
same deployment. See `app/(ftm)/web/vercel.json` and
`app/(ftm)/web/python/requirements.txt`.
