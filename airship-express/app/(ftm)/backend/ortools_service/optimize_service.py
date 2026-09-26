from flask import Flask, request, jsonify
from ortools.constraint_solver import pywrapcp, routing_enums_pb2
import math

app = Flask(__name__)


def haversine_km(a, b):
    # a and b are dicts with lat,lng in degrees
    R = 6371.0
    lat1 = math.radians(a['lat'])
    lat2 = math.radians(b['lat'])
    dlat = lat2 - lat1
    dlng = math.radians(b['lng'] - a['lng'])
    x = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng/2)**2
    return 2 * R * math.atan2(math.sqrt(x), math.sqrt(1-x))


def create_distance_matrix(points):
    n = len(points)
    matrix = [[0]*n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            if i == j:
                matrix[i][j] = 0
            else:
                matrix[i][j] = int(haversine_km(points[i], points[j]) * 1000)  # meters
    return matrix


def solve_tsp_distance_matrix(distance_matrix, start_index=0, time_limit_sec=5):
    n = len(distance_matrix)
    manager = pywrapcp.RoutingIndexManager(n, 1, start_index)
    routing = pywrapcp.RoutingModel(manager)

    def distance_callback(from_index, to_index):
        return distance_matrix[manager.IndexToNode(from_index)][manager.IndexToNode(to_index)]

    transit_callback_index = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    search_parameters.time_limit.seconds = time_limit_sec

    solution = routing.SolveWithParameters(search_parameters)
    if solution:
        index = routing.Start(0)
        route = []
        route_distance = 0
        while not routing.IsEnd(index):
            node = manager.IndexToNode(index)
            route.append(node)
            previous_index = index
            index = solution.Value(routing.NextVar(index))
            route_distance += routing.GetArcCostForVehicle(previous_index, index, 0)
        return route, route_distance
    return None, None


@app.route('/optimize', methods=['POST'])
def optimize():
    payload = request.get_json(force=True)
    if not payload or 'depot' not in payload or 'stops' not in payload:
        return jsonify({'error': 'payload must include depot and stops'}), 400

    depot = payload['depot']
    stops = payload['stops']
    # points: depot + stops
    points = [depot] + stops
    distance_matrix = create_distance_matrix(points)

    route, route_distance_m = solve_tsp_distance_matrix(distance_matrix, start_index=0)
    if route is None:
        return jsonify({'error': 'no solution'}), 500

    # route is list of indices into points; convert to stops order (exclude depot index 0)
    ordered = []
    for idx in route:
        if idx == 0:
            continue
        ordered.append(stops[idx-1].get('name') or stops[idx-1].get('id') or f'stop-{idx}')

    return jsonify({
        'depot': depot.get('name') or depot.get('id') or 'depot',
        'order': ordered,
        'distance_m': int(route_distance_m),
        'distance_km': round(route_distance_m / 1000.0, 3),
        'solver': 'ortools-tsp-python',
    })


if __name__ == '__main__':
    import os
    port = int(os.environ.get('ORTOOLS_SERVICE_PORT', 8000))
    app.run(host='0.0.0.0', port=port)
