interface RunWorkflowResponse {
  taskId?: string;
  status?: string;
  errorCode?: string;
  errorMessage?: string;
  results?: unknown;
  clientId?: string;
  promptTips?: string;
}

interface ClientRunRequestBody {
  workflowType?: string;
  addMetadata?: unknown;
  nodeInfoList?: unknown;
  instanceType?: unknown;
  usePersonalQueue?: unknown;
  [key: string]: unknown;
}

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init?.headers ?? {})
    },
    ...init
  });
}

function pickEnvValue(env: Record<string, unknown>, key: string) {
  const v = env[key];
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

function normalizeWorkflowType(value: unknown) {
  const raw = typeof value === 'string' ? value : '';
  const normalized = raw.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  return normalized.length > 0 ? normalized : null;
}

function previewForLog(text: string, maxLen = 300) {
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}...(+${text.length - maxLen} chars)`;
}

export const onRequestPost = async ({ request, env }: { request: Request; env: Record<string, unknown> }) => {
  const apiKey = pickEnvValue(env, 'RUNNINGHUB_API_KEY');
  const rawBody = await request.text();
  let bodyJson: ClientRunRequestBody | null = null;
  try {
    bodyJson = JSON.parse(rawBody) as ClientRunRequestBody;
  } catch {
    bodyJson = null;
  }

  const workflowType = normalizeWorkflowType(bodyJson?.workflowType);
  const suffix = workflowType ? `_${workflowType}` : '';
  const workflowId = pickEnvValue(env, `RUNNINGHUB_WORKFLOW_ID${suffix}`) ?? pickEnvValue(env, 'RUNNINGHUB_WORKFLOW_ID');
  const runUrlOverride =
    pickEnvValue(env, `RUNNINGHUB_WORKFLOW_RUN_URL${suffix}`) ?? pickEnvValue(env, 'RUNNINGHUB_WORKFLOW_RUN_URL');

  if (!apiKey) return json({ error: 'missing-env', key: 'RUNNINGHUB_API_KEY' }, { status: 500 });
  if (!runUrlOverride && !workflowId) {
    return json({ error: 'missing-env', key: 'RUNNINGHUB_WORKFLOW_ID' }, { status: 500 });
  }

  const runUrl = runUrlOverride ?? `https://www.runninghub.cn/openapi/v2/run/workflow/${workflowId}`;

  let runUrlHost: string | null = null;
  let runUrlPath: string | null = null;
  try {
    const u = new URL(runUrl);
    runUrlHost = u.host;
    runUrlPath = u.pathname;
  } catch {
    runUrlHost = null;
    runUrlPath = null;
  }

  const inputPayload = (() => {
    const src = (bodyJson ?? {}) as Record<string, unknown>;
    const { workflowType: _workflowType, ...rest } = src;
    return rest;
  })();

  let usedSchema: 'passthrough' | 'wrap-input' | 'v1' = 'passthrough';
  let upstreamBodyText = rawBody;

  // 如果你把 RUNNINGHUB_WORKFLOW_RUN_URL 配成 v1 端点，则自动按 v1 schema 发送
  if (runUrl.includes('/task/openapi/v1/run')) {
    if (!workflowId) return json({ error: 'missing-env', key: 'RUNNINGHUB_WORKFLOW_ID' }, { status: 500 });
    usedSchema = 'v1';
    upstreamBodyText = JSON.stringify({ workflowId, input: inputPayload });
  }

  console.log('[runninghub/run] start', {
    workflowType,
    runUrlHost,
    runUrlPath,
    bodyBytes: rawBody.length,
    usedSchema
  });

  const doFetch = async (bodyTextToSend: string) => {
    return await fetch(runUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: bodyTextToSend
    });
  };

  let resp = await doFetch(upstreamBodyText);
  let text = await resp.text();

  // 对 v2 端点做一次温和的 fallback：400 时尝试包一层 input
  if (usedSchema === 'passthrough' && resp.status === 400) {
    usedSchema = 'wrap-input';
    const retryBodyText = JSON.stringify({ input: inputPayload });
    console.log('[runninghub/run] retry with wrap-input', { retryBodyBytes: retryBodyText.length });
    resp = await doFetch(retryBodyText);
    text = await resp.text();
  }

  let data: RunWorkflowResponse | null = null;
  try {
    data = JSON.parse(text) as RunWorkflowResponse;
  } catch {
    data = null;
  }

  if (!resp.ok) {
    console.log('[runninghub/run] upstream not ok', {
      upstreamStatus: resp.status,
      usedSchema,
      bodyPreview: previewForLog(text)
    });
    return json(
      {
        error: 'runninghub-error',
        upstreamStatus: resp.status,
        usedSchema,
        body: data ?? text
      },
      { status: resp.status }
    );
  }

  if (!data) {
    console.log('[runninghub/run] invalid json', { bodyPreview: previewForLog(text) });
    return json({ error: 'runninghub-invalid-json', body: text }, { status: 502 });
  }

  if (data?.errorCode || data?.errorMessage) {
    console.log('[runninghub/run] upstream response error', {
      errorCode: data.errorCode,
      errorMessage: data.errorMessage
    });
    return json({ error: 'runninghub-response-error', body: data }, { status: 502 });
  }

  if (!data.taskId || !data.status) {
    console.log('[runninghub/run] invalid response', { bodyPreview: previewForLog(text) });
    return json({ error: 'runninghub-invalid-response', body: data }, { status: 502 });
  }

  console.log('[runninghub/run] ok', { taskId: data.taskId, status: data.status });
  return json(data);
};
