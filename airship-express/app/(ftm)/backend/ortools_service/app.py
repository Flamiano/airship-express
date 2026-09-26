"""
OR-Tools route optimization service.

WHAT CHANGED FROM THE ORIGINAL VERSION, AND WHY:

1. Distance matrix now uses REAL ROAD DISTANCE (via OSRM's /table API) instead
   of straight-line haversine distance. Haversine ignores one-way streets,
   water, highways vs. side streets — an "optimal" order computed from it can
   be meaningfully wrong once a driver is actually on real roads. If OSRM is
   unreachable (offline dev, rate limit, network hiccup), this falls back to
   haversine automatically rather than failing the whole request — you'll
   see which one was used in the `distance_source` field of the response.

2. This is now a genuine multi-vehicle VRP (Vehicle Routing Problem), not
   just single-vehicle TSP. `num_vehicles` defaults to 1, so existing callers
   (the driver app's single-driver `runOptimizer`) get identical behavior and
   response shape to before — nothing breaks. But you can now pass
   `num_vehicles > 1` to split stops across multiple drivers in one
   optimization call, optionally with `vehicle_capacities` to cap how much
   load (e.g. packages, kg) each vehicle can carry, using OR-Tools'
   `AddDimensionWithVehicleCapacity`. This is the "fleet-wide dispatch"
   version rather than "one driver's route."

3. The dead `nl` field (defined in the payload, never read anywhere) has been
   replaced with `time_limit_secs` — a real, working parameter that actually
   controls the solver's search time budget.

4. Optional API key auth via an `X-API-Key` header. If the OPTIMIZER_API_KEY
   environment variable isn't set, auth is skipped (convenient for local
   dev) — but set it before this is reachable from the public internet.

5. The naive (before-optimization) distance is now computed using the SAME
   distance metric (road distance or haversine, whichever was used) as the
   optimized route, so the "X% shorter" comparison is apples-to-apples
   instead of comparing a road-distance route against a haversine baseline.
"""

import logging
import math
import os
from typing import List, Optional

import requests
from fastapi import Depends, FastAPI, Header, HTTPException
from ortools.constraint_solver import pywrapcp, routing_enums_pb2
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("optimizer")

app = FastAPI(title="OR-Tools Optimizer Service")

# Public OSRM demo server — free, no API key. See the driver app's Leaflet
# migration notes for the same trade-off: no uptime SLA, rate-limited under
# heavy load. Fine for development and a small fleet; self-host OSRM (or a
# paid routing provider) before relying on this at real production scale.
OSRM_TABLE_URL = "https://router.project-osrm.org/table/v1/driving"
OSRM_TIMEOUT_SECS = 6

# If unset, the /optimize endpoint accepts requests with no auth at all —
# fine for local development, not fine once this is reachable from the
# public internet. Set this in your environment before deploying.
API_KEY = os.environ.get("OPTIMIZER_API_KEY")


def verify_api_key(x_api_key: Optional[str] = Header(None)):
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Missing or invalid X-API-Key header")


class Location(BaseModel):
    name: str
    lat: float
    lng: float
    demand: int = Field(0, ge=0, description="Load this stop requires (e.g. packages, kg). Used only if vehicle_capacities is set.")


class OptimizePayload(BaseModel):
    depot: Location
    stops: List[Location]
    num_vehicles: int = Field(1, ge=1, le=25, description="Number of drivers/vehicles to split stops across. Defaults to 1 (single-driver route, matches the original behavior).")
    vehicle_capacities: Optional[List[int]] = Field(None, description="Max total demand each vehicle can carry, in the same order as vehicles. Length must equal num_vehicles. Omit to skip capacity constraints entirely.")
    use_road_distance: bool = Field(True, description="Use real road distance via OSRM. Falls back to straight-line distance automatically if OSRM is unreachable.")
    time_limit_secs: int = Field(3, ge=1, le=30, description="Solver search time budget.")


class VehicleRoute(BaseModel):
    vehicle_id: int
    stops: List[str]
    distance_km: float


class OptimizeResult(BaseModel):
    depot: str
    order: List[str]
    routes: List[VehicleRoute]
    distance_km: float
    naive_distance_km: float
    pct_shorter: int
    distance_source: str
    solver: str


def haversine_meters(a: Location, b: Location) -> float:
    radius = 6371000
    lat1, lon1, lat2, lon2 = map(math.radians, [a.lat, a.lng, b.lat, b.lng])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return radius * 2 * math.asin(math.sqrt(h))


def haversine_matrix(points: List[Location]) -> List[List[int]]:
    size = len(points)
    matrix = [[0] * size for _ in range(size)]
    for i in range(size):
        for j in range(size):
            if i != j:
                matrix[i][j] = int(round(haversine_meters(points[i], points[j])))
    return matrix


def fetch_osrm_distance_matrix(points: List[Location]) -> List[List[int]]:
    """Real road-distance matrix (meters) from OSRM's /table API. Raises on
    any failure — callers should catch this and fall back to haversine."""
    coords = ";".join(f"{p.lng},{p.lat}" for p in points)
    url = f"{OSRM_TABLE_URL}/{coords}?annotations=distance"
    resp = requests.get(url, timeout=OSRM_TIMEOUT_SECS)
    resp.raise_for_status()
    data = resp.json()
    if data.get("code") != "Ok":
        raise RuntimeError(f"OSRM table request returned {data.get('code')}")

    distances = data["distances"]
    flat_values = [d for row in distances for d in row if d is not None]
    penalty = (max(flat_values) * 10 + 1_000_000) if flat_values else 10_000_000
    return [[int(round(d)) if d is not None else penalty for d in row] for row in distances]


def build_distance_matrix(points: List[Location], use_road_distance: bool):
    if use_road_distance:
        try:
            return fetch_osrm_distance_matrix(points), "osrm-road-distance"
        except Exception as exc:
            logger.warning("OSRM table request failed, falling back to haversine: %s", exc)
    return haversine_matrix(points), "haversine-fallback"


def sequential_distance(matrix: List[List[int]]) -> int:
    return sum(matrix[i][i + 1] for i in range(len(matrix) - 1))


def solve_vrp(distance_matrix: List[List[int]], demands: List[int], num_vehicles: int,
              vehicle_capacities: Optional[List[int]], time_limit_secs: int):
    manager = pywrapcp.RoutingIndexManager(len(distance_matrix), num_vehicles, 0)
    routing = pywrapcp.RoutingModel(manager)

    def distance_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return distance_matrix[from_node][to_node]

    transit_callback_index = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

    if vehicle_capacities:
        if len(vehicle_capacities) != num_vehicles:
            raise ValueError("vehicle_capacities length must match num_vehicles")
        if sum(vehicle_capacities) < sum(demands):
            raise ValueError(
                f"Total vehicle capacity ({sum(vehicle_capacities)}) is less than total demand "
                f"({sum(demands)}) — no feasible assignment exists."
            )

        def demand_callback(from_index):
            node = manager.IndexToNode(from_index)
            return demands[node]

        demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)
        routing.AddDimensionWithVehicleCapacity(
            demand_callback_index, 0, vehicle_capacities, True, "Capacity"
        )

    routing.AddDimension(transit_callback_index, 0, 3_000_000, True, "Distance")
    if num_vehicles > 1:
        routing.GetDimensionOrDie("Distance").SetGlobalSpanCostCoefficient(100)

    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    search_parameters.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    search_parameters.time_limit.seconds = time_limit_secs
    search_parameters.log_search = False

    solution = routing.SolveWithParameters(search_parameters)
    if solution is None:
        raise RuntimeError(
            "OR-Tools could not find a feasible solution — check vehicle_capacities against total demand, "
            "or increase time_limit_secs for a larger problem."
        )

    return manager, routing, solution


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/optimize", response_model=OptimizeResult, dependencies=[Depends(verify_api_key)])
def optimize(payload: OptimizePayload):
    if not payload.stops:
        raise HTTPException(status_code=400, detail="At least one stop is required")
    if payload.vehicle_capacities and len(payload.vehicle_capacities) != payload.num_vehicles:
        raise HTTPException(status_code=400, detail="vehicle_capacities length must match num_vehicles")

    points = [payload.depot] + payload.stops
    demands = [0] + [stop.demand for stop in payload.stops]
    distance_matrix, distance_source = build_distance_matrix(points, payload.use_road_distance)

    try:
        manager, routing, solution = solve_vrp(
            distance_matrix,
            demands,
            payload.num_vehicles,
            payload.vehicle_capacities,
            payload.time_limit_secs,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"OR-Tools optimization failed: {exc}")

    routes: List[VehicleRoute] = []
    flattened_order: List[str] = []
    total_distance = 0
    for vehicle_id in range(payload.num_vehicles):
        index = routing.Start(vehicle_id)
        route_stops: List[str] = []
        route_distance = 0
        while not routing.IsEnd(index):
            node_index = manager.IndexToNode(index)
            if node_index != 0:
                route_stops.append(points[node_index].name)
            previous_index = index
            index = solution.Value(routing.NextVar(index))
            route_distance += routing.GetArcCostForVehicle(previous_index, index, vehicle_id)
        routes.append(VehicleRoute(vehicle_id=vehicle_id, stops=route_stops, distance_km=round(route_distance / 1000, 2)))
        flattened_order.extend(route_stops)
        total_distance += route_distance

    naive_distance = sequential_distance(distance_matrix)
    pct_shorter = (
        int(round(((naive_distance - total_distance) / naive_distance) * 100))
        if naive_distance > 0 else 0
    )

    return OptimizeResult(
        depot=payload.depot.name,
        order=flattened_order,
        routes=routes,
        distance_km=round(total_distance / 1000, 2),
        naive_distance_km=round(naive_distance / 1000, 2),
        pct_shorter=pct_shorter,
        distance_source=distance_source,
        solver=f"OR-Tools (GUIDED_LOCAL_SEARCH, {payload.num_vehicles} vehicle{'s' if payload.num_vehicles != 1 else ''})",
    )
