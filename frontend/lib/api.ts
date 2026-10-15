import { DatasetResponse, PredictRequest, PredictResponse, TrainRequest, TrainResponse } from "@/types";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

function formatNetworkError(err: any): Error {
  if (
    err instanceof TypeError &&
    (err.message.includes("fetch") ||
      err.message.includes("NetworkError") ||
      err.message.includes("Failed to fetch"))
  ) {
    return new Error(
      `Tidak dapat terhubung ke backend di ${API_BASE_URL}. Pastikan server FastAPI sudah berjalan (uvicorn main:app --reload).`
    );
  }
  return err instanceof Error ? err : new Error(String(err));
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/`, { method: "GET", cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function uploadCSV(file: File): Promise<DatasetResponse> {
  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch(`${API_BASE_URL}/api/datasets/upload`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Upload gagal dengan status HTTP ${response.status}`);
    }

    return await response.json();
  } catch (err: any) {
    throw formatNetworkError(err);
  }
}

export async function getSampleDataset(name: string): Promise<DatasetResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/datasets/sample/${name}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Gagal memuat dataset sampel '${name}' (status ${response.status})`);
    }

    return await response.json();
  } catch (err: any) {
    throw formatNetworkError(err);
  }
}

export async function trainModel(payload: TrainRequest): Promise<TrainResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/train`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Proses training gagal dengan status HTTP ${response.status}`);
    }

    return await response.json();
  } catch (err: any) {
    throw formatNetworkError(err);
  }
}

export async function predictModel(payload: PredictRequest): Promise<PredictResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/predict`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Prediksi gagal dengan status HTTP ${response.status}`);
    }

    return await response.json();
  } catch (err: any) {
    throw formatNetworkError(err);
  }
}
