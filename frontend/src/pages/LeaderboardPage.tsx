import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

interface LeaderboardEntry {
  model_key: string
  model_display_name: string
  total: number
  wins: number
  ties: number
  losses: number
  win_rate: number
}

const BASE = import.meta.env.VITE_API_URL ?? ''

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${BASE}/api/leaderboard`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
        return r.json()
      })
      .then((d) => {
        if (!Array.isArray(d.leaderboard)) throw new Error('Unexpected response from server')
        setData(d.leaderboard)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const maxWins = Math.max(...data.map((d) => d.wins), 1)

  return (
    <main className="mx-auto max-w-3xl px-6 py-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text">Leaderboard</h1>
          <p className="text-xs text-muted mt-0.5">Win rates across all battles</p>
        </div>
        <Link to="/battle" className="btn-accent btn-sm">Start a Battle</Link>
      </div>

      {loading && (
        <div className="card p-12 flex items-center justify-center gap-3 text-muted">
          <span className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-2 w-2 rounded-full bg-border animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </span>
          Loading…
        </div>
      )}

      {error && (
        <div className="card border-red-200 p-8 text-center space-y-2">
          <p className="text-2xl">⚠</p>
          <p className="text-sm text-muted">{error}</p>
        </div>
      )}

      {!loading && !error && data.length === 0 && (
        <div className="card p-10 text-center space-y-3">
          <p className="text-2xl">🏆</p>
          <p className="font-semibold text-text">No battles yet</p>
          <p className="text-sm text-muted">Run some battles to populate the leaderboard.</p>
          <Link to="/battle" className="btn-accent inline-block">Start a Battle</Link>
        </div>
      )}

      {!loading && !error && data.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2">
                <th className="text-left px-5 py-3 text-xs font-bold tracking-widest text-muted uppercase w-8">#</th>
                <th className="text-left px-5 py-3 text-xs font-bold tracking-widest text-muted uppercase">Model</th>
                <th className="text-right px-4 py-3 text-xs font-bold tracking-widest text-muted uppercase">Battles</th>
                <th className="text-right px-4 py-3 text-xs font-bold tracking-widest text-muted uppercase">W</th>
                <th className="text-right px-4 py-3 text-xs font-bold tracking-widest text-muted uppercase">T</th>
                <th className="text-right px-4 py-3 text-xs font-bold tracking-widest text-muted uppercase">L</th>
                <th className="px-5 py-3 text-xs font-bold tracking-widest text-muted uppercase">Win rate</th>
              </tr>
            </thead>
            <tbody>
              {data.map((entry, i) => (
                <tr key={entry.model_key} className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors">
                  <td className="px-5 py-3.5 text-muted font-medium">{i + 1}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      {i === 0 && <span title="Leader">🥇</span>}
                      {i === 1 && <span title="2nd">🥈</span>}
                      {i === 2 && <span title="3rd">🥉</span>}
                      <span className="font-medium text-text">{entry.model_display_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right text-muted">{entry.total}</td>
                  <td className="px-4 py-3.5 text-right font-semibold text-green-600">{entry.wins}</td>
                  <td className="px-4 py-3.5 text-right text-muted">{entry.ties}</td>
                  <td className="px-4 py-3.5 text-right text-muted">{entry.losses}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-border rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full bg-accent rounded-full transition-all"
                          style={{ width: `${(entry.wins / maxWins) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-text w-10 text-right">
                        {entry.win_rate}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && data.length > 0 && (
        <p className="text-xs text-center text-muted">
          Based on {data.reduce((s, d) => s + d.total, 0)} agent appearances across all battles
        </p>
      )}
    </main>
  )
}
