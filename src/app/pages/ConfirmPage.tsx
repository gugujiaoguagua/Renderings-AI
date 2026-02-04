import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronUp, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { Skeleton } from '@/app/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/app/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { analyzeImage, parseError } from '@/app/services/ai';
import type { ImageData, AnalysisResult, GenerationError } from '@/app/types';
import { toast } from 'sonner';

export function ConfirmPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const image = location.state?.image as ImageData | undefined;

  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [error, setError] = useState<GenerationError | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showCorrectionDialog, setShowCorrectionDialog] = useState(false);

  useEffect(() => {
    if (!image) {
      navigate('/');
      return;
    }

    performAnalysis();
  }, [image]);

  const performAnalysis = async () => {
    if (!image) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const result = await analyzeImage(image.url);
      setAnalysis(result);
    } catch (err) {
      const parsedError = parseError(err);
      setError(parsedError);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerate = () => {
    if (!image || !analysis) return;

    navigate('/generating', {
      state: { image, analysis }
    });
  };

  const handleChangeImage = () => {
    navigate('/');
  };

  const handleRetry = () => {
    performAnalysis();
  };

  const correctionTags = [
    { id: 'portrait', label: '人像' },
    { id: 'landscape', label: '风景' },
    { id: 'product', label: '产品' },
    { id: 'animal', label: '动物' },
    { id: 'food', label: '美食' },
    { id: 'architecture', label: '建筑' }
  ];

  if (!image) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleChangeImage}
          >
            <ArrowLeft className="size-4 mr-1" />
            返回
          </Button>
          <h1 className="flex-1 text-center font-semibold">确认生成</h1>
          <div className="w-20" /> {/* Spacer for center alignment */}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6 pb-32">
        {/* Image Preview */}
        <Card className="overflow-hidden">
          <div className="relative aspect-[4/3] bg-gray-100">
            <img
              src={image.url}
              alt="Selected"
              className="w-full h-full object-contain"
            />
            <div className="absolute top-2 right-2">
              <span className="px-2 py-1 bg-black/60 text-white text-xs rounded">
                {image.source === 'album'
                  ? '相册'
                  : image.source === 'example'
                    ? '示例'
                    : image.source === 'camera'
                      ? '相机'
                      : '模型渲染'}
              </span>
            </div>
          </div>
        </Card>

        {/* Analysis Result */}
        <Card className="p-4">
          {isAnalyzing ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-blue-600">
                <RefreshCw className="size-4 animate-spin" />
                <span className="text-sm">正在理解图片…</span>
              </div>
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>{error.message}</AlertTitle>
              <AlertDescription className="mt-2">
                {error.action}
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="outline" onClick={handleRetry}>
                    重试
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleChangeImage}>
                    换图
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : analysis ? (
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-700">
                    系统已识别为：
                  </h3>
                  <button
                    onClick={() => setShowCorrectionDialog(true)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    不准确？
                  </button>
                </div>
                <p className="text-base font-medium">{analysis.summary}</p>
                <div className="flex items-center gap-1 mt-1">
                  <div className="flex gap-1">
                    {analysis.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <span className="text-xs text-gray-500 ml-2">
                    置信度 {Math.round(analysis.confidence * 100)}%
                  </span>
                </div>
              </div>

              <button
                onClick={() => setShowDetails(!showDetails)}
                className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
              >
                {showDetails ? (
                  <>
                    <ChevronUp className="size-4" />
                    收起详细描述
                  </>
                ) : (
                  <>
                    <ChevronDown className="size-4" />
                    展开查看描述
                  </>
                )}
              </button>

              {showDetails && (
                <div className="pt-3 border-t">
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {analysis.details}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      navigator.clipboard.writeText(analysis.details);
                      toast.success('已复制描述');
                    }}
                  >
                    复制描述
                  </Button>
                </div>
              )}
            </div>
          ) : null}
        </Card>

        {/* Privacy Notice */}
        {analysis && (
          <div className="text-sm text-gray-600 space-y-1">
            <p>• 生成将使用你选择的图片进行内容理解和参考</p>
            <p>• 图片将临时上传到云端处理，完成后自动删除</p>
            <button className="text-blue-600 hover:underline">
              了解隐私说明
            </button>
          </div>
        )}
      </main>

      {/* Fixed Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">
        <div className="max-w-3xl mx-auto space-y-3">
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleChangeImage}
            >
              换一张图
            </Button>
            <Button
              className="flex-1"
              onClick={handleGenerate}
              disabled={!analysis || isAnalyzing}
            >
              {isAnalyzing ? '理解后可生成' : '确认并生成'}
            </Button>
          </div>
          <p className="text-xs text-center text-gray-500">
            预计耗时 10-30 秒 · 失败不扣费，可重试
          </p>
        </div>
      </div>

      {/* Correction Dialog */}
      <Dialog open={showCorrectionDialog} onOpenChange={setShowCorrectionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>纠正识别类型</DialogTitle>
            <DialogDescription>
              选择最符合你图片内容的类型，帮助我们更准确地生成
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            {correctionTags.map((tag) => (
              <Button
                key={tag.id}
                variant="outline"
                className="h-auto py-3"
                onClick={() => {
                  toast.success(`已标记为 ${tag.label}`);
                  setShowCorrectionDialog(false);
                }}
              >
                {tag.label}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
