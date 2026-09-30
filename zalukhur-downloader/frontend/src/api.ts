import type {
  AOIInfo, AoiCloudStat, AppConfig, CloudMaskOptions, DownloadOptions, Geometry, Job, PreviewMode, PreviewResponse,
  PreviousResponse, SearchResponse,
} from "./types";

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

export class ApiError extends Error {
  constructor(message: string, public status = 0, public code = "error") {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path, init);
  } catch {
    throw new ApiError("Tidak dapat menghubungi server. Periksa koneksi Anda.", 0, "network");
  }
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* bukan JSON */
  }
  if (!res.ok) {
    const b = body as { detail?: unknown; code?: string } | null;
    const detail = typeof b?.detail === "string" ? b.detail : `Permintaan gagal (HTTP ${res.status}).`;
    throw new ApiError(detail, res.status, b?.code ?? "error");
  }
  return body as T;
}

const json = (data: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});

export const api = {
  config: () => request<AppConfig>("/api/config"),

  aoiFromGeometry: (geometry: Geometry, radius_m?: number) =>
    request<AOIInfo>("/api/aoi", json({ geometry, radius_m })),
  aoiFromPoint: (lat: number, lon: number, radius_m: number) =>
    request<AOIInfo>("/api/aoi", json({ lat, lon, radius_m })),
  aoiFromFile: (file: File, radius_m?: number) => {
    const fd = new FormData();
    fd.append("file", file);
    if (radius_m) fd.append("radius_m", String(radius_m));
    return request<AOIInfo>("/api/aoi/upload", { method: "POST", body: fd });
  },

  search: (p: { aoi: Geometry; start_date: string; end_date: string; max_cloud_cover: number; limit?: number }) =>
    request<SearchResponse>("/api/scenes/search", json({ ...p, satellite: "sentinel-2", product_level: "L2A" })),

  preview: (scene_id: string, aoi: Geometry, mode: PreviewMode, cloud_mask?: CloudMaskOptions) =>
    request<PreviewResponse>("/api/scenes/preview", json({ scene_id, aoi, mode, ...(cloud_mask ? { cloud_mask } : {}) })),

  previousScenes: (scene_id: string, aoi: Geometry, lookback_days: number) =>
    request<PreviousResponse>("/api/scenes/previous", json({ scene_id, aoi, lookback_days, limit: 10 })),
  aoiCloud: (scene_ids: string[], aoi: Geometry, classes: string[], dilate_m: number) =>
    request<{ stats: AoiCloudStat[] }>("/api/scenes/aoi-cloud", json({ scene_ids, aoi, classes, dilate_m })),

  startDownload: (scene_id: string, aoi: Geometry, o: DownloadOptions) =>
    request<Job>("/api/download", json({ scene_id, aoi, ...o, name: o.name || null })),
  job: (id: string) => request<Job>(`/api/jobs/${id}`),
  fileUrl: (url: string) => BASE + url,

  geocode: (q: string) =>
    request<{ name: string; lat: number; lon: number; bbox: [number, number, number, number] | null }[]>(
      `/api/geocode?q=${encodeURIComponent(q)}`,
    ),
};
