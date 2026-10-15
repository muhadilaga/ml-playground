import os
import io
import pytest
from fastapi.testclient import TestClient
from main import app, DATA_DIR, MODELS_DIR

client = TestClient(app)

def test_root():
    response = client.get("/")
    assert response.status_code == 200
    assert "endpoints" in response.json()

def test_samples():
    for name in ["iris", "housing", "energy"]:
        response = client.get(f"/api/datasets/sample/{name}")
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == name
        assert data["total_rows"] > 0
        assert len(data["columns"]) > 0
        assert len(data["preview"]) == 10

def test_upload_csv():
    csv_data = "feature_a,feature_b,target\n1.0,2.0,cat\n1.5,2.5,dog\n2.0,3.0,cat\n2.5,3.5,dog\n3.0,4.0,cat\n3.5,4.5,dog\n4.0,5.0,cat\n4.5,5.5,dog\n5.0,6.0,cat\n5.5,6.5,dog\n6.0,7.0,cat\n"
    response = client.post(
        "/api/datasets/upload",
        files={"file": ("test_data.csv", io.BytesIO(csv_data.encode("utf-8")), "text/csv")},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["total_rows"] == 11
    assert "dataset_id" in data

    # Train on uploaded dataset
    train_res = client.post(
        "/api/train",
        json={
            "dataset_id": data["dataset_id"],
            "target_column": "target",
            "model_type": "decision_tree",
        },
    )
    assert train_res.status_code == 201
    train_data = train_res.json()
    assert train_data["task_type"] == "classification"
    assert "model_id" in train_data

def test_train_classification_auto():
    payload = {
        "dataset_id": "sample_iris",
        "target_column": "species",
        "model_type": "random_forest",
        "max_depth": 3,
        "n_estimators": 20,
    }
    response = client.post("/api/train", json=payload)
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["task_type"] == "classification"
    assert data["detected_task_type"] == "classification"
    assert "model_id" in data
    assert "accuracy" in data["metrics"]
    assert "f1" in data["metrics"]
    assert data["confusion_matrix"] is not None
    assert len(data["confusion_matrix"]["labels"]) == 3
    assert len(data["feature_importance"]) == 4
    assert data["tree"] is not None
    assert "feature" in data["tree"]
    assert "threshold" in data["tree"]
    assert "samples" in data["tree"]
    assert "value" in data["tree"]
    assert "left" in data["tree"]
    assert "right" in data["tree"]

    # Verify model file exists
    model_id = data["model_id"]
    model_file = MODELS_DIR / f"{model_id}.joblib"
    assert model_file.exists()

def test_train_regression_auto():
    payload = {
        "dataset_id": "sample_energy",
        "target_column": "heating_load",
        "model_type": "decision_tree",
        "max_depth": 4,
    }
    response = client.post("/api/train", json=payload)
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["task_type"] == "regression"
    assert data["detected_task_type"] == "regression"
    assert "rmse" in data["metrics"]
    assert "mae" in data["metrics"]
    assert "r2" in data["metrics"]
    assert data["confusion_matrix"] is None
    assert data["tree"] is not None
    assert "samples" in data["tree"]
    assert "value" in data["tree"]

def test_list_and_get_models():
    response = client.get("/api/models")
    assert response.status_code == 200
    models = response.json()
    assert len(models) >= 2
    model_id = models[0]["model_id"]

    detail_res = client.get(f"/api/models/{model_id}")
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["model_id"] == model_id


def test_predict_classification_valid():
    # 1. Train classification model
    train_payload = {
        "dataset_id": "sample_iris",
        "target_column": "species",
        "model_type": "decision_tree",
        "max_depth": 3,
    }
    train_res = client.post("/api/train", json=train_payload)
    assert train_res.status_code == 201
    model_id = train_res.json()["model_id"]

    # 2. Predict with valid model_id and inputs
    predict_payload = {
        "model_id": model_id,
        "inputs": {
            "sepal_length": 5.1,
            "sepal_width": 3.5,
            "petal_length": 1.4,
            "petal_width": 0.2,
        },
    }
    response = client.post("/api/predict", json=predict_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["model_id"] == model_id
    assert "prediction" in data
    assert data["prediction"] in ["setosa", "versicolor", "virginica"]
    assert "probabilities" in data
    assert isinstance(data["probabilities"], dict)
    assert "setosa" in data["probabilities"]
    assert "versicolor" in data["probabilities"]
    assert "virginica" in data["probabilities"]
    # Check sum of probabilities
    assert 0.99 <= sum(data["probabilities"].values()) <= 1.01


def test_predict_model_not_found():
    # Predict with ngawur / non-existent model_id
    predict_payload = {
        "model_id": "model_ngawur_tidak_ada_99999",
        "inputs": {
            "sepal_length": 5.1,
            "sepal_width": 3.5,
        },
    }
    response = client.post("/api/predict", json=predict_payload)
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_predict_regression_valid():
    # Train regression model
    train_payload = {
        "dataset_id": "sample_energy",
        "target_column": "heating_load",
        "model_type": "decision_tree",
        "max_depth": 4,
    }
    train_res = client.post("/api/train", json=train_payload)
    assert train_res.status_code == 201
    model_id = train_res.json()["model_id"]

    # Predict with valid regression inputs
    predict_payload = {
        "model_id": model_id,
        "inputs": {
            "relative_compactness": 0.8,
            "surface_area": 600.0,
            "wall_area": 300.0,
            "roof_area": 150.0,
            "overall_height": 7.0,
            "orientation": 3,
            "glazing_area": 0.25,
            "cooling_load": 25.0,
        },
    }
    response = client.post("/api/predict", json=predict_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["model_id"] == model_id
    assert "prediction" in data
    assert isinstance(data["prediction"], float)
    assert data["probabilities"] is None


