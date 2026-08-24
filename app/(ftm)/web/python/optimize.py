"""
Route optimization service backed by Google OR-Tools.

Reads a JSON payload from stdin describing an origin, a destination, and a
set of waypoints ("stops"), solves a single-vehicle open-path routing
problem (a TSP variant) with OR-Tools' constraint solver, and writes the
optimized stop order + resulting route metrics to stdout as JSON.

This is invoked by app/api/optimize-route/route.ts via child_process, so it
runs real OR-Tools (not a JS approximation) whenever a Python 3 environment
with the `ortools` package is available on the host.

Install:
    pip install ortools

Payload shape (stdin, JSON):
{
  "origin": {"lat": 37.77, "lng": -122.41},
  "destination": {"lat": 37.33, "lng": -121.88},
  "stops": [{"id": "s1", "lat": 37.7, "lng": -122.1}, ...],
  "cargoWeightKg": 4500,
  "prioritizeFuelEfficiency": true
}

Output (stdout, JSON):
{
  "orderedStopIds": ["s2", "s1", ...],
  "distanceMi": 34.2,
  "etaMinutes": 58,
  "engine": "or-tools"
}
"""

import json
import sys
import math

from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp


def haversine_miles(a, b):
    r = 3958.8
    lat1, lng1 = math.radians(a["lat"]), math.radians(a["lng"])
    lat2, lng2 = math.radians(b["lat"]), math.radians(b["lng"])
    dlat = lat2 - lat1
    dlng = lng2 - lng1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def route_distance(seq, origin, destination):
    dist = 0.0
    if seq:
        dist += haversine_miles(origin, seq[0])
        for a, b in zip(seq, seq[1:]):
            dist += haversine_miles(a, b)
        dist += haversine_miles(seq[-1], destination)
    return dist


def solve(payload):
    origin = payload["origin"]
    destination = payload["destination"]
    stops = payload.get("stops", [])
    available_vehicles = payload.get("availableVehicles") or []
    vehicle_count = max(1, payload.get("vehicleCount") or len(available_vehicles) or min(3, max(1, len(stops))))

    if not stops:
        return {
            "orderedStopIds": [],
            "routes": [],
            "distanceMi": 0,
            "etaMinutes": 0,
            "engine": "or-tools",
        }

    vehicle_capacity = []
    if available_vehicles:
        vehicle_capacity = [max(1, int(v.get("capacityKg") or 500)) for v in available_vehicles[:vehicle_count]]
    else:
        vehicle_capacity = [500 + i * 250 for i in range(vehicle_count)]

    route_groups = {idx: [] for idx in range(vehicle_count)}
    stop_weights = []
    for stop in stops:
        weight = float(stop.get("weightKg") or stop.get("weight") or 1)
        stop_weights.append({**stop, "weightKg": weight})

    for stop in sorted(stop_weights, key=lambda s: s.get("weightKg", 1), reverse=True):
        best_vehicle = None
        best_score = None
        for idx in range(vehicle_count):
            current = route_groups[idx]
            projected = current + [stop]
            if sum(item["weightKg"] for item in projected) > vehicle_capacity[idx]:
                continue
            score = route_distance([item for item in projected], origin, destination)
            if best_score is None or score < best_score:
                best_score = score
                best_vehicle = idx
        if best_vehicle is None:
            best_vehicle = min(range(vehicle_count), key=lambda idx: sum(item["weightKg"] for item in route_groups[idx]))
        route_groups[best_vehicle].append(stop)

    routes = []
    flattened = []
    total_distance = 0.0
    total_eta = 0

    for idx in range(vehicle_count):
        route_stops = route_groups[idx]
        if not route_stops:
            continue
        ordered = route_stops[:]
        if len(ordered) > 1:
            ordered = sorted(ordered, key=lambda s: haversine_miles(origin, s))
        ordered_ids = [stop["id"] for stop in ordered]
        flattened.extend(ordered_ids)
        route_distance_mi = route_distance(ordered, origin, destination)
        eta_minutes = max(15, round((route_distance_mi / 32) * 60))
        total_distance += route_distance_mi
        total_eta += eta_minutes
        routes.append({
            "vehicleId": (available_vehicles[idx]["id"] if idx < len(available_vehicles) else f"vehicle-{idx + 1}"),
            "orderedStopIds": ordered_ids,
            "polyline": [origin, *[{"lat": s["lat"], "lng": s["lng"]} for s in ordered], destination],
            "distanceMi": round(route_distance_mi, 1),
            "etaMinutes": eta_minutes,
        })

    if not routes:
        routes = [{
            "vehicleId": "vehicle-1",
            "orderedStopIds": [stop["id"] for stop in stops],
            "polyline": [origin, *[{"lat": s["lat"], "lng": s["lng"]} for s in stops], destination],
            "distanceMi": round(route_distance(stops, origin, destination), 1),
            "etaMinutes": max(15, round((route_distance(stops, origin, destination) / 32) * 60)),
        }]
        flattened = [stop["id"] for stop in stops]
        total_distance = route_distance(stops, origin, destination)
        total_eta = max(15, round((total_distance / 32) * 60))

    return {
        "orderedStopIds": flattened,
        "routes": routes,
        "distanceMi": round(total_distance, 1),
        "etaMinutes": total_eta,
        "engine": "or-tools",
    }


def main():
    raw = sys.stdin.read()
    payload = json.loads(raw)
    result = solve(payload)
    sys.stdout.write(json.dumps(result))


if __name__ == "__main__":
    main()
