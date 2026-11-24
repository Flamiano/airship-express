"""
Route optimization service backed by Google OR-Tools.

Reads a JSON payload from stdin describing an origin, a destination, and a
set of waypoints ("stops"), solves an open-path routing problem (a TSP
variant) with OR-Tools' constraint solver, and writes the optimized stop
order + resulting route metrics to stdout as JSON. Parcel pickup/delivery
pairs stay on the same vehicle and in pickup-first order. Both OSRM distance
and duration matrices are required; optimizationMode selects the primary
objective or balances normalized time and distance costs.

This is invoked by the FTM Next.js API locally and by the colocated Python
runtime in production. It runs OR-Tools whenever Python has the `ortools`
package; missing runtime/dependency errors are surfaced by the caller.

Install:
    pip install ortools

Payload shape (stdin, JSON):
{
  "origin": {"lat": 37.77, "lng": -122.41},
  "destination": {"lat": 37.33, "lng": -121.88},
  "stops": [{"id": "s1", "lat": 37.7, "lng": -122.1}, ...],
    "distanceMatrix": [[0, ...], ...],
    "durationMatrix": [[0, ...], ...],
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


def matrix_is_valid(matrix, size):
    if not isinstance(matrix, list) or len(matrix) != size:
        return False
    try:
        return all(
            isinstance(row, list)
            and len(row) == size
            and all(math.isfinite(float(value)) and float(value) >= 0 for value in row)
            for row in matrix
        )
    except (TypeError, ValueError):
        return False


def parcel_event_pairs(stops):
    events_by_parcel = {}
    for stop_index, stop in enumerate(stops):
        events = stop.get("parcelEvents")
        if events is None:
            continue
        if not isinstance(events, list):
            raise ValueError("parcelEvents must be an array")
        for event in events:
            if not isinstance(event, dict):
                raise ValueError("Every parcel route event must be an object")
            parcel_id = event.get("parcelId")
            kind = event.get("kind")
            if not isinstance(parcel_id, str) or not parcel_id.strip() or kind not in {"pickup", "delivery"}:
                raise ValueError("Every parcel route event needs a parcel ID and a pickup or delivery kind")
            raw_weight = event.get("weightKg", stop.get("weightKg", 0))
            if isinstance(raw_weight, bool):
                raise ValueError("Parcel event weights must be non-negative finite numbers")
            try:
                weight = float(raw_weight)
            except (TypeError, ValueError):
                raise ValueError("Parcel event weights must be non-negative finite numbers")
            if not math.isfinite(weight) or weight < 0:
                raise ValueError("Parcel event weights must be non-negative finite numbers")
            pair = events_by_parcel.setdefault(parcel_id, {"pickup": None, "delivery": None})
            if pair[kind] is not None:
                raise ValueError(f"Parcel {parcel_id} has more than one {kind} stop")
            pair[kind] = (stop_index + 1, weight)
    if any(pair["pickup"] is None or pair["delivery"] is None for pair in events_by_parcel.values()):
        raise ValueError("Every parcel route needs exactly one pickup and one delivery stop")
    if any(
        not math.isclose(pair["pickup"][1], pair["delivery"][1], rel_tol=1e-9, abs_tol=1e-6)
        for pair in events_by_parcel.values()
    ):
        raise ValueError("Parcel pickup and delivery weights must match")
    return events_by_parcel


def solve(payload):
    origin = payload["origin"]
    destination = payload["destination"]
    stops = payload.get("stops", [])
    available_vehicles = payload.get("availableVehicles") or []
    vehicle_count = max(1, payload.get("vehicleCount") or len(available_vehicles) or min(3, max(1, len(stops))))
    optimization_mode = payload.get("optimizationMode") or "fastest"
    if optimization_mode not in {"fastest", "shortest", "fuel", "balanced"}:
        optimization_mode = "fastest"

    if not stops:
        raise ValueError("At least one stop is required")

    stop_ids = [stop.get("id") for stop in stops]
    if any(not isinstance(stop_id, str) or not stop_id for stop_id in stop_ids):
        raise ValueError("Every stop must have a non-empty string ID")
    if len(set(stop_ids)) != len(stop_ids):
        raise ValueError("Stop IDs must be unique")

    parcel_pairs = parcel_event_pairs(stops)
    vehicle_capacity_kg = payload.get("vehicleCapacityKg")
    cargo_weight_kg = payload.get("cargoWeightKg")
    if vehicle_capacity_kg is not None:
        if isinstance(vehicle_capacity_kg, bool):
            raise ValueError("vehicleCapacityKg must be a positive finite number")
        try:
            vehicle_capacity_kg = float(vehicle_capacity_kg)
        except (TypeError, ValueError):
            raise ValueError("vehicleCapacityKg must be a positive finite number")
        if not math.isfinite(vehicle_capacity_kg) or vehicle_capacity_kg <= 0:
            raise ValueError("vehicleCapacityKg must be a positive finite number")
    if cargo_weight_kg is not None:
        if isinstance(cargo_weight_kg, bool):
            raise ValueError("cargoWeightKg must be a non-negative finite number")
        try:
            cargo_weight_kg = float(cargo_weight_kg)
        except (TypeError, ValueError):
            raise ValueError("cargoWeightKg must be a non-negative finite number")
        if not math.isfinite(cargo_weight_kg) or cargo_weight_kg < 0:
            raise ValueError("cargoWeightKg must be a non-negative finite number")
        if vehicle_count == 1 and vehicle_capacity_kg is not None and cargo_weight_kg > vehicle_capacity_kg:
            raise ValueError(
                f"Cargo load ({cargo_weight_kg:g} kg) exceeds vehicle capacity ({vehicle_capacity_kg:g} kg)"
            )

    location_count = len(stops) + 2
    distance_matrix = payload.get("distanceMatrix")
    duration_matrix = payload.get("durationMatrix")
    has_distance_matrix = distance_matrix is not None
    has_duration_matrix = duration_matrix is not None
    if has_distance_matrix != has_duration_matrix:
        raise ValueError("distanceMatrix and durationMatrix must be supplied together")
    if not has_distance_matrix:
        raise ValueError("OSRM distanceMatrix and durationMatrix are required for route optimization")
    if has_distance_matrix and (
        not matrix_is_valid(distance_matrix, location_count)
        or not matrix_is_valid(duration_matrix, location_count)
    ):
        raise ValueError(f"distanceMatrix and durationMatrix must both be finite {location_count}x{location_count} matrices")

    if has_distance_matrix:
        distance_matrix = [[float(value) for value in row] for row in distance_matrix]
        duration_matrix = [[float(value) for value in row] for row in duration_matrix]

    vehicle_capacity = [
        max(1, int(math.ceil(float(v.get("capacityKg") or 500) * 1000)))
        for v in available_vehicles[:vehicle_count]
    ]
    if available_vehicles and len(vehicle_capacity) != vehicle_count:
        raise ValueError("A capacity must be provided for every configured vehicle")

    stop_weights = []
    for stop in stops:
        events = stop.get("parcelEvents") or []
        if events:
            weight = sum(
                (1 if event["kind"] == "pickup" else -1)
                * float(event.get("weightKg", stop.get("weightKg", 0)))
                for event in events
            )
        else:
            raw_weight = stop.get("weightKg", stop.get("weight", 1))
            if isinstance(raw_weight, bool):
                raise ValueError("Stop weights must be non-negative finite numbers")
            try:
                weight = float(raw_weight)
            except (TypeError, ValueError):
                raise ValueError("Stop weights must be non-negative finite numbers")
            if not math.isfinite(weight) or weight < 0:
                raise ValueError("Stop weights must be non-negative finite numbers")
        stop_weights.append({**stop, "weightKg": weight})

    manager = pywrapcp.RoutingIndexManager(location_count, vehicle_count, [0] * vehicle_count, [location_count - 1] * vehicle_count)
    routing = pywrapcp.RoutingModel(manager)
    max_distance_cost = max(
        int(round(value * 1_609.344))
        for row in distance_matrix
        for value in row
    )
    max_route_arcs = len(stops) + vehicle_count
    distance_tiebreak_scale = max_distance_cost * max_route_arcs + 1
    balanced_cost_scale = 1_000_000
    max_time_cost = max(
        int(round(value * 60))
        for row in duration_matrix
        for value in row
    )
    time_tiebreak_scale = max_time_cost * max_route_arcs + 1
    if optimization_mode == "balanced":
        max_encoded_cost = balanced_cost_scale * 2
    elif optimization_mode in {"shortest", "fuel"}:
        max_encoded_cost = max_distance_cost * time_tiebreak_scale + max_time_cost
    else:
        max_encoded_cost = max_time_cost * distance_tiebreak_scale + max_distance_cost
    if max_encoded_cost * max_route_arcs > 2**63 - 1:
        raise ValueError("The supplied route costs exceed OR-Tools' supported integer range")

    def cost_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        time_cost = int(round(duration_matrix[from_node][to_node] * 60))
        distance_cost = int(round(distance_matrix[from_node][to_node] * 1_609.344))
        if optimization_mode == "balanced":
            normalized_time = (time_cost * balanced_cost_scale + max(max_time_cost, 1) // 2) // max(max_time_cost, 1)
            normalized_distance = (distance_cost * balanced_cost_scale + max(max_distance_cost, 1) // 2) // max(max_distance_cost, 1)
            return normalized_time + normalized_distance
        if optimization_mode in {"shortest", "fuel"}:
            return distance_cost * time_tiebreak_scale + time_cost
        return time_cost * distance_tiebreak_scale + distance_cost

    transit_callback_index = routing.RegisterTransitCallback(cost_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

    demands = [0] + [int(round(stop["weightKg"] * 1000)) for stop in stop_weights] + [0]

    def demand_callback(index):
        return demands[manager.IndexToNode(index)]

    if available_vehicles:
        demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)
        routing.AddDimensionWithVehicleCapacity(
            demand_callback_index,
            0,
            vehicle_capacity,
            True,
            "Capacity",
        )

    warehouse_nodes = [index + 1 for index, stop in enumerate(stops) if stop.get("kind") == "warehouse"]
    parcel_nodes = [index + 1 for index, stop in enumerate(stops) if stop.get("kind") != "warehouse"]
    if parcel_pairs or (vehicle_count == 1 and warehouse_nodes and parcel_nodes):
        order_callback_index = routing.RegisterTransitCallback(lambda _from, _to: 1)
        routing.AddDimension(order_callback_index, 0, location_count, True, "StopOrder")
        stop_order = routing.GetDimensionOrDie("StopOrder")
        if vehicle_count == 1:
            for warehouse_node in warehouse_nodes:
                for parcel_node in parcel_nodes:
                    warehouse_index = manager.NodeToIndex(warehouse_node)
                    parcel_index = manager.NodeToIndex(parcel_node)
                    routing.solver().Add(
                        stop_order.CumulVar(warehouse_index) < stop_order.CumulVar(parcel_index)
                    )
        for pair in parcel_pairs.values():
            pickup_index = manager.NodeToIndex(pair["pickup"][0])
            delivery_index = manager.NodeToIndex(pair["delivery"][0])
            routing.AddPickupAndDelivery(pickup_index, delivery_index)
            routing.solver().Add(
                routing.VehicleVar(pickup_index) == routing.VehicleVar(delivery_index)
            )
            routing.solver().Add(
                stop_order.CumulVar(pickup_index) < stop_order.CumulVar(delivery_index)
            )

    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    search_parameters.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    search_parameters.time_limit.seconds = max(1, min(30, int(payload.get("timeLimitSecs") or 5)))
    solution = routing.SolveWithParameters(search_parameters)
    if solution is None:
        raise RuntimeError("OR-Tools could not find a feasible solution for the supplied route and vehicle capacities")

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
            "etaMinutes": round(route_eta_minutes),
        })

    if not routes:
        raise RuntimeError("OR-Tools returned no route containing the selected stops")

    if len(flattened) != len(stop_ids) or set(flattened) != set(stop_ids):
        raise RuntimeError("OR-Tools did not visit every selected stop exactly once")

    return {
        "orderedStopIds": flattened,
        "routes": routes,
        "distanceMi": round(total_distance, 1),
        "etaMinutes": round(total_eta),
        "engine": "or-tools",
    }


def main():
    raw = sys.stdin.read()
    payload = json.loads(raw)
    result = solve(payload)
    sys.stdout.write(json.dumps(result))


if __name__ == "__main__":
    main()
