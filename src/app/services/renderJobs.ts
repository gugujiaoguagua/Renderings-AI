import type { RenderJob } from '@/app/types';

const RENDER_JOBS_KEY = 'ai-render-jobs';
const MAX_JOBS = 50;

function safeParseJobs(raw: string | null): RenderJob[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as RenderJob[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((j) => j && typeof j.jobId === 'string');
  } catch {
    return [];
  }
}

function sortJobs(jobs: RenderJob[]) {
  return [...jobs].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

export const renderJobsService = {
  getJobs(): RenderJob[] {
    return sortJobs(safeParseJobs(localStorage.getItem(RENDER_JOBS_KEY)));
  },

  upsert(job: RenderJob) {
    const now = Date.now();
    const existing = safeParseJobs(localStorage.getItem(RENDER_JOBS_KEY));
    const idx = existing.findIndex((j) => j.jobId === job.jobId);
    const normalized: RenderJob = {
      ...job,
      createdAt: job.createdAt ?? now,
      updatedAt: job.updatedAt ?? now,
    };

    let next: RenderJob[];
    if (idx >= 0) {
      next = [...existing];
      next[idx] = { ...next[idx], ...normalized, updatedAt: now };
    } else {
      next = [normalized, ...existing];
    }

    next = sortJobs(next).slice(0, MAX_JOBS);
    localStorage.setItem(RENDER_JOBS_KEY, JSON.stringify(next));
  },

  update(jobId: string, patch: Partial<RenderJob>) {
    const existing = safeParseJobs(localStorage.getItem(RENDER_JOBS_KEY));
    const idx = existing.findIndex((j) => j.jobId === jobId);
    if (idx < 0) return;
    const now = Date.now();
    const next = [...existing];
    next[idx] = { ...next[idx], ...patch, updatedAt: now };
    localStorage.setItem(RENDER_JOBS_KEY, JSON.stringify(sortJobs(next).slice(0, MAX_JOBS)));
  },

  remove(jobId: string) {
    const existing = safeParseJobs(localStorage.getItem(RENDER_JOBS_KEY));
    const next = existing.filter((j) => j.jobId !== jobId);
    localStorage.setItem(RENDER_JOBS_KEY, JSON.stringify(sortJobs(next).slice(0, MAX_JOBS)));
  },

  clear() {
    localStorage.removeItem(RENDER_JOBS_KEY);
  },
};
