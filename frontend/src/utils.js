export const TOKEN_KEY = "ss_token";
export const USER_KEY  = "ss_user";

const API = "";

export function token()    { return localStorage.getItem(TOKEN_KEY); }
export function userName() { return localStorage.getItem(USER_KEY); }

export function saveAuth(tok, user) {
  localStorage.setItem(TOKEN_KEY, tok);
  localStorage.setItem(USER_KEY, user);
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function apiFetch(path, opts = {}) {
  const headers = { "Content-Type": "application/json", ...opts.headers };
  const t = token();
  if (t) headers["Authorization"] = `Bearer ${t}`;

  const res = await fetch(API + path, { ...opts, headers });

  if (res.status === 401) {
    clearAuth();
    window.location.reload();
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `${res.status}`);
  }

  return res.json();
}
