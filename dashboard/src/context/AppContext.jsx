import { createContext, useContext, useEffect, useReducer, useCallback } from 'react'
import { getClips, getSources, getAnalytics, getTrending, getPipelineStatus } from '../api/client'

const AppContext = createContext()

const initialState = {
  clips: [],
  clipsTotal: 0,
  sources: [],
  analytics: null,
  trending: [],
  pipeline: { running: false, stats: { processed: 0, relevant: 0, errors: 0, skipped: 0, queue_size: 0 } },
  loading: true,
  currentPage: 'dashboard',
  filters: { page: 1, topic: null, category: null, published: null },
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_CLIPS':
      return { ...state, clips: action.payload.clips, clipsTotal: action.payload.total }
    case 'SET_SOURCES':
      return { ...state, sources: action.payload }
    case 'SET_ANALYTICS':
      return { ...state, analytics: action.payload }
    case 'SET_TRENDING':
      return { ...state, trending: action.payload }
    case 'SET_PIPELINE':
      return { ...state, pipeline: action.payload }
    case 'SET_LOADING':
      return { ...state, loading: action.payload }
    case 'SET_PAGE':
      return { ...state, currentPage: action.payload }
    case 'SET_FILTERS':
      return { ...state, filters: { ...state.filters, ...action.payload } }
    default:
      return state
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  const refresh = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true })
    try {
      // Carrega cada endpoint independente (um falhando nao bloqueia os outros)
      const [clipsData, sourcesData, analyticsData, trendingData, pipelineData] = await Promise.allSettled([
        getClips(state.filters),
        getSources(),
        getAnalytics(),
        getTrending(),
        getPipelineStatus(),
      ])
      if (clipsData.status === 'fulfilled') dispatch({ type: 'SET_CLIPS', payload: clipsData.value })
      if (sourcesData.status === 'fulfilled') dispatch({ type: 'SET_SOURCES', payload: sourcesData.value.sources })
      if (analyticsData.status === 'fulfilled') dispatch({ type: 'SET_ANALYTICS', payload: analyticsData.value })
      if (trendingData.status === 'fulfilled') dispatch({ type: 'SET_TRENDING', payload: trendingData.value.trends })
      if (pipelineData.status === 'fulfilled') dispatch({ type: 'SET_PIPELINE', payload: pipelineData.value })
    } catch (err) {
      console.error('Refresh error:', err)
    }
    dispatch({ type: 'SET_LOADING', payload: false })
  }, [state.filters])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 30000)
    return () => clearInterval(interval)
  }, [refresh])

  // SSE
  useEffect(() => {
    const es = new EventSource('/api/sse')
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'analytics') {
          dispatch({ type: 'SET_ANALYTICS', payload: msg.data })
        }
      } catch {}
    }
    es.onerror = () => {
      es.close()
      setTimeout(() => {}, 5000)
    }
    return () => es.close()
  }, [])

  return (
    <AppContext.Provider value={{ state, dispatch, refresh }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
