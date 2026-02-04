import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import type { ImageData } from '@/app/types';
import { toast } from 'sonner';

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read-failed'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

function canvasToJpegDataUrl(canvas: HTMLCanvasElement, quality = 0.92) {
  return canvas.toDataURL('image/jpeg', Math.max(0.1, Math.min(1, quality)));
}

async function reencodeToJpegDataUrl(file: File) {
  const dataUrl = await readFileAsDataUrl(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('decode-failed'));
    i.src = dataUrl;
  });
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas-failed');
  ctx.drawImage(img, 0, 0);
  return canvasToJpegDataUrl(canvas);
}

export function ImageRepairPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sourceFileName, setSourceFileName] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [jpegDataUrl, setJpegDataUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const canSubmit = useMemo(() => Boolean(jpegDataUrl) && !isProcessing, [jpegDataUrl, isProcessing]);

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handlePick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('图片大小不能超过 10MB');
      return;
    }

    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setSourceFileName(file.name);
    setIsProcessing(true);
    setJpegDataUrl(null);

    try {
      const jpeg = await reencodeToJpegDataUrl(file);
      setJpegDataUrl(jpeg);
      toast.success('图片已完成修复编码');
    } catch {
      toast.error('图片处理失败，请换一张试试');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartRepair = () => {
    if (!jpegDataUrl) {
      toast.info('请先选择图片');
      return;
    }

    const image: ImageData = {
      id: `repair-${Date.now()}`,
      url: jpegDataUrl,
      source: 'repair',
      timestamp: Date.now()
    };

    navigate('/generating', {
      state: {
        image,
        imageDataUrl: jpegDataUrl,
        returnTo: '/image-repair'
      }
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="size-4 mr-1" />
            返回
          </Button>
          <h1 className="flex-1 text-center font-semibold">图片修复</h1>
          <div className="w-20" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <Card
          className="p-10 border-2 border-dashed border-amber-200 bg-white/70 hover:bg-white transition-colors cursor-pointer"
          onClick={handlePick}
        >
          <div className="flex flex-col items-center text-center gap-3">
            <div className="size-14 rounded-full bg-amber-500 flex items-center justify-center">
              <Upload className="size-6 text-white" />
            </div>
            <div className="space-y-1">
              <div className="text-base font-semibold">选择图片进行修复编码</div>
              <div className="text-sm text-gray-600">会将图片重新编码为 JPG 结构后再提交渲染</div>
            </div>
            <Button
              className="mt-2"
              onClick={(e) => {
                e.stopPropagation();
                handlePick();
              }}
            >
              选择图片
            </Button>
          </div>
        </Card>

        {previewUrl && (
          <section className="space-y-3">
            <div className="text-sm font-semibold text-gray-800">预览</div>
            <Card className="overflow-hidden">
              <img src={previewUrl} alt="preview" className="w-full max-h-[420px] object-contain bg-black/5" />
            </Card>
            <div className="text-xs text-gray-600">
              {sourceFileName ? `文件：${sourceFileName}` : null}
            </div>
            <div className="flex gap-2">
              <Button onClick={handleStartRepair} disabled={!canSubmit}>
                {isProcessing ? '处理中...' : '开始修复并渲染'}
              </Button>
              <Button variant="outline" onClick={handlePick}>
                换一张
              </Button>
            </div>
          </section>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />
      </main>
    </div>
  );
}
