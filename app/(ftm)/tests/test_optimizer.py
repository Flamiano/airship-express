"""Local integration checks with supplied matrices; no external routing calls."""
import importlib.util
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
SERVICES = ROOT / "app" / "(ftm)" / "lib" / "server" / "python-services"
sys.dont_write_bytecode = True


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


solver = load("optimize", ROOT / "app" / "(ftm)" / "lib" / "server" / "python" / "optimize.py")
api = load("ftm_optimizer_api", ROOT / "app" / "(ftm)" / "lib" / "server" / "python" / "ortools_api.py")
legacy = load("ftm_legacy_optimizer", SERVICES / "ortools_service" / "app.py")
older = load("ftm_older_optimizer", SERVICES / "ortools-service" / "app.py")
flask_api = load("ftm_flask_optimizer", SERVICES / "ortools_service" / "optimize_service.py")


def payload():
    kilometer_in_miles = 1_000 / 1_609.344
    return {
        "origin": {"lat": 14.59, "lng": 120.98},
        "destination": {"lat": 14.59, "lng": 120.98},
        "stops": [{"id": "A", "lat": 14.60, "lng": 120.99}, {"id": "B", "lat": 14.61, "lng": 121.00}],
        "distanceMatrix": [
            [0, kilometer_in_miles, 3 * kilometer_in_miles, 0],
            [kilometer_in_miles, 0, kilometer_in_miles, kilometer_in_miles],
            [3 * kilometer_in_miles, kilometer_in_miles, 0, 3 * kilometer_in_miles],
            [0, kilometer_in_miles, 3 * kilometer_in_miles, 0],
        ],
        "durationMatrix": [[0, 60, 180, 0], [60, 0, 60, 60], [180, 60, 0, 180], [0, 60, 180, 0]],
        "timeLimitSecs": 1,
    }


class OptimizerTests(unittest.TestCase):
    def test_real_ortools_solve_visits_each_stop_and_returns_metrics(self):
        result = solver.solve(payload())
        self.assertEqual(result["engine"], "or-tools")
        self.assertCountEqual(result["orderedStopIds"], ["A", "B"])
        self.assertAlmostEqual(result["distanceMi"] * 1609.344, 5000, delta=20)
        self.assertGreater(result["etaMinutes"], 0)

    def test_solver_rejects_missing_and_invalid_cost_matrices(self):
        data = payload()
        data.pop("distanceMatrix")
        with self.assertRaises(ValueError):
            solver.solve(data)
        data = payload()
        data["durationMatrix"][0][1] = -1
        with self.assertRaises(ValueError):
            solver.solve(data)

    def test_solver_keeps_parcel_pickup_before_delivery(self):
        data = payload()
        data["vehicleCount"] = 1
        data["vehicleCapacityKg"] = 5
        data["cargoWeightKg"] = 4
        data["stops"] = [
            {
                "id": "delivery",
                "lat": 14.60,
                "lng": 120.99,
                "parcelEvents": [{"parcelId": "parcel-1", "kind": "delivery", "weightKg": 4}],
            },
            {
                "id": "pickup",
                "lat": 14.61,
                "lng": 121.00,
                "parcelEvents": [{"parcelId": "parcel-1", "kind": "pickup", "weightKg": 4}],
            },
        ]
        data["distanceMatrix"] = [
            [0, 1, 2, 20],
            [1, 0, 1, 20],
            [2, 1, 0, 1],
            [20, 20, 1, 0],
        ]
        data["durationMatrix"] = data["distanceMatrix"]

        result = solver.solve(data)
        self.assertEqual(result["orderedStopIds"], ["pickup", "delivery"])

    def test_solver_rejects_incomplete_parcel_pairs_and_overweight_cargo(self):
        data = payload()
        data["stops"] = [{
            "id": "pickup",
            "lat": 14.60,
            "lng": 120.99,
            "parcelEvents": [{"parcelId": "parcel-1", "kind": "pickup"}],
        }]
        with self.assertRaisesRegex(ValueError, "exactly one pickup and one delivery"):
            solver.solve(data)

        data = payload()
        data["vehicleCount"] = 1
        data["vehicleCapacityKg"] = 4
        data["cargoWeightKg"] = 5
        with self.assertRaisesRegex(ValueError, "exceeds vehicle capacity"):
            solver.solve(data)

    def test_shared_api_enforces_credential_before_solving(self):
        with patch.dict(os.environ, {"FTM_ORTOOLS_SHARED_SECRET": "local-test-only"}):
            with self.assertRaises(api.HTTPException) as error:
                api.optimize_route(payload(), authorization="Bearer incorrect")
            self.assertEqual(error.exception.status_code, 401)
            self.assertEqual(api.optimize_route(payload(), authorization="Bearer local-test-only")["engine"], "or-tools")

    def test_recovered_multivehicle_api_runs_without_network(self):
        data = legacy.OptimizePayload(
            depot={"name": "Depot", "lat": 14.59, "lng": 120.98},
            stops=[{"name": "A", "lat": 14.60, "lng": 120.99, "demand": 1}, {"name": "B", "lat": 14.61, "lng": 121.00, "demand": 1}],
            num_vehicles=2, vehicle_capacities=[1, 1], use_road_distance=False, time_limit_secs=1,
        )
        result = legacy.optimize(data)
        self.assertCountEqual(result.order, ["A", "B"])
        self.assertEqual(len(result.routes), 2)

    def test_original_service_contract_is_callable(self):
        result = older.optimize(older.OptimizePayload(
            depot={"name": "Depot", "lat": 14.59, "lng": 120.98},
            stops=[{"name": "A", "lat": 14.60, "lng": 120.99}],
        ))
        self.assertEqual(result.order, ["A"])

    def test_flask_service_preserves_http_validation_contract(self):
        with flask_api.app.test_client() as client:
            response = client.post("/optimize", json={})
            self.assertEqual(response.status_code, 400)
            response = client.post("/optimize", json={"depot": {"name": "Depot", "lat": 14.59, "lng": 120.98}, "stops": [{"name": "A", "lat": 14.60, "lng": 120.99}]})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json["order"], ["A"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
