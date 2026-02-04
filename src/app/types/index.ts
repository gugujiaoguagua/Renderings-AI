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
