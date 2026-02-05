export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(url, init);
  if (!resp.ok) {
    let text = '';
    try {
      text = await resp.text();
    } catch {
      text = '';
    }

    let jsonBody: unknown = null;
    if (text) {
      try {
        jsonBody = JSON.parse(text) as unknown;
      } catch {
        jsonBody = null;
      }
    }

    if (jsonBody && typeof jsonBody === 'object' && 'error' in jsonBody) {
      const serialized = (() => {
        try {
          return JSON.stringify(jsonBody);
        } catch {
          return '';
        }
      })();
      throw new Error(serialized || `HTTP_${resp.status} ${url}`);
    }

    const concise = text ? text.slice(0, 500) : '';
    throw new Error(concise || `HTTP_${resp.status} ${url}`);
  }
  const data = (await resp.json()) as T;
  return data;
}
