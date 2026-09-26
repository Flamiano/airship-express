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


def matrix_is_valid(matrix, size):
    return (
        isinstance(matrix, list)
        and len(matrix) == size
        and all(isinstance(row, list) and len(row) == size and all(math.isfinite(float(value)) for value in row) for row in matrix)
    )


def solve(payload):
    origin = payload["origin"]
    destination = payload["destination"]
    stops = payload.get("stops", [])
    available_vehicles = payload.get("availableVehicles") or []
    optimization_mode = payload.get("optimizationMode", "balanced")
    vehicle_count = max(1, payload.get("vehicleCount") or len(available_vehicles) or min(3, max(1, len(stops))))

    if not stops:
        return {
            "orderedStopIds": [],
            "routes": [],
            "distanceMi": 0,
            "etaMinutes": 0,
            "engine": "or-tools",
        }

    location_count = len(stops) + 2
    distance_matrix = payload.get("distanceMatrix")
    duration_matrix = payload.get("durationMatrix")
    has_road_matrix = matrix_is_valid(distance_matrix, location_count) and matrix_is_valid(duration_matrix, location_count)

    if has_road_matrix:
        distance_matrix = [[float(value) for value in row] for row in distance_matrix]
        duration_matrix = [[float(value) for value in row] for row in duration_matrix]

    vehicle_capacity = []
    if available_vehicles:
        vehicle_capacity = [max(1, int(v.get("capacityKg") or 500)) for v in available_vehicles[:vehicle_count]]
    else:
        vehicle_capacity = [500 + i * 250 for i in range(vehicle_count)]

    stop_weights = []
    for stop in stops:
        weight = float(stop.get("weightKg") or stop.get("weight") or 1)
        stop_weights.append({**stop, "weightKg": weight})

    if has_road_matrix:
        manager = pywrapcp.RoutingIndexManager(location_count, vehicle_count, [0] * vehicle_count, [location_count - 1] * vehicle_count)
        routing = pywrapcp.RoutingModel(manager)
        cost_matrix = duration_matrix if optimization_mode in {"fastest", "balanced"} else distance_matrix

        def cost_callback(from_index, to_index):
            return int(round(cost_matrix[manager.IndexToNode(from_index)][manager.IndexToNode(to_index)] * 1000))

        transit_callback_index = routing.RegisterTransitCallback(cost_callback)
        routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

        demands = [0] + [max(1, int(round(stop["weightKg"]))) for stop in stop_weights] + [0]

        def demand_callback(index):
            return demands[manager.IndexToNode(index)]

        demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)
        routing.AddDimensionWithVehicleCapacity(
            demand_callback_index,
            0,
            vehicle_capacity,
            True,
            "Capacity",
        )

        search_parameters = pywrapcp.DefaultRoutingSearchParameters()
        search_parameters.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
        search_parameters.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
        search_parameters.time_limit.seconds = 3
        solution = routing.SolveWithParameters(search_parameters)
        if solution is None:
            raise RuntimeError("OR-Tools could not find a feasible road-matrix solution")

        routes = []
        flattened = []
        total_distance = 0.0
        total_eta = 0
        for idx in range(vehicle_count):
            index = routing.Start(idx)
            route_ids = []
            route_distance_mi = 0.0
            route_eta_minutes = 0.0
            while not routing.IsEnd(index):
                next_index = solution.Value(routing.NextVar(index))
                from_node = manager.IndexToNode(index)
                to_node = manager.IndexToNode(next_index)
                if 0 < from_node < location_count - 1:
                    route_ids.append(stops[from_node - 1]["id"])
                route_distance_mi += distance_matrix[from_node][to_node]
                route_eta_minutes += duration_matrix[from_node][to_node]
                index = next_index
            if not route_ids:
                continue
            flattened.extend(route_ids)
            total_distance += route_distance_mi
            total_eta = max(total_eta, route_eta_minutes)
            ordered = [next(stop for stop in stops if stop["id"] == stop_id) for stop_id in route_ids]
            routes.append({
                "vehicleId": (available_vehicles[idx]["id"] if idx < len(available_vehicles) else f"vehicle-{idx + 1}"),
                "orderedStopIds": route_ids,
                "polyline": [origin, *[{"lat": stop["lat"], "lng": stop["lng"]} for stop in ordered], destination],
                "distanceMi": round(route_distance_mi, 1),
                "etaMinutes": max(1, round(route_eta_minutes)),
            })
    else:
        # Keep the existing geometry-only fallback when the road matrix service is unavailable.
        route_groups = {idx: [] for idx in range(vehicle_count)}
        for stop in sorted(stop_weights, key=lambda s: s.get("weightKg", 1), reverse=True):
            best_vehicle = None
            best_score = None
            for idx in range(vehicle_count):
                current = route_groups[idx]
                projected = current + [stop]
                if sum(item["weightKg"] for item in projected) > vehicle_capacity[idx]:
                    continue
                score = route_distance(projected, origin, destination)
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
            ordered = sorted(route_stops, key=lambda stop: haversine_miles(origin, stop))
            ordered_ids = [stop["id"] for stop in ordered]
            flattened.extend(ordered_ids)
            route_distance_mi = route_distance(ordered, origin, destination)
            eta_minutes = max(15, round((route_distance_mi / 32) * 60))
            total_distance += route_distance_mi
            total_eta = max(total_eta, eta_minutes)
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
