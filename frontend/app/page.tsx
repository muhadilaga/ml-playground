"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  Database,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Loader2,
  Table as TableIcon,
  Info,
  Sparkles,
} from "lucide-react";
import { uploadCSV, getSampleDataset } from "@/lib/api";
import { DatasetResponse } from "@/types";
import ErrorBanner from "@/components/ErrorBanner";
import { TableSkeleton, CardsSkeleton } from "@/components/LoadingSkeleton";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB in bytes

const SAMPLE_DATASETS = [
  {
    id: "iris",
    title: "Fisher's Iris",
    task: "Classification (3 Classes)",
    badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    description: "150 flowers with 4 morphological measurements predicting flower species.",
    records: "150 rows × 5 cols",
  },
  {
    id: "housing",
    title: "California Housing",
    task: "Regression (Continuous)",
    badgeColor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    description: "District characteristics predicting median house values in California.",
    records: "1,000+ rows × 9 cols",
  },
  {
    id: "energy",
    title: "Building Energy Efficiency",
    task: "Regression (Heating Load)",
    badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    description: "Architectural dimensions and glazing areas predicting heating & cooling loads.",
    records: "768 rows × 9 cols",
  },
];

export default function HomePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dataset, setDataset] = useState<DatasetResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingSample, setLoadingSample] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [retryAction, setRetryAction] = useState<(() => void) | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Load existing active dataset from localStorage if available
  useEffect(() => {
    try {
      const stored = localStorage.getItem("ml_active_dataset");
      if (stored) {
        setDataset(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to read localStorage:", e);
    }
  }, []);

  const handleDatasetLoaded = (data: DatasetResponse, sourceName: string) => {
    setDataset(data);
    setError(null);
    setSuccessMsg(`Successfully loaded ${sourceName} (${data.total_rows} rows, ${data.total_columns} columns)`);
    try {
      localStorage.setItem("ml_active_dataset", JSON.stringify(data));
    } catch (e) {
      console.error("Failed to write to localStorage:", e);
    }
  };

  const handleFileUpload = async (file: File) => {
    setError(null);
    setSuccessMsg(null);
    setRetryAction(() => () => handleFileUpload(file));

    // Validation 1: File size <= 10MB
    if (file.size > MAX_FILE_SIZE) {
      setError(`File size exceeds 10 MB limit (${(file.size / (1024 * 1024)).toFixed(2)} MB). Please upload a smaller CSV.`);
      return;
    }

    // Validation 2: CSV extension
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Only CSV files (.csv) are supported.");
      return;
    }

    setLoading(true);
    try {
      const res = await uploadCSV(file);
      handleDatasetLoaded(res, `uploaded file '${file.name}'`);
    } catch (err: any) {
      setError(err.message || "Failed to upload and process CSV file.");
    } finally {
      setLoading(false);
    }
  };

  const handleSampleSelect = async (sampleId: string, sampleTitle: string) => {
    setError(null);
    setSuccessMsg(null);
    setRetryAction(() => () => handleSampleSelect(sampleId, sampleTitle));
    setLoadingSample(sampleId);
    try {
      const res = await getSampleDataset(sampleId);
      handleDatasetLoaded(res, `sample dataset '${sampleTitle}'`);
    } catch (err: any) {
      setError(err.message || `Failed to fetch sample dataset '${sampleTitle}'.`);
    } finally {
      setLoadingSample(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleConfigureNavigation = () => {
    if (dataset) {
      router.push("/configure");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Top Banner */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Step 1: Select or Upload Dataset
        </h1>
        <p className="text-slate-400 text-sm sm:text-base">
          Upload your own CSV dataset (up to 10 MB) or choose from ready-to-use benchmark datasets.
          The backend automatically computes metadata, column statistics, and a 10-row preview.
        </p>
      </div>

      {/* Error & Success Alerts */}
      {error && (
        <div className="max-w-4xl mx-auto">
          <ErrorBanner
            title="Gagal Memuat Dataset"
            message={error}
            onRetry={retryAction ? () => retryAction() : undefined}
            onDismiss={() => setError(null)}
          />
        </div>
      )}

      {successMsg && !error && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3 text-emerald-300 max-w-4xl mx-auto animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-400" />
          <div className="text-sm font-medium">{successMsg}</div>
        </div>
      )}

      {/* Grid: Upload Box + Sample Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-6xl mx-auto items-stretch">
        {/* Upload Box (7 cols) */}
        <div className="lg:col-span-7 flex flex-col">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex-1 min-h-[260px] border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 ${
              isDragging
                ? "border-indigo-400 bg-indigo-950/30 scale-[1.01]"
                : "border-slate-700 hover:border-slate-500 bg-slate-900/60 hover:bg-slate-900/90"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
            />

            {loading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
                <p className="text-sm text-slate-300 font-medium">Processing & uploading CSV...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                  <Upload className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-base font-semibold text-slate-200">
                    Drag and drop your CSV file here, or{" "}
                    <span className="text-indigo-400 underline underline-offset-4">browse</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Supports comma-delimited CSV up to 10 MB.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sample Datasets (5 cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-3">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 px-1">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Or Choose a Sample Dataset</span>
          </div>

          {SAMPLE_DATASETS.map((sample) => {
            const isLoadingThis = loadingSample === sample.id;
            const isSelected = dataset?.dataset_id === `sample_${sample.id}` || dataset?.name === sample.id;

            return (
              <button
                key={sample.id}
                type="button"
                onClick={() => handleSampleSelect(sample.id, sample.title)}
                disabled={loading || !!loadingSample}
                className={`w-full p-4 rounded-xl border text-left transition-all duration-150 flex items-start justify-between gap-3 ${
                  isSelected
                    ? "border-indigo-500 bg-indigo-950/25 ring-1 ring-indigo-500/50"
                    : "border-slate-800 bg-slate-900/60 hover:bg-slate-800/80 hover:border-slate-700"
                } disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-200 text-sm">{sample.title}</span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${sample.badgeColor}`}>
                      {sample.task}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2">{sample.description}</p>
                  <span className="inline-block text-[11px] text-slate-500 font-mono">{sample.records}</span>
                </div>

                <div className="mt-1 flex-shrink-0 text-slate-500">
                  {isLoadingThis ? (
                    <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                  ) : isSelected ? (
                    <CheckCircle2 className="w-5 h-5 text-indigo-400" />
                  ) : (
                    <Database className="w-5 h-5 text-slate-600 hover:text-slate-400" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading Skeletons State */}
      {(loading || loadingSample) && (
        <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in">
          <div className="flex items-center gap-2.5 text-sm text-indigo-400 font-mono bg-indigo-950/20 border border-indigo-500/20 p-4 rounded-xl">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Memproses dataset dan menghasilkan statistik preview...</span>
          </div>
          <CardsSkeleton count={4} />
          <TableSkeleton rows={8} cols={5} />
        </div>
      )}

      {/* Dataset Details & Preview Section */}
      {dataset && !loading && !loadingSample && (
        <div className="space-y-8 animate-in fade-in duration-300">
          {/* Action Header Banner */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-indigo-950/40 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-6 h-6 text-indigo-400" />
                <h2 className="text-xl font-bold text-white tracking-tight">
                  {dataset.filename || dataset.name || dataset.dataset_id}
                </h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                  ID: {dataset.dataset_id}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400">
                Loaded {dataset.total_rows.toLocaleString()} rows and {dataset.total_columns} columns.
                Ready for model configuration.
              </p>
            </div>

            <button
              type="button"
              onClick={handleConfigureNavigation}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Configure & Train Model</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Column Metadata Cards */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-indigo-400" />
              <h3 className="text-base font-bold text-slate-200">Column Schema & Missing Values</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {dataset.columns.map((col) => (
                <div
                  key={col.name}
                  className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900/80 transition-colors"
                >
                  <div className="font-semibold text-sm text-slate-200 truncate" title={col.name}>
                    {col.name}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className="font-mono text-indigo-400 bg-indigo-950/40 px-1.5 py-0.5 rounded text-[11px]">
                      {col.dtype}
                    </span>
                    <span className="text-slate-500 text-[11px]">{col.unique_count} unique</span>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Missing:</span>
                    <span
                      className={`font-medium ${
                        col.missing_count > 0 ? "text-amber-400 font-bold" : "text-slate-500"
                      }`}
                    >
                      {col.missing_count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 10-Row Preview Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TableIcon className="w-4 h-4 text-indigo-400" />
                <h3 className="text-base font-bold text-slate-200">First 10 Rows Preview</h3>
              </div>
              <span className="text-xs text-slate-500">Showing top 10 preview rows</span>
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40 shadow-inner">
              <div className="overflow-x-auto max-h-[420px]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-slate-300 font-semibold z-10">
                    <tr>
                      <th className="py-3 px-4 text-slate-500 w-12 font-mono">#</th>
                      {dataset.columns.map((col) => (
                        <th key={col.name} className="py-3 px-4 font-mono font-medium whitespace-nowrap">
                          {col.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                    {dataset.preview.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-4 text-slate-600">{idx + 1}</td>
                        {dataset.columns.map((col) => (
                          <td key={col.name} className="py-2.5 px-4 whitespace-nowrap">
                            {row[col.name] !== null && row[col.name] !== undefined ? (
                              String(row[col.name])
                            ) : (
                              <span className="text-rose-400/80 italic font-sans text-[11px]">null</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
