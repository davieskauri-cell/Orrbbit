import { getSessionToken } from "@/src/lib/session";

const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;

type Options = {
  method?: string;
  body?: any;
  token?: string | null;
};

export async function api<T = any>(path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const tok = opts.token !== undefined ? opts.token : getSessionToken();
  if (tok) headers["Authorization"] = `Bearer ${tok}`;

  const res = await fetch(`${BASE}${path}`, {
    method: opts.method || "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null; // non-JSON body (proxy/HTML error page) — fall through to status handling
  }

  if (!res.ok) {
    let message = (data && (data.detail || data.message)) || `Request failed (${res.status})`;
    if (message === "EMAIL_VERIFICATION_REQUIRED") {
      message = "Please verify your email address to continue.";
    }
    throw new Error(typeof message === "string" ? message : "Request failed");
  }
  return data as T;
}
