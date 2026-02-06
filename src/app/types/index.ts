export interface ImageData {
  id: string;
  url: string;
  source: 'album' | 'example' | 'camera' | 'model' | 'repair';
  timestamp: number;
}

export interface AnalysisResult {
  summary: string;
  details: string;
  tags: string[];
  confidence: number;
}

export interface GenerationResult {
  id: string;
  originalImage: ImageData;
  generatedUrl: string;
  analysis: AnalysisResult;
  timestamp: number;
}

export type GenerationStatus = 
  | 'idle'
  | 'analyzing'
  | 'analysis-failed'
  | 'ready'
  | 'generating'
  | 'generation-failed'
  | 'completed';

export interface GenerationError {
  type: 'network' | 'format' | 'compliance' | 'service-busy' | 'permission';
  message: string;
  action: string;
}

export type RenderJobStatus = 'submitted' | 'rendering' | 'success' | 'failed' | 'cancelled';

export interface RenderJob {
  jobId: string;
  kind: 'model-render' | 'image-repair' | 'ai-generate';
  title?: string;

  taskId?: string;
  status: RenderJobStatus;
  statusText?: string;

  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  timeoutMs?: number;

  // Small preview (建议存缩略图，避免 localStorage 过大)
  originalThumbUrl?: string;
  originalUrl?: string; // 仅用于兜底（可能是 blob）
  originalImageId?: string;

  // Result
  resultUrl?: string;
  resultId?: string;

  errorMessage?: string;
}
