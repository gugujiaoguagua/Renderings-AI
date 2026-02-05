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
  const bodyText = await request.text();
  let body: { workflowType?: string } | null = null;
  try {
    body = JSON.parse(bodyText) as { workflowType?: string };
  } catch {
    body = null;
  }

  const workflowType = normalizeWorkflowType(body?.workflowType);
  const suffix = workflowType ? `_${workflowType}` : '';

  const workflowIdKeyUsed = pickEnvValue(env, `RUNNINGHUB_WORKFLOW_ID${suffix}`)
    ? `RUNNINGHUB_WORKFLOW_ID${suffix}`
    : pickEnvValue(env, 'RUNNINGHUB_WORKFLOW_ID')
      ? 'RUNNINGHUB_WORKFLOW_ID'
      : null;

  const runUrlKeyUsed = pickEnvValue(env, `RUNNINGHUB_WORKFLOW_RUN_URL${suffix}`)
    ? `RUNNINGHUB_WORKFLOW_RUN_URL${suffix}`
    : pickEnvValue(env, 'RUNNINGHUB_WORKFLOW_RUN_URL')
      ? 'RUNNINGHUB_WORKFLOW_RUN_URL'
      : null;

  const queryUrlKeyUsed = pickEnvValue(env, 'RUNNINGHUB_QUERY_URL') ? 'RUNNINGHUB_QUERY_URL' : null;

  const workflowId = workflowIdKeyUsed ? pickEnvValue(env, workflowIdKeyUsed) : null;
  const runUrlOverride = runUrlKeyUsed ? pickEnvValue(env, runUrlKeyUsed) : null;
  const runUrl = runUrlOverride ?? (workflowId ? `https://api.runninghub.cn/run/workflow/${workflowId}` : null);

  let runUrlHost: string | null = null;
  let runUrlPath: string | null = null;
  if (runUrl) {
    try {
      const u = new URL(runUrl);
      runUrlHost = u.host;
      runUrlPath = u.pathname;
    } catch {
      runUrlHost = null;
      runUrlPath = null;
    }
  }

  const ok = Boolean(pickEnvValue(env, 'RUNNINGHUB_API_KEY')) && Boolean(runUrlHost);
  return json({
    ok,
    workflowType,
    workflowIdKeyUsed,
    runUrlKeyUsed,
    queryUrlKeyUsed,
    runUrlHost,
    runUrlPath
  });
};
