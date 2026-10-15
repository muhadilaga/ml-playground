export interface ColumnInfo {
  name: string;
  dtype: string;
  missing_count: number;
  unique_count: number;
}

export interface DatasetResponse {
  dataset_id: string;
  name?: string;
  filename?: string;
  description?: string;
  total_rows: number;
  total_columns: number;
  columns: ColumnInfo[];
  preview: Record<string, any>[];
  saved_files: {
    csv: string;
    parquet: string;
  };
}

export interface TrainRequest {
  dataset_id: string;
  target_column: string;
  task_type?: "auto" | "classification" | "regression";
  feature_columns?: string[];
  model_type?: "random_forest" | "decision_tree";
  test_size?: number;
  max_depth?: number;
  n_estimators?: number;
  random_state?: number;
}

export interface ConfusionMatrixResponse {
  matrix: number[][];
  labels: string[];
}

export interface FeatureImportanceItem {
  feature: string;
  importance: number;
}

export interface TreeNode {
  feature: string | null;
  threshold: number | null;
  samples: number;
  value: number[];
  left: TreeNode | null;
  right: TreeNode | null;
}

export interface TrainResponse {
  model_id: string;
  dataset_id: string;
  task_type: "classification" | "regression";
  detected_task_type: "classification" | "regression";
  model_type: "random_forest" | "decision_tree";
  target_column: string;
  feature_columns: string[];
  train_samples: number;
  test_samples: number;
  metrics: Record<string, number>;
  confusion_matrix?: ConfusionMatrixResponse | null;
  feature_importance: FeatureImportanceItem[];
  tree: TreeNode;
  model_file: string;
}

export interface PredictRequest {
  model_id: string;
  inputs: Record<string, any>;
}

export interface PredictResponse {
  model_id: string;
  prediction: string | number;
  probabilities?: Record<string, number> | null;
}

export interface ExperimentItem {
  id: string;
  name: string;
  time: string;
  model_id: string;
  task_type: "classification" | "regression";
  model_type: string;
  config: {
    target: string;
    features: string[];
    n_estimators?: number;
    max_depth?: number;
    test_size?: number;
    random_state?: number;
  };
  score: {
    name: string;
    value: number;
  };
  full_result: TrainResponse;
}
