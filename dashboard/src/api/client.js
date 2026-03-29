const API_BASE = '/api'

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

// Clips
export const getClips = (params = {}) => {
  const qs = new URLSearchParams(params).toString()
  return request(`/clips?${qs}`)
}
export const publishClip = (id) => request(`/clips/${id}/publish`, { method: 'POST' })
export const deleteClip = (id) => request(`/clips/${id}`, { method: 'DELETE' })

// Sources
export const getSources = () => request('/sources')
export const addSource = (data) => request('/sources', { method: 'POST', body: JSON.stringify(data) })
export const removeSource = (id) => request(`/sources/${id}`, { method: 'DELETE' })
export const toggleSource = (id) => request(`/sources/${id}/toggle`, { method: 'PATCH' })

// Trending
export const getTrending = () => request('/trending')

// Analytics
export const getAnalytics = () => request('/analytics')

// Settings
export const getSettings = () => request('/settings')
export const updateSettings = (data) => request('/settings', { method: 'PATCH', body: JSON.stringify(data) })
