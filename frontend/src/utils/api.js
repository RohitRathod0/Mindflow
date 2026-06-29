const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export const api = {
  get: (path, config) => {
    let url = `${BASE_URL}${path}`;
    if (config?.params) {
      const qs = new URLSearchParams(config.params).toString();
      if (qs) url += `?${qs}`;
    }
    return fetch(url).then(r => r.json()).then(data => ({ data }));
  },
  post: (path, body) => fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(r => r.json()).then(data => ({ data })),
  patch: (path, body) => fetch(`${BASE_URL}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(r => r.json()).then(data => ({ data })),
  delete: (path) => fetch(`${BASE_URL}${path}`, { method: 'DELETE' }).then(r => r.json()).then(data => ({ data }))
};
