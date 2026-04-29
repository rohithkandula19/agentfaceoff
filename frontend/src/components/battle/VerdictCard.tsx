import { useRef, useState } from 'react'
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, Legend, Tooltip,
} from 'recharts'
import type { Verdict } from '@/lib/types'

interface Props {
  verdict: Verdict
  modelA: string
  modelB: string
  battleId?: string | null
  onNewBattle: () => void
  onRematch?: () => void
  isBlind?: boolean
  userVote?: 'A' | 'B' | null
}

const SCORE_DIMS = ['accuracy', 'reasoning', 'clarity', 'completeness'] as const

export default function VerdictCard({ verdict, modelA, modelB, battleId, onNewBattle, onRematch, isBlind = false, userVote = null }: Props) {
  // In blind mode, reveal model names only after the user has voted
  const revealNames = !isBlind || userVote !== null
  const displayA = revealNames ? modelA : 'Agent A'
  const displayB = revealNames ? modelB : 'Agent B'
  const [showReasoning, setShowReasoning] = useState(false)
  const [copied, setCopied] = useState(false)
  const [sharing, setSharing] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const handleShareImage = async () => {
    if (!cardRef.current) return
    setSharing(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(cardRef.current, { scale: 2, useCORS: true })
      const link = document.createElement('a')
      link.download = 'battle-verdict.png'
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (e) {
      console.error('Share failed', e)
    } finally {
      setSharing(false)
    }
  }

  const handleCopyLink = () => {
    const url = battleId
      ? `${window.location.origin}/battle?id=${battleId}`
      : window.location.href
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const radarData = SCORE_DIMS.map((dim) => ({
    dim: dim.charAt(0).toUpperCase() + dim.slice(1),
    A: verdict.scores_a[dim],
    B: verdict.scores_b[dim],
    fullMark: 10,
  }))

  const totalA = SCORE_DIMS.reduce((s, d) => s + verdict.scores_a[d], 0)
  const totalB = SCORE_DIMS.reduce((s, d) => s + verdict.scores_b[d], 0)

  const winnerLabel =
    verdict.winner === 'tie'
      ? "It's a tie"
      : verdict.winner === 'A'
      ? `Agent A wins`
      : `Agent B wins`

  const bannerBg =
    verdict.winner === 'A' ? 'bg-accent'
    : verdict.winner === 'B' ? 'bg-zinc-900'
    : 'bg-surface-2'

  const bannerText = verdict.winner !== 'tie' ? 'text-white' : 'text-text'

  return (
    <div ref={cardRef} className="card overflow-hidden animate-fade-up space-y-8">
      {/* Cinematic winner banner */}
      <div className={`${bannerBg} px-8 pt-8 pb-7 text-center space-y-1.5 relative overflow-hidden`}>
        {/* subtle radial glow */}
        {verdict.winner !== 'tie' && (
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 70% 80% at 50% 120%, rgba(255,255,255,0.08) 0%, transparent 70%)' }} />
        )}
        <p className={`relative text-[10px] font-bold tracking-[0.2em] uppercase
          ${verdict.winner !== 'tie' ? 'text-white/50' : 'text-muted'}`}>
          Verdict
        </p>
        <h2 className={`relative text-4xl font-black tracking-tight ${bannerText}`}>
          {winnerLabel}
        </h2>
        {verdict.winner !== 'tie' && (
          <p className="relative text-sm text-white/60">
            {verdict.winner === 'A' ? displayA : displayB} outperformed on this prompt
          </p>
        )}
        {isBlind && userVote && (
          <p className={`relative text-sm font-semibold mt-1 ${userVote === verdict.winner ? 'text-green-400' : 'text-red-400'}`}>
            {userVote === verdict.winner ? '✓ Your vote was correct!' : `✗ You voted ${userVote} — judge picked ${verdict.winner === 'tie' ? 'a tie' : verdict.winner}`}
          </p>
        )}
      </div>

      <div className="px-8 pb-8 space-y-8">

      {/* Score comparison + radar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        {/* Score table */}
        <div className="space-y-3">
          {/* Totals */}
          <div className="grid grid-cols-3 text-xs font-semibold text-muted uppercase tracking-wider pb-2 border-b border-border">
            <span>Dimension</span>
            <span className="text-center text-accent">Agent A</span>
            <span className="text-center text-text">Agent B</span>
          </div>
          {SCORE_DIMS.map((dim) => {
            const a = verdict.scores_a[dim]
            const b = verdict.scores_b[dim]
            return (
              <div key={dim} className="grid grid-cols-3 items-center text-sm">
                <span className="text-muted capitalize">{dim}</span>
                <ScoreCell value={a} wins={a > b} isA />
                <ScoreCell value={b} wins={b > a} isA={false} />
              </div>
            )
          })}
          <div className="grid grid-cols-3 items-center pt-2 border-t border-border text-sm font-bold">
            <span className="text-muted">Total</span>
            <span className={`text-center ${totalA > totalB ? 'text-accent' : 'text-muted'}`}>{totalA}</span>
            <span className={`text-center ${totalB > totalA ? 'text-text' : 'text-muted'}`}>{totalB}</span>
          </div>
        </div>

        {/* Radar chart */}
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData}>
              <PolarGrid stroke="#E5DED5" />
              <PolarAngleAxis
                dataKey="dim"
                tick={{ fill: '#6B6560', fontSize: 11, fontFamily: 'Inter' }}
              />
              <Radar
                name={`A · ${displayA}`}
                dataKey="A"
                stroke="#C45826"
                fill="#C45826"
                fillOpacity={0.15}
                strokeWidth={2}
              />
              <Radar
                name={`B · ${displayB}`}
                dataKey="B"
                stroke="#1A1714"
                fill="#1A1714"
                fillOpacity={0.08}
                strokeWidth={2}
              />
              <Legend
                wrapperStyle={{ fontSize: '11px', fontFamily: 'Inter' }}
              />
              <Tooltip
                contentStyle={{
                  background: '#fff',
                  border: '1px solid #E5DED5',
                  borderRadius: '10px',
                  fontSize: '12px',
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Key differences */}
      <div>
        <p className="text-xs font-bold tracking-widest text-muted uppercase mb-3">Key Differences</p>
        <ul className="space-y-2">
          {verdict.key_differences.map((diff, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-text animate-slide-in"
              style={{ animationDelay: `${i * 0.07}s` }}>
              <span className="mt-0.5 flex-shrink-0 h-5 w-5 rounded-full bg-accent-light
                               text-accent text-[10px] font-black flex items-center justify-center">
                {i + 1}
              </span>
              {diff}
            </li>
          ))}
        </ul>
      </div>

      {/* Judge reasoning (expandable) */}
      <div className="card-flat rounded-xl overflow-hidden">
        <button
          onClick={() => setShowReasoning(!showReasoning)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold
                     text-text hover:bg-border/30 transition-colors"
        >
          <span>Judge reasoning</span>
          <span className={`transition-transform duration-200 ${showReasoning ? 'rotate-180' : ''}`}>
            ▾
          </span>
        </button>
        {showReasoning && (
          <div className="px-4 pb-4 pt-1 text-sm text-muted leading-relaxed border-t border-border">
            {verdict.reasoning}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2 flex-wrap">
        <button className="btn-primary btn-lg" onClick={onNewBattle}>
          New Battle
        </button>
        {onRematch && (
          <button className="btn-outline" onClick={onRematch}>↺ Rematch</button>
        )}
        <button className="btn-outline btn-lg" onClick={handleCopyLink}>
          {copied ? 'Copied!' : 'Copy Link'}
        </button>
        <button className="btn-outline" onClick={handleShareImage} disabled={sharing}>
          {sharing ? 'Saving…' : '⬇ Save image'}
        </button>
      </div>
      </div>  {/* closes px-8 pb-8 wrapper */}
    </div>
  )
}

function ScoreCell({ value, wins, isA }: { value: number; wins: boolean; isA: boolean }) {
  return (
    <div className="flex justify-center">
      <span className={`inline-flex items-center justify-center h-7 w-7 rounded-lg text-sm font-bold
        ${wins
          ? isA
            ? 'bg-accent-light text-accent'
            : 'bg-text/10 text-text'
          : 'text-muted'
        }`}>
        {value}
      </span>
    </div>
  )
}
