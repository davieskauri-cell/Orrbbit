let token: string | null = null;

// Web: seed synchronously from localStorage so API calls fired before the async
// AuthContext restore completes (e.g. direct URL access / refresh) are authenticated.
if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
  try {
    const raw = window.localStorage.getItem("auth_token");
    if (raw) token = JSON.parse(raw);
  } catch {}
}

export const setSessionToken = (t: string | null) => {
  token = t;
};

export const getSessionToken = () => token;
