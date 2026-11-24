"""Stdin/stdout adapter for the recovered legacy Node optimizer contract."""
import json
import sys

from app import OptimizePayload, optimize


if __name__ == "__main__":
    try:
        payload = OptimizePayload.model_validate(json.load(sys.stdin))
        result = optimize(payload)
        json.dump(result.model_dump(), sys.stdout)
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
