const BASE = '/api';

async function request(url, options = {}) {
  const res = await fetch(`${BASE}${url}`, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || body.errors?.join(', ') || `HTTP ${res.status}`);
  }
  return res.json();
}

export const fetchMonths = () => request('/months');

export const fetchDashboard = (monthId) => request(`/months/${monthId}/dashboard`);

export const fetchHistory = () => request('/months/history/all');

export const updateMonth = (monthId, data) =>
  request(`/months/${monthId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

export const deleteMonth = (monthId) =>
  request(`/months/${monthId}`, { method: 'DELETE' });

export const fetchTransactions = (params = {}) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null))
  ).toString();
  return request(`/transactions${qs ? '?' + qs : ''}`);
};

export const setCardOwner = (credit_card_name, bank, owner) =>
  request('/card-owners', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credit_card_name, bank, owner }),
  });

export const tagTransaction = (txId, tag, permanent = false, tag_note = '') =>
  request(`/transactions/${txId}/tag`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag, permanent, tag_note }),
  });


export const getMonthFileDownloadUrl = (monthId, bank) =>
  `${BASE}/months/${monthId}/files/${bank}/download`;

export const deleteMonthFile = (monthId, bank) =>
  request(`/months/${monthId}/files/${bank}`, { method: 'DELETE' });

export async function replaceMonthFile(monthId, bank, file) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${BASE}/months/${monthId}/files/${bank}`, { method: 'POST', body: fd });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function uploadCreditCardFile(file, cardName = '', owner = 'joint', period = '') {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('card_name', cardName);
  fd.append('owner', owner);
  fd.append('period', period);
  const res = await fetch(`${BASE}/credit-cards/upload`, { method: 'POST', body: fd });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const updateCCFileMeta = (id, cardName, owner, period = '') =>
  request(`/credit-cards/files/${id}/meta`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ card_name: cardName, owner, period }),
  });

export const fetchCCFiles = () => request('/credit-cards/files');

export const deleteCCFile = (id) => request(`/credit-cards/files/${id}`, { method: 'DELETE' });

export async function replaceCCFile(id, file) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${BASE}/credit-cards/files/${id}/replace`, { method: 'POST', body: fd });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const getCCFileDownloadUrl = (id) => `${BASE}/credit-cards/files/${id}/download`;

export const tagCCTransaction = (txId, tag, permanent = false, tag_note = '') =>
  request(`/credit-cards/transactions/${txId}/tag`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag, permanent, tag_note }),
  });

export const fetchCCFileTransactions = (uploadId) =>
  request(`/credit-cards/transactions?upload_id=${uploadId}`);

export const fetchCCTransactions = (params = {}) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null))
  ).toString();
  return request(`/credit-cards/transactions${qs ? '?' + qs : ''}`);
};

export const categorizeMerchant = (merchantName) =>
  request('/categorize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ merchantName }),
  });

export const fetchPeriodSummary = () =>
  request('/insights/period-summary');

export const fetchDrillDown = (filter, period = 'all', owner = 'both') =>
  request(`/insights/drill?${new URLSearchParams({ filter, period, owner })}`);

export const fetchCategoryBreakdown = (period = 'current', owner = 'both') =>
  request(`/insights/category-breakdown?${new URLSearchParams({ period, owner })}`);

export const fetchCategoryTrend = (source = 'all') =>
  request(`/insights/category-trend?${new URLSearchParams({ source })}`);

export const overrideCategory = (merchantName, category) =>
  request('/categorize/override', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ merchantName, category }),
  });

export async function uploadFiles(formData) {
  const res = await fetch(`${BASE}/upload`, { method: 'POST', body: formData });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || (body.errors && body.errors.join('\n')) || `HTTP ${res.status}`);
  }
  return res.json();
}
