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

export interface CloudStats {
  aoi_pixels: number;
  masked_pct: number;
  filled_pct: number;
  unfilled_masked_pct: number;
  filled_pct_per_previous: number[];
  clear_pct: number;
}

export interface PreviewResponse {
  image: string;
  coordinates: [number, number][];
  mode: string;
  width: number;
  height: number;
  cloud: CloudStats | null;
}

export type MaskClass = "cloud" | "cloud_shadow" | "cirrus" | "snow_ice";

export interface CloudMaskOptions {
  enabled: boolean;
  classes: MaskClass[];
  dilate_m: number;
  fill_from_previous: boolean;
  previous_scene_ids: string[];
  auto_previous: number;
  auto_lookback_days: number;
  include_qa: boolean;
}

export interface PreviousScene extends Scene {
  same_tile: boolean;
  days_before: number;
}

export interface PreviousResponse {
  count: number;
  scenes: PreviousScene[];
  message: string | null;
}

export interface AoiCloudStat {
  scene_id: string;
  cloud_pct: number | null;
  valid_pct: number | null;
  error: string | null;
}

export type PreviewMode = "true_color" | "false_color" | "ndvi" | "ndwi" | "nbr";
export type IndexName = "NDVI" | "NDWI" | "NBR";

export interface AppConfig {
  max_aoi_km2: number;
  max_upload_mb: number;
  bands: Record<string, { label: string; native_res: number }>;
  presets: Record<string, string[]>;
  resolutions: number[];
  resampling: string[];
  mask_classes: Record<MaskClass, string>;
  indices: Record<IndexName, { label: string; formula: string; bands: string[] }>;
  max_batch: number;
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

export interface ChangeOptions {
  enabled: boolean;
  index: IndexName;
  reference_scene_id: string | null;
  threshold: number;
}

export type BatchStatus = "RUNNING" | "COMPLETED" | "COMPLETED_WITH_ERRORS" | "FAILED";

export interface Batch {
  id: string;
  status: BatchStatus;
  total: number;
  completed: number;
  failed: number;
  progress: number;
  jobs: Job[];
  zip_url: string | null;
}

export interface DownloadOptions {
  bands: string[];
  indices: IndexName[];
  change: ChangeOptions;
  resolution: number;
  formats: ("geotiff" | "cog")[];
  mask_to_aoi: boolean;
  resampling: string;
  name: string;
  cloud_mask: CloudMaskOptions;
}

export type DrawMode = "polygon" | "rectangle" | "point" | null;
