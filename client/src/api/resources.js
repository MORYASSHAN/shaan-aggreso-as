import { api } from './client.js';

// One small function per endpoint. Components never call fetch directly.

export const authApi = {
  me: () => api('/auth/me'),
  login: (body) => api('/auth/login', { method: 'POST', body }),
  logout: () => api('/auth/logout', { method: 'POST' }),
};

export const postsApi = {
  feed: (query) => api('/posts', { query }),
  get: (id) => api(`/posts/${id}`),
  create: (body) => api('/posts', { method: 'POST', body: { body } }),
  comment: (postId, body) => api(`/posts/${postId}/comments`, { method: 'POST', body: { body } }),
};

export const contentApi = {
  mine: () => api('/me/content'),
  report: (id, body) => api(`/content/${id}/reports`, { method: 'POST', body }),
  history: (id) => api(`/content/${id}/history`),
};

export const casesApi = {
  queue: (query) => api('/cases', { query }),
  get: (id) => api(`/cases/${id}`),
  decide: (id, body) => api(`/cases/${id}/decisions`, { method: 'POST', body }),
  reanalyze: (id) => api(`/cases/${id}/reanalyze`, { method: 'POST' }),
  reopen: (id) => api(`/cases/${id}/reopen`, { method: 'POST' }),
};

export const appealsApi = {
  submit: (decisionId, body) => api(`/decisions/${decisionId}/appeals`, { method: 'POST', body }),
  list: (query) => api('/appeals', { query }),
  get: (id) => api(`/appeals/${id}`),
  resolve: (id, body) => api(`/appeals/${id}/resolve`, { method: 'POST', body }),
};

export const policiesApi = {
  list: () => api('/policies'),
  get: (version) => api(`/policies/${version}`),
  diff: (from, to) => api('/policies/diff', { query: { from, to } }),
  publish: (file) => api('/policies', { method: 'POST', body: file }),
  run: (id) => api(`/reevaluations/${id}`),
};

export const auditApi = {
  list: (query) => api('/audit', { query }),
};
