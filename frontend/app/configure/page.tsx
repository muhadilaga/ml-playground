"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sliders,
  Play,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Database,
  BarChart3,
  Network,
  Cpu,
  Layers,
  Sparkles,
} from "lucide-react";
import { trainModel } from "@/lib/api";
import { DatasetResponse, TrainResponse } from "@/types";
import ErrorBanner from "@/components/ErrorBanner";
import { CardsSkeleton } from "@/components/LoadingSkeleton";

export default function ConfigurePage() {
  const router = useRouter();
  const [dataset, setDataset] = useState<DatasetResponse | null>(null);

  // Form State
  const [targetColumn, setTargetColumn] = useState<string>("");
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [taskType, setTaskType] = useState<"auto" | "classification" | "regression">("auto");
  const [modelType, setModelType] = useState<"random_forest" | "decision_tree">("random_forest");
  const [testSize, setTestSize] = useState<number>(0.2);
  const [maxDepth, setMaxDepth] = useState<number>(5);
  const [nEstimators, setNEstimators] = useState<number>(50);
  const [randomState, setRandomState] = useState<number>(42);

  // Training Execution State
  const [isTraining, setIsTraining] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [trainingResult, setTrainingResult] = useState<TrainResponse | null>(null);

  // Load dataset from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("ml_active_dataset");
      if (stored) {
        const parsed: DatasetResponse = JSON.parse(stored);
        setDataset(parsed);

        // Smart target column default:
        // Look for common target names like 'species', 'target', 'medhouseval', 'heating_load', or last column
        const colNames = parsed.columns.map((c) => c.name);
        let defaultTarget = colNames[colNames.length - 1];
        const preferred = ["species", "target", "label", "heating_load", "medhouseval", "price"];
        for (const p of preferred) {
          if (colNames.includes(p)) {
            defaultTarget = p;
            break;
          }
        }
        setTargetColumn(defaultTarget);

        // Select all other features by default
        setSelectedFeatures(colNames.filter((c) => c !== defaultTarget));
      }
    } catch (e) {
      console.error("Failed to parse active dataset:", e);
    }
  }, []);

  // When targetColumn changes, remove it from selectedFeatures
  const handleTargetChange = (newTarget: string) => {
    setTargetColumn(newTarget);
    setSelectedFeatures((prev) => prev.filter((f) => f !== newTarget));
  };

  const toggleFeature = (col: string) => {
    if (selectedFeatures.includes(col)) {
      setSelectedFeatures(selectedFeatures.filter((f) => f !== col));
    } else {
      setSelectedFeatures([...selectedFeatures, col]);
    }
  };

  const handleSelectAllFeatures = () => {
    if (!dataset) return;
    const allExceptTarget = dataset.columns.map((c) => c.name).filter((c) => c !== targetColumn);
    setSelectedFeatures(allExceptTarget);
  };

  const handleClearFeatures = () => {
    setSelectedFeatures([]);
  };

  const handleTrain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dataset) return;

    if (!targetColumn) {
      setError("Please select a target column to predict.");
      return;
    }

    if (selectedFeatures.length === 0) {
      setError("Please select at least one feature column for training.");
      return;
    }

    setError(null);
    setIsTraining(true);
    setTrainingResult(null);

    try {
      const payload = {
        dataset_id: dataset.dataset_id,
        target_column: targetColumn,
        task_type: taskType,
        feature_columns: selectedFeatures,
        model_type: modelType,
        test_size: Number(testSize),
        max_depth: Number(maxDepth),
        n_estimators: modelType === "random_forest" ? Number(nEstimators) : undefined,
        random_state: Number(randomState),
      };

      const result = await trainModel(payload);
      setTrainingResult(result);

      // Save result in localStorage for subsequent pages
      localStorage.setItem("ml_last_training_result", JSON.stringify(result));

      // Append to experiment history in localStorage
      try {
        const historyJson = localStorage.getItem("ml_experiment_history");
        const history = historyJson ? JSON.parse(historyJson) : [];
        const primaryMetric =
          result.task_type === "classification"
            ? { name: "Accuracy", value: result.metrics.accuracy ?? 0 }
            : { name: "R²", value: result.metrics.r2 ?? 0 };

        const experimentItem = {
          id: `exp_${Date.now()}`,
          name: dataset.filename || dataset.name || dataset.dataset_id,
          time: new Date().toLocaleString(),
          model_id: result.model_id,
          task_type: result.task_type,
          model_type: result.model_type,
          config: {
            target: targetColumn,
            features: selectedFeatures,
            n_estimators: modelType === "random_forest" ? Number(nEstimators) : undefined,
            max_depth: Number(maxDepth),
            test_size: Number(testSize),
            random_state: Number(randomState),
          },
          score: primaryMetric,
          full_result: result,
        };

        const updatedHistory = [
          experimentItem,
          ...history.filter((h: any) => h.model_id !== result.model_id),
        ].slice(0, 50);
        localStorage.setItem("ml_experiment_history", JSON.stringify(updatedHistory));
      } catch (histErr) {
        console.error("Failed to update experiment history:", histErr);
      }
    } catch (err: any) {
      setError(err.message || "Failed to train model. Check backend logs.");
    } finally {
      setIsTraining(false);
    }
  };

  if (!dataset) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-indigo-400">
          <Database className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white">No Dataset Selected Yet</h2>
          <p className="text-slate-400 text-sm">
            Please choose or upload a dataset on the main page before configuring model training.
          </p>
        </div>
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-colors shadow-lg shadow-indigo-600/25"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go to Dataset Ingestion</span>
          </Link>
        </div>
      </div>
    );
  }

  const availableFeatureColumns = dataset.columns.filter((c) => c.name !== targetColumn);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400 uppercase tracking-wider">
            <Sliders className="w-4 h-4" />
            <span>Step 2: Model Configuration</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
            Train Machine Learning Model
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
            Dataset: <span className="text-slate-200 font-medium">{dataset.filename || dataset.name}</span> ({dataset.total_rows} rows)
          </p>
        </div>

        <Link
          href="/"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300 text-xs font-medium transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Change Dataset</span>
        </Link>
      </div>

      {/* Error Alert */}
      {error && (
        <ErrorBanner
          title="Training Model Gagal"
          message={error}
          onRetry={() => {
            setError(null);
            const fakeEvent = { preventDefault: () => {} } as any;
            handleTrain(fakeEvent);
          }}
          onDismiss={() => setError(null)}
        />
      )}

      {/* Training In-Progress Banner & Skeleton */}
      {isTraining && (
        <div className="p-6 rounded-2xl bg-indigo-950/30 border border-indigo-500/30 space-y-4 animate-in fade-in">
          <div className="flex items-center gap-3 text-indigo-300">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
            <div className="space-y-0.5">
              <div className="font-semibold text-sm text-indigo-200">
                Sedang Melatih Model ({modelType === "random_forest" ? "Random Forest" : "Decision Tree"})...
              </div>
              <p className="text-xs text-indigo-300/80 font-mono">
                Menghitung splitting pohon, metrics evaluasi, confusion matrix, dan feature importance.
              </p>
            </div>
          </div>
          <CardsSkeleton count={3} />
        </div>
      )}

      {/* Training Form */}
      <form onSubmit={handleTrain} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column (7 cols): Data Selection */}
        <div className="lg:col-span-7 space-y-6">
          {/* Target Column Selection */}
          <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/50 space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="targetColumn" className="text-sm font-bold text-slate-200">
                1. Target Column to Predict (y)
              </label>
              <span className="text-xs text-indigo-400 font-mono">1 column required</span>
            </div>
            <select
              id="targetColumn"
              value={targetColumn}
              onChange={(e) => handleTargetChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {dataset.columns.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.dtype}, {c.unique_count} unique)
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500">
              Choosing a target automatically detaches it from the input features below.
            </p>
          </div>

          {/* Feature Columns Selection */}
          <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <label className="text-sm font-bold text-slate-200">2. Feature Columns (X)</label>
                <div className="text-xs text-slate-400">
                  {selectedFeatures.length} of {availableFeatureColumns.length} features selected
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllFeatures}
                  className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={handleClearFeatures}
                  className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[300px] overflow-y-auto pr-1">
              {availableFeatureColumns.map((col) => {
                const checked = selectedFeatures.includes(col.name);
                return (
                  <label
                    key={col.name}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      checked
                        ? "border-indigo-500/50 bg-indigo-950/20 text-slate-100"
                        : "border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleFeature(col.name)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-900 border-slate-700"
                    />
                    <div className="flex-1 truncate font-mono text-xs">
                      <span className="font-semibold text-slate-200">{col.name}</span>
                      <span className="text-[10px] text-slate-500 ml-1.5 font-sans">({col.dtype})</span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Algorithm & Hyperparameters */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/50 space-y-5">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-400" />
              <span>3. Model & Task Settings</span>
            </h3>

            {/* Model Algorithm Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Algorithm
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setModelType("random_forest")}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    modelType === "random_forest"
                      ? "border-indigo-500 bg-indigo-950/30 text-white ring-1 ring-indigo-500/50"
                      : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <div className="font-bold text-xs">Random Forest</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Ensemble of trees</div>
                </button>

                <button
                  type="button"
                  onClick={() => setModelType("decision_tree")}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    modelType === "decision_tree"
                      ? "border-indigo-500 bg-indigo-950/30 text-white ring-1 ring-indigo-500/50"
                      : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <div className="font-bold text-xs">Decision Tree</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Single explainable tree</div>
                </button>
              </div>
            </div>

            {/* Task Type Override */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Task Type
                </label>
                <span className="text-[11px] text-indigo-400">Auto-detect recommended</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(["auto", "classification", "regression"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTaskType(t)}
                    className={`py-2 px-2 text-xs font-semibold rounded-lg border capitalize transition-all ${
                      taskType === t
                        ? "border-indigo-500 bg-indigo-600 text-white"
                        : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Sliders */}
            <div className="space-y-4 pt-2 border-t border-slate-800/80">
              {/* Test Size Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300 font-medium">Test Split Size</span>
                  <span className="font-mono text-indigo-400 font-bold">
                    {Math.round(testSize * 100)}% ({testSize.toFixed(2)})
                  </span>
                </div>
                <input
                  type="range"
                  min="0.10"
                  max="0.50"
                  step="0.05"
                  value={testSize}
                  onChange={(e) => setTestSize(parseFloat(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>

              {/* Max Depth Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300 font-medium">Max Depth (Tree Depth)</span>
                  <span className="font-mono text-indigo-400 font-bold">{maxDepth}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  step="1"
                  value={maxDepth}
                  onChange={(e) => setMaxDepth(parseInt(e.target.value, 10))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>

              {/* n_estimators Slider (Random Forest only) */}
              {modelType === "random_forest" && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300 font-medium">Number of Trees (n_estimators)</span>
                    <span className="font-mono text-indigo-400 font-bold">{nEstimators}</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="200"
                    step="10"
                    value={nEstimators}
                    onChange={(e) => setNEstimators(parseInt(e.target.value, 10))}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>
              )}
            </div>

            {/* Train Submit Button */}
            <button
              type="submit"
              disabled={isTraining || selectedFeatures.length === 0}
              className="w-full py-3.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99]"
            >
              {isTraining ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Fitting Model on Backend...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Start Model Training</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Training Results Section */}
      {trainingResult && (
        <div className="p-6 sm:p-8 rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-slate-900 to-slate-950 space-y-6 shadow-2xl animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white">Model Successfully Trained</h2>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 capitalize">
                    {trainingResult.task_type}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono mt-0.5">ID: {trainingResult.model_id}</p>
              </div>
            </div>

            <div className="text-xs text-slate-400 font-mono bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
              Saved at: {trainingResult.model_file}
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Evaluation Metrics (Test Split: {trainingResult.test_samples} samples)</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {Object.entries(trainingResult.metrics).map(([name, val]) => (
                <div key={name} className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 text-center">
                  <div className="text-xs font-semibold text-slate-400 uppercase">{name}</div>
                  <div className="text-2xl font-extrabold text-white font-mono mt-1">
                    {typeof val === "number" ? val.toFixed(4) : val}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Feature Importance Preview */}
          {trainingResult.feature_importance && trainingResult.feature_importance.length > 0 && (
            <div className="space-y-3 pt-3 border-t border-slate-800/80">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Feature Importances
              </h3>
              <div className="space-y-2">
                {trainingResult.feature_importance.slice(0, 5).map((item) => (
                  <div key={item.feature} className="space-y-1">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-slate-300 font-medium">{item.feature}</span>
                      <span className="text-indigo-400 font-bold">{(item.importance * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(item.importance * 100, 2)}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tree Structure Preview (Root Node) */}
          {trainingResult.tree && (
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 text-xs font-mono space-y-1">
              <div className="text-slate-400 flex items-center gap-1.5 font-sans font-semibold text-xs">
                <Network className="w-3.5 h-3.5 text-indigo-400" />
                <span>Recursive Tree Structure Root Split</span>
              </div>
              <div className="text-slate-300 mt-1">
                Root Feature:{" "}
                <span className="text-indigo-300 font-bold">{trainingResult.tree.feature || "Leaf"}</span>
                {trainingResult.tree.threshold !== null && (
                  <span> &le; {trainingResult.tree.threshold} (samples: {trainingResult.tree.samples})</span>
                )}
              </div>
              <div className="text-slate-500 text-[11px]">
                Full recursive tree structure JSON stored and ready for visualization.
              </div>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <Link
              href="/results"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02]"
            >
              <span>View Full Results, Heatmap & Interactive Tree</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
