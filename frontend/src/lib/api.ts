import type { ModelInfo, StrategyInfo, HistoryBattle, SharedBattle } from './types'

const BASE = import.meta.env.VITE_API_URL ?? ''
const API_URL = BASE

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('af_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function get<T>(path: string, auth = false): Promise<T> {
  const res = await fetch(`${BASE}${path}`, auth ? { headers: authHeaders() } : {})
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

export async function fetchModels(tier?: 'FREE' | 'PAID'): Promise<ModelInfo[]> {
  const qs = tier ? `?tier=${tier}` : ''
  const data = await get<{ models: ModelInfo[] }>(`/api/models${qs}`)
  return data.models
}

export async function fetchStrategies(): Promise<StrategyInfo[]> {
  const data = await get<{ strategies: StrategyInfo[] }>('/api/strategies')
  return data.strategies
}

export async function fetchHistory(page = 1, perPage = 20) {
  return get<{ battles: HistoryBattle[]; total: number; page: number; per_page: number }>(
    `/api/battles?page=${page}&per_page=${perPage}`,
    true,
  )
}

export async function fetchBattle(id: string): Promise<SharedBattle> {
  return get<SharedBattle>(`/api/battles/${id}`, true)
}

export async function uploadFile(file: File): Promise<{ text: string; chars: number }> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${API_URL}/api/upload/file`, { method: 'POST', body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? 'Upload failed')
  }
  return res.json()
}

export async function uploadUrl(url: string): Promise<{ text: string; chars: number }> {
  const res = await fetch(`${API_URL}/api/upload/url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? 'Fetch failed')
  }
  return res.json()
}
