import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { renderJobsService } from '@/app/services/renderJobs';
import type { GenerationResult, RenderJob } from '@/app/types';

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function formatMmSs(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${pad2(m)}:${pad2(s)}`;
}

function statusBadge(job: RenderJob) {
  if (job.status === 'success') return <Badge>已完成</Badge>;
  if (job.status === 'failed') return <Badge variant="destructive">失败</Badge>;
  if (job.status === 'cancelled') return <Badge variant="outline">已取消</Badge>;
  return <Badge variant="secondary">渲染中</Badge>;
}

function buildResultFromJob(job: RenderJob): GenerationResult {
  const originalUrl = job.originalThumbUrl || job.originalUrl || '';
  return {
    id: job.resultId || `job-${job.jobId}`,
    originalImage: {
      id: job.originalImageId || job.jobId,
      url: originalUrl,
      source: job.kind === 'image-repair' ? 'repair' : 'model',
      timestamp: job.createdAt,
    },
    generatedUrl: job.resultUrl || '',
    analysis: {
      summary: job.kind === 'image-repair' ? '图片修复' : '模型渲染',
      details: job.taskId ? `taskId: ${job.taskId}` : 'render job',
      tags: [job.kind === 'image-repair' ? '图片修复' : '模型渲染'],
      confidence: 1,
    },
    timestamp: job.completedAt || job.updatedAt || job.createdAt,
  };
}

export function RenderJobsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<RenderJob[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const autoRefreshRef = useRef<number | null>(null);

  const visibleJobs = useMemo(() => jobs, [jobs]);

  useEffect(() => {
    if (!open) return;
    setJobs(renderJobsService.getJobs());

    autoRefreshRef.current = window.setInterval(() => {
      setNow(Date.now());
      setJobs(renderJobsService.getJobs());
    }, 1000);

    return () => {
      if (autoRefreshRef.current) window.clearInterval(autoRefreshRef.current);
      autoRefreshRef.current = null;
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>渲染记录</DialogTitle>
        </DialogHeader>

        {visibleJobs.length === 0 ? (
          <div className="text-sm text-gray-600">暂无渲染记录</div>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-auto pr-1">
            {visibleJobs.map((job) => {
              const timeoutMs = job.timeoutMs ?? 10 * 60_000;
              const endAt = job.completedAt ?? now;
              const elapsedMs = Math.max(0, endAt - job.createdAt);
              const remainingMs = Math.max(0, timeoutMs - elapsedMs);
              const createdText = new Date(job.createdAt).toLocaleString();


              return (
                <div key={job.jobId} className="border rounded-lg p-3 flex gap-3">
                  <div className="size-16 rounded-md overflow-hidden bg-gray-100 shrink-0">
                    {job.originalThumbUrl || job.originalUrl ? (
                      <img
                        src={job.originalThumbUrl || job.originalUrl}
                        alt="提交图片"
                        className="w-full h-full object-cover"
                        draggable={false}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                        无预览
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">
                          {job.title || (job.kind === 'image-repair' ? '图片修复' : '模型渲染')}
                        </div>
                        <div className="text-xs text-gray-500 truncate">{createdText}</div>
                      </div>
                      <div className="shrink-0">{statusBadge(job)}</div>
                    </div>

                    <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
                      <Clock className="size-3.5" />
                      <span>用时 {formatMmSs(elapsedMs)}</span>
                      <span className="text-gray-300">|</span>
                      <span>剩余 {formatMmSs(remainingMs)}</span>
                    </div>

                    {job.statusText && (
                      <div className="mt-1 text-xs text-gray-600 truncate">{job.statusText}</div>
                    )}

                    {job.errorMessage && job.status === 'failed' && (
                      <div className="mt-1 text-xs text-red-600 truncate">{job.errorMessage}</div>
                    )}

                    <div className="mt-2 flex items-center gap-2">
                      {job.status === 'success' && job.resultUrl ? (
                        <Button
                          size="sm"
                          onClick={() => {
                            const result = buildResultFromJob(job);
                            onOpenChange(false);
                            navigate('/result', { state: { result, autoPreview: true } });
                          }}
                        >
                          <CheckCircle2 className="size-4 mr-1" />
                          打开预览
                        </Button>
                      ) : job.status === 'failed' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            onOpenChange(false);
                            navigate('/settings');
                          }}
                        >
                          <XCircle className="size-4 mr-1" />
                          查看设置
                        </Button>
                      ) : null}

                      {job.taskId && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            navigator.clipboard.writeText(job.taskId!);
                          }}
                        >
                          复制 taskId
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => {
              renderJobsService.clear();
              setJobs([]);
            }}
          >
            清空记录
          </Button>
          <Button onClick={() => onOpenChange(false)}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
