import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { HistoryBattle } from '@/lib/types'
import { fetchHistory } from '@/lib/api'

const WINNER_LABELS: Record<string, { label: string; cls: string }> = {
  A:   { label: 'A won',  cls: 'badge-accent' },
  B:   { label: 'B won',  cls: 'badge-dark' },
  tie: { label: 'Tie',    cls: 'badge-muted' },
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function HistoryPage() {
  const nav = useNavigate()
  const [battles, setBattles] = useState<HistoryBattle[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetchHistory(page)
      .then((d) => {
        setBattles(d.battles)
        setTotal(d.total)
        setError(null)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [page])

  const perPage = 20
  const totalPages = Math.max(1, Math.ceil(total / perPage))

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text">Battle History</h1>
        <button className="btn-primary" onClick={() => nav('/battle')}>
          New Battle
        </button>
      </div>

      {/* States */}
      {loading && (
        <div className="card p-12 flex items-center justify-center gap-3 text-muted">
          <span className="flex gap-1">
            {[0,1,2].map((i) => (
              <span key={i} className="h-2 w-2 rounded-full bg-border animate-bounce"
                style={{ animationDelay: `${i*0.15}s` }} />
            ))}
          </span>
          Loading…
        </div>
      )}

      {error && (
        <div className="card border-red-200 p-8 text-center space-y-3">
          <p className="font-semibold text-text">Could not load history</p>
          <p className="text-sm text-muted">{error}</p>
          <p className="text-xs text-muted">Is the backend running and Postgres connected?</p>
        </div>
      )}

      {!loading && !error && battles.length === 0 && (
        <div className="card p-16 text-center space-y-4">
          <p className="text-4xl">⚔</p>
          <p className="font-semibold text-text">No battles yet</p>
          <p className="text-sm text-muted">Run your first battle and it'll appear here.</p>
          <button className="btn-primary" onClick={() => nav('/battle')}>
            Start a Battle
          </button>
        </div>
      )}

      {!loading && !error && battles.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left">
                {['Date', 'Agent A', 'Agent B', 'Judge', 'Winner', ''].map((h) => (
                  <th key={h} className="px-5 py-3 text-xs font-bold tracking-widest text-muted uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {battles.map((b, i) => {
                const w = b.winner ? WINNER_LABELS[b.winner] : null
                return (
                  <tr
                    key={b.battle_id}
                    className={`border-b border-border last:border-0 hover:bg-surface-2 transition-colors
                      ${i % 2 === 0 ? '' : 'bg-bg/40'}`}
                  >
                    <td className="px-5 py-3.5 text-muted whitespace-nowrap">{fmt(b.created_at)}</td>
                    <td className="px-5 py-3.5 font-medium text-text">{b.agent_a_display_name}</td>
                    <td className="px-5 py-3.5 font-medium text-text">{b.agent_b_display_name}</td>
                    <td className="px-5 py-3.5 text-muted">{b.judge_model}</td>
                    <td className="px-5 py-3.5">
                      {w
                        ? <span className={`badge ${w.cls}`}>{w.label}</span>
                        : <span className="text-muted">-</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        className="text-xs text-accent hover:underline font-semibold"
                        onClick={() => nav(`/battle?id=${b.battle_id}`)}
                      >
                        View →
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted">{total} battles total</p>
          <div className="flex items-center gap-2">
            <button
              className="btn-outline btn-sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              ← Prev
            </button>
            <span className="px-3 py-1 text-muted">
              {page} / {totalPages}
            </span>
            <button
              className="btn-outline btn-sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next →
            </button>
          </div>
        </div>
      )}

    </main>
  )
}
