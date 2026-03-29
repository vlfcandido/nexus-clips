const API_BASE = '/api'

async function request(path, options = {}) {
  const headers = { ...options.headers }
  if (options.body) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

// Clips
export const getClips = (params = {}) => {
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
  const qs = new URLSearchParams(clean).toString()
  return request(`/clips${qs ? `?${qs}` : ''}`)
}
export const publishClip = (id) => request(`/clips/${id}/publish`, { method: 'POST' })
export const publishClipTo = (clipId, accountId) => request(`/clips/${clipId}/publish-to/${accountId}`, { method: 'POST' })
export const generateClip = (data) => request('/clips/generate', { method: 'POST', body: JSON.stringify(data) })
export const getClipComments = (id) => request(`/clips/${id}/comments`)
export const addClipComment = (id, data) => request(`/clips/${id}/comments`, { method: 'POST', body: JSON.stringify(data) })
export const cloneClip = (id, adjustments = '') => request(`/clips/${id}/clone`, { method: 'POST', body: JSON.stringify({ adjustments }) })
export const preparePublish = (clipId, accountId) => request(`/clips/${clipId}/prepare-publish/${accountId}`, { method: 'POST' })

// Templates visuais
export const getTemplates = () => request('/templates')
export const updateTemplate = (id, data) => request(`/templates/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
export const createTemplateFromNatural = (instruction, baseId = null) => request('/templates/from-natural', { method: 'POST', body: JSON.stringify({ instruction, base_template_id: baseId }) })
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

// Pipeline control
export const getPipelineStatus = () => request('/pipeline/status')
export const pausePipeline = () => request('/pipeline/pause', { method: 'POST' })
export const resumePipeline = () => request('/pipeline/resume', { method: 'POST' })

// Accounts
export const getAccounts = () => request('/accounts')
export const createAccount = (data) => request('/accounts', { method: 'POST', body: JSON.stringify(data) })
export const updateAccount = (id, data) => request(`/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
export const deleteAccount = (id) => request(`/accounts/${id}`, { method: 'DELETE' })
export const getAccountLog = (id) => request(`/accounts/${id}/log`)

// Platforms
export const getPlatforms = () => request('/platforms')
export const getClipCompatibility = (id) => request(`/clips/${id}/compatibility`)

// Prompts
export const getPrompts = () => request('/prompts')
export const updatePrompt = (id, data) => request(`/prompts/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
export const testPrompt = (id) => request(`/prompts/${id}/test`, { method: 'POST' })

// Account verification & sync
export const verifyAccount = (id) => request(`/accounts/${id}/verify`, { method: 'POST' })
export const syncAccount = (id) => request(`/accounts/${id}/sync`, { method: 'POST' })
export const diagnoseAccount = (id) => request(`/accounts/${id}/diagnose`, { method: 'POST' })
