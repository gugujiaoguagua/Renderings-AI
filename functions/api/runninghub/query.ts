interface QueryResponseResult {
  url?: string;
  outputType?: string;
  text?: string | null;
}

interface QueryWorkflowResponse {
  taskId?: string;
  status?: string;
  errorCode?: string;
  errorMessage?: string;
  failedReason?: unknown;
  usage?: {
    taskCostTime?: string;
  };
  results?: QueryResponseResult[] | null;
  clientId?: string;
  promptTips?: string;
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

function previewForLog(text: string, maxLen = 300) {
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}...(+${text.length - maxLen} chars)`;
}

export const onRequestPost = async ({ request, env }: { request: Request; env: Record<string, unknown> }) => {
  try {
    const apiKey = pickEnvValue(env, 'RUNNINGHUB_API_KEY');
  const queryUrl = pickEnvValue(env, 'RUNNINGHUB_QUERY_URL') ?? 'https://www.runninghub.cn/openapi/v2/query';

  if (!apiKey) return json({ error: 'missing-env', key: 'RUNNINGHUB_API_KEY' }, { status: 500 });

  const bodyText = await request.text();
  let payload: { taskId?: string } | null = null;
  try {
    payload = JSON.parse(bodyText) as { taskId?: string };
  } catch {
    payload = null;
  }
  const taskId = payload?.taskId;
  if (!taskId || typeof taskId !== 'string') return json({ error: 'missing-taskId' }, { status: 400 });

  let queryUrlHost: string | null = null;
  let queryUrlPath: string | null = null;
  try {
    const u = new URL(queryUrl);
    queryUrlHost = u.host;
    queryUrlPath = u.pathname;
  } catch {
    queryUrlHost = null;
    queryUrlPath = null;
  }

  console.log('[runninghub/query] start', { queryUrlHost, queryUrlPath, taskId });

  const resp = await fetch(queryUrl, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'X-API-KEY': apiKey
    },
    body: JSON.stringify({ taskId })
  });

  const text = await resp.text();
  let data: QueryWorkflowResponse | null = null;
  try {
    data = JSON.parse(text) as QueryWorkflowResponse;
  } catch {
    data = null;
  }

  if (!resp.ok) {
    console.log('[runninghub/query] upstream not ok', {
      upstreamStatus: resp.status,
      bodyPreview: previewForLog(text)
    });
    return json(
      {
        error: 'runninghub-error',
        upstreamStatus: resp.status,
        body: data ?? text
      },
      { status: resp.status }
    );
  }

  if (!data) {
    console.log('[runninghub/query] invalid json', { bodyPreview: previewForLog(text) });
    return json({ error: 'runninghub-invalid-json', body: text }, { status: 502 });
  }

  if (data?.errorCode || data?.errorMessage) {
    console.log('[runninghub/query] upstream response error', {
      errorCode: data.errorCode,
      errorMessage: data.errorMessage
    });
    return json({ error: 'runninghub-response-error', body: data }, { status: 502 });
  }

  if (!data.taskId || !data.status) {
    console.log('[runninghub/query] invalid response', { bodyPreview: previewForLog(text) });
    return json({ error: 'runninghub-invalid-response', body: data }, { status: 502 });
  }

  console.log('[runninghub/query] ok', { taskId: data.taskId, status: data.status });
  return json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : '';
    const stackPreview = stack ? stack.split('\n').slice(0, 6).join('\n') : '';
    console.log('[runninghub/query] exception', { message, stackPreview });
    return json({ error: 'worker-exception', message, stack: stackPreview }, { status: 500 });
  }
};
