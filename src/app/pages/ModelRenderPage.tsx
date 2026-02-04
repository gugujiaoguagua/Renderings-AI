import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Upload } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { storageService } from '@/app/services/storage';
import type { ImageData } from '@/app/types';
import { toast } from 'sonner';

interface PendingImage {
  image: ImageData;
  name: string;
  size: number;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

export function ModelRenderPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const pendingImagesRef = useRef<PendingImage[]>([]);

  const canAddMore = pendingImages.length < 10;
  const remainingSlots = useMemo(() => Math.max(0, 10 - pendingImages.length), [pendingImages.length]);

  useEffect(() => {
    pendingImagesRef.current = pendingImages;
  }, [pendingImages]);

  const handleUploadClick = () => {
    if (!canAddMore) {
      toast.info('最多只能上传 10 张图片');
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;

    const limitedFiles = files.slice(0, remainingSlots);
    if (files.length > limitedFiles.length) {
      toast.info(`最多只能上传 10 张图片，已添加前 ${limitedFiles.length} 张`);
    }

    let invalidTypeCount = 0;
    let tooLargeCount = 0;
    const accepted: PendingImage[] = [];

    const baseTime = Date.now();
    limitedFiles.forEach((file, index) => {
      if (!file.type.startsWith('image/')) {
        invalidTypeCount += 1;
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        tooLargeCount += 1;
        return;
      }

      const url = URL.createObjectURL(file);
      const image: ImageData = {
        id: `model-${baseTime}-${index}`,
        url,
        source: 'model',
        timestamp: Date.now()
      };

      accepted.push({
        image,
        name: file.name,
        size: file.size
      });
    });

    if (invalidTypeCount > 0) {
      toast.error(`有 ${invalidTypeCount} 个文件不是图片，已跳过`);
    }
    if (tooLargeCount > 0) {
      toast.error(`有 ${tooLargeCount} 张图片超过 10MB，已跳过`);
    }
    if (accepted.length === 0) return;

    accepted.forEach((item) => storageService.addRecentImage(item.image));
    setPendingImages((prev) => [...prev, ...accepted]);
  };

  const handleRemove = (id: string) => {
    setPendingImages((prev) => {
      const target = prev.find((p) => p.image.id === id);
      if (target) URL.revokeObjectURL(target.image.url);
      return prev.filter((p) => p.image.id !== id);
    });
  };

  const handleClearAll = () => {
    setPendingImages((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.image.url));
      return [];
    });
  };

  const handleGenerateAll = () => {
    if (pendingImages.length === 0) {
      toast.info('请先上传至少 1 张图片');
      return;
    }

    navigate('/generating', {
      state: {
        batchImages: pendingImages.map((p) => p.image),
        returnTo: '/model-render'
      }
    });
  };

  useEffect(() => {
    return () => {
      pendingImagesRef.current.forEach((p) => URL.revokeObjectURL(p.image.url));
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="size-4 mr-1" />
            返回
          </Button>
          <h1 className="flex-1 text-center font-semibold">模型渲染</h1>
          <div className="w-20" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <Card
          className="p-10 border-2 border-dashed border-purple-200 bg-white/70 hover:bg-white transition-colors cursor-pointer"
          onClick={handleUploadClick}
        >
          <div className="flex flex-col items-center text-center gap-3">
            <div className="size-14 rounded-full bg-purple-500 flex items-center justify-center">
              <Upload className="size-6 text-white" />
            </div>
            <div className="space-y-1">
              <div className="text-base font-semibold">上传图片开始渲染</div>
              <div className="text-sm text-gray-600">
                支持 JPG/PNG/WebP，最大 10MB（最多 10 张）
              </div>
            </div>
            <Button
              className="mt-2"
              onClick={(e) => {
                e.stopPropagation();
                handleUploadClick();
              }}
              disabled={!canAddMore}
            >
              选择图片
            </Button>
          </div>
        </Card>

        {pendingImages.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-800">
                等待区（{pendingImages.length}/10）
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleGenerateAll}>
                  一键生成
                </Button>
                <Button size="sm" variant="outline" onClick={handleClearAll}>
                  清空
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {pendingImages.map((item) => (
                <Card
                  key={item.image.id}
                  className="overflow-hidden relative aspect-square"
                >
                  <img
                    src={item.image.url}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                  <button
                    className="absolute top-2 right-2 bg-black/60 text-white rounded-md p-1.5 hover:bg-black/75 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(item.image.id);
                    }}
                    aria-label="删除"
                    type="button"
                  >
                    <Trash2 className="size-4" />
                  </button>
                  <div className="absolute left-0 right-0 bottom-0 bg-black/60 text-white p-2">
                    <div className="text-xs font-medium truncate">{item.name}</div>
                    <div className="text-[11px] opacity-90">{formatBytes(item.size)}</div>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          multiple
          onChange={handleFileSelect}
        />
      </main>
    </div>
  );
}
