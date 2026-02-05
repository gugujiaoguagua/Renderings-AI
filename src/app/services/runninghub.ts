import { fetchJson } from '@/app/services/http';

export interface RunningHubRunResponse {
  taskId: string;
  status: string;
  errorCode?: string;
  errorMessage?: string;
  results?: unknown;
  clientId?: string;
  promptTips?: string;
}

export interface RunningHubPingResponse {
  ok: boolean;
  workflowType: string | null;
  workflowIdKeyUsed: string | null;
  runUrlKeyUsed: string | null;
  queryUrlKeyUsed: string | null;
  runUrlHost: string | null;
  runUrlPath: string | null;
}

export interface RunningHubQueryResultItem {
  url: string;
  outputType?: string;
  text?: string | null;
}

export interface RunningHubQueryResponse {
  taskId: string;
  status: string;
  errorCode?: string;
  errorMessage?: string;
  failedReason?: unknown;
  usage?: {
    taskCostTime?: string;
  };
  results?: RunningHubQueryResultItem[] | null;
  clientId?: string;
  promptTips?: string;
}

export async function runninghubRunWorkflow(payload: unknown) {
  return await fetchJson<RunningHubRunResponse>('/api/runninghub/run', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function runninghubPing(workflowType?: string) {
  return await fetchJson<RunningHubPingResponse>('/api/runninghub/ping', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ workflowType })
  });
}

export async function runninghubQueryTask(taskId: string) {
  return await fetchJson<RunningHubQueryResponse>('/api/runninghub/query', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ taskId })
  });
}

export async function runninghubWaitForResult(
  taskId: string,
  options?: {
    timeoutMs?: number;
    pollIntervalMs?: number;
    onTick?: (status: string) => void;
    isCancelled?: () => boolean;
  }
) {
  const timeoutMs = options?.timeoutMs ?? 5 * 60_000;
  const pollIntervalMs = options?.pollIntervalMs ?? 2000;
  const startedAt = Date.now();

  while (true) {
    if (options?.isCancelled?.()) throw new Error('cancelled');
    if (Date.now() - startedAt > timeoutMs) throw new Error('timeout');

    const data = await runninghubQueryTask(taskId);
    options?.onTick?.(data.status);

    if (data.status === 'SUCCESS') return data;
    if (data.status === 'FAILED' || data.status === 'CANCELLED') {
      throw new Error(data.errorMessage || data.errorCode || 'runninghub-failed');
    }

    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
}
