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

function safeHostPath(rawUrl: string) {
  try {
    const u = new URL(rawUrl);
    return { host: u.host, path: u.pathname };
  } catch {
    return { host: null as string | null, path: null as string | null };
  }
}

export const onRequestGet = async ({ request, env }: { request: Request; env: Record<string, unknown> }) => {
  try {
    const apiKey = pickEnvValue(env, 'RUNNINGHUB_API_KEY');
    const queryUrl = pickEnvValue(env, 'RUNNINGHUB_QUERY_URL') ?? 'https://www.runninghub.cn/openapi/v2/query';

    if (!apiKey) return json({ error: 'missing-env', key: 'RUNNINGHUB_API_KEY' }, { status: 500 });

    const u = new URL(request.url);
    const taskId = u.searchParams.get('taskId') || '';
    const index = Math.max(0, Number(u.searchParams.get('index') || '0') || 0);
    if (!taskId) return json({ error: 'missing-taskId' }, { status: 400 });

    // 1) query task
    const queryHp = safeHostPath(queryUrl);
    console.log('[runninghub/image] query start', { queryUrlHost: queryHp.host, queryUrlPath: queryHp.path, taskId, index });

    let resp: Response;
    try {
      resp = await fetch(queryUrl, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'X-API-KEY': apiKey
        },
        body: JSON.stringify({ taskId })
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log('[runninghub/image] query network error', { message });
      return json({ error: 'runninghub-network', stage: 'query', message }, { status: 502 });
    }

    const text = await resp.text();
    let data: QueryWorkflowResponse | null = null;
    try {
      data = JSON.parse(text) as QueryWorkflowResponse;
    } catch {
      data = null;
    }

    if (!resp.ok) {
      console.log('[runninghub/image] query upstream not ok', { upstreamStatus: resp.status, bodyBytes: text.length });
      return json({ error: 'runninghub-error', stage: 'query', upstreamStatus: resp.status }, { status: resp.status });
    }

    if (!data || !data.taskId || !data.status) {
      console.log('[runninghub/image] query invalid response', { bodyBytes: text.length });
      return json({ error: 'runninghub-invalid-response', stage: 'query' }, { status: 502 });
    }

    if (data.status !== 'SUCCESS') {
      return json({ error: 'not-ready', stage: 'query', status: data.status }, { status: 409 });
    }

    const resultUrl = data.results?.[index]?.url;
    if (!resultUrl || typeof resultUrl !== 'string') {
      return json({ error: 'missing-result-url', stage: 'query', index }, { status: 502 });
    }

    // 2) fetch image from resultUrl (do NOT expose query)
    const imgHp = safeHostPath(resultUrl);
    console.log('[runninghub/image] fetch result', { host: imgHp.host, path: imgHp.path, taskId, index });

    let imgResp: Response;
    try {
      imgResp = await fetch(resultUrl, { method: 'GET' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log('[runninghub/image] fetch network error', { message, host: imgHp.host, path: imgHp.path });
      return json({ error: 'runninghub-network', stage: 'fetch', message }, { status: 502 });
    }

    if (!imgResp.ok) {
      console.log('[runninghub/image] fetch not ok', { status: imgResp.status, host: imgHp.host, path: imgHp.path });
      return json({ error: 'runninghub-error', stage: 'fetch', upstreamStatus: imgResp.status }, { status: 502 });
    }

    const contentType = imgResp.headers.get('content-type') || 'image/jpeg';
    return new Response(imgResp.body, {
      status: 200,
      headers: {
        'content-type': contentType,
        // avoid caching signed URLs, keep it short
        'cache-control': 'no-store'
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : '';
    const stackPreview = stack ? stack.split('\n').slice(0, 6).join('\n') : '';
    console.log('[runninghub/image] exception', { message, stackPreview });
    return json({ error: 'worker-exception', message, stack: stackPreview }, { status: 500 });
  }
};
