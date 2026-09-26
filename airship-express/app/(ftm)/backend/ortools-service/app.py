from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from ortools.constraint_solver import pywrapcp, routing_enums_pb2
import math

app = FastAPI(title='OR-Tools Optimizer Service')

class Location(BaseModel):
    name: str
    lat: float
    lng: float

class OptimizePayload(BaseModel):
    depot: Location
    stops: List[Location]
    nl: Optional[int] = Field(None, description='Optional optimization hint')

class OptimizeResult(BaseModel):
    depot: str
    order: List[str]
    distance_km: float
    naive_distance_km: float
    pct_shorter: int
    solver: str


def haversine_meters(a, b):
    radius = 6371000
    lat1, lon1, lat2, lon2 = map(math.radians, [a.lat, a.lng, b.lat, b.lng])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return radius * 2 * math.asin(math.sqrt(h))


def build_distance_matrix(points):
    size = len(points)
    matrix = [[0] * size for _ in range(size)]
    for i in range(size):
        for j in range(size):
            if i == j:
                matrix[i][j] = 0
            else:
                matrix[i][j] = int(round(haversine_meters(points[i], points[j])))
    return matrix


def solve_route(depot, stops, time_limit_secs=3):
    points = [depot] + stops
    distance_matrix = build_distance_matrix(points)
    manager = pywrapcp.RoutingIndexManager(len(distance_matrix), 1, 0)
    routing = pywrapcp.RoutingModel(manager)

    def distance_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return distance_matrix[from_node][to_node]

    transit_callback_index = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    search_parameters.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    search_parameters.time_limit.seconds = time_limit_secs
    search_parameters.log_search = False

    solution = routing.SolveWithParameters(search_parameters)
    if solution is None:
        raise RuntimeError('OR-Tools could not find a solution')

    index = routing.Start(0)
    route = []
    route_distance = 0
    while not routing.IsEnd(index):
        node_index = manager.IndexToNode(index)
        if node_index != 0:
            route.append(points[node_index].name)
        previous_index = index
        index = solution.Value(routing.NextVar(index))
        route_distance += routing.GetArcCostForVehicle(previous_index, index, 0)

    return route, route_distance


def compute_naive_distance(depot, stops):
    distance = 0.0
    current = depot
    for stop in stops:
        distance += haversine_meters(current, stop)
        current = stop
    return distance


@app.post('/optimize', response_model=OptimizeResult)
def optimize(payload: OptimizePayload):
    if not payload.stops:
        raise HTTPException(status_code=400, detail='At least one stop is required')

    try:
        order, distance_m = solve_route(payload.depot, payload.stops)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f'OR-Tools optimization failed: {exc}')

    naive_m = compute_naive_distance(payload.depot, payload.stops)
    return OptimizeResult(
        depot=payload.depot.name,
        order=order,
        distance_km=round(distance_m / 1000, 2),
        naive_distance_km=round(naive_m / 1000, 2),
        pct_shorter=int(round(((naive_m - distance_m) / naive_m) * 100)) if naive_m > 0 else 0,
        solver='OR-Tools',
    )
