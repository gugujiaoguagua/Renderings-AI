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

function coerceBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'true') return true;
    if (v === 'false') return false;
  }
  return null;
}

function stripDataUrlBase64Prefix(value: string) {
  const idx = value.indexOf('base64,');
  if (idx >= 0) return value.slice(idx + 'base64,'.length);
  return value;
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

  const runUrl = runUrlOverride ?? `https://api.runninghub.cn/run/workflow/${workflowId}`;

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

  const src = (bodyJson ?? {}) as Record<string, unknown>;

  // RunningHub 工作流接口要求 nodeInfoList 非空，且每项包含 nodeId + params。
  type NodeInfoItem = { nodeId: string; params: Record<string, unknown> };
  const rawNodeInfoList = src.nodeInfoList;
  let nodeInfoList: NodeInfoItem[] | null = null;
  let usedSchema: 'client-nodeInfoList' | 'env-mapped-image' = 'client-nodeInfoList';

  if (Array.isArray(rawNodeInfoList) && rawNodeInfoList.length > 0) {
    const normalized: NodeInfoItem[] = [];
    for (const it of rawNodeInfoList) {
      if (!it || typeof it !== 'object') continue;
      const item = it as Record<string, unknown>;
      const nodeId = item.nodeId;
      const params = item.params;
      if (typeof nodeId !== 'string' || !nodeId.trim()) continue;
      if (!params || typeof params !== 'object') continue;
      normalized.push({ nodeId: nodeId.trim(), params: params as Record<string, unknown> });
    }
    nodeInfoList = normalized.length > 0 ? normalized : null;
  }

  // 前端当前默认不会填 nodeInfoList（为空数组），这里提供一个可配置的“自动映射”。
  if (!nodeInfoList) {
    const imageDataUrl = src.imageDataUrl;
    if (typeof imageDataUrl !== 'string' || !imageDataUrl.trim()) {
      return json(
        {
          error: 'missing-nodeInfoList',
          hint: 'RunningHub 工作流接口要求 nodeInfoList 非空；或在请求中提供 imageDataUrl，并配置 RUNNINGHUB_IMAGE_NODE_ID / RUNNINGHUB_IMAGE_PARAM_KEY 进行自动映射。'
        },
        { status: 400 }
      );
    }

    usedSchema = 'env-mapped-image';

    const imageNodeIdKey = pickEnvValue(env, `RUNNINGHUB_IMAGE_NODE_ID${suffix}`) ? `RUNNINGHUB_IMAGE_NODE_ID${suffix}` : 'RUNNINGHUB_IMAGE_NODE_ID';
    const imageParamKeyKey = pickEnvValue(env, `RUNNINGHUB_IMAGE_PARAM_KEY${suffix}`)
      ? `RUNNINGHUB_IMAGE_PARAM_KEY${suffix}`
      : 'RUNNINGHUB_IMAGE_PARAM_KEY';

    const imageNodeId = pickEnvValue(env, imageNodeIdKey) ?? '1';
    const imageParamKey = pickEnvValue(env, imageParamKeyKey) ?? 'image';

    const base64 = stripDataUrlBase64Prefix(imageDataUrl.trim());

    nodeInfoList = [
      {
        nodeId: imageNodeId,
        params: {
          [imageParamKey]: base64
        }
      }
    ];

    const promptFromClient = typeof src.prompt === 'string' ? src.prompt.trim() : '';
    const promptFromEnv =
      pickEnvValue(env, `RUNNINGHUB_DEFAULT_PROMPT${suffix}`) ?? pickEnvValue(env, 'RUNNINGHUB_DEFAULT_PROMPT') ?? '';
    const prompt = promptFromClient || promptFromEnv;
    if (prompt) {
      const promptNodeIdKey =
        pickEnvValue(env, `RUNNINGHUB_PROMPT_NODE_ID${suffix}`) ? `RUNNINGHUB_PROMPT_NODE_ID${suffix}` : 'RUNNINGHUB_PROMPT_NODE_ID';
      const promptParamKeyKey =
        pickEnvValue(env, `RUNNINGHUB_PROMPT_PARAM_KEY${suffix}`)
          ? `RUNNINGHUB_PROMPT_PARAM_KEY${suffix}`
          : 'RUNNINGHUB_PROMPT_PARAM_KEY';

      const promptNodeId = pickEnvValue(env, promptNodeIdKey) ?? '4';
      const promptParamKey = pickEnvValue(env, promptParamKeyKey) ?? 'prompt';

      nodeInfoList.push({
        nodeId: promptNodeId,
        params: {
          [promptParamKey]: prompt
        }
      });
    }
  }

  const addMetadata = coerceBoolean(src.addMetadata);
  const usePersonalQueue = coerceBoolean(src.usePersonalQueue);
  const instanceType = typeof src.instanceType === 'string' ? src.instanceType.trim() : '';
  const webhookUrl = typeof src.webhookUrl === 'string' ? src.webhookUrl.trim() : '';

  const payload: Record<string, unknown> = {
    nodeInfoList
  };
  if (addMetadata !== null) payload.addMetadata = addMetadata;
  if (usePersonalQueue !== null) payload.usePersonalQueue = usePersonalQueue;
  if (instanceType) payload.instanceType = instanceType;
  if (webhookUrl) payload.webhookUrl = webhookUrl;

  const upstreamBodyText = JSON.stringify(payload);

  console.log('[runninghub/run] start', {
    workflowType,
    runUrlHost,
    runUrlPath,
    clientBodyBytes: rawBody.length,
    upstreamBodyBytes: upstreamBodyText.length,
    usedSchema
  });

  const resp = await fetch(runUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: upstreamBodyText
  });

  const text = await resp.text();
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
    const upstreamContentType = resp.headers.get('content-type');
    return json(
      {
        error: 'runninghub-error',
        upstreamStatus: resp.status,
        upstreamStatusText: resp.statusText,
        upstreamContentType,
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
