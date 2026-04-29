import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { cleanText } from '@/lib/cleanText'
import type { BattleConfig, SharedBattle } from '@/lib/types'
import { fetchBattle } from '@/lib/api'
import { useBattle } from '@/lib/hooks/useBattle'
import { useFollowUp } from '@/lib/hooks/useFollowUp'
import BattleSetup from '@/components/battle/BattleSetup'
import SplitScreen from '@/components/battle/SplitScreen'
import DebateThread from '@/components/battle/DebateThread'
import VerdictCard from '@/components/battle/VerdictCard'
import FollowUpChat from '@/components/battle/FollowUpChat'

const MODE_LABELS: Record<string, string> = {
  model_vs_model:       'Model vs Model',
  strategy_vs_strategy: 'Strategy vs Strategy',
  adversarial_debate:   'Adversarial Debate',
}

export default function BattlePage() {
  const [searchParams] = useSearchParams()
  const sharedId = searchParams.get('id')

  const { state, startBattle, reset, castVote } = useBattle()
  const { turns: followUpTurns, streaming: followUpStreaming, error: followUpError, sendFollowUp, reset: resetFollowUp, clearError: clearFollowUpError } = useFollowUp()
  const [lastConfig, setLastConfig] = useState<BattleConfig | null>(null)

  // Shared battle state (loaded from ?id=xxx)
  const [shared, setShared] = useState<SharedBattle | null>(null)
  const [sharedLoading, setSharedLoading] = useState(false)
  const [sharedError, setSharedError] = useState<string | null>(null)

  useEffect(() => {
    if (!sharedId) return
    setSharedLoading(true)
    setSharedError(null)
    fetchBattle(sharedId)
      .then(setShared)
      .catch((e: Error) => setSharedError(e.message))
      .finally(() => setSharedLoading(false))
  }, [sharedId])

  const handleStart = (config: BattleConfig) => {
    resetFollowUp()
    setLastConfig(config)
    startBattle(config)
  }

  // --- Shared battle view ---
  if (sharedId) {
    if (sharedLoading) {
      return (
        <main className="mx-auto max-w-5xl px-6 py-10">
          <div className="card p-12 flex items-center justify-center gap-3 text-muted">
            <span className="flex gap-1">
              {[0,1,2].map((i) => (
                <span key={i} className="h-2 w-2 rounded-full bg-border animate-bounce"
                  style={{ animationDelay: `${i*0.15}s` }} />
              ))}
            </span>
            Loading battle…
          </div>
        </main>
      )
    }

    if (sharedError || !shared || !shared.verdict) {
      return (
        <main className="mx-auto max-w-5xl px-6 py-10">
          <div className="card border-red-200 p-8 text-center space-y-4">
            <p className="text-2xl">⚠</p>
            <p className="font-semibold text-text">{sharedError ?? 'Battle not found'}</p>
            <a href="/battle" className="btn-primary inline-block">Start a new battle</a>
          </div>
        </main>
      )
    }

    return (
      <main className="mx-auto max-w-5xl px-6 py-10 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-text">Shared Battle</h1>
            <p className="text-xs text-muted mt-0.5">{MODE_LABELS[shared.mode] ?? shared.mode}</p>
          </div>
          <a href="/battle" className="btn-outline btn-sm">← New Battle</a>
        </div>

        <PromptEcho prompt={shared.prompt} />

        <div className="grid grid-cols-2 gap-4">
          {(['A', 'B'] as const).map((label) => {
            const agent = label === 'A' ? shared.agent_a : shared.agent_b
            return (
              <div key={label} className="card p-5 space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full
                    text-[10px] font-black ${label === 'A' ? 'bg-accent text-white' : 'bg-text text-white'}`}>
                    {label}
                  </span>
                  <p className="text-xs font-semibold text-muted">{agent.model_display_name}</p>
                </div>
                <p className="text-sm text-text leading-relaxed whitespace-pre-wrap font-mono
                              max-h-64 overflow-y-auto scroll-pane">
                  {cleanText(agent.response)}
                </p>
              </div>
            )
          })}
        </div>

        <VerdictCard
          verdict={shared.verdict}
          modelA={shared.agent_a.model_display_name}
          modelB={shared.agent_b.model_display_name}
          battleId={shared.battle_id}
          onNewBattle={() => { window.location.href = '/battle' }}
        />
      </main>
    )
  }

  // --- Live battle view ---
  const isIdle      = state.phase === 'idle'
  const isActive    = ['connecting', 'searching', 'streaming', 'judging'].includes(state.phase)
  const isDone      = state.phase === 'verdict'
  const isError     = state.phase === 'error'
  const isDebate    = lastConfig?.mode === 'adversarial_debate'

  // Raw key used for logic / config references
  const agentAKey = lastConfig
    ? lastConfig.mode === 'strategy_vs_strategy' ? lastConfig.strategy_a : lastConfig.agent_a_model
    : ''
  const agentBKey = lastConfig
    ? lastConfig.mode === 'strategy_vs_strategy' ? lastConfig.strategy_b : lastConfig.agent_b_model
    : ''

  // Human-readable display name priority:
  //  1. battle_started message (available from token 1)
  //  2. agent_done message (arrives when streaming ends)
  //  3. last debate round's agent info
  //  4. raw registry key as last resort
  const lastRound = state.rounds[state.rounds.length - 1]
  const agentALabel = (
    state.modelADisplay ||
    state.agentA?.model_display_name ||
    lastRound?.agentA?.model_display_name ||
    agentAKey
  )
  const agentBLabel = (
    state.modelBDisplay ||
    state.agentB?.model_display_name ||
    lastRound?.agentB?.model_display_name ||
    agentBKey
  )

  return (
    <main className={`mx-auto px-6 py-10 space-y-8 ${isIdle ? 'max-w-3xl' : 'max-w-5xl'}`}>

      {/* Header — hidden on idle since BattleSetup has its own greeting */}
      {!isIdle && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-text">
              {isActive  && 'Battle in progress'}
              {isDone    && 'Battle complete'}
              {isError   && 'Something went wrong'}
            </h1>
            {lastConfig && (
              <p className="text-xs text-muted mt-0.5">{MODE_LABELS[lastConfig.mode]}</p>
            )}
          </div>
          {(isActive || isDone || isError) && (
            <button className="btn-outline btn-sm" onClick={reset}>← New Battle</button>
          )}
        </div>
      )}

      {/* Setup */}
      {isIdle && (
        <BattleSetup onStart={handleStart} isConnecting={state.phase === 'connecting'} />
      )}

      {/* Connecting spinner */}
      {state.phase === 'connecting' && (
        <div className="card p-12 flex items-center justify-center gap-3 text-muted">
          <span className="flex gap-1">
            {[0,1,2].map((i) => (
              <span key={i} className="h-2 w-2 rounded-full bg-border animate-bounce"
                style={{ animationDelay: `${i*0.15}s` }} />
            ))}
          </span>
          Connecting to battle server…
        </div>
      )}

      {/* Web search spinner */}
      {state.phase === 'searching' && (
        <div className="card p-12 flex items-center justify-center gap-3 text-muted">
          <span className="text-xl">🔍</span>
          <span className="flex gap-1">
            {[0,1,2].map((i) => (
              <span key={i} className="h-2 w-2 rounded-full bg-accent animate-bounce"
                style={{ animationDelay: `${i*0.15}s` }} />
            ))}
          </span>
          Searching the web…
        </div>
      )}

      {/* Search image strip — shown as soon as images arrive, persists through verdict */}
      {state.searchImages.length > 0 && (
        <div className="space-y-2 animate-fade-up">
          <p className="text-[10px] font-bold tracking-widest text-muted uppercase flex items-center gap-1.5">
            <span>🔍</span> Web search images
          </p>
          <div className="flex gap-3 overflow-x-auto pb-1 scroll-pane">
            {state.searchImages.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                className="shrink-0 rounded-xl overflow-hidden border border-border
                           hover:border-accent/40 transition-colors shadow-sm">
                <img
                  src={url}
                  alt={`Search result ${i + 1}`}
                  className="h-28 w-44 object-cover"
                  onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none' }}
                />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Live view — only render panes once models are actually streaming */}
      {['streaming', 'judging'].includes(state.phase) && lastConfig && (
        <div className="space-y-4 animate-fade-up">
          <PromptEcho prompt={lastConfig.prompt} />
          {isDebate ? (
            <DebateThread
              state={state}
              configA={{ modelKey: agentALabel }}
              configB={{ modelKey: agentBLabel }}
            />
          ) : (
            <SplitScreen
              state={state}
              configA={{ modelKey: agentALabel }}
              configB={{ modelKey: agentBLabel }}
              isBlind={state.isBlind}
            />
          )}
          {state.isBlind && state.agentA && state.agentB && !state.userVote && state.phase !== 'idle' && (
            <div className="card p-6 text-center space-y-4 animate-fade-up">
              <p className="font-semibold text-text">Which response was better?</p>
              <p className="text-xs text-muted">Vote before the verdict is revealed</p>
              <div className="flex gap-4 justify-center">
                <button className="btn-accent px-8" onClick={() => castVote('A')}>Agent A</button>
                <button className="btn-primary px-8" onClick={() => castVote('B')}>Agent B</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Verdict */}
      {isDone && state.verdict && lastConfig && (
        <div className="space-y-4 animate-fade-up">
          <PromptEcho prompt={lastConfig.prompt} />

          {/* Final responses */}
          <details className="group">
            <summary className="card px-5 py-3 cursor-pointer text-sm font-semibold text-muted
                                hover:text-text transition-colors list-none flex items-center justify-between">
              <span>View full responses</span>
              <span className="group-open:rotate-180 transition-transform">▾</span>
            </summary>
            <div className="grid grid-cols-2 gap-4 mt-3">
              {(['A', 'B'] as const).map((label) => {
                const tokens = label === 'A' ? state.tokensA : state.tokensB
                const debateTokens = isDebate
                  ? state.rounds[state.rounds.length - 1]?.[label === 'A' ? 'tokensA' : 'tokensB'] ?? ''
                  : ''
                const display = isDebate ? debateTokens : tokens
                const modelKey = label === 'A' ? agentALabel : agentBLabel
                const blindHidden = state.isBlind && !state.userVote
                return (
                  <div key={label} className="card p-5 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full
                        text-[10px] font-black ${label === 'A' ? 'bg-accent text-white' : 'bg-text text-white'}`}>
                        {label}
                      </span>
                      <p className="text-xs font-semibold text-muted">{blindHidden ? `Agent ${label}` : modelKey}</p>
                    </div>
                    <p className="text-sm text-text leading-relaxed whitespace-pre-wrap font-mono
                                  max-h-64 overflow-y-auto scroll-pane">
                      {cleanText(display)}
                    </p>
                  </div>
                )
              })}
            </div>
          </details>

          <VerdictCard
            verdict={state.verdict}
            modelA={agentALabel}
            modelB={agentBLabel}
            battleId={state.battleId}
            onNewBattle={reset}
            onRematch={() => { if (lastConfig) { resetFollowUp(); startBattle(lastConfig) } }}
            isBlind={state.isBlind}
            userVote={state.userVote}
          />

          {lastConfig.mode !== 'adversarial_debate' && (
            <FollowUpChat
              turns={followUpTurns}
              streaming={followUpStreaming}
              error={followUpError}
              onSend={(q) => sendFollowUp(q, lastConfig, state.tokensA, state.tokensB)}
              onClearError={clearFollowUpError}
              modelA={agentALabel}
              modelB={agentBLabel}
            />
          )}
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="card border-red-200 p-8 text-center space-y-4 animate-fade-up">
          <p className="text-2xl">⚠</p>
          <p className="font-semibold text-text">{state.error ?? 'Unknown error'}</p>
          <button className="btn-primary" onClick={reset}>Try again</button>
        </div>
      )}

    </main>
  )
}

function PromptEcho({ prompt }: { prompt: string }) {
  return (
    <div className="card-flat rounded-xl px-5 py-3">
      <p className="text-xs font-bold tracking-widest text-muted uppercase mb-1">Prompt</p>
      <p className="text-sm text-text line-clamp-2">{prompt}</p>
    </div>
  )
}
