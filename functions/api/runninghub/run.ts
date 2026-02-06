interface RunWorkflowResponse {
  taskId?: string;
  status?: string;
  errorCode?: string;
  errorMessage?: string;
  results?: unknown;
  clientId?: string;
  promptTips?: string;
}

interface UploadImageResponse {
  fileKey?: string;
  fileValue?: unknown;
  data?: {
    fileKey?: string;
    fileValue?: unknown;
    name?: string;
  };
  name?: string;
}

interface ClientRunRequestBody {
  workflowType?: string;
  addMetadata?: unknown;
  nodeInfoList?: unknown;
  instanceType?: unknown;
  usePersonalQueue?: unknown;
  webhookUrl?: unknown;
  prompt?: unknown;
  imageDataUrl?: unknown;
  // when using multipart: other fields come from FormData
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

function validateWorkflowRunUrl(url: string) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return { ok: false as const, reason: 'protocol-not-https', host: u.host, path: u.pathname };

    const okPath =
      u.pathname.startsWith('/run/workflow/') ||
      u.pathname.startsWith('/openapi/v2/run/workflow/') ||
      u.pathname.startsWith('/call-api/run/workflow/');

    if (!okPath) {
      return { ok: false as const, reason: 'path-not-workflow', host: u.host, path: u.pathname };
    }

    return { ok: true as const, host: u.host, path: u.pathname };
  } catch {
    return { ok: false as const, reason: 'invalid-url' };
  }
}


function safeHostPath(rawUrl: string) {
  try {
    const u = new URL(rawUrl);
    return { host: u.host, path: u.pathname };
  } catch {
    return { host: null as string | null, path: null as string | null };
  }
}

function hasRhQuery(rawUrl: string) {
  try {
    const u = new URL(rawUrl);
    for (const k of u.searchParams.keys()) {
      if (/^Rh-/i.test(k)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

function parseUploadResponse(data: UploadImageResponse | null) {
  const d = (data ?? {}) as UploadImageResponse;

  const fileKey =
    typeof d.fileKey === 'string' && d.fileKey.trim()
      ? d.fileKey.trim()
      : typeof d.data?.fileKey === 'string' && d.data.fileKey.trim()
        ? d.data.fileKey.trim()
        : '';

  const fileValue = Object.prototype.hasOwnProperty.call(d, 'fileValue')
    ? d.fileValue
    : d.data && Object.prototype.hasOwnProperty.call(d.data, 'fileValue')
      ? d.data.fileValue
      : d;

  const finalKey =
    fileKey ||
    (typeof d.name === 'string'
      ? d.name
      : typeof d.data?.name === 'string'
        ? d.data.name
        : '');

  return { fileKey: finalKey, fileValue };
}

function resolveUploadedFieldValue(
  uploaded: { fileKey: string; fileValue: unknown },
  env: Record<string, unknown>,
  workflowType: string | null
) {
  const suffix = workflowType ? `_${workflowType}` : '';
  const mode =
    (pickEnvValue(env, `RUNNINGHUB_FILEVALUE_MODE${suffix}`) ?? pickEnvValue(env, 'RUNNINGHUB_FILEVALUE_MODE') ?? 'auto')
      .trim()
      .toLowerCase();

  const fv = uploaded.fileValue;
  const fk = uploaded.fileKey;

  if (mode === 'filekey' || mode === 'file_key') return fk;
  if (mode === 'filevalue' || mode === 'file_value') return fv;

  // auto：优先 fileKey（更稳定），其次 fileValue.name/full/url
  if (fv && typeof fv === 'object') {
    const o = fv as Record<string, unknown>;
    const name = typeof o.name === 'string' ? o.name.trim() : '';
    if (name) return name;
    const full = typeof o.full === 'string' ? o.full.trim() : '';
    if (full) return full;
    const url = typeof o.url === 'string' ? o.url.trim() : '';
    if (url) return url;
  }

  if (typeof fv === 'string' && fv.trim()) return fv.trim();
  return fk;
}

async function uploadImageToRunningHub(options: {
  file: File;
  apiKey: string;
  env: Record<string, unknown>;
  workflowType: string | null;
}) {
  const { file, apiKey, env, workflowType } = options;
  const suffix = workflowType ? `_${workflowType}` : '';

  const uploadUrl =
    pickEnvValue(env, `RUNNINGHUB_UPLOAD_URL${suffix}`) ??
    pickEnvValue(env, 'RUNNINGHUB_UPLOAD_URL') ??
    'https://www.runninghub.cn/openapi/v2/upload/image';

  const uploadField =
    pickEnvValue(env, `RUNNINGHUB_UPLOAD_FIELD${suffix}`) ??
    pickEnvValue(env, 'RUNNINGHUB_UPLOAD_FIELD') ??
    'image';

  const explicitUseBearer =
    pickEnvValue(env, `RUNNINGHUB_UPLOAD_USE_BEARER${suffix}`) ?? pickEnvValue(env, 'RUNNINGHUB_UPLOAD_USE_BEARER');

  const useBearer = (() => {
    if (explicitUseBearer) return explicitUseBearer.trim().toLowerCase() === 'true';
    return !hasRhQuery(uploadUrl);
  })();

  const hp = safeHostPath(uploadUrl);
  console.log('[runninghub/run] upload start', {
    workflowType,
    uploadUrlHost: hp.host,
    uploadUrlPath: hp.path,
    useBearer,
    fileSize: file.size,
    fileType: file.type
  });

  const upstreamForm = new FormData();
  upstreamForm.append(uploadField, file, file.name || 'image');

  const headers: Record<string, string> = {
    accept: 'application/json'
  };
  if (useBearer) {
    headers.Authorization = `Bearer ${apiKey}`;
    headers['X-API-KEY'] = apiKey;
  }

  let resp: Response;
  try {
    resp = await fetch(uploadUrl, {
      method: 'POST',
      headers,
      body: upstreamForm
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const e = {
      error: 'runninghub-network',
      stage: 'upload',
      message,
      uploadUrlHost: hp.host,
      uploadUrlPath: hp.path
    };
    console.log('[runninghub/run] upload network error', e);
    throw Object.assign(new Error('upload-network'), e);
  }

  const text = await resp.text();
  let data: UploadImageResponse | null = null;
  try {
    data = JSON.parse(text) as UploadImageResponse;
  } catch {
    data = null;
  }

  if (!resp.ok) {
    const e = {
      error: 'runninghub-error',
      stage: 'upload',
      upstreamStatus: resp.status,
      uploadUrlHost: hp.host,
      uploadUrlPath: hp.path,
      body: data ?? text
    };
    console.log('[runninghub/run] upload upstream not ok', {
      upstreamStatus: resp.status,
      uploadUrlHost: hp.host,
      uploadUrlPath: hp.path,
      bodyBytes: text.length
    });
    throw Object.assign(new Error('upload-upstream'), e);
  }

  const parsed = parseUploadResponse(data);
  if (!parsed.fileKey) {
    const e = {
      error: 'runninghub-invalid-response',
      stage: 'upload',
      uploadUrlHost: hp.host,
      uploadUrlPath: hp.path
    };
    console.log('[runninghub/run] upload invalid response', e);
    throw Object.assign(new Error('upload-invalid-response'), e);
  }

  return parsed;
}

export const onRequestPost = async ({ request, env }: { request: Request; env: Record<string, unknown> }) => {
  try {
    const apiKey = pickEnvValue(env, 'RUNNINGHUB_API_KEY');
    if (!apiKey) return json({ error: 'missing-env', key: 'RUNNINGHUB_API_KEY' }, { status: 500 });

    const contentType = request.headers.get('content-type') || '';
    const isMultipart = contentType.toLowerCase().includes('multipart/form-data');

    let rawBodyBytes = 0;
    let src: Record<string, unknown> = {};
    let incomingFile: File | null = null;

    if (isMultipart) {
      const form = await request.formData();
      const file = form.get('file');
      incomingFile = file instanceof File ? file : null;

      // flatten scalar fields
      for (const [k, v] of form.entries()) {
        if (k === 'file') continue;
        if (typeof v === 'string') src[k] = v;
      }

      rawBodyBytes = 0;
    } else {
      const rawBody = await request.text();
      rawBodyBytes = rawBody.length;
      let bodyJson: ClientRunRequestBody | null = null;
      try {
        bodyJson = JSON.parse(rawBody) as ClientRunRequestBody;
      } catch {
        bodyJson = null;
      }
      src = (bodyJson ?? {}) as Record<string, unknown>;
    }

    const workflowType = normalizeWorkflowType(src.workflowType);
    const suffix = workflowType ? `_${workflowType}` : '';
    const workflowId = pickEnvValue(env, `RUNNINGHUB_WORKFLOW_ID${suffix}`) ?? pickEnvValue(env, 'RUNNINGHUB_WORKFLOW_ID');
    const runUrlOverride =
      pickEnvValue(env, `RUNNINGHUB_WORKFLOW_RUN_URL${suffix}`) ?? pickEnvValue(env, 'RUNNINGHUB_WORKFLOW_RUN_URL');

    if (!runUrlOverride && !workflowId) {
      return json({ error: 'missing-env', key: 'RUNNINGHUB_WORKFLOW_ID' }, { status: 500 });
    }

    const apiBase = pickEnvValue(env, 'RUNNINGHUB_API_BASE') ?? 'https://api.runninghub.cn';
    const defaultRunUrl = `${apiBase.replace(/\/$/, '')}/run/workflow/${workflowId}`;
    const runUrl = runUrlOverride ?? defaultRunUrl;

    // 防止把 RUNNINGHUB_WORKFLOW_RUN_URL 误配成 /upload/image 之类的非工作流接口
    if (runUrlOverride) {
      const v = validateWorkflowRunUrl(runUrlOverride);
      if (!v.ok) {
        return json(
          {
            error: 'invalid-env',
            key: 'RUNNINGHUB_WORKFLOW_RUN_URL',
            reason: v.reason,
            host: 'host' in v ? v.host : null,
            path: 'path' in v ? v.path : null,
            expectedExample: defaultRunUrl
          },
          { status: 500 }
        );
      }
    }

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

    // RunningHub 工作流接口要求 nodeInfoList 非空，且每项包含 nodeId + params。
    type NodeInfoItem = { nodeId: string; params: Record<string, unknown> };
    const rawNodeInfoList = src.nodeInfoList;
    let nodeInfoList: NodeInfoItem[] | null = null;
    let usedSchema: 'client-nodeInfoList' | 'env-mapped-image' | 'env-mapped-file' = 'client-nodeInfoList';

    // debug meta (do NOT include large payloads or secrets)
    let mappedImageNodeId: string | null = null;
    let mappedImageParamKey: string | null = null;
    let mappedImageParamMode: string | null = null;
    let mappedPromptNodeId: string | null = null;
    let mappedPromptParamKey: string | null = null;
    let imageBase64Length: number | null = null;
    let imageBase64Prefix: string | null = null;
    let uploadUrlHost: string | null = null;
    let uploadUrlPath: string | null = null;
    let uploadUsedBearer: boolean | null = null;
    let uploadedFileKeyPreview: string | null = null;

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

    // 前端未填 nodeInfoList 时：支持两种自动映射
    // - multipart: file → upload → file ref
    // - json: imageDataUrl → base64
    if (!nodeInfoList) {
      const imageNodeIdKey = pickEnvValue(env, `RUNNINGHUB_IMAGE_NODE_ID${suffix}`) ? `RUNNINGHUB_IMAGE_NODE_ID${suffix}` : 'RUNNINGHUB_IMAGE_NODE_ID';
      const imageParamKeyKey = pickEnvValue(env, `RUNNINGHUB_IMAGE_PARAM_KEY${suffix}`)
        ? `RUNNINGHUB_IMAGE_PARAM_KEY${suffix}`
        : 'RUNNINGHUB_IMAGE_PARAM_KEY';

      const imageNodeId = pickEnvValue(env, imageNodeIdKey) ?? '1';
      const imageParamKey = pickEnvValue(env, imageParamKeyKey) ?? 'image';
      mappedImageNodeId = imageNodeId;
      mappedImageParamKey = imageParamKey;

      if (incomingFile) {
        usedSchema = 'env-mapped-file';

        // 通过上传拿到 fileKey/fileValue，并在本次 run 中直接引用（不下发到前端）
        const uploadUrl =
          pickEnvValue(env, `RUNNINGHUB_UPLOAD_URL${suffix}`) ??
          pickEnvValue(env, 'RUNNINGHUB_UPLOAD_URL') ??
          'https://www.runninghub.cn/openapi/v2/upload/image';
        const uploadHp = safeHostPath(uploadUrl);
        uploadUrlHost = uploadHp.host;
        uploadUrlPath = uploadHp.path;
        uploadUsedBearer = (() => {
          const explicitUseBearer =
            pickEnvValue(env, `RUNNINGHUB_UPLOAD_USE_BEARER${suffix}`) ?? pickEnvValue(env, 'RUNNINGHUB_UPLOAD_USE_BEARER');
          if (explicitUseBearer) return explicitUseBearer.trim().toLowerCase() === 'true';
          return !hasRhQuery(uploadUrl);
        })();

        const uploaded = await uploadImageToRunningHub({ file: incomingFile, apiKey, env, workflowType });
        uploadedFileKeyPreview = uploaded.fileKey ? `${uploaded.fileKey.slice(0, 6)}...(${uploaded.fileKey.length})` : null;

        const injectedValue = resolveUploadedFieldValue(uploaded, env, workflowType);

        const paramMode =
          (pickEnvValue(env, `RUNNINGHUB_IMAGE_PARAM_MODE${suffix}`) ?? pickEnvValue(env, 'RUNNINGHUB_IMAGE_PARAM_MODE') ?? 'file')
            .trim()
            .toLowerCase();
        mappedImageParamMode = paramMode;

        const params =
          paramMode === 'direct'
            ? { [imageParamKey]: injectedValue }
            : { fileKey: imageParamKey, fileValue: injectedValue };

        nodeInfoList = [{ nodeId: imageNodeId, params }];
      } else {
        const imageDataUrl = src.imageDataUrl;
        if (typeof imageDataUrl !== 'string' || !imageDataUrl.trim()) {
          return json(
            {
              error: 'missing-nodeInfoList',
              hint:
                'RunningHub 工作流接口要求 nodeInfoList 非空；你当前发布项需要先上传图片：请使用 multipart/form-data（字段名 file）调用 /api/runninghub/run，或提供 nodeInfoList。'
            },
            { status: 400 }
          );
        }

        usedSchema = 'env-mapped-image';

        const base64 = stripDataUrlBase64Prefix(imageDataUrl.trim());
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
      }

      // optional prompt injection
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

    const payload: Record<string, unknown> = {
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
      isMultipart,
      clientBodyBytes: rawBodyBytes,
      upstreamBodyBytes: upstreamBodyText.length,
      nodeInfoListSummary,
      mappedImageNodeId,
      mappedImageParamKey,
      mappedImageParamMode,
      mappedPromptNodeId,
      mappedPromptParamKey,
      imageBase64Length,
      imageBase64Prefix,
      uploadUrlHost,
      uploadUrlPath,
      uploadUsedBearer,
      uploadedFileKeyPreview
    };

    console.log('[runninghub/run] start', debug);

    const buildRunCandidates = () => {
      const out: string[] = [];
      const add = (u: string | null) => {
        if (!u) return;
        if (out.includes(u)) return;
        out.push(u);
      };

      const addGatewayByHost = (host: string, id: string) => {
        add(`https://${host}/openapi/v2/run/workflow/${id}`);
        add(`https://${host}/call-api/run/workflow/${id}`);
      };

      const parseHostsFromEnv = (value: string | null) => {
        if (!value) return [];
        return value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => s.replace(/^https?:\/\//i, '').replace(/\/$/, ''));
      };

      // primary
      add(runUrl);

      // swap host with same path
      if (runUrlHost && runUrlPath) {
        if (runUrlHost === 'www.runninghub.cn') add(`https://api.runninghub.cn${runUrlPath}`);
        if (runUrlHost === 'api.runninghub.cn') add(`https://www.runninghub.cn${runUrlPath}`);

        // if currently using /run/workflow/:id, also try OpenAPI gateway path
        if (runUrlPath.startsWith('/run/workflow/')) {
          add(`https://${runUrlHost}/openapi/v2${runUrlPath}`);
          add(`https://${runUrlHost}/call-api${runUrlPath}`);
        }
      }

      // common gateways by workflowId (avoid relying on RUNNINGHUB_API_BASE)
      // + 国际版候选入口（默认加入 runninghub.ai；也可用 env 扩展）
      if (workflowId) {
        // CN
        addGatewayByHost('www.runninghub.cn', workflowId);
        addGatewayByHost('api.runninghub.cn', workflowId);

        // Global / International
        addGatewayByHost('www.runninghub.ai', workflowId);
        addGatewayByHost('api.runninghub.ai', workflowId);

        // optional extra hosts, comma-separated, e.g. "www.runninghub.io,api.runninghub.io"
        const extraHosts = parseHostsFromEnv(pickEnvValue(env, `RUNNINGHUB_RUN_HOSTS${suffix}`) ?? pickEnvValue(env, 'RUNNINGHUB_RUN_HOSTS'));
        for (const h of extraHosts) addGatewayByHost(h, workflowId);
      }

      return out;
    };


    const candidates = buildRunCandidates();
    const attempts: Array<{ url: string; status?: number; error?: string }> = [];


    let resp: Response | null = null;
    for (const url of candidates) {
      try {
        const r = await fetch(url, {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'X-API-KEY': apiKey
          },
          body: upstreamBodyText
        });

        attempts.push({ url, status: r.status });

        // 401：网关不接受 OpenAPI Key；530/404：可能是网关/路径不可用（例如 Cloudflare 1016）。都尝试备用入口。
        if ((r.status === 401 || r.status === 404 || r.status === 530) && candidates.length > 1) {
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
      return json(
        {
          error: 'runninghub-network',
          message: lastErr,
          attempts,
          hint:
            'Cloudflare 到 RunningHub 的网络连接中断。可尝试在 Pages 环境变量中设置 RUNNINGHUB_API_BASE（例如 https://api.runninghub.cn 或 https://www.runninghub.cn）后重新部署。',
          debug
        },
        { status: 502 }
      );
    }

    // 如果第一条命中的是 401，说明 Key 可能不是 OpenAPI Key，或该域名不支持该鉴权。
    if (resp.status === 401) {
      console.log('[runninghub/run] unauthorized', { attempts });
    }

    let text = '';
    try {
      text = await resp.text();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log('[runninghub/run] read-body error', { message, attempts, status: resp.status });
      return json(
        {
          error: 'runninghub-network',
          message,
          attempts,
          hint:
            '上游连接在读取响应体时中断（常见于跨境链路/网关限流）。建议改用 OpenAPI Key + api.runninghub.cn，避免使用网页登录态/上传签名接口。',
          debug
        },
        { status: 502 }
      );
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
        upstreamBodyBytes: text.length,
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
          debug,
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
  } catch (err) {
    // normalize thrown objects from upload stage
    if (err && typeof err === 'object') {
      const e = err as Record<string, unknown>;
      if (typeof e.error === 'string' && typeof e.stage === 'string') {
        // 安全：此处不要回传任何 URL query、也不要回传上传返回体（可能包含临时签名）
        return json(
          {
            error: e.error,
            stage: e.stage,
            upstreamStatus: e.upstreamStatus ?? null,
            uploadUrlHost: e.uploadUrlHost ?? null,
            uploadUrlPath: e.uploadUrlPath ?? null,
            message: typeof e.message === 'string' ? e.message : 'upload-failed'
          },
          { status: 502 }
        );
      }
    }

    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : '';
    const stackPreview = stack ? stack.split('\n').slice(0, 6).join('\n') : '';
    console.log('[runninghub/run] exception', { message, stackPreview });
    return json({ error: 'worker-exception', message, stack: stackPreview }, { status: 500 });
  }
};
