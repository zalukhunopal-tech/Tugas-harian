export interface Geometry {
  type: string;
  coordinates: unknown;
}

export interface AOIInfo {
  geometry: Geometry;
  crs: string;
  area_km2: number;
  bbox: [number, number, number, number];
  centroid: [number, number];
  kind: "polygon" | "point";
  parts: number;
  warnings: string[];
}

export interface Scene {
  id: string;
  collection: string;
  datetime: string;
  date: string;
  platform: string | null;
  cloud_cover: number | null;
  tile: string | null;
  product_level: string;
  epsg: number | null;
  geometry: Geometry | null;
  thumbnail: string | null;
  aoi_coverage_pct: number | null;
}

export interface SearchResponse {
  count: number;
  scenes: Scene[];
  message: string | null;
  truncated: boolean;
  min_cloud_cover_available: number | null;
}

export interface PreviewResponse {
  image: string;
  coordinates: [number, number][];
  mode: string;
  width: number;
  height: number;
}

export type PreviewMode = "true_color" | "false_color";

export interface AppConfig {
  max_aoi_km2: number;
  max_upload_mb: number;
  bands: Record<string, { label: string; native_res: number }>;
  presets: Record<string, string[]>;
  resolutions: number[];
  resampling: string[];
}

export type JobStatus = "QUEUED" | "DOWNLOADING" | "PROCESSING" | "CROPPING" | "GENERATING" | "COMPLETED" | "FAILED";

export interface Job {
  id: string;
  status: JobStatus;
  progress: number;
  message: string;
  files: { name: string; url: string }[];
  error: string | null;
  scene_id: string | null;
}

export interface DownloadOptions {
  bands: string[];
  resolution: number;
  formats: ("geotiff" | "cog")[];
  mask_to_aoi: boolean;
  resampling: string;
  name: string;
}

export type DrawMode = "polygon" | "rectangle" | "point" | null;
