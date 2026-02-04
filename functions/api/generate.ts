interface RequestBody {
  imageDataUrl?: string;
  analysis?: unknown;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

export const onRequestPost = async ({ request }: { request: Request }) => {
  const body = (await request.json().catch(() => ({}))) as RequestBody;
  if (!body.imageDataUrl || typeof body.imageDataUrl !== 'string') {
    return json({ error: 'missing-image' }, { status: 400 });
  }

  for (let i = 0; i < 10; i += 1) {
    await sleep(200 + Math.random() * 300);
  }

  return json({
    generatedUrl: body.imageDataUrl
  });
};
