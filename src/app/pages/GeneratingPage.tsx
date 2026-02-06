import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { History, Loader2, X } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Progress } from '@/app/components/ui/progress';
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
import { analyzeImage, generateImage, parseError } from '@/app/services/ai';
import { runninghubPing, runninghubRunWorkflowWithFile, runninghubWaitForResult } from '@/app/services/runninghub';
import { storageService } from '@/app/services/storage';
import { renderJobsService } from '@/app/services/renderJobs';
import { pointsService } from '@/app/services/points';
import { authService } from '@/app/services/auth';
import { RenderJobsDialog } from '@/app/components/RenderJobsDialog';
import type { ImageData, AnalysisResult, GenerationResult, RenderJob } from '@/app/types';
import { toast } from 'sonner';

function calcCostPointsByMs(elapsedMs: number) {
  const minutes = Math.max(1, Math.ceil(elapsedMs / 60000));
  return minutes;
}

async function fetchAsDataUrl(url: string): Promise<string> {
  if (url.startsWith('data:')) return url;
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      if (url.startsWith('blob:')) throw new Error('blob-expired');
      throw new Error('fetch-failed');
    }
    const blob = await resp.blob();
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('read-failed'));
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(blob);
    });
    return base64;
  } catch {
    if (url.startsWith('blob:')) throw new Error('blob-expired');
    throw new Error('fetch-failed');
  }
}

function extFromMime(mime: string) {
  const m = (mime || '').toLowerCase();
  if (m === 'image/jpeg') return 'jpg';
  if (m === 'image/png') return 'png';
  if (m === 'image/webp') return 'webp';
  if (m === 'image/gif') return 'gif';
  return 'bin';
}

async function fetchAsFile(url: string, nameBase = 'image'): Promise<File> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      if (url.startsWith('blob:')) throw new Error('blob-expired');
      throw new Error('fetch-failed');
    }

    const blob = await resp.blob();
    if (blob.type && !blob.type.startsWith('image/')) throw new Error('unsupported');

    const ext = extFromMime(blob.type);
    const filename = `${nameBase}.${ext}`;
    return new File([blob], filename, { type: blob.type || 'application/octet-stream' });
  } catch {
    if (url.startsWith('blob:')) throw new Error('blob-expired');
    throw new Error('fetch-failed');
  }
}

async function loadImageFromBlob(blob: Blob): Promise<{ width: number; height: number; draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void; cleanup: () => void }> {
  // Prefer createImageBitmap for performance
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyGlobal: any = globalThis as any;
  if (typeof anyGlobal.createImageBitmap === 'function') {
    const bitmap = await anyGlobal.createImageBitmap(blob);
    return {
      width: bitmap.width,
      height: bitmap.height,
      draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
      cleanup: () => bitmap.close?.(),
    };
  }

  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.decoding = 'async';
  img.src = url;

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('image-load-failed'));
  });

  return {
    width: img.naturalWidth || img.width,
    height: img.naturalHeight || img.height,
    draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
    cleanup: () => URL.revokeObjectURL(url),
  };
}

async function createThumbnailDataUrlFromBlob(blob: Blob, maxSize = 512, quality = 0.86): Promise<string> {
  const img = await loadImageFromBlob(blob);
  try {
    const scale = Math.min(1, maxSize / Math.max(1, Math.max(img.width, img.height)));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas-context-failed');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    img.draw(ctx, w, h);

    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    img.cleanup();
  }
}

async function persistImageForHistory(image: ImageData, file?: File): Promise<ImageData> {
  if (!image?.url || !image.url.startsWith('blob:')) return image;

  const blob = file ?? (await (await fetch(image.url)).blob());
  const thumb = await createThumbnailDataUrlFromBlob(blob, 512, 0.86);
  return { ...image, url: thumb };
}

async function persistUrlForHistory(url: string): Promise<string> {
  if (!url?.startsWith('blob:')) return url;
  const blob = await (await fetch(url)).blob();
  return createThumbnailDataUrlFromBlob(blob, 768, 0.9);
}

export function GeneratingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const image = location.state?.image as ImageData | undefined;
  const analysis = location.state?.analysis as AnalysisResult | undefined;
  const batchImages = location.state?.batchImages as ImageData[] | undefined;
  const batchImageFiles = location.state?.batchImageFiles as Record<string, File> | undefined;
  const batchImageDataUrls = location.state?.batchImageDataUrls as Record<string, string> | undefined; // legacy
  const imageFileFromState = location.state?.imageFile as File | undefined;
  const imageDataUrlFromState = location.state?.imageDataUrl as string | undefined; // legacy
  const returnTo = (location.state?.returnTo as string | undefined) ?? '/';
  const isBatch = Array.isArray(batchImages) && batchImages.length > 0;
  const accountId = authService.getAccountId();

  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('准备中...');
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [canBackground, setCanBackground] = useState(false);
  const cancelledRef = useRef(false);
  const [batchIndex, setBatchIndex] = useState(0);
  const [currentImage, setCurrentImage] = useState<ImageData | undefined>(image);
  const [showJobsDialog, setShowJobsDialog] = useState(false);

  useEffect(() => {
    // Allow background after 3 seconds
    const timer = setTimeout(() => {
      setCanBackground(true);
    }, 3000);

    if (isBatch) {
      startBatchGeneration();
    } else {
      startSingleGeneration();
    }

    return () => clearTimeout(timer);
  }, []);

  const startSingleGeneration = async () => {
    if (!image) {
      navigate(returnTo);
      return;
    }

    if (!pointsService.canSpend(accountId, 1)) {
      toast.error('积分不足，无法开始生成');
      navigate('/settings', { state: { openPoints: true }, replace: true });
      return;
    }

    const startedAt = Date.now();
    const isModelRender =
      image.source === 'model' || returnTo === '/model-render' || image.source === 'repair' || returnTo === '/image-repair';
    let resolvedAnalysis: AnalysisResult | undefined = analysis;

    let originalFileForPersist: File | undefined;
    let jobForThisRun: RenderJob | undefined;

    try {
      let generatedUrl: string;
      if (isModelRender) {
        const workflowType = returnTo === '/image-repair' || image.source === 'repair' ? 'IMAGE_REPAIR' : undefined;
        setCurrentStep('检查服务配置...');
        setProgress(4);
        const ping = await runninghubPing(workflowType);
        if (!ping.ok) {
          if (!ping.workflowIdKeyUsed && !ping.runUrlKeyUsed) throw new Error('missing-env RUNNINGHUB_WORKFLOW_ID');
          throw new Error('missing-env RUNNINGHUB_API_KEY');
        }

        setCurrentStep('提交渲染任务...');
        setProgress(8);
        const file =
          imageFileFromState ??
          (await fetchAsFile(imageDataUrlFromState ?? image.url, image.id || 'image'));

        originalFileForPersist = file;

        let originalThumbUrl: string | undefined;
        try {
          originalThumbUrl = await createThumbnailDataUrlFromBlob(file, 512, 0.86);
        } catch {
          // ignore thumbnail errors
        }

        const runResp = await runninghubRunWorkflowWithFile({
          workflowType,
          addMetadata: true,
          instanceType: 'default',
          usePersonalQueue: 'false',
          file
        });
        if (cancelledRef.current) return;

        const taskId = runResp.taskId;

        jobForThisRun = {
          jobId: `rh-${taskId}`,
          kind: workflowType === 'IMAGE_REPAIR' ? 'image-repair' : 'model-render',
          title: workflowType === 'IMAGE_REPAIR' ? '图片修复' : '模型渲染',
          taskId,
          status: 'rendering',
          statusText: '已提交，等待渲染…',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          timeoutMs: 10 * 60_000,
          originalThumbUrl,
          originalUrl: image.url,
          originalImageId: image.id,
        };
        renderJobsService.upsert(jobForThisRun);

        resolvedAnalysis = {
          summary: '模型渲染',
          details: `taskId: ${taskId}`,
          tags: ['模型渲染'],
          confidence: 1
        };

        setCurrentStep('渲染中...');
        setProgress(18);
        const queryResp = await runninghubWaitForResult(taskId, {
          pollIntervalMs: 2000,
          timeoutMs: 10 * 60_000,
          isCancelled: () => cancelledRef.current,
          onTick: (status) => {
            if (cancelledRef.current) return;
            const text = `渲染中（${status}）...`;
            setCurrentStep(text);
            setProgress((p) => Math.min(94, Math.max(p, 18) + 2));
            if (jobForThisRun?.jobId) {
              renderJobsService.update(jobForThisRun.jobId, { status: 'rendering', statusText: text });
            }
          }
        });

        if (cancelledRef.current) return;
        const url =
          queryResp.results?.[0]?.url || `/api/runninghub/image?taskId=${encodeURIComponent(taskId)}&index=0`;
        if (!url) throw new Error('generation-failed');
        generatedUrl = url;
      } else {
        if (!resolvedAnalysis) {
          setCurrentStep('理解中...');
          setProgress(5);
          resolvedAnalysis = await analyzeImage(image.url);
          if (cancelledRef.current) return;
        }

        setCurrentStep('理解完成');
        setProgress(10);

        await new Promise(resolve => setTimeout(resolve, 500));
        if (cancelledRef.current) return;

        setCurrentStep('生成中...');
        setProgress(20);

        generatedUrl = await generateImage(
          image.url,
          resolvedAnalysis,
          (genProgress) => {
            if (cancelledRef.current) return;
            setProgress(20 + genProgress * 70);
          }
        );
      }

      if (cancelledRef.current) return;

      // Step 3: Post-processing
      setCurrentStep('后处理中...');
      setProgress(95);

      await new Promise(resolve => setTimeout(resolve, 1000));
      if (cancelledRef.current) return;

      setProgress(100);

      const costPoints = calcCostPointsByMs(Date.now() - startedAt);
      const spendRes = pointsService.spendPoints(accountId, costPoints, `生成图片（${costPoints} 积分）`);
      if (!spendRes.ok) {
        toast.error('积分不足，无法完成生成');
        navigate('/settings', { state: { openPoints: true }, replace: true });
        return;
      }

      // Save to history（把 blob URL 转成可持久化的缩略图，避免历史记录被跳过）
      let originalImageForHistory: ImageData = image;
      try {
        originalImageForHistory = await persistImageForHistory(image, originalFileForPersist ?? imageFileFromState);
      } catch {
        // ignore
      }

      let generatedUrlForHistory = generatedUrl;
      try {
        generatedUrlForHistory = await persistUrlForHistory(generatedUrl);
      } catch {
        // ignore
      }

      const result: GenerationResult = {
        id: `gen-${Date.now()}`,
        originalImage: originalImageForHistory,
        generatedUrl: generatedUrlForHistory,
        analysis: resolvedAnalysis,
        timestamp: Date.now()
      };

      storageService.addToHistory(result);

      if (jobForThisRun?.jobId) {
        renderJobsService.update(jobForThisRun.jobId, {
          status: 'success',
          statusText: '渲染完成',
          resultUrl: generatedUrl,
          resultId: result.id,
          completedAt: Date.now(),
        });
      }

      // Navigate to result page（自动打开预览）
      navigate('/result', { state: { result, autoPreview: true }, replace: true });

    } catch (error) {
      if (cancelledRef.current) return;

      const parsedError = parseError(error);
      if (jobForThisRun?.jobId) {
        renderJobsService.update(jobForThisRun.jobId, {
          status: 'failed',
          statusText: '渲染失败',
          errorMessage: parsedError.message,
          completedAt: Date.now(),
        });
      }

      navigate('/error', {
        state: { error: parsedError, image, analysis: resolvedAnalysis },
        replace: true
      });
    }
  };

  const startBatchGeneration = async () => {
    if (!batchImages || batchImages.length === 0) {
      navigate(returnTo);
      return;
    }

    if (!pointsService.canSpend(accountId, 1)) {
      toast.error('积分不足，无法开始批量生成');
      navigate('/settings', { state: { openPoints: true }, replace: true });
      return;
    }

    let lastImage: ImageData | undefined;
    let lastAnalysis: AnalysisResult | undefined;
    try {
      const total = batchImages.length;
      const isModelRenderBatch = returnTo === '/model-render' || returnTo === '/image-repair';

      for (let i = 0; i < total; i += 1) {
        if (cancelledRef.current) return;

        if (!pointsService.canSpend(accountId, 1)) {
          toast.error('积分不足，已停止批量生成');
          navigate('/settings', { state: { openPoints: true }, replace: true });
          return;
        }

        const item = batchImages[i];
        lastImage = item;
        lastAnalysis = undefined;
        const startedAt = Date.now();
        setBatchIndex(i);
        setCurrentImage(item);

        let jobForThisItem: RenderJob | undefined;
        let fileForThisItem: File | undefined;

        let resolvedAnalysis: AnalysisResult;
        let generatedUrl: string;
        if (isModelRenderBatch || item.source === 'model' || item.source === 'repair') {
          const workflowType = returnTo === '/image-repair' || item.source === 'repair' ? 'IMAGE_REPAIR' : undefined;
          setCurrentStep(`正在提交第 ${i + 1}/${total} 张…`);
          setProgress(((i + 0.05) / total) * 100);
          const file =
            batchImageFiles?.[item.id] ??
            (await fetchAsFile(batchImageDataUrls?.[item.id] ?? item.url, item.id || 'image'));

          fileForThisItem = file;

          let originalThumbUrl: string | undefined;
          try {
            originalThumbUrl = await createThumbnailDataUrlFromBlob(file, 512, 0.86);
          } catch {
            // ignore thumbnail errors
          }

          const runResp = await runninghubRunWorkflowWithFile({
            workflowType,
            addMetadata: true,
            instanceType: 'default',
            usePersonalQueue: 'false',
            file
          });
          if (cancelledRef.current) return;

          const taskId = runResp.taskId;

          jobForThisItem = {
            jobId: `rh-${taskId}`,
            kind: workflowType === 'IMAGE_REPAIR' ? 'image-repair' : 'model-render',
            title: workflowType === 'IMAGE_REPAIR' ? '图片修复' : '模型渲染',
            taskId,
            status: 'rendering',
            statusText: `批量渲染中（第 ${i + 1}/${total} 张）…`,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            timeoutMs: 10 * 60_000,
            originalThumbUrl,
            originalUrl: item.url,
            originalImageId: item.id,
          };
          renderJobsService.upsert(jobForThisItem);

          resolvedAnalysis = {
            summary: '模型渲染',
            details: `taskId: ${taskId}`,
            tags: ['模型渲染'],
            confidence: 1
          };
          lastAnalysis = resolvedAnalysis;

          setCurrentStep(`正在渲染第 ${i + 1}/${total} 张…`);
          setProgress(((i + 0.15) / total) * 100);

          const queryResp = await runninghubWaitForResult(taskId, {
            pollIntervalMs: 2000,
            timeoutMs: 10 * 60_000,
            isCancelled: () => cancelledRef.current,
            onTick: (status) => {
              if (cancelledRef.current) return;
              setProgress((p) => Math.min(((i + 0.93) / total) * 100, Math.max(p, ((i + 0.15) / total) * 100) + 1));
              if (jobForThisItem?.jobId) {
                renderJobsService.update(jobForThisItem.jobId, {
                  status: 'rendering',
                  statusText: `批量渲染中（${status}，第 ${i + 1}/${total} 张）…`,
                });
              }
            }
          });
          if (cancelledRef.current) return;
          const url =
            queryResp.results?.[0]?.url || `/api/runninghub/image?taskId=${encodeURIComponent(taskId)}&index=0`;
          if (!url) throw new Error('generation-failed');
          generatedUrl = url;
        } else {
          setCurrentStep(`正在理解第 ${i + 1}/${total} 张…`);
          setProgress((i / total) * 100);

          resolvedAnalysis = await analyzeImage(item.url);
          lastAnalysis = resolvedAnalysis;
          if (cancelledRef.current) return;

          setCurrentStep(`正在生成第 ${i + 1}/${total} 张…`);
          setProgress(((i + 0.15) / total) * 100);

          generatedUrl = await generateImage(
            item.url,
            resolvedAnalysis,
            (genProgress) => {
              if (cancelledRef.current) return;
              const stageProgress = 0.15 + genProgress * 0.8;
              setProgress(((i + stageProgress) / total) * 100);
            }
          );
        }

        if (cancelledRef.current) return;

        const costPoints = calcCostPointsByMs(Date.now() - startedAt);
        const spendRes = pointsService.spendPoints(accountId, costPoints, `批量生成（${costPoints} 积分）`);
        if (!spendRes.ok) {
          toast.error('积分不足，已停止批量生成');
          navigate('/settings', { state: { openPoints: true }, replace: true });
          return;
        }

        setCurrentStep(`正在保存第 ${i + 1}/${total} 张…`);
        setProgress(((i + 0.97) / total) * 100);

        let originalImageForHistory: ImageData = item;
        try {
          originalImageForHistory = await persistImageForHistory(item, fileForThisItem ?? batchImageFiles?.[item.id]);
        } catch {
          // ignore
        }

        let generatedUrlForHistory = generatedUrl;
        try {
          generatedUrlForHistory = await persistUrlForHistory(generatedUrl);
        } catch {
          // ignore
        }

        const result: GenerationResult = {
          id: `gen-${Date.now()}-${i}`,
          originalImage: originalImageForHistory,
          generatedUrl: generatedUrlForHistory,
          analysis: resolvedAnalysis,
          timestamp: Date.now()
        };

        storageService.addToHistory(result);

        if (jobForThisItem?.jobId) {
          renderJobsService.update(jobForThisItem.jobId, {
            status: 'success',
            statusText: '渲染完成',
            resultUrl: generatedUrl,
            resultId: result.id,
            completedAt: Date.now(),
          });
        }

        setProgress(((i + 1) / total) * 100);
      }

      setCurrentStep('全部完成');
      setProgress(100);
      toast.success(`已生成 ${batchImages.length} 张图片`);
      navigate('/history', { replace: true });
    } catch (error) {
      if (cancelledRef.current) return;

      const parsedError = parseError(error);
      navigate('/error', {
        state: { error: parsedError, image: lastImage ?? currentImage, analysis: lastAnalysis },
        replace: true
      });
    }
  };

  const handleCancel = () => {
    setShowCancelDialog(true);
  };

  const confirmCancel = () => {
    cancelledRef.current = true;
    navigate(returnTo, { replace: true });
  };

  const handleBackground = () => {
    // In a real app, this would minimize and allow background processing
    navigate(returnTo, { replace: true });
  };

  const getEstimatedTime = () => {
    const remaining = 100 - progress;
    const seconds = Math.ceil((remaining / 100) * 25);
    return `预计还需 ${seconds} 秒`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
      <RenderJobsDialog open={showJobsDialog} onOpenChange={setShowJobsDialog} />

      <div className="w-full max-w-md space-y-8">
        {/* Animation */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="size-32 rounded-full bg-blue-100 animate-pulse" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="size-16 text-blue-600 animate-spin" />
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-semibold">生成中…</h2>
          {isBatch && (
            <div className="text-sm text-gray-600">
              第 {batchIndex + 1}/{batchImages?.length} 张
            </div>
          )}
          <p className="text-gray-600">{currentStep}</p>

          {/* Progress Bar */}
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-sm text-gray-500">
              <span>{Math.round(progress)}%</span>
              <span>{getEstimatedTime()}</span>
            </div>
          </div>
        </div>

        {/* Preview Image */}
        {currentImage && (
          <div className="rounded-lg overflow-hidden border-2 border-blue-200">
            <img
              src={currentImage.url}
              alt="Original"
              className="w-full aspect-[4/3] object-cover opacity-50"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Button variant="outline" onClick={() => setShowJobsDialog(true)} className="w-full">
            <History className="size-4 mr-2" />
            渲染记录
          </Button>

          {canBackground && (
            <Button
              variant="outline"
              onClick={handleBackground}
              className="w-full"
            >
              后台等待
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={handleCancel}
            className="w-full"
          >
            <X className="size-4 mr-2" />
            取消生成
          </Button>
          <p className="text-xs text-center text-gray-500">
            取消不会扣费，你可以随时重新生成
          </p>
        </div>
      </div>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认取消？</AlertDialogTitle>
            <AlertDialogDescription>
              当前生成进度将会丢失，但不会产生任何费用。你确定要取消吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>继续生成</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancel}>
              确认取消
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
