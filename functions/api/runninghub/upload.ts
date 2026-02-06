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

export const onRequestPost = async ({ request, env }: { request: Request; env: Record<string, unknown> }) => {
  try {
    const apiKey = pickEnvValue(env, 'RUNNINGHUB_API_KEY');
    if (!apiKey) return json({ error: 'missing-env', key: 'RUNNINGHUB_API_KEY' }, { status: 500 });

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('multipart/form-data')) {
      return json({ error: 'bad-request', hint: '请使用 multipart/form-data 上传图片（字段名：file）' }, { status: 400 });
    }

    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return json({ error: 'missing-file', hint: 'form-data 缺少 file 字段' }, { status: 400 });
    }

    const workflowType = normalizeWorkflowType(form.get('workflowType'));
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

    const uploadHp = safeHostPath(uploadUrl);
    console.log('[runninghub/upload] start', {
      workflowType,
      uploadUrlHost: uploadHp.host,
      uploadUrlPath: uploadHp.path,
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
      console.log('[runninghub/upload] network error', { message, uploadUrlHost: uploadHp.host, uploadUrlPath: uploadHp.path });
      return json(
        {
          error: 'runninghub-network',
          stage: 'upload',
          message,
          uploadUrlHost: uploadHp.host,
          uploadUrlPath: uploadHp.path
        },
        { status: 502 }
      );
    }

    const text = await resp.text();
    let data: UploadImageResponse | null = null;
    try {
      data = JSON.parse(text) as UploadImageResponse;
    } catch {
      data = null;
    }

    if (!resp.ok) {
      console.log('[runninghub/upload] upstream not ok', {
        upstreamStatus: resp.status,
        uploadUrlHost: uploadHp.host,
        uploadUrlPath: uploadHp.path,
        bodyBytes: text.length
      });
      return json(
        {
          error: 'runninghub-error',
          stage: 'upload',
          upstreamStatus: resp.status,
          uploadUrlHost: uploadHp.host,
          uploadUrlPath: uploadHp.path,
          body: data ?? text
        },
        { status: resp.status }
      );
    }

    const parsed = parseUploadResponse(data);
    if (!parsed.fileKey) {
      console.log('[runninghub/upload] invalid response', { uploadUrlHost: uploadHp.host, uploadUrlPath: uploadHp.path });
      return json({ error: 'runninghub-invalid-response', stage: 'upload' }, { status: 502 });
    }

    // 安全：不向前端返回 fileValue（它可能包含临时签名/URL）。前端只用 fileKey。
    return json({ ok: true, fileKey: parsed.fileKey });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : '';
    const stackPreview = stack ? stack.split('\n').slice(0, 6).join('\n') : '';
    console.log('[runninghub/upload] exception', { message, stackPreview });
    return json({ error: 'worker-exception', message, stack: stackPreview }, { status: 500 });
  }
};
