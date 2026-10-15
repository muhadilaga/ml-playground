"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import {
  BarChart3,
  Sliders,
  ArrowLeft,
  CheckCircle2,
  Table as TableIcon,
  Network,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  Info,
  ChevronRight,
  Target,
  Layers,
  Activity,
  FileCode2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { TrainResponse, TreeNode } from "@/types";

// Helper layout for interactive custom SVG tree
interface LayoutNode {
  id: string;
  x: number;
  y: number;
  raw: TreeNode;
  isLeft: boolean | null;
  parent: LayoutNode | null;
  depth: number;
  isLeaf: boolean;
}

export default function ResultsPage() {
  const [result, setResult] = useState<TrainResponse | null>(null);
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [selectedNodePath, setSelectedNodePath] = useState<string>("Root Node");
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [treeOffset, setTreeOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Read data from localStorage key ml_last_training_result
  useEffect(() => {
    try {
      const stored = localStorage.getItem("ml_last_training_result");
      if (stored) {
        const parsed: TrainResponse = JSON.parse(stored);
        setResult(parsed);
        if (parsed.tree) {
          setSelectedNode(parsed.tree);
          setSelectedNodePath("Root Decision Split");
        }
      }
    } catch (e) {
      console.error("Failed to load ml_last_training_result:", e);
    }
  }, []);

  // Compute Layout for Decision Tree
  const treeLayout = useMemo(() => {
    if (!result || !result.tree) return null;

    const root = result.tree;
    const nodeWidth = 140;
    const nodeHeight = 54;
    const levelHeight = 90;

    // 1. Calculate leaf counts to space subtrees proportionally
    const getLeafCount = (n: TreeNode): number => {
      if (!n.left && !n.right) return 1;
      return (n.left ? getLeafCount(n.left) : 0) + (n.right ? getLeafCount(n.right) : 0);
    };

    let nextLeafIndex = 0;
    const leafSpacing = 160;
    const nodes: LayoutNode[] = [];
    const links: { source: LayoutNode; target: LayoutNode; label: string }[] = [];

    const assignCoordinates = (
      n: TreeNode,
      depth: number,
      isLeft: boolean | null,
      parent: LayoutNode | null,
      pathStr: string
    ): LayoutNode => {
      const isLeaf = !n.left && !n.right;
      let x = 0;

      const currentLayoutNode: LayoutNode = {
        id: `node-${depth}-${Math.random().toString(36).substring(2, 8)}`,
        x: 0,
        y: depth * levelHeight + 40,
        raw: n,
        isLeft,
        parent,
        depth,
        isLeaf,
      };

      if (isLeaf) {
        x = nextLeafIndex * leafSpacing + 80;
        nextLeafIndex += 1;
      } else {
        const leftChild = n.left
          ? assignCoordinates(n.left, depth + 1, true, currentLayoutNode, `${pathStr} → Left`)
          : null;
        const rightChild = n.right
          ? assignCoordinates(n.right, depth + 1, false, currentLayoutNode, `${pathStr} → Right`)
          : null;

        if (leftChild && rightChild) {
          x = (leftChild.x + rightChild.x) / 2;
        } else if (leftChild) {
          x = leftChild.x;
        } else if (rightChild) {
          x = rightChild.x;
        } else {
          x = nextLeafIndex * leafSpacing + 80;
          nextLeafIndex += 1;
        }

        if (leftChild) {
          links.push({
            source: currentLayoutNode,
            target: leftChild,
            label: `≤ ${n.threshold}`,
          });
        }
        if (rightChild) {
          links.push({
            source: currentLayoutNode,
            target: rightChild,
            label: `> ${n.threshold}`,
          });
        }
      }

      currentLayoutNode.x = x;
      nodes.push(currentLayoutNode);
      return currentLayoutNode;
    };

    assignCoordinates(root, 0, null, null, "Root");

    const minX = Math.min(...nodes.map((n) => n.x)) - 80;
    const maxX = Math.max(...nodes.map((n) => n.x)) + 80;
    const maxY = Math.max(...nodes.map((n) => n.y)) + 80;
    const totalWidth = Math.max(maxX - minX, 600);
    const totalHeight = maxY + 40;

    return { nodes, links, totalWidth, totalHeight, minX };
  }, [result]);

  // Confusion Matrix Max Value for Heatmap Color Intensity
  const cmMaxVal = useMemo(() => {
    if (!result?.confusion_matrix?.matrix) return 1;
    let max = 1;
    result.confusion_matrix.matrix.forEach((row) => {
      row.forEach((v) => {
        if (v > max) max = v;
      });
    });
    return max;
  }, [result]);

  // Mouse pan handlers for tree SVG
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsPanning(true);
    setPanStart({ x: e.clientX - treeOffset.x, y: e.clientY - treeOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setTreeOffset({
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const resetTreeTransform = () => {
    setZoomLevel(1);
    setTreeOffset({ x: 0, y: 0 });
  };

  if (!result) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-indigo-400">
          <BarChart3 className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white">No Training Results Found</h2>
          <p className="text-slate-400 text-sm">
            You haven't trained a model yet or no results were saved in localStorage (`ml_last_training_result`).
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/configure"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/25"
          >
            <Sliders className="w-4 h-4" />
            <span>Go to Model Training</span>
          </Link>
        </div>
      </div>
    );
  }

  const isClassification = result.task_type === "classification";
  const metrics = result.metrics || {};

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400 uppercase tracking-wider">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Model Evaluation & Results</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight mt-1">
            Training Performance Dashboard
          </h1>
          <div className="flex flex-wrap items-center gap-2.5 mt-2 text-xs text-slate-400">
            <span className="font-mono bg-slate-900 px-2.5 py-1 rounded-md border border-slate-800 text-slate-300">
              Model: {result.model_id}
            </span>
            <span className="px-2.5 py-1 rounded-md bg-indigo-950/60 text-indigo-300 border border-indigo-500/30 uppercase font-semibold text-[10px]">
              {result.model_type.replace("_", " ")}
            </span>
            <span
              className={`px-2.5 py-1 rounded-md font-semibold text-[10px] uppercase border ${
                isClassification
                  ? "bg-emerald-950/40 text-emerald-300 border-emerald-500/30"
                  : "bg-blue-950/40 text-blue-300 border-blue-500/30"
              }`}
            >
              {result.task_type}
            </span>
            <span className="text-slate-500">Target:</span>
            <span className="font-mono text-slate-200 font-semibold">{result.target_column}</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/configure"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-colors shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Retrain Model</span>
          </Link>
          <Link
            href="/predict"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors shadow-lg shadow-indigo-600/30"
          >
            <span>Run Predictions</span>
            <Target className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* 1. Metric Cards */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-400" />
          <h2 className="text-lg font-bold text-slate-100">
            Evaluation Metrics ({result.test_samples} test samples)
          </h2>
        </div>

        {isClassification ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Accuracy */}
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 relative overflow-hidden">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Accuracy</div>
              <div className="text-3xl font-extrabold text-white font-mono mt-2">
                {metrics.accuracy !== undefined ? `${(metrics.accuracy * 100).toFixed(1)}%` : "N/A"}
              </div>
              <p className="text-xs text-slate-500 mt-1">Raw: {metrics.accuracy?.toFixed(4)}</p>
              <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-bold text-xs">
                Acc
              </div>
            </div>

            {/* F1 Score */}
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 relative overflow-hidden">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">F1 Score (Weighted)</div>
              <div className="text-3xl font-extrabold text-white font-mono mt-2">
                {metrics.f1 !== undefined ? `${(metrics.f1 * 100).toFixed(1)}%` : "N/A"}
              </div>
              <p className="text-xs text-slate-500 mt-1">Raw: {metrics.f1?.toFixed(4)}</p>
              <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-bold text-xs">
                F1
              </div>
            </div>

            {/* Precision */}
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 relative overflow-hidden">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Precision</div>
              <div className="text-3xl font-extrabold text-white font-mono mt-2">
                {metrics.precision !== undefined ? `${(metrics.precision * 100).toFixed(1)}%` : "N/A"}
              </div>
              <p className="text-xs text-slate-500 mt-1">Raw: {metrics.precision?.toFixed(4)}</p>
              <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 font-bold text-xs">
                Pr
              </div>
            </div>

            {/* Recall */}
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 relative overflow-hidden">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Recall</div>
              <div className="text-3xl font-extrabold text-white font-mono mt-2">
                {metrics.recall !== undefined ? `${(metrics.recall * 100).toFixed(1)}%` : "N/A"}
              </div>
              <p className="text-xs text-slate-500 mt-1">Raw: {metrics.recall?.toFixed(4)}</p>
              <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-400 font-bold text-xs">
                Re
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* RMSE */}
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">RMSE (Root Mean Squared Error)</div>
              <div className="text-3xl font-extrabold text-white font-mono mt-2">
                {metrics.rmse !== undefined ? metrics.rmse.toFixed(4) : "N/A"}
              </div>
              <p className="text-xs text-slate-500 mt-1">Standard deviation of the residuals</p>
            </div>

            {/* MAE */}
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">MAE (Mean Absolute Error)</div>
              <div className="text-3xl font-extrabold text-white font-mono mt-2">
                {metrics.mae !== undefined ? metrics.mae.toFixed(4) : "N/A"}
              </div>
              <p className="text-xs text-slate-500 mt-1">Average magnitude of prediction errors</p>
            </div>

            {/* R2 */}
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">R² Score (Variance Explained)</div>
              <div className="text-3xl font-extrabold text-white font-mono mt-2">
                {metrics.r2 !== undefined ? metrics.r2.toFixed(4) : "N/A"}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {metrics.r2 !== undefined ? `${(metrics.r2 * 100).toFixed(1)}% of total variance explained` : ""}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Grid: Confusion Matrix + Feature Importance */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* 2. Confusion Matrix (5 cols for classification) */}
        {isClassification && result.confusion_matrix && (
          <div className="lg:col-span-5 p-6 rounded-2xl border border-slate-800 bg-slate-900/50 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TableIcon className="w-4 h-4 text-indigo-400" />
                <h3 className="text-base font-bold text-slate-100">Confusion Matrix Heatmap</h3>
              </div>
              <span className="text-[11px] text-slate-500">True vs Predicted</span>
            </div>

            <div className="overflow-x-auto pb-2">
              <div className="inline-block min-w-full">
                {/* Column Headers (Predicted) */}
                <div className="text-center text-[11px] font-semibold text-slate-400 mb-1">
                  Predicted Class &rarr;
                </div>
                <table className="w-full border-collapse text-xs font-mono">
                  <thead>
                    <tr>
                      <th className="p-2 text-slate-500 font-normal text-left text-[11px]">
                        Actual &darr;
                      </th>
                      {result.confusion_matrix.labels.map((lbl) => (
                        <th key={lbl} className="p-2 text-center text-slate-300 font-semibold truncate max-w-[80px]" title={lbl}>
                          {lbl}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.confusion_matrix.matrix.map((row, rIdx) => {
                      const actualLabel = result.confusion_matrix!.labels[rIdx];
                      return (
                        <tr key={actualLabel}>
                          <td className="p-2 font-semibold text-slate-300 truncate max-w-[90px]" title={actualLabel}>
                            {actualLabel}
                          </td>
                          {row.map((val, cIdx) => {
                            const isDiagonal = rIdx === cIdx;
                            const intensity = cmMaxVal > 0 ? val / cmMaxVal : 0;
                            // Heatmap background calculation
                            const bgColor = isDiagonal
                              ? `rgba(16, 185, 129, ${Math.max(0.12, intensity * 0.85)})`
                              : val > 0
                              ? `rgba(244, 63, 94, ${Math.max(0.15, intensity * 0.7)})`
                              : "rgba(30, 41, 59, 0.4)";

                            return (
                              <td
                                key={`${rIdx}-${cIdx}`}
                                className="p-3 text-center border border-slate-800/80 transition-all hover:ring-2 hover:ring-indigo-400 cursor-default"
                                style={{ backgroundColor: bgColor }}
                                title={`Actual: ${actualLabel}, Predicted: ${result.confusion_matrix!.labels[cIdx]} (Count: ${val})`}
                              >
                                <span className={`font-bold ${isDiagonal ? "text-white" : val > 0 ? "text-rose-200" : "text-slate-600"}`}>
                                  {val}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-800/80 pt-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-emerald-500/80 inline-block"></span>
                <span>Correct Predictions</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-rose-500/80 inline-block"></span>
                <span>Misclassifications</span>
              </div>
            </div>
          </div>
        )}

        {/* 3. Feature Importance Horizontal Bar Chart (7 cols or 12 cols if regression) */}
        <div className={`${isClassification && result.confusion_matrix ? "lg:col-span-7" : "lg:col-span-12"} p-6 rounded-2xl border border-slate-800 bg-slate-900/50 space-y-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-400" />
              <h3 className="text-base font-bold text-slate-100">Feature Importance Ranking</h3>
            </div>
            <span className="text-[11px] text-slate-500">Gini / Variance Reduction</span>
          </div>

          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={result.feature_importance}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <XAxis
                  type="number"
                  domain={[0, "auto"]}
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                />
                <YAxis
                  dataKey="feature"
                  type="category"
                  width={110}
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-lg shadow-xl text-xs font-mono">
                          <p className="font-semibold text-slate-200">{data.feature}</p>
                          <p className="text-indigo-400 mt-0.5">
                            Importance: {(data.importance * 100).toFixed(2)}% ({data.importance.toFixed(4)})
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="importance" radius={[0, 6, 6, 0]}>
                  {result.feature_importance.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={index === 0 ? "#818cf8" : index === 1 ? "#6366f1" : "#4f46e5"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 4. Interactive Decision Tree Visualization */}
      <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/50 space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Network className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-lg font-bold text-white">Interactive Decision Tree Diagram</h2>
              <p className="text-xs text-slate-400">
                Click any tree node to inspect its decision split, threshold, sample count, and class distribution.
              </p>
            </div>
          </div>

          {/* Zoom & Pan Controls */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setZoomLevel((prev) => Math.min(prev + 0.15, 2.0))}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <span className="text-[11px] font-mono px-2 text-slate-400 select-none">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoomLevel((prev) => Math.max(prev - 0.15, 0.5))}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={resetTreeTransform}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors border-l border-slate-800 ml-1"
              title="Reset View"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tree Canvas and Inspector Split Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* SVG Tree Viewport (8 cols) */}
          <div
            className="lg:col-span-8 border border-slate-800 rounded-2xl bg-slate-950 overflow-hidden relative min-h-[460px] cursor-grab active:cursor-grabbing select-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {treeLayout ? (
              <svg
                width="100%"
                height="460"
                className="w-full h-full"
                viewBox={`0 0 ${treeLayout.totalWidth} ${treeLayout.totalHeight}`}
              >
                <g
                  transform={`translate(${treeOffset.x}, ${treeOffset.y}) scale(${zoomLevel})`}
                  style={{ transformOrigin: "center center", transition: isPanning ? "none" : "transform 0.15s ease-out" }}
                >
                  {/* Tree Edges / Links */}
                  {treeLayout.links.map((link, idx) => {
                    const midY = (link.source.y + link.target.y) / 2;
                    return (
                      <g key={`link-${idx}`}>
                        <path
                          d={`M ${link.source.x} ${link.source.y} C ${link.source.x} ${midY}, ${link.target.x} ${midY}, ${link.target.x} ${link.target.y}`}
                          fill="none"
                          stroke="#334155"
                          strokeWidth="2"
                        />
                        <text
                          x={(link.source.x + link.target.x) / 2}
                          y={midY - 4}
                          fill="#94a3b8"
                          fontSize="10"
                          textAnchor="middle"
                          fontFamily="monospace"
                        >
                          {link.label}
                        </text>
                      </g>
                    );
                  })}

                  {/* Tree Nodes */}
                  {treeLayout.nodes.map((node) => {
                    const isSelected = selectedNode === node.raw;
                    const isLeaf = node.isLeaf;

                    return (
                      <g
                        key={node.id}
                        transform={`translate(${node.x}, ${node.y})`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedNode(node.raw);
                          setSelectedNodePath(
                            isLeaf ? `Leaf Node (Depth ${node.depth})` : `Split Node: ${node.raw.feature} (Depth ${node.depth})`
                          );
                        }}
                        className="cursor-pointer group"
                      >
                        {/* Node Card Box */}
                        <rect
                          x="-65"
                          y="-24"
                          width="130"
                          height="48"
                          rx="8"
                          fill={
                            isSelected
                              ? "#1e1b4b"
                              : isLeaf
                              ? "#064e3b"
                              : "#0f172a"
                          }
                          stroke={
                            isSelected
                              ? "#818cf8"
                              : isLeaf
                              ? "#10b981"
                              : "#3b82f6"
                          }
                          strokeWidth={isSelected ? "2.5" : "1.5"}
                          className="transition-all"
                        />

                        {/* Node Title (Feature or Leaf) */}
                        <text
                          x="0"
                          y="-6"
                          textAnchor="middle"
                          fill={isLeaf ? "#34d399" : "#e2e8f0"}
                          fontSize="11"
                          fontWeight="bold"
                          fontFamily="monospace"
                        >
                          {isLeaf ? "Leaf" : node.raw.feature}
                        </text>

                        {/* Node Subtitle (Threshold or Sample Count) */}
                        <text
                          x="0"
                          y="12"
                          textAnchor="middle"
                          fill="#94a3b8"
                          fontSize="9.5"
                          fontFamily="monospace"
                        >
                          {isLeaf
                            ? `n = ${node.raw.samples}`
                            : `≤ ${node.raw.threshold} (n=${node.raw.samples})`}
                        </text>
                      </g>
                    );
                  })}
                </g>
              </svg>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                No tree layout available.
              </div>
            )}
          </div>

          {/* Node Inspector Card (4 cols) */}
          <div className="lg:col-span-4 p-5 rounded-2xl border border-slate-800 bg-slate-900/80 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Node Inspector
                  </span>
                </div>
                <span className="text-[11px] font-mono text-indigo-400 bg-indigo-950 px-2 py-0.5 rounded">
                  {selectedNode?.feature ? "Split Node" : "Leaf Node"}
                </span>
              </div>

              {selectedNode ? (
                <div className="space-y-3.5 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Location</span>
                    <span className="font-semibold text-slate-200 text-sm">{selectedNodePath}</span>
                  </div>

                  {selectedNode.feature ? (
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                      <span className="text-[11px] text-indigo-400 font-semibold block uppercase">
                        Decision Split Condition
                      </span>
                      <div className="font-mono text-sm font-bold text-white">
                        {selectedNode.feature} &le; {selectedNode.threshold}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Samples lower than or equal to {selectedNode.threshold} follow the left subtree; others follow the right.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 space-y-1">
                      <span className="text-[11px] text-emerald-400 font-semibold block uppercase">
                        Terminal Leaf Prediction
                      </span>
                      <p className="text-[11px] text-slate-300">
                        This is a terminal node where classification or regression predictions are assigned.
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-slate-500 text-[10px] uppercase font-bold block">Samples</span>
                      <span className="text-lg font-extrabold text-white font-mono">
                        {selectedNode.samples}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-slate-500 text-[10px] uppercase font-bold block">Values / Classes</span>
                      <span className="text-xs font-bold text-slate-200 font-mono mt-1 block truncate">
                        {JSON.stringify(selectedNode.value)}
                      </span>
                    </div>
                  </div>

                  {/* Distribution Value Breakdown */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-slate-500 text-[11px]">Node Value Details:</span>
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 break-all">
                      {isClassification && result.confusion_matrix?.labels ? (
                        <div className="space-y-1">
                          {selectedNode.value.map((v, i) => (
                            <div key={i} className="flex justify-between">
                              <span className="text-slate-400">{result.confusion_matrix!.labels[i] || `Class ${i}`}:</span>
                              <span className="text-indigo-300 font-bold">{v}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span>Predicted Value: {JSON.stringify(selectedNode.value)}</span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500 text-xs">
                  Click on any node in the tree diagram to inspect its exact split rule and sample parameters.
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-800/80 text-[11px] text-slate-500">
              Tip: Drag the diagram to pan, or use the zoom buttons to explore deeper branches.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
