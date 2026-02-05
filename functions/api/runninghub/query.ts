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

export const onRequestPost = async ({ request, env }: { request: Request; env: Record<string, unknown> }) => {
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

  const resp = await fetch(queryUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${apiKey}`
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
    return json(
      {
        error: 'runninghub-error',
        status: resp.status,
        body: data ?? text
      },
      { status: 502 }
    );
  }

  if (!data) {
    return json({ error: 'runninghub-invalid-json', body: text }, { status: 502 });
  }

  if (data?.errorCode || data?.errorMessage) {
    return json({ error: 'runninghub-response-error', body: data }, { status: 502 });
  }

  if (!data.taskId || !data.status) {
    return json({ error: 'runninghub-invalid-response', body: data }, { status: 502 });
  }

  return json(data);
};
