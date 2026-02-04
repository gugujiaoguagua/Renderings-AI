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
  const resp = await fetch('/api/runninghub/run', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(text || 'runninghub-run-failed');
  }
  return (await resp.json()) as RunningHubRunResponse;
}

export async function runninghubPing(workflowType?: string) {
  const resp = await fetch('/api/runninghub/ping', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ workflowType })
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(text || 'runninghub-ping-failed');
  }
  return (await resp.json()) as RunningHubPingResponse;
}

export async function runninghubQueryTask(taskId: string) {
  const resp = await fetch('/api/runninghub/query', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ taskId })
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(text || 'runninghub-query-failed');
  }
  return (await resp.json()) as RunningHubQueryResponse;
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
