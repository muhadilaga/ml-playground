"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Target,
  Play,
  Sliders,
  History,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  ArrowRight,
  Database,
  BarChart3,
  RotateCcw,
  Clock,
  Layers,
  ChevronRight,
} from "lucide-react";
import { predictModel } from "@/lib/api";
import { TrainResponse, ExperimentItem, PredictResponse } from "@/types";
import ErrorBanner from "@/components/ErrorBanner";

export default function PredictPage() {
  const router = useRouter();

  // Active Model State
  const [modelResult, setModelResult] = useState<TrainResponse | null>(null);
  const [inputs, setInputs] = useState<Record<string, number>>({});
  const [isPredicting, setIsPredicting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [predictionResult, setPredictionResult] = useState<PredictResponse | null>(null);

  // Experiment History State
  const [history, setHistory] = useState<ExperimentItem[]>([]);

  // Load Active Model & Experiment History from localStorage
  useEffect(() => {
    loadActiveModel();
    loadHistory();
  }, []);

  const loadActiveModel = () => {
    try {
      const stored = localStorage.getItem("ml_last_training_result");
      if (stored) {
        const parsed: TrainResponse = JSON.parse(stored);
        setModelResult(parsed);

        // Initialize feature inputs
        const initialInputs: Record<string, number> = {};
        parsed.feature_columns.forEach((feat) => {
          initialInputs[feat] = 0;
        });
        setInputs(initialInputs);
      } else {
        setModelResult(null);
      }
    } catch (e) {
      console.error("Failed to load active model:", e);
    }
  };

  const loadHistory = () => {
    try {
      const stored = localStorage.getItem("ml_experiment_history");
      if (stored) {
        setHistory(JSON.parse(stored));
      } else {
        setHistory([]);
      }
    } catch (e) {
      console.error("Failed to load history:", e);
    }
  };

  const handleInputChange = (featureName: string, val: string) => {
    const num = parseFloat(val);
    setInputs((prev) => ({
      ...prev,
      [featureName]: isNaN(num) ? 0 : num,
    }));
  };

  const handlePredict = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modelResult) return;

    setError(null);
    setIsPredicting(true);

    try {
      const response = await predictModel({
        model_id: modelResult.model_id,
        inputs: inputs,
      });
      setPredictionResult(response);
    } catch (err: any) {
      setError(err.message || "Prediction failed. Check backend logs.");
    } finally {
      setIsPredicting(false);
    }
  };

  // Switch active model to an entry from history and reload results to /results
  const handleSelectHistoryItem = (item: ExperimentItem, navigateToResults: boolean = false) => {
    try {
      localStorage.setItem("ml_last_training_result", JSON.stringify(item.full_result));
      setModelResult(item.full_result);

      // Reinitialize inputs for newly selected model
      const newInputs: Record<string, number> = {};
      item.full_result.feature_columns.forEach((feat) => {
        newInputs[feat] = 0;
      });
      setInputs(newInputs);
      setPredictionResult(null);

      if (navigateToResults) {
        router.push("/results");
      }
    } catch (e) {
      console.error("Failed to activate history model:", e);
    }
  };

  const handleResetInputs = () => {
    if (!modelResult) return;
    const reset: Record<string, number> = {};
    modelResult.feature_columns.forEach((feat) => {
      reset[feat] = 0;
    });
    setInputs(reset);
    setPredictionResult(null);
  };

  // Case 2: Handle case when no model is trained yet
  if (!modelResult) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-indigo-400 shadow-xl">
          <Target className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white tracking-tight">No Trained Model Found</h2>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            You need to train a model first before running predictions. Please configure and train a model from your dataset.
          </p>
        </div>
        <div>
          <Link
            href="/configure"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/25 hover:scale-[1.02]"
          >
            <Sliders className="w-4 h-4" />
            <span>Go to Model Training</span>
          </Link>
        </div>
      </div>
    );
  }

  const isClassification = modelResult.task_type === "classification";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400 uppercase tracking-wider">
            <Target className="w-4 h-4" />
            <span>Step 4: Inference & Experiments</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
            Real-time Model Prediction
          </h1>
          <div className="flex flex-wrap items-center gap-2.5 mt-2 text-xs text-slate-400">
            <span className="font-mono bg-slate-900 px-2.5 py-1 rounded-md border border-slate-800 text-slate-300">
              Active: {modelResult.model_id}
            </span>
            <span className="px-2.5 py-1 rounded-md bg-indigo-950/60 text-indigo-300 border border-indigo-500/30 uppercase font-semibold text-[10px]">
              {modelResult.model_type.replace("_", " ")}
            </span>
            <span
              className={`px-2.5 py-1 rounded-md font-semibold text-[10px] uppercase border ${
                isClassification
                  ? "bg-emerald-950/40 text-emerald-300 border-emerald-500/30"
                  : "bg-blue-950/40 text-blue-300 border-blue-500/30"
              }`}
            >
              {modelResult.task_type}
            </span>
            <span className="text-slate-500">Target:</span>
            <span className="font-mono text-slate-200 font-semibold">{modelResult.target_column}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/results"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-colors"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>View Full Results</span>
          </Link>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <ErrorBanner
          title="Gagal Menjalankan Prediksi"
          message={error}
          onRetry={() => {
            setError(null);
            const fakeEvent = { preventDefault: () => {} } as any;
            handlePredict(fakeEvent);
          }}
          onDismiss={() => setError(null)}
        />
      )}

      {/* Main Grid: Form + Result (8 cols) vs History Sidebar (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (8 cols): Prediction Form & Prominent Result */}
        <div className="lg:col-span-8 space-y-6">
          {/* Automatic Input Form */}
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/50 space-y-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-indigo-400" />
                  <span>Feature Inputs</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Input values for the {modelResult.feature_columns.length} features used by this model.
                </p>
              </div>

              <button
                type="button"
                onClick={handleResetInputs}
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Values</span>
              </button>
            </div>

            <form onSubmit={handlePredict} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {modelResult.feature_columns.map((feature) => (
                  <div key={feature} className="space-y-1.5">
                    <label
                      htmlFor={`input-${feature}`}
                      className="text-xs font-semibold text-slate-300 font-mono truncate block"
                      title={feature}
                    >
                      {feature}
                    </label>
                    <input
                      id={`input-${feature}`}
                      type="number"
                      step="any"
                      value={inputs[feature] ?? 0}
                      onChange={(e) => handleInputChange(feature, e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                      placeholder="0.0"
                    />
                  </div>
                ))}
              </div>

              <button
                type="submit"
                disabled={isPredicting}
                className="w-full py-3.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99]"
              >
                {isPredicting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Computing Prediction...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Prediksi</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Prediction Loading State */}
          {isPredicting && (
            <div className="p-8 rounded-2xl border border-indigo-500/20 bg-slate-900/60 space-y-4 text-center animate-pulse">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mx-auto text-indigo-400">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
              <div className="space-y-1">
                <div className="text-base font-semibold text-white">Menghitung Prediksi...</div>
                <p className="text-xs text-slate-400 font-mono">
                  Mengirim fitur ke model {modelResult.model_id} di backend FastAPI...
                </p>
              </div>
            </div>
          )}

          {/* Prominent Prediction Result Display */}
          {predictionResult && !isPredicting && (
            <div className="p-6 sm:p-8 rounded-2xl border border-indigo-500/30 bg-gradient-to-b from-slate-900 via-slate-900 to-indigo-950/40 space-y-6 shadow-2xl animate-in fade-in duration-300">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Prediction Result</h3>
                    <p className="text-xs text-slate-400">
                      Target: <span className="text-slate-200 font-mono">{modelResult.target_column}</span>
                    </p>
                  </div>
                </div>

                <span className="text-[11px] font-mono bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800 text-slate-400">
                  Model: {predictionResult.model_id}
                </span>
              </div>

              {/* Big Prediction Display */}
              <div className="text-center py-4 space-y-1">
                <div className="text-xs uppercase font-semibold text-slate-400 tracking-wider">
                  Predicted Value
                </div>
                <div className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-white to-emerald-300 font-mono tracking-tight py-1">
                  {predictionResult.prediction}
                </div>
                <p className="text-xs text-slate-400 font-sans mt-1">
                  {isClassification ? "Predicted Target Class" : "Estimated Target Value"}
                </p>
              </div>

              {/* Class Probabilities Bar (for Classification) */}
              {isClassification && predictionResult.probabilities && (
                <div className="space-y-3 pt-4 border-t border-slate-800/80">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                    <span>Class Probability Distribution</span>
                    <span className="text-indigo-400 font-mono">Softmax / Tree ratio</span>
                  </div>

                  <div className="space-y-3">
                    {Object.entries(predictionResult.probabilities).map(([cls, prob]) => {
                      const isPredictedClass = String(cls) === String(predictionResult.prediction);
                      const percent = (prob * 100).toFixed(1);

                      return (
                        <div key={cls} className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-mono">
                            <span
                              className={`font-semibold ${
                                isPredictedClass ? "text-emerald-400 flex items-center gap-1.5" : "text-slate-300"
                              }`}
                            >
                              {isPredictedClass && <CheckCircle2 className="w-3.5 h-3.5" />}
                              {cls}
                            </span>
                            <span className={isPredictedClass ? "text-emerald-400 font-bold" : "text-slate-400"}>
                              {percent}% ({prob.toFixed(4)})
                            </span>
                          </div>
                          <div className="w-full h-3 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isPredictedClass
                                  ? "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-sm shadow-emerald-500/50"
                                  : "bg-indigo-600/70"
                              }`}
                              style={{ width: `${Math.max(prob * 100, 2)}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column (4 cols): Experiment History Sidebar */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/50 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-400" />
                <h2 className="text-sm font-bold text-slate-200">Experiment History</h2>
              </div>
              <span className="text-xs text-slate-500 font-mono">{history.length} saved</span>
            </div>

            {history.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500 space-y-2">
                <Clock className="w-8 h-8 text-slate-700 mx-auto" />
                <p>No experiment runs recorded yet.</p>
                <p className="text-[11px] text-slate-600">
                  Every successful training in <span className="text-indigo-400">/configure</span> will automatically appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
                {history.map((exp) => {
                  const isActive = exp.model_id === modelResult.model_id;

                  return (
                    <div
                      key={exp.id || exp.model_id}
                      className={`p-3.5 rounded-xl border text-xs transition-all relative ${
                        isActive
                          ? "border-indigo-500/60 bg-indigo-950/25 ring-1 ring-indigo-500/40"
                          : "border-slate-800/90 bg-slate-950/70 hover:border-slate-700 hover:bg-slate-900/50"
                      }`}
                    >
                      {/* Active Indicator Badge */}
                      {isActive && (
                        <span className="absolute top-2.5 right-2.5 text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-600 text-white font-bold">
                          Active
                        </span>
                      )}

                      <div className="space-y-2">
                        <div>
                          <div className="font-bold text-slate-200 text-sm truncate max-w-[190px]">
                            {exp.name}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">{exp.time}</div>
                        </div>

                        {/* Model & Score Badges */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 capitalize">
                            {exp.model_type.replace("_", " ")}
                          </span>
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded border capitalize ${
                              exp.task_type === "classification"
                                ? "bg-emerald-950/40 text-emerald-400 border-emerald-500/30"
                                : "bg-blue-950/40 text-blue-400 border-blue-500/30"
                            }`}
                          >
                            {exp.task_type}
                          </span>
                        </div>

                        {/* Score Metric */}
                        {exp.score && (
                          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/60">
                            <span className="text-slate-400">{exp.score.name}:</span>
                            <span className="font-mono font-bold text-white">
                              {typeof exp.score.value === "number"
                                ? exp.task_type === "classification"
                                  ? `${(exp.score.value * 100).toFixed(1)}%`
                                  : exp.score.value.toFixed(4)
                                : exp.score.value}
                            </span>
                          </div>
                        )}

                        {/* Config Summary */}
                        <div className="text-[11px] text-slate-500">
                          Target: <span className="text-slate-400 font-mono">{exp.config.target}</span> • {exp.config.features.length} features
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                          <button
                            type="button"
                            onClick={() => handleSelectHistoryItem(exp, false)}
                            className="flex-1 py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-[11px] transition-colors text-center"
                          >
                            {isActive ? "Active in Form" : "Load into Form"}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSelectHistoryItem(exp, true)}
                            className="py-1.5 px-2.5 rounded-lg border border-slate-700 hover:border-slate-500 text-indigo-400 hover:text-indigo-300 font-semibold text-[11px] transition-colors flex items-center gap-1"
                            title="Load & View in Results page"
                          >
                            <span>Results</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
