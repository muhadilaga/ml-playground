"use client";

import { AlertCircle, RefreshCw, X } from "lucide-react";

interface ErrorBannerProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export default function ErrorBanner({
  title = "Terjadi Kesalahan",
  message,
  onRetry,
  onDismiss,
  className = "",
}: ErrorBannerProps) {
  return (
    <div
      className={`p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 shadow-lg shadow-rose-950/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-200 ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 flex-shrink-0 mt-0.5">
          <AlertCircle className="w-4 h-4" />
        </div>
        <div className="space-y-0.5">
          <div className="font-bold text-sm text-rose-300">{title}</div>
          <p className="text-xs text-rose-200/90 leading-relaxed font-sans">{message}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Coba Lagi</span>
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="p-1.5 rounded-lg hover:bg-rose-500/20 text-rose-400 hover:text-rose-200 transition-colors"
            title="Tutup Pesan"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
