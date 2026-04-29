import type { BattleState, DebateRound } from '@/lib/types'

interface Props {
  state: BattleState
  configA: { modelKey: string }
  configB: { modelKey: string }
}

export default function DebateThread({ state, configA, configB }: Props) {
  const isStreaming = state.phase === 'streaming'

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div className="flex items-center gap-2">
        {Array.from({ length: state.totalRounds }, (_, i) => i + 1).map((n) => {
          const done = n < state.currentRound || state.phase === 'judging' || state.phase === 'verdict'
          const active = n === state.currentRound && isStreaming
          return (
            <div key={n} className="flex items-center gap-2">
              <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold
                transition-all duration-300
                ${done   ? 'bg-text text-white' : ''}
                ${active ? 'bg-accent text-white animate-pulse' : ''}
                ${!done && !active ? 'bg-border text-muted' : ''}`}>
                {n}
              </div>
              {n < state.totalRounds && (
                <div className={`h-0.5 w-8 rounded transition-all duration-500
                  ${done ? 'bg-text' : 'bg-border'}`} />
              )}
            </div>
          )
        })}
        <span className="ml-2 text-xs text-muted">
          {isStreaming ? `Round ${state.currentRound} in progress…` : ''}
          {state.phase === 'judging' ? 'All rounds complete, judging…' : ''}
          {state.phase === 'verdict' ? 'Debate complete' : ''}
        </span>
      </div>

      {/* Render each round */}
      {state.rounds.map((round) => {
        const isCurrent = round.roundNum === state.currentRound && isStreaming
        const isComplete = round.agentA !== null && round.agentB !== null
        return (
          <RoundCard
            key={round.roundNum}
            round={round}
            isCurrent={isCurrent}
            isComplete={isComplete}
            modelA={configA.modelKey}
            modelB={configB.modelKey}
          />
        )
      })}

      {/* Judging indicator */}
      {state.phase === 'judging' && (
        <div className="card-flat rounded-xl px-5 py-4 flex items-center justify-center gap-3 animate-fade-up">
          <span className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-2 w-2 rounded-full bg-accent animate-bounce"
                style={{ animationDelay: `${i * 0.2}s` }} />
            ))}
          </span>
          <p className="text-sm font-semibold text-text">Judge evaluating final round responses…</p>
        </div>
      )}
    </div>
  )
}

// ── Round card ────────────────────────────────────────────────────────────────

interface RoundCardProps {
  round: DebateRound
  isCurrent: boolean
  isComplete: boolean
  modelA: string
  modelB: string
}

function RoundCard({ round, isCurrent, isComplete, modelA, modelB }: RoundCardProps) {
  const isDebateRound = round.roundNum > 1

  return (
    <div className={`space-y-3 animate-fade-up ${isCurrent ? 'opacity-100' : 'opacity-90'}`}>
      {/* Round header */}
      <div className="flex items-center gap-3">
        <span className={`step-number ${round.roundNum === 1 ? '' : 'text-text'}`}>
          {isDebateRound ? `Round ${round.roundNum}: Rebuttal` : 'Round 1: Opening'}
        </span>
        {isComplete && <span className="badge badge-muted">Complete</span>}
        {isCurrent && (
          <span className="flex items-center gap-1 text-[10px] text-accent font-semibold">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent" />
            </span>
            Live
          </span>
        )}
      </div>

      {/* Split panes */}
      <div className="grid grid-cols-2 gap-4">
        <DebatePane
          label="A"
          modelKey={modelA}
          tokens={round.tokensA}
          doneInfo={round.agentA}
          isStreaming={isCurrent}
          isDebateRound={isDebateRound}
        />
        <DebatePane
          label="B"
          modelKey={modelB}
          tokens={round.tokensB}
          doneInfo={round.agentB}
          isStreaming={isCurrent}
          isDebateRound={isDebateRound}
        />
      </div>
    </div>
  )
}

interface DebatePaneProps {
  label: string
  modelKey: string
  tokens: string
  doneInfo: { latency_ms: number; error: string | null } | null
  isStreaming: boolean
  isDebateRound: boolean
}

function DebatePane({ label, modelKey, tokens, doneInfo, isStreaming, isDebateRound }: DebatePaneProps) {
  // Split critique and refined answer for rounds 2+
  const critique = isDebateRound ? extractSection(tokens, 'CRITIQUE') : null
  const refined  = isDebateRound ? extractSection(tokens, 'REFINED ANSWER') : null
  const isDone   = doneInfo !== null

  return (
    <div className="card flex flex-col" style={{ minHeight: '160px', maxHeight: '320px' }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black
            ${label === 'A' ? 'bg-accent text-white' : 'bg-text text-white'}`}>{label}</span>
          <p className="text-xs font-medium text-muted">{modelKey}</p>
        </div>
        {isDone && !doneInfo.error && (
          <span className="badge badge-muted">{doneInfo.latency_ms.toLocaleString()} ms</span>
        )}
        {isStreaming && !isDone && (
          <span className="flex items-center gap-1 text-[10px] text-accent font-medium">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent" />
            </span>
            Streaming
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto scroll-pane px-4 py-3 space-y-3">
        {tokens.length === 0 && !isDone && (
          <div className="flex items-center gap-2 text-muted text-xs">
            <span className="flex gap-1">
              {[0,1,2].map((i) => (
                <span key={i} className="h-1 w-1 rounded-full bg-border animate-bounce"
                  style={{ animationDelay: `${i*0.15}s` }} />
              ))}
            </span>
            Waiting…
          </div>
        )}

        {isDebateRound && (critique !== null || refined !== null) ? (
          <>
            {critique !== null && (
              <div>
                <p className="text-[10px] font-bold tracking-wider text-accent uppercase mb-1">Critique</p>
                <p className={`text-xs text-text leading-relaxed whitespace-pre-wrap font-mono
                  ${!isDone && !refined ? 'cursor-blink' : ''}`}>{critique}</p>
              </div>
            )}
            {refined !== null && (
              <div>
                <p className="text-[10px] font-bold tracking-wider text-muted uppercase mb-1">Refined Answer</p>
                <p className={`text-xs text-text leading-relaxed whitespace-pre-wrap font-mono
                  ${!isDone ? 'cursor-blink' : ''}`}>{refined}</p>
              </div>
            )}
            {critique === null && tokens.length > 0 && (
              <p className={`text-xs text-text leading-relaxed whitespace-pre-wrap font-mono
                ${!isDone ? 'cursor-blink' : ''}`}>{tokens}</p>
            )}
          </>
        ) : (
          tokens.length > 0 && (
            <p className={`text-xs text-text leading-relaxed whitespace-pre-wrap font-mono
              ${!isDone ? 'cursor-blink' : ''}`}>{tokens}</p>
          )
        )}
      </div>
    </div>
  )
}

function extractSection(text: string, heading: string): string | null {
  const upper = text.toUpperCase()
  const start = upper.indexOf(heading.toUpperCase() + ':')
  if (start === -1) return null
  const contentStart = start + heading.length + 1
  // find next heading
  const nextHeading = upper.indexOf('\n\n', contentStart)
  const raw = nextHeading === -1 ? text.slice(contentStart) : text.slice(contentStart, nextHeading)
  return raw.trim() || null
}
