const BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';

export const getToken = () => {
  try { return localStorage.getItem('token'); } catch { return null; }
};
export const setToken = (t) => {
  try { t ? localStorage.setItem('token', t) : localStorage.removeItem('token'); } catch { /* storage blocked */ }
};

/** Thin fetch wrapper. Throws Error with .code and .status taken from the API's { error, message }. */
export async function api(path, { method = 'GET', body } = {}) {
  const token = getToken();
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw Object.assign(new Error('Cannot reach the server. Check your connection.'), { code: 'network' });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.message || 'Request failed'), { code: data.error, status: res.status });
  return data;
}
