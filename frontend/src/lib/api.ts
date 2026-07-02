const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;

type Options = {
  method?: string;
  body?: any;
  token?: string | null;
};

export async function api<T = any>(path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;

  const res = await fetch(`${BASE}${path}`, {
    method: opts.method || "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message = (data && (data.detail || data.message)) || "Something went wrong";
    throw new Error(typeof message === "string" ? message : "Request failed");
  }
  return data as T;
}
