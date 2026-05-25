// NEXT_PUBLIC_API_URL must be set in production (e.g. https://goldeneye-api.railway.app).
// The localhost fallback is only valid for local development.
const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Detection = {
  bbox: [number, number, number, number];
  confidence: number;
  class_name: string;
};

export type Timing = {
  preprocess_ms: number;
  inference_ms: number;
  postprocess_ms: number;
};

export type ImageResult = {
  detections: Detection[];
  count: number;
  timing: Timing;
  annotated_image_b64: string;
};

export type JobStatus = "queued" | "processing" | "done" | "failed";

export type JobState = {
  job_id: string;
  status: JobStatus;
  progress: number;
  total_frames: number;
  processed_frames: number;
  error?: string | null;
  result_mp4_url?: string | null;
  result_csv_url?: string | null;
};

export type ModelInfo = {
  name: string;
  path: string;
  input_size: number;
  provider: string;
  confidence_threshold: number;
  nms_iou_threshold: number;
  active: boolean;
};

export const api = {
  health: () => fetch(`${BASE}/api/health`).then((r) => r.json()),

  detectImage: async (file: File, mode: "full" | "sahi" = "full"): Promise<ImageResult> => {
    const form = new FormData();
    form.append("file", file);
    const url = `${BASE}/api/detect/image?mode=${mode}`;
    const res = await fetch(url, { method: "POST", body: form });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  detectVideo: async (file: File): Promise<{ job_id: string }> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE}/api/detect/video`, { method: "POST", body: form });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  jobStatus: (jobId: string): Promise<JobState> =>
    fetch(`${BASE}/api/jobs/${jobId}`).then((r) => r.json()),

  models: (): Promise<{ models: ModelInfo[]; active_model: string }> =>
    fetch(`${BASE}/api/models`).then((r) => r.json()),

  wsLiveUrl: () => `${BASE.replace(/^http/, "ws")}/ws/live`,

  resultMp4Url: (jobId: string) => `${BASE}/api/jobs/${jobId}/result.mp4`,
  resultCsvUrl: (jobId: string) => `${BASE}/api/jobs/${jobId}/result.csv`,
};
