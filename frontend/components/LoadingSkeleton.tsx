"use client";

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40 p-4 space-y-3 animate-pulse">
      <div className="flex gap-4 border-b border-slate-800/80 pb-3">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={`head-${i}`} className="h-4 bg-slate-800 rounded-md flex-1"></div>
        ))}
      </div>
      <div className="space-y-2.5">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={`row-${r}`} className="flex gap-4 py-1.5">
            {Array.from({ length: cols }).map((_, c) => (
              <div
                key={`cell-${r}-${c}`}
                className="h-3.5 bg-slate-800/60 rounded flex-1"
                style={{ width: `${60 + ((r * 13 + c * 17) % 35)}%` }}
              ></div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 space-y-2.5">
          <div className="h-4 w-1/3 bg-slate-800 rounded"></div>
          <div className="h-8 w-2/3 bg-slate-800 rounded"></div>
          <div className="h-3 w-1/2 bg-slate-800/60 rounded"></div>
        </div>
      ))}
    </div>
  );
}

export function TreeSkeleton() {
  return (
    <div className="w-full h-72 border border-slate-800 rounded-2xl bg-slate-950 flex flex-col items-center justify-center p-8 space-y-4 animate-pulse">
      <div className="w-32 h-12 bg-slate-800 rounded-xl"></div>
      <div className="w-48 h-0.5 bg-slate-800"></div>
      <div className="flex gap-16">
        <div className="w-28 h-10 bg-slate-800/80 rounded-xl"></div>
        <div className="w-28 h-10 bg-slate-800/80 rounded-xl"></div>
      </div>
      <div className="text-xs text-slate-500 font-mono mt-4">Generating hierarchical tree graph...</div>
    </div>
  );
}
