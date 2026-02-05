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

  const resp = await fetch(runUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: rawBody
  });

  const text = await resp.text();
  let data: RunWorkflowResponse | null = null;
  try {
    data = JSON.parse(text) as RunWorkflowResponse;
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
