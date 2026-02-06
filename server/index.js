import 'dotenv/config';
import express from 'express';

function pickEnvValue(key) {
  const v = process.env[key];
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

function normalizeWorkflowType(value) {
  const raw = typeof value === 'string' ? value : '';
  const normalized = raw.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  return normalized.length > 0 ? normalized : null;
}

function previewForLog(text, maxLen = 300) {
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}...(+${text.length - maxLen} chars)`;
}

function coerceBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'true') return true;
    if (v === 'false') return false;
  }
  return null;
}

function stripDataUrlBase64Prefix(value) {
  const idx = value.indexOf('base64,');
  if (idx >= 0) return value.slice(idx + 'base64,'.length);
  return value;
}

function validateWorkflowRunUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') {
      return { ok: false, reason: 'protocol-not-https', host: u.host, path: u.pathname };
    }
    if (!u.pathname.startsWith('/run/workflow/')) {
      return { ok: false, reason: 'path-not-workflow', host: u.host, path: u.pathname };
    }
    return { ok: true, host: u.host, path: u.pathname };
  } catch {
    return { ok: false, reason: 'invalid-url' };
  }
}

function runningHubHeaders(apiKey) {
  return {
    accept: 'application/json',
    'content-type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    'X-API-KEY': apiKey
  };
}

const app = express();
app.disable('x-powered-by');

// base64 图片很大：一定要调高 limit
app.use(express.json({ limit: pickEnvValue('JSON_BODY_LIMIT') ?? '50mb' }));

// ---- mock AI endpoints (keep behavior same as Cloudflare Functions) ----
const mockAnalyses = [
  {
    summary: '室内人像、柔光、浅景深',
    details:
      '这是一张专业的人像摄影作品，采用自然光拍摄，背景虚化效果良好。人物表情自然，光线柔和，整体色调温暖。适合用于头像、社交媒体或专业简历。',
    tags: ['人像', '室内', '自然光', '专业'],
    confidence: 0.92
  },
  {
    summary: '风景摄影、日落时分、山景',
    details: '壮丽的山地风光，拍摄于日落时分。画面层次分明，色彩饱满，展现了大自然的磅礴气势。光线温暖，适合作为壁纸或旅行记录。',
    tags: ['风景', '山景', '日落', '户外'],
    confidence: 0.89
  },
  {
    summary: '宠物摄影、动物特写、自然环境',
    details: '可爱的宠物照片，捕捉到了动物生动的表情和姿态。背景简洁，主体突出，色彩自然。非常适合宠物主人纪念或分享。',
    tags: ['宠物', '动物', '特写', '户外'],
    confidence: 0.95
  },
  {
    summary: '产品摄影、简约风格、静物',
    details: '专业的产品摄影，采用简约的构图和纯净的背景。光线均匀，细节清晰，能够很好地展现产品的质感和设计。适合电商或品牌展示。',
    tags: ['产品', '静物', '简约', '商业'],
    confidence: 0.88
  },
  {
    summary: '抽象艺术、色彩丰富、创意设计',
    details: '充满创意的抽象作品，色彩鲜明，构图独特。视觉冲击力强，富有艺术感和想象空间。适合作为装饰画或设计素材。',
    tags: ['抽象', '艺术', '色彩', '创意'],
    confidence: 0.86
  }
];

app.post('/api/analyze', async (req, res) => {
  const { imageDataUrl } = req.body ?? {};
  if (!imageDataUrl || typeof imageDataUrl !== 'string') {
    return res.status(400).json({ error: 'missing-image' });
  }
  const idx = Math.floor(Math.random() * mockAnalyses.length);
  return res.json({ analysis: mockAnalyses[idx] });
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

app.post('/api/generate', async (req, res) => {
  const { imageDataUrl } = req.body ?? {};
  if (!imageDataUrl || typeof imageDataUrl !== 'string') {
    return res.status(400).json({ error: 'missing-image' });
  }
  for (let i = 0; i < 10; i += 1) {
    await sleep(200 + Math.random() * 300);
  }
  return res.json({ generatedUrl: imageDataUrl });
});

// ---- RunningHub endpoints ----
app.post('/api/runninghub/ping', async (req, res) => {
  const body = req.body ?? {};
  const workflowType = normalizeWorkflowType(body.workflowType);
  const suffix = workflowType ? `_${workflowType}` : '';

  const workflowIdKeyUsed = pickEnvValue(`RUNNINGHUB_WORKFLOW_ID${suffix}`)
    ? `RUNNINGHUB_WORKFLOW_ID${suffix}`
    : pickEnvValue('RUNNINGHUB_WORKFLOW_ID')
      ? 'RUNNINGHUB_WORKFLOW_ID'
      : null;

  const runUrlKeyUsed = pickEnvValue(`RUNNINGHUB_WORKFLOW_RUN_URL${suffix}`)
    ? `RUNNINGHUB_WORKFLOW_RUN_URL${suffix}`
    : pickEnvValue('RUNNINGHUB_WORKFLOW_RUN_URL')
      ? 'RUNNINGHUB_WORKFLOW_RUN_URL'
      : null;

  const queryUrlKeyUsed = pickEnvValue('RUNNINGHUB_QUERY_URL') ? 'RUNNINGHUB_QUERY_URL' : null;

  const workflowId = workflowIdKeyUsed ? pickEnvValue(workflowIdKeyUsed) : null;
  const runUrlOverride = runUrlKeyUsed ? pickEnvValue(runUrlKeyUsed) : null;
  const runUrl = runUrlOverride ?? (workflowId ? `https://api.runninghub.cn/run/workflow/${workflowId}` : null);

  const isRunUrlValid = runUrl
    ? (() => {
        try {
          const u = new URL(runUrl);
          return u.protocol === 'https:' && u.pathname.startsWith('/run/workflow/');
        } catch {
          return false;
        }
      })()
    : false;

  let runUrlHost = null;
  let runUrlPath = null;
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

  const ok = Boolean(pickEnvValue('RUNNINGHUB_API_KEY')) && Boolean(runUrlHost) && isRunUrlValid;
  return res.json({
    ok,
    workflowType,
    workflowIdKeyUsed,
    runUrlKeyUsed,
    queryUrlKeyUsed,
    runUrlHost,
    runUrlPath
  });
});

app.post('/api/runninghub/run', async (req, res) => {
  try {
    const apiKey = pickEnvValue('RUNNINGHUB_API_KEY');
    const bodyJson = (req.body ?? null) && typeof req.body === 'object' ? req.body : null;

    const workflowType = normalizeWorkflowType(bodyJson?.workflowType);
    const suffix = workflowType ? `_${workflowType}` : '';
    const workflowId = pickEnvValue(`RUNNINGHUB_WORKFLOW_ID${suffix}`) ?? pickEnvValue('RUNNINGHUB_WORKFLOW_ID');
    const runUrlOverride =
      pickEnvValue(`RUNNINGHUB_WORKFLOW_RUN_URL${suffix}`) ?? pickEnvValue('RUNNINGHUB_WORKFLOW_RUN_URL');

    if (!apiKey) return res.status(500).json({ error: 'missing-env', key: 'RUNNINGHUB_API_KEY' });
    if (!runUrlOverride && !workflowId) {
      return res.status(500).json({ error: 'missing-env', key: 'RUNNINGHUB_WORKFLOW_ID' });
    }

    const apiBase = pickEnvValue('RUNNINGHUB_API_BASE') ?? 'https://api.runninghub.cn';
    const defaultRunUrl = `${apiBase.replace(/\/$/, '')}/run/workflow/${workflowId}`;
    const runUrl = runUrlOverride ?? defaultRunUrl;

    // 防止把 RUNNINGHUB_WORKFLOW_RUN_URL 误配成 /upload/image 之类的非工作流接口
    if (runUrlOverride) {
      const v = validateWorkflowRunUrl(runUrlOverride);
      if (!v.ok) {
        return res.status(500).json({
          error: 'invalid-env',
          key: 'RUNNINGHUB_WORKFLOW_RUN_URL',
          reason: v.reason,
          host: 'host' in v ? v.host : null,
          path: 'path' in v ? v.path : null,
          expectedExample: defaultRunUrl
        });
      }
    }

    let runUrlHost = null;
    let runUrlPath = null;
    try {
      const u = new URL(runUrl);
      runUrlHost = u.host;
      runUrlPath = u.pathname;
    } catch {
      runUrlHost = null;
      runUrlPath = null;
    }

    const src = bodyJson ?? {};

    // RunningHub 工作流接口要求 nodeInfoList 非空，且每项包含 nodeId + params。
    const rawNodeInfoList = src.nodeInfoList;
    let nodeInfoList = null;
    let usedSchema = 'client-nodeInfoList';

    // debug meta (do NOT include large payloads or secrets)
    let mappedImageNodeId = null;
    let mappedImageParamKey = null;
    let mappedPromptNodeId = null;
    let mappedPromptParamKey = null;
    let imageBase64Length = null;
    let imageBase64Prefix = null;

    if (Array.isArray(rawNodeInfoList) && rawNodeInfoList.length > 0) {
      const normalized = [];
      for (const it of rawNodeInfoList) {
        if (!it || typeof it !== 'object') continue;
        const item = it;
        const nodeId = item.nodeId;
        const params = item.params;
        if (typeof nodeId !== 'string' || !nodeId.trim()) continue;
        if (!params || typeof params !== 'object') continue;
        normalized.push({ nodeId: nodeId.trim(), params });
      }
      nodeInfoList = normalized.length > 0 ? normalized : null;
    }

    // 前端当前默认不会填 nodeInfoList（为空数组），这里提供一个可配置的“自动映射”。
    if (!nodeInfoList) {
      const imageDataUrl = src.imageDataUrl;
      if (typeof imageDataUrl !== 'string' || !imageDataUrl.trim()) {
        return res.status(400).json({
          error: 'missing-nodeInfoList',
          hint:
            'RunningHub 工作流接口要求 nodeInfoList 非空；或在请求中提供 imageDataUrl，并配置 RUNNINGHUB_IMAGE_NODE_ID / RUNNINGHUB_IMAGE_PARAM_KEY 进行自动映射。'
        });
      }

      usedSchema = 'env-mapped-image';

      const imageNodeIdKey = pickEnvValue(`RUNNINGHUB_IMAGE_NODE_ID${suffix}`)
        ? `RUNNINGHUB_IMAGE_NODE_ID${suffix}`
        : 'RUNNINGHUB_IMAGE_NODE_ID';
      const imageParamKeyKey = pickEnvValue(`RUNNINGHUB_IMAGE_PARAM_KEY${suffix}`)
        ? `RUNNINGHUB_IMAGE_PARAM_KEY${suffix}`
        : 'RUNNINGHUB_IMAGE_PARAM_KEY';

      const imageNodeId = pickEnvValue(imageNodeIdKey) ?? '1';
      const imageParamKey = pickEnvValue(imageParamKeyKey) ?? 'image';

      const base64 = stripDataUrlBase64Prefix(imageDataUrl.trim());
      mappedImageNodeId = imageNodeId;
      mappedImageParamKey = imageParamKey;
      imageBase64Length = base64.length;
      imageBase64Prefix = base64.slice(0, 24);

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
        pickEnvValue(`RUNNINGHUB_DEFAULT_PROMPT${suffix}`) ?? pickEnvValue('RUNNINGHUB_DEFAULT_PROMPT') ?? '';
      const prompt = promptFromClient || promptFromEnv;
      if (prompt) {
        const promptNodeIdKey = pickEnvValue(`RUNNINGHUB_PROMPT_NODE_ID${suffix}`)
          ? `RUNNINGHUB_PROMPT_NODE_ID${suffix}`
          : 'RUNNINGHUB_PROMPT_NODE_ID';
        const promptParamKeyKey = pickEnvValue(`RUNNINGHUB_PROMPT_PARAM_KEY${suffix}`)
          ? `RUNNINGHUB_PROMPT_PARAM_KEY${suffix}`
          : 'RUNNINGHUB_PROMPT_PARAM_KEY';

        const promptNodeId = pickEnvValue(promptNodeIdKey) ?? '4';
        const promptParamKey = pickEnvValue(promptParamKeyKey) ?? 'prompt';
        mappedPromptNodeId = promptNodeId;
        mappedPromptParamKey = promptParamKey;

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

    const payload = {
      nodeInfoList
    };
    if (addMetadata !== null) payload.addMetadata = addMetadata;
    if (usePersonalQueue !== null) payload.usePersonalQueue = usePersonalQueue;
    if (instanceType) payload.instanceType = instanceType;
    if (webhookUrl) payload.webhookUrl = webhookUrl;

    const upstreamBodyText = JSON.stringify(payload);

    const nodeInfoListSummary = (nodeInfoList ?? []).map((it) => ({ nodeId: it.nodeId, keys: Object.keys(it.params ?? {}) }));
    const debug = {
      workflowType,
      usedSchema,
      runUrlHost,
      runUrlPath,
      clientBodyBytes: JSON.stringify(bodyJson ?? {}).length,
      upstreamBodyBytes: upstreamBodyText.length,
      nodeInfoListSummary,
      mappedImageNodeId,
      mappedImageParamKey,
      mappedPromptNodeId,
      mappedPromptParamKey,
      imageBase64Length,
      imageBase64Prefix
    };

    console.log('[runninghub/run] start', debug);

    const altRunUrl = (() => {
      if (!runUrlHost || !runUrlPath) return null;
      if (runUrlHost === 'www.runninghub.cn') return `https://api.runninghub.cn${runUrlPath}`;
      if (runUrlHost === 'api.runninghub.cn') return `https://www.runninghub.cn${runUrlPath}`;
      return null;
    })();

    const candidates = [runUrl, altRunUrl].filter(Boolean);
    const attempts = [];

    let resp = null;
    for (const url of candidates) {
      try {
        const r = await fetch(url, {
          method: 'POST',
          headers: runningHubHeaders(apiKey),
          body: upstreamBodyText
        });

        attempts.push({ url, status: r.status });

        // 401 很可能是域名/网关不接受 OpenAPI Key（例如 www 站点域名）。遇到 401 则尝试备用域名。
        if (r.status === 401 && candidates.length > 1) {
          continue;
        }

        resp = r;
        break;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        attempts.push({ url, error: message });
        continue;
      }
    }

    if (!resp) {
      const lastErr = attempts.slice().reverse().find((a) => a.error)?.error ?? 'network-error';
      console.log('[runninghub/run] network error', { lastErr, attempts });
      return res.status(502).json({
        error: 'runninghub-network',
        message: lastErr,
        attempts,
        hint:
          '到 RunningHub 的网络连接中断。可尝试设置 RUNNINGHUB_API_BASE（例如 https://api.runninghub.cn 或 https://www.runninghub.cn），并优先使用 OpenAPI Key。',
        debug
      });
    }

    if (resp.status === 401) {
      console.log('[runninghub/run] unauthorized', { attempts });
    }

    let text = '';
    try {
      text = await resp.text();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log('[runninghub/run] read-body error', { message, attempts, status: resp.status });
      return res.status(502).json({
        error: 'runninghub-network',
        message,
        attempts,
        hint:
          '上游连接在读取响应体时中断（常见于跨境链路/网关限流）。建议改用 OpenAPI Key + api.runninghub.cn，避免使用网页登录态/上传签名接口。',
        debug
      });
    }

    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }

    if (!resp.ok) {
      console.log('[runninghub/run] upstream not ok', {
        upstreamStatus: resp.status,
        usedSchema,
        upstreamBodyBytes: text.length,
        bodyPreview: previewForLog(text)
      });
      const upstreamContentType = resp.headers.get('content-type');
      return res.status(resp.status).json({
        error: 'runninghub-error',
        upstreamStatus: resp.status,
        upstreamStatusText: resp.statusText,
        upstreamContentType,
        usedSchema,
        debug,
        body: data ?? text
      });
    }

    if (!data) {
      console.log('[runninghub/run] invalid json', { bodyPreview: previewForLog(text) });
      return res.status(502).json({ error: 'runninghub-invalid-json', body: text });
    }

    if (data?.errorCode || data?.errorMessage) {
      console.log('[runninghub/run] upstream response error', {
        errorCode: data.errorCode,
        errorMessage: data.errorMessage
      });
      return res.status(502).json({ error: 'runninghub-response-error', body: data });
    }

    if (!data.taskId || !data.status) {
      console.log('[runninghub/run] invalid response', { bodyPreview: previewForLog(text) });
      return res.status(502).json({ error: 'runninghub-invalid-response', body: data });
    }

    console.log('[runninghub/run] ok', { taskId: data.taskId, status: data.status });
    return res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : '';
    const stackPreview = stack ? stack.split('\n').slice(0, 6).join('\n') : '';
    console.log('[runninghub/run] exception', { message, stackPreview });
    return res.status(500).json({ error: 'worker-exception', message, stack: stackPreview });
  }
});

app.post('/api/runninghub/query', async (req, res) => {
  try {
    const apiKey = pickEnvValue('RUNNINGHUB_API_KEY');
    const queryUrl = pickEnvValue('RUNNINGHUB_QUERY_URL') ?? 'https://www.runninghub.cn/openapi/v2/query';

    if (!apiKey) return res.status(500).json({ error: 'missing-env', key: 'RUNNINGHUB_API_KEY' });

    const taskId = req.body?.taskId;
    if (!taskId || typeof taskId !== 'string') return res.status(400).json({ error: 'missing-taskId' });

    let queryUrlHost = null;
    let queryUrlPath = null;
    try {
      const u = new URL(queryUrl);
      queryUrlHost = u.host;
      queryUrlPath = u.pathname;
    } catch {
      queryUrlHost = null;
      queryUrlPath = null;
    }

    console.log('[runninghub/query] start', { queryUrlHost, queryUrlPath, taskId });

    let resp;
    try {
      resp = await fetch(queryUrl, {
        method: 'POST',
        headers: runningHubHeaders(apiKey),
        body: JSON.stringify({ taskId })
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log('[runninghub/query] network error', { message });
      return res.status(502).json({ error: 'runninghub-network', message });
    }

    let text = '';
    try {
      text = await resp.text();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log('[runninghub/query] read-body error', { message, status: resp.status });
      return res.status(502).json({ error: 'runninghub-network', message });
    }

    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }

    if (!resp.ok) {
      console.log('[runninghub/query] upstream not ok', {
        upstreamStatus: resp.status,
        bodyPreview: previewForLog(text)
      });
      return res.status(resp.status).json({
        error: 'runninghub-error',
        upstreamStatus: resp.status,
        body: data ?? text
      });
    }

    if (!data) {
      console.log('[runninghub/query] invalid json', { bodyPreview: previewForLog(text) });
      return res.status(502).json({ error: 'runninghub-invalid-json', body: text });
    }

    if (data?.errorCode || data?.errorMessage) {
      console.log('[runninghub/query] upstream response error', {
        errorCode: data.errorCode,
        errorMessage: data.errorMessage
      });
      return res.status(502).json({ error: 'runninghub-response-error', body: data });
    }

    if (!data.taskId || !data.status) {
      console.log('[runninghub/query] invalid response', { bodyPreview: previewForLog(text) });
      return res.status(502).json({ error: 'runninghub-invalid-response', body: data });
    }

    console.log('[runninghub/query] ok', { taskId: data.taskId, status: data.status });
    return res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : '';
    const stackPreview = stack ? stack.split('\n').slice(0, 6).join('\n') : '';
    console.log('[runninghub/query] exception', { message, stackPreview });
    return res.status(500).json({ error: 'worker-exception', message, stack: stackPreview });
  }
});

app.get('/healthz', (_req, res) => {
  return res.json({ ok: true });
});

const port = Number(pickEnvValue('PORT') ?? '8788');
const host = pickEnvValue('HOST') ?? '127.0.0.1';

app.listen(port, host, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] listening on http://${host}:${port}`);
});
