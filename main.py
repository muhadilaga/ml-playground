from __future__ import annotations

import io
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, File, HTTPException, Query, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor

# Base directories
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
MODELS_DIR = BASE_DIR / "models"

DATA_DIR.mkdir(parents=True, exist_ok=True)
MODELS_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="Dataset & ML Management API",
    description="FastAPI backend for dataset ingestion, EDA previews, sample dataset generation, and model training (Decision Tree / Random Forest).",
    version="1.1.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Pydantic Schemas ---

class ColumnInfo(BaseModel):
    name: str = Field(..., description="Column name")
    dtype: str = Field(..., description="Data type representation")
    missing_count: int = Field(..., description="Number of missing / null values")
    unique_count: int = Field(..., description="Number of unique values")


class DatasetSummaryResponse(BaseModel):
    dataset_id: str
    filename: Optional[str] = None
    total_rows: int
    total_columns: int
    columns: List[ColumnInfo]
    preview: List[Dict[str, Any]]
    saved_files: Dict[str, str]


class SampleDatasetResponse(BaseModel):
    dataset_id: str
    name: str
    description: str
    total_rows: int
    total_columns: int
    columns: List[ColumnInfo]
    preview: List[Dict[str, Any]]
    saved_files: Dict[str, str]


class DatasetListItem(BaseModel):
    dataset_id: str
    csv_exists: bool
    parquet_exists: bool
    total_rows: Optional[int] = None
    total_columns: Optional[int] = None


class TrainRequest(BaseModel):
    dataset_id: str = Field(
        ...,
        description="ID of the dataset (e.g. ds_xxx, sample_iris, sample_housing, sample_energy)",
        json_schema_extra={"example": "sample_iris"},
    )
    target_column: str = Field(
        ...,
        description="Name of the target column to predict",
        json_schema_extra={"example": "species"},
    )
    task_type: Optional[Literal["auto", "classification", "regression"]] = Field(
        default="auto",
        description="Task type: 'auto' (automatically detected from target dtype), or override with 'classification' or 'regression'",
    )
    feature_columns: Optional[List[str]] = Field(
        default=None,
        description="List of feature columns. If omitted, all columns except target_column are used.",
    )
    model_type: Optional[Literal["random_forest", "decision_tree"]] = Field(
        default="random_forest",
        description="Algorithm choice: 'random_forest' or 'decision_tree'",
    )
    test_size: Optional[float] = Field(
        default=0.2,
        ge=0.05,
        le=0.5,
        description="Proportion of the dataset to include in the test split",
    )
    max_depth: Optional[int] = Field(
        default=5,
        ge=1,
        le=30,
        description="Maximum depth of the tree(s) for interpretability",
    )
    n_estimators: Optional[int] = Field(
        default=50,
        ge=1,
        le=500,
        description="Number of trees in Random Forest",
    )
    random_state: Optional[int] = Field(
        default=42,
        description="Random seed for reproducibility",
    )


class ConfusionMatrixResponse(BaseModel):
    matrix: List[List[int]] = Field(..., description="Confusion matrix 2D grid")
    labels: List[str] = Field(..., description="Class labels in order of rows/columns")


class FeatureImportanceItem(BaseModel):
    feature: str = Field(..., description="Feature name")
    importance: float = Field(..., description="Normalized importance score")


class TreeNode(BaseModel):
    feature: Optional[str] = Field(None, description="Feature used for split (None for leaf)")
    threshold: Optional[float] = Field(None, description="Split threshold value (None for leaf)")
    samples: int = Field(..., description="Number of samples at this node")
    value: List[float] = Field(..., description="Target class distribution or regression value")
    left: Optional[TreeNode] = Field(None, description="Left child subtree")
    right: Optional[TreeNode] = Field(None, description="Right child subtree")


class TrainResponse(BaseModel):
    model_id: str = Field(..., description="Unique model identifier")
    dataset_id: str
    task_type: Literal["classification", "regression"]
    detected_task_type: Literal["classification", "regression"]
    model_type: Literal["random_forest", "decision_tree"]
    target_column: str
    feature_columns: List[str]
    train_samples: int
    test_samples: int
    metrics: Dict[str, float]
    confusion_matrix: Optional[ConfusionMatrixResponse] = None
    feature_importance: List[FeatureImportanceItem]
    tree: TreeNode
    model_file: str


class ModelListItem(BaseModel):
    model_id: str
    dataset_id: str
    task_type: str
    model_type: str
    target_column: str
    created_at: str
    metrics: Dict[str, float]


class PredictRequest(BaseModel):
    model_id: str = Field(..., description="ID of the trained model to use for prediction")
    inputs: Dict[str, Any] = Field(..., description="Feature values mapping {feature_name: value}")


class PredictResponse(BaseModel):
    model_id: str = Field(..., description="ID of the model used for prediction")
    prediction: Any = Field(..., description="Predicted class label or regression value")
    probabilities: Optional[Dict[str, float]] = Field(
        default=None,
        description="Class probabilities for classification tasks (None for regression)",
    )


# --- Helper Functions ---

def clean_for_json(records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    cleaned = []
    for row in records:
        cleaned_row = {}
        for k, v in row.items():
            if pd.isna(v) or v in [np.inf, -np.inf]:
                cleaned_row[k] = None
            elif isinstance(v, (np.integer,)):
                cleaned_row[k] = int(v)
            elif isinstance(v, (np.floating,)):
                cleaned_row[k] = float(v)
            elif isinstance(v, (np.ndarray,)):
                cleaned_row[k] = v.tolist()
            else:
                cleaned_row[k] = v
        cleaned.append(cleaned_row)
    return cleaned


def extract_metadata(df: pd.DataFrame) -> List[ColumnInfo]:
    columns_info: List[ColumnInfo] = []
    for col in df.columns:
        columns_info.append(
            ColumnInfo(
                name=str(col),
                dtype=str(df[col].dtype),
                missing_count=int(df[col].isna().sum()),
                unique_count=int(df[col].nunique(dropna=False)),
            )
        )
    return columns_info


def extract_preview(df: pd.DataFrame, n: int = 10) -> List[Dict[str, Any]]:
    preview_df = df.head(n).copy()
    records = preview_df.to_dict(orient="records")
    return clean_for_json(records)


def save_dataset_files(df: pd.DataFrame, dataset_id: str) -> Dict[str, str]:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    df.columns = [str(col) for col in df.columns]

    csv_path = DATA_DIR / f"{dataset_id}.csv"
    parquet_path = DATA_DIR / f"{dataset_id}.parquet"

    df.to_csv(csv_path, index=False)
    df.to_parquet(parquet_path, index=False, engine="pyarrow")

    return {
        "csv": f"data/{dataset_id}.csv",
        "parquet": f"data/{dataset_id}.parquet",
    }


def detect_task_type(series: pd.Series) -> Literal["classification", "regression"]:
    valid_series = series.dropna()
    if valid_series.empty:
        return "regression"

    if valid_series.dtype.kind in ("O", "b", "S", "U", "c"):
        return "classification"

    nunique = int(valid_series.nunique())

    if pd.api.types.is_integer_dtype(valid_series):
        if nunique <= 20 and (nunique / len(valid_series)) < 0.2:
            return "classification"
        return "regression"

    if pd.api.types.is_float_dtype(valid_series):
        is_whole = np.all(np.mod(valid_series, 1) == 0)
        if is_whole and nunique <= 10:
            return "classification"
        return "regression"

    return "regression"


def tree_to_dict(tree, feature_names: List[str], node_id: int = 0) -> Dict[str, Any]:
    left = int(tree.children_left[node_id])
    right = int(tree.children_right[node_id])
    is_leaf = (left == -1 and right == -1)

    raw_val = tree.value[node_id].squeeze().tolist()
    if isinstance(raw_val, (int, float)):
        val_list = [round(float(raw_val), 4)]
    else:
        val_list = [round(float(v), 4) for v in raw_val]

    samples_count = int(tree.n_node_samples[node_id])

    if is_leaf:
        return {
            "feature": None,
            "threshold": None,
            "samples": samples_count,
            "value": val_list,
            "left": None,
            "right": None,
        }

    feat_idx = int(tree.feature[node_id])
    feat_name = feature_names[feat_idx] if 0 <= feat_idx < len(feature_names) else f"feature_{feat_idx}"
    thresh = round(float(tree.threshold[node_id]), 4)

    return {
        "feature": feat_name,
        "threshold": thresh,
        "samples": samples_count,
        "value": val_list,
        "left": tree_to_dict(tree, feature_names, left),
        "right": tree_to_dict(tree, feature_names, right),
    }


# --- Sample Dataset Generators ---

def generate_iris_dataset() -> pd.DataFrame:
    from sklearn.datasets import load_iris

    iris = load_iris(as_frame=True)
    df = iris.frame.copy()
    df.rename(
        columns={
            "sepal length (cm)": "sepal_length",
            "sepal width (cm)": "sepal_width",
            "petal length (cm)": "petal_length",
            "petal width (cm)": "petal_width",
            "target": "species",
        },
        inplace=True,
    )
    species_map = {0: "setosa", 1: "versicolor", 2: "virginica"}
    df["species"] = df["species"].map(species_map)
    return df


def generate_housing_dataset() -> pd.DataFrame:
    try:
        from sklearn.datasets import fetch_california_housing

        housing = fetch_california_housing(as_frame=True)
        df = housing.frame.copy()
        df.columns = [c.lower() for c in df.columns]
        return df
    except Exception:
        np.random.seed(42)
        n = 1000
        med_inc = np.round(np.random.gamma(3, 1.2, n) + 0.5, 4)
        house_age = np.round(np.random.uniform(1, 52, n), 1)
        ave_rooms = np.round(np.clip(np.random.normal(5.4, 1.2, n), 1, 15), 4)
        ave_bedrms = np.round(np.clip(ave_rooms * np.random.uniform(0.18, 0.25, n), 1, 5), 4)
        population = np.random.randint(100, 5000, n)
        ave_occup = np.round(np.clip(np.random.normal(3.0, 0.8, n), 1, 8), 4)
        latitude = np.round(np.random.uniform(32.5, 42.0, n), 4)
        longitude = np.round(np.random.uniform(-124.3, -114.3, n), 4)
        med_house_val = np.round(
            np.clip(med_inc * 0.4 + (52 - house_age) * 0.01 + np.random.normal(0, 0.3, n), 0.15, 5.0),
            4,
        )
        return pd.DataFrame(
            {
                "medinc": med_inc,
                "houseage": house_age,
                "averooms": ave_rooms,
                "avebedrms": ave_bedrms,
                "population": population,
                "aveoccup": ave_occup,
                "latitude": latitude,
                "longitude": longitude,
                "medhouseval": med_house_val,
            }
        )


def generate_energy_dataset() -> pd.DataFrame:
    np.random.seed(42)
    n_samples = 768
    relative_compactness = np.round(np.random.uniform(0.62, 0.98, n_samples), 2)
    surface_area = np.round(np.random.uniform(514.5, 808.5, n_samples), 1)
    wall_area = np.round(np.random.uniform(245.0, 416.5, n_samples), 1)
    roof_area = np.round((surface_area - wall_area) / 2, 1)
    overall_height = np.random.choice([3.5, 7.0], n_samples)
    orientation = np.random.choice([2, 3, 4, 5], n_samples)
    glazing_area = np.random.choice([0.0, 0.1, 0.25, 0.4], n_samples)
    heating_load = np.round(
        15
        + 20 * relative_compactness
        - 0.05 * roof_area
        + 2.0 * overall_height
        + 10.0 * glazing_area
        + np.random.normal(0, 1.5, n_samples),
        2,
    )
    cooling_load = np.round(
        18
        + 18 * relative_compactness
        - 0.04 * roof_area
        + 2.2 * overall_height
        + 12.0 * glazing_area
        + np.random.normal(0, 1.8, n_samples),
        2,
    )

    return pd.DataFrame(
        {
            "relative_compactness": relative_compactness,
            "surface_area": surface_area,
            "wall_area": wall_area,
            "roof_area": roof_area,
            "overall_height": overall_height,
            "orientation": orientation,
            "glazing_area": glazing_area,
            "heating_load": heating_load,
            "cooling_load": cooling_load,
        }
    )


SAMPLE_GENERATORS = {
    "iris": {
        "generator": generate_iris_dataset,
        "description": "Fisher's Iris dataset: 150 samples with 4 morphological features and 3 flower species.",
    },
    "housing": {
        "generator": generate_housing_dataset,
        "description": "California Housing dataset: median house values and district characteristics.",
    },
    "energy": {
        "generator": generate_energy_dataset,
        "description": "Building Energy Efficiency dataset: structural features to predict heating and cooling loads.",
    },
}


def load_dataset_by_id(dataset_id: str) -> pd.DataFrame:
    parquet_path = DATA_DIR / f"{dataset_id}.parquet"
    csv_path = DATA_DIR / f"{dataset_id}.csv"

    if parquet_path.exists():
        return pd.read_parquet(parquet_path)
    if csv_path.exists():
        return pd.read_csv(csv_path)

    clean_name = dataset_id.lower().replace("sample_", "").strip()
    if clean_name in SAMPLE_GENERATORS:
        df = SAMPLE_GENERATORS[clean_name]["generator"]()
        save_dataset_files(df, f"sample_{clean_name}")
        return df

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Dataset '{dataset_id}' not found in data directory ({DATA_DIR}).",
    )


# --- API Endpoints ---

@app.get("/", tags=["General"])
def root():
    return {
        "message": "Dataset & ML Training API is running",
        "docs_url": "/docs",
        "endpoints": {
            "upload_csv": "POST /api/datasets/upload",
            "get_sample": "GET /api/datasets/sample/{name} (names: iris, housing, energy)",
            "list_samples": "GET /api/datasets/samples",
            "list_datasets": "GET /api/datasets",
            "train_model": "POST /api/train",
            "predict": "POST /api/predict",
            "list_models": "GET /api/models",
        },
    }


@app.post(
    "/api/datasets/upload",
    response_model=DatasetSummaryResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Datasets"],
    summary="Upload CSV Dataset",
    description="Upload a CSV file via multipart/form-data. Stores it as CSV and Parquet, then returns dataset ID, column info, and 10 preview rows.",
)
async def upload_dataset(file: UploadFile = File(...)):
    filename = file.filename or "uploaded.csv"
    if not filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a CSV with a .csv extension.",
        )

    try:
        content = await file.read()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read file content: {str(e)}",
        )

    if not content or len(content.strip()) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is empty.",
        )

    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse CSV: {str(e)}",
        )

    if df.empty and len(df.columns) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Parsed CSV contains no rows and no columns.",
        )

    dataset_id = f"ds_{uuid.uuid4().hex[:12]}"
    saved_files = save_dataset_files(df, dataset_id)
    columns_info = extract_metadata(df)
    preview = extract_preview(df, n=10)

    return DatasetSummaryResponse(
        dataset_id=dataset_id,
        filename=filename,
        total_rows=int(len(df)),
        total_columns=int(len(df.columns)),
        columns=columns_info,
        preview=preview,
        saved_files=saved_files,
    )


@app.get(
    "/api/datasets/samples",
    tags=["Datasets"],
    summary="List Available Sample Datasets",
)
def list_available_samples():
    return [
        {"name": name, "description": info["description"]}
        for name, info in SAMPLE_GENERATORS.items()
    ]


@app.get(
    "/api/datasets/sample/{name}",
    response_model=SampleDatasetResponse,
    tags=["Datasets"],
    summary="Get / Generate Sample Dataset",
    description="Serve sample dataset (iris, housing, energy). Saves dataset as CSV and Parquet in backend/data/ and returns column metadata and 10 preview rows.",
)
def get_sample_dataset(name: str):
    dataset_name = name.lower().strip()
    if dataset_name not in SAMPLE_GENERATORS:
        available = ", ".join(SAMPLE_GENERATORS.keys())
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sample dataset '{name}' not found. Available samples: {available}",
        )

    sample_meta = SAMPLE_GENERATORS[dataset_name]
    dataset_id = f"sample_{dataset_name}"
    parquet_path = DATA_DIR / f"{dataset_id}.parquet"

    if parquet_path.exists():
        df = pd.read_parquet(parquet_path)
        saved_files = {
            "csv": f"data/{dataset_id}.csv",
            "parquet": f"data/{dataset_id}.parquet",
        }
    else:
        df = sample_meta["generator"]()
        saved_files = save_dataset_files(df, dataset_id)

    columns_info = extract_metadata(df)
    preview = extract_preview(df, n=10)

    return SampleDatasetResponse(
        dataset_id=dataset_id,
        name=dataset_name,
        description=sample_meta["description"],
        total_rows=int(len(df)),
        total_columns=int(len(df.columns)),
        columns=columns_info,
        preview=preview,
        saved_files=saved_files,
    )


@app.get(
    "/api/datasets",
    response_model=List[DatasetListItem],
    tags=["Datasets"],
    summary="List Saved Datasets",
)
def list_saved_datasets():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    files = list(DATA_DIR.glob("*"))
    dataset_ids = set()

    for f in files:
        if f.suffix in [".csv", ".parquet"]:
            dataset_ids.add(f.stem)

    results = []
    for d_id in sorted(dataset_ids):
        csv_file = DATA_DIR / f"{d_id}.csv"
        parquet_file = DATA_DIR / f"{d_id}.parquet"

        rows = None
        cols = None
        if parquet_file.exists():
            try:
                import pyarrow.parquet as pq

                meta = pq.read_metadata(parquet_file)
                rows = meta.num_rows
                cols = meta.num_columns
            except Exception:
                pass

        results.append(
            DatasetListItem(
                dataset_id=d_id,
                csv_exists=csv_file.exists(),
                parquet_exists=parquet_file.exists(),
                total_rows=rows,
                total_columns=cols,
            )
        )
    return results


@app.get(
    "/api/datasets/{dataset_id}/download",
    tags=["Datasets"],
    summary="Download Dataset File",
)
def download_dataset(
    dataset_id: str,
    format: Literal["csv", "parquet"] = Query("csv", description="File format to download"),
):
    file_path = DATA_DIR / f"{dataset_id}.{format}"
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File {dataset_id}.{format} not found.",
        )

    media_type = "text/csv" if format == "csv" else "application/octet-stream"
    return FileResponse(
        path=file_path,
        media_type=media_type,
        filename=f"{dataset_id}.{format}",
    )


# --- Model Training Endpoint ---

@app.post(
    "/api/train",
    response_model=TrainResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Machine Learning"],
    summary="Train Model on Dataset",
    description=(
        "Train a tree model (Random Forest or Decision Tree) on a dataset. "
        "Automatically detects classification vs regression from target column dtype (can be overridden). "
        "Returns metrics, confusion matrix (classification), feature importance, one tree in recursive format, "
        "and saves the model with joblib in backend/models/."
    ),
)
def train_model(payload: TrainRequest):
    df = load_dataset_by_id(payload.dataset_id)

    if payload.target_column not in df.columns:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Target column '{payload.target_column}' not found. Available columns: {list(df.columns)}",
        )

    detected_task = detect_task_type(df[payload.target_column])
    if payload.task_type and payload.task_type != "auto":
        task_type = payload.task_type
    else:
        task_type = detected_task

    if payload.feature_columns:
        missing_features = [col for col in payload.feature_columns if col not in df.columns]
        if missing_features:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Specified feature columns not found in dataset: {missing_features}",
            )
        feature_names = [col for col in payload.feature_columns if col != payload.target_column]
        if not feature_names:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one feature column must be specified (excluding the target column).",
            )
    else:
        feature_names = [col for col in df.columns if col != payload.target_column]
        if not feature_names:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Dataset has no feature columns to train on besides the target column.",
            )

    target_clean_mask = df[payload.target_column].notna()
    df_clean = df.loc[target_clean_mask].copy()

    if len(df_clean) < 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Dataset has only {len(df_clean)} non-null rows; minimum 10 rows required for training.",
        )

    X_raw = df_clean[feature_names].copy()
    y_raw = df_clean[payload.target_column].copy()

    X = pd.get_dummies(X_raw, drop_first=False)
    for col in X.columns:
        if X[col].isna().any():
            median_val = X[col].median()
            X[col] = X[col].fillna(0.0 if pd.isna(median_val) else median_val)

    encoded_feature_names = list(X.columns)

    label_encoder: Optional[LabelEncoder] = None
    class_names: List[str] = []

    if task_type == "classification":
        label_encoder = LabelEncoder()
        y = label_encoder.fit_transform(y_raw.astype(str))
        class_names = [str(cls) for cls in label_encoder.classes_]
        if len(class_names) < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Target column '{payload.target_column}' has only 1 distinct class. At least 2 classes required.",
            )
    else:
        try:
            y = y_raw.astype(float).values
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Could not convert target column values to numeric float for regression: {str(e)}",
            )

    stratify_split = None
    if task_type == "classification":
        class_counts = pd.Series(y).value_counts()
        if (class_counts >= 2).all():
            stratify_split = y

    X_train, X_test, y_train, y_test = train_test_split(
        X.values,
        y,
        test_size=payload.test_size or 0.2,
        random_state=payload.random_state or 42,
        stratify=stratify_split,
    )

    model_type = payload.model_type or "random_forest"
    max_depth = payload.max_depth or 5
    random_state = payload.random_state or 42
    n_estimators = payload.n_estimators or 50

    if task_type == "classification":
        if model_type == "decision_tree":
            model = DecisionTreeClassifier(max_depth=max_depth, random_state=random_state)
        else:
            model = RandomForestClassifier(
                n_estimators=n_estimators, max_depth=max_depth, random_state=random_state
            )
    else:
        if model_type == "decision_tree":
            model = DecisionTreeRegressor(max_depth=max_depth, random_state=random_state)
        else:
            model = RandomForestRegressor(
                n_estimators=n_estimators, max_depth=max_depth, random_state=random_state
            )

    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)

    confusion_matrix_resp: Optional[ConfusionMatrixResponse] = None
    metrics: Dict[str, float] = {}

    if task_type == "classification":
        acc = float(accuracy_score(y_test, y_pred))
        f1 = float(f1_score(y_test, y_pred, average="weighted", zero_division=0))
        prec = float(precision_score(y_test, y_pred, average="weighted", zero_division=0))
        rec = float(recall_score(y_test, y_pred, average="weighted", zero_division=0))
        metrics = {
            "accuracy": round(acc, 4),
            "f1": round(f1, 4),
            "precision": round(prec, 4),
            "recall": round(rec, 4),
        }

        cm = confusion_matrix(y_test, y_pred, labels=list(range(len(class_names)))).tolist()
        confusion_matrix_resp = ConfusionMatrixResponse(matrix=cm, labels=class_names)
    else:
        rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
        mae = float(mean_absolute_error(y_test, y_pred))
        r2 = float(r2_score(y_test, y_pred))
        metrics = {
            "rmse": round(rmse, 4),
            "mae": round(mae, 4),
            "r2": round(r2, 4),
        }

    importances = model.feature_importances_
    feat_imp_list = [
        FeatureImportanceItem(
            feature=str(feat),
            importance=round(float(imp), 4),
        )
        for feat, imp in zip(encoded_feature_names, importances)
    ]
    feat_imp_list.sort(key=lambda item: item.importance, reverse=True)

    if hasattr(model, "estimators_"):
        single_tree = model.estimators_[0].tree_
    else:
        single_tree = model.tree_

    tree_dict = tree_to_dict(single_tree, encoded_feature_names)
    tree_node = TreeNode(**tree_dict)

    model_id = f"model_{uuid.uuid4().hex[:12]}"
    model_filename = f"{model_id}.joblib"
    model_path = MODELS_DIR / model_filename

    artifact = {
        "model_id": model_id,
        "dataset_id": payload.dataset_id,
        "task_type": task_type,
        "detected_task_type": detected_task,
        "model_type": model_type,
        "target_column": payload.target_column,
        "feature_names": encoded_feature_names,
        "class_names": class_names if task_type == "classification" else None,
        "label_encoder": label_encoder,
        "model": model,
        "metrics": metrics,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    joblib.dump(artifact, model_path)

    return TrainResponse(
        model_id=model_id,
        dataset_id=payload.dataset_id,
        task_type=task_type,
        detected_task_type=detected_task,
        model_type=model_type,
        target_column=payload.target_column,
        feature_columns=encoded_feature_names,
        train_samples=int(len(X_train)),
        test_samples=int(len(X_test)),
        metrics=metrics,
        confusion_matrix=confusion_matrix_resp,
        feature_importance=feat_imp_list,
        tree=tree_node,
        model_file=f"models/{model_filename}",
    )


@app.get(
    "/api/models",
    response_model=List[ModelListItem],
    tags=["Machine Learning"],
    summary="List Saved Models",
)
def list_saved_models():
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    models = []
    for model_path in MODELS_DIR.glob("*.joblib"):
        try:
            meta = joblib.load(model_path)
            models.append(
                ModelListItem(
                    model_id=meta.get("model_id", model_path.stem),
                    dataset_id=meta.get("dataset_id", "unknown"),
                    task_type=meta.get("task_type", "unknown"),
                    model_type=meta.get("model_type", "unknown"),
                    target_column=meta.get("target_column", "unknown"),
                    created_at=meta.get("created_at", "unknown"),
                    metrics=meta.get("metrics", {}),
                )
            )
        except Exception:
            continue
    models.sort(key=lambda m: m.created_at, reverse=True)
    return models


@app.get(
    "/api/models/{model_id}",
    tags=["Machine Learning"],
    summary="Get Model Details",
)
def get_model_details(model_id: str):
    model_path = MODELS_DIR / f"{model_id}.joblib"
    if not model_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model '{model_id}' not found.",
        )
    meta = joblib.load(model_path)
    return {
        "model_id": meta.get("model_id"),
        "dataset_id": meta.get("dataset_id"),
        "task_type": meta.get("task_type"),
        "detected_task_type": meta.get("detected_task_type"),
        "model_type": meta.get("model_type"),
        "target_column": meta.get("target_column"),
        "feature_names": meta.get("feature_names"),
        "class_names": meta.get("class_names"),
        "metrics": meta.get("metrics"),
        "created_at": meta.get("created_at"),
        "model_file": f"models/{model_id}.joblib",
    }


@app.post(
    "/api/predict",
    response_model=PredictResponse,
    tags=["Machine Learning"],
    summary="Predict with Trained Model",
    description="Run inference using a trained model. Returns prediction and class probabilities (for classification).",
)
def predict(payload: PredictRequest):
    model_path = MODELS_DIR / f"{payload.model_id}.joblib"
    if not model_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model '{payload.model_id}' not found.",
        )

    try:
        artifact = joblib.load(model_path)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load model '{payload.model_id}': {str(e)}",
        )

    model = artifact.get("model")
    task_type = artifact.get("task_type", "classification")
    feature_names = artifact.get("feature_names", [])
    class_names = artifact.get("class_names")
    label_encoder = artifact.get("label_encoder")

    # Format inputs into single-row DataFrame aligned with training feature names
    input_df = pd.DataFrame([payload.inputs])
    input_encoded = pd.get_dummies(input_df, drop_first=False)
    input_encoded = input_encoded.reindex(columns=feature_names, fill_value=0.0).astype(float)

    # Perform prediction
    pred_raw = model.predict(input_encoded.values)[0]

    probabilities = None
    if task_type == "classification":
        if label_encoder is not None:
            pred_val = label_encoder.inverse_transform([int(pred_raw)])[0]
        elif class_names and int(pred_raw) < len(class_names):
            pred_val = class_names[int(pred_raw)]
        else:
            pred_val = pred_raw

        if isinstance(pred_val, (np.generic,)):
            pred_val = pred_val.item()

        if hasattr(model, "predict_proba"):
            proba = model.predict_proba(input_encoded.values)[0]
            if class_names:
                probabilities = {str(c): round(float(p), 4) for c, p in zip(class_names, proba)}
            else:
                probabilities = {f"class_{i}": round(float(p), 4) for i, p in enumerate(proba)}
    else:
        pred_val = round(float(pred_raw), 4)

    return PredictResponse(
        model_id=payload.model_id,
        prediction=pred_val,
        probabilities=probabilities,
    )
