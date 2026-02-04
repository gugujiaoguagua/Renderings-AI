import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Download, Share2, RefreshCw, Image as ImageIcon, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';
import type { GenerationResult } from '@/app/types';
import { toast } from 'sonner';

export function ResultPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const result = location.state?.result as GenerationResult | undefined;

  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [feedback, setFeedback] = useState<'good' | 'bad' | null>(null);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);

  if (!result) {
    navigate('/');
    return null;
  }

  const handleDownload = async () => {
    try {
      const filename = `ai-generated-${result.id}.jpg`;
      const originalUrl = result.generatedUrl;

      let downloadUrl = originalUrl;
      let revoke: (() => void) | undefined;

      if (!originalUrl.startsWith('blob:') && !originalUrl.startsWith('data:')) {
        const resp = await fetch(originalUrl);
        if (!resp.ok) throw new Error('download-failed');
        const blob = await resp.blob();
        downloadUrl = URL.createObjectURL(blob);
        revoke = () => URL.revokeObjectURL(downloadUrl);
      }

      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      revoke?.();

      toast.success('图片已保存到相册');
    } catch (error) {
      try {
        window.open(result.generatedUrl, '_blank', 'noopener,noreferrer');
        toast.info('已打开图片，请长按/右键保存到相册');
      } catch {
        toast.error('保存失败，请重试');
      }
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'AI 生成的图片',
        text: '查看我用 AI 生成的图片',
        url: result.generatedUrl
      }).catch(() => {
        // User cancelled share
      });
    } else {
      toast.info('分享功能需要在移动设备上使用');
    }
  };

  const handleRegenerate = () => {
    setShowRegenerateDialog(true);
  };

  const confirmRegenerate = () => {
    navigate('/generating', {
      state: {
        image: result.originalImage,
        analysis: result.analysis
      }
    });
  };

  const handleChangeImage = () => {
    navigate('/');
  };

  const handleRetry = () => {
    setImageError(false);
    setImageLoaded(false);
  };

  const handleFeedback = (type: 'good' | 'bad') => {
    setFeedback(type);
    toast.success(type === 'good' ? '感谢你的反馈！' : '我们会继续改进');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-center font-semibold">生成完成</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6 pb-32">
        {/* Generated Image */}
        <Card className="overflow-hidden">
          <div className="relative aspect-[4/3] bg-gray-100">
            {!imageLoaded && !imageError && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center space-y-2">
                  <div className="size-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-sm text-gray-600">加载中...</p>
                </div>
              </div>
            )}

            {imageError ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center space-y-4">
                  <ImageIcon className="size-12 text-gray-400 mx-auto" />
                  <div>
                    <p className="font-medium">图片加载失败</p>
                    <p className="text-sm text-gray-600 mt-1">请检查网络后重试</p>
                  </div>
                  <Button onClick={handleRetry} variant="outline">
                    重试
                  </Button>
                </div>
              </div>
            ) : (
              <img
                src={result.generatedUrl}
                alt="Generated result"
                className={`w-full h-full object-contain transition-opacity ${
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                } ${imageLoaded ? 'cursor-zoom-in' : ''}`}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
                onClick={() => {
                  if (!imageLoaded || imageError) return;
                  setShowPreviewDialog(true);
                }}
              />
            )}
          </div>
        </Card>

        {/* Analysis Info */}
        <Card className="p-4">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700">基于理解：</h3>
            <p className="text-base">{result.analysis.summary}</p>
            <div className="flex gap-1 flex-wrap">
              {result.analysis.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </Card>

        {/* Feedback */}
        {imageLoaded && !imageError && (
          <div className="flex items-center justify-center gap-4">
            <span className="text-sm text-gray-600">对结果满意吗？</span>
            <div className="flex gap-2">
              <Button
                variant={feedback === 'good' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleFeedback('good')}
              >
                <ThumbsUp className="size-4 mr-1" />
                满意
              </Button>
              <Button
                variant={feedback === 'bad' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleFeedback('bad')}
              >
                <ThumbsDown className="size-4 mr-1" />
                不满意
              </Button>
            </div>
          </div>
        )}

        {/* Original Image (Small Preview) */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">原图：</h3>
          <Card className="overflow-hidden w-32 aspect-square">
            <img
              src={result.originalImage.url}
              alt="Original"
              className="w-full h-full object-cover"
            />
          </Card>
        </div>
      </main>

      {/* Fixed Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">
        <div className="max-w-4xl mx-auto space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={handleDownload}
              disabled={!imageLoaded || imageError}
              className="w-full"
            >
              <Download className="size-4 mr-2" />
              保存到相册
            </Button>
            <Button
              onClick={handleShare}
              variant="outline"
              disabled={!imageLoaded || imageError}
              className="w-full"
            >
              <Share2 className="size-4 mr-2" />
              分享
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={handleRegenerate}
              variant="outline"
              className="w-full"
            >
              <RefreshCw className="size-4 mr-2" />
              再生成一张
            </Button>
            <Button
              onClick={handleChangeImage}
              variant="outline"
              className="w-full"
            >
              <ImageIcon className="size-4 mr-2" />
              换一张图
            </Button>
          </div>
        </div>
      </div>

      {/* Regenerate Confirmation Dialog */}
      <AlertDialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>再生成一张？</AlertDialogTitle>
            <AlertDialogDescription>
              将使用相同的图片和理解结果重新生成，可能会得到不同的效果。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRegenerate}>
              确认生成
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>预览</DialogTitle>
          </DialogHeader>
          <div className="rounded-lg overflow-hidden bg-gray-100">
            <img
              src={result.generatedUrl}
              alt="Preview"
              className="w-full max-h-[70vh] object-contain bg-gray-100"
              draggable={false}
            />
          </div>
          <DialogFooter>
            <Button onClick={handleDownload} disabled={!imageLoaded || imageError}>
              <Download className="size-4 mr-2" />
              保存到相册
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
