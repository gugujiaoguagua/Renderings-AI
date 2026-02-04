interface RunWorkflowResponse {
  taskId?: string;
  status?: string;
  errorCode?: string;
  errorMessage?: string;
  results?: unknown;
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
  const workflowId = pickEnvValue(env, 'RUNNINGHUB_WORKFLOW_ID');
  const runUrlOverride = pickEnvValue(env, 'RUNNINGHUB_WORKFLOW_RUN_URL');

  if (!apiKey) return json({ error: 'missing-env', key: 'RUNNINGHUB_API_KEY' }, { status: 500 });
  if (!runUrlOverride && !workflowId) {
    return json({ error: 'missing-env', key: 'RUNNINGHUB_WORKFLOW_ID' }, { status: 500 });
  }

  const runUrl = runUrlOverride ?? `https://www.runninghub.cn/openapi/v2/run/workflow/${workflowId}`;
  const body = await request.text();

  const resp = await fetch(runUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`
    },
    body
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

  if (data?.errorCode || data?.errorMessage) {
    return json({ error: 'runninghub-response-error', body: data }, { status: 502 });
  }

  return json({ ...data, taskId: data?.taskId, status: data?.status });
};
