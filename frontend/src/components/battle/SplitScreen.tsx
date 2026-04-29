import type { BattleState } from '@/lib/types'
import AgentPane from './AgentPane'

interface Props {
  state: BattleState
  configA: { modelKey: string }
  configB: { modelKey: string }
  isBlind?: boolean
}

export default function SplitScreen({ state, configA, configB, isBlind }: Props) {
  const isStreaming = state.phase === 'streaming'

  return (
    <div className="flex flex-col gap-4">

      {/* Judging banner */}
      {state.phase === 'judging' && (
        <div className="card-flat px-5 py-3.5 flex items-center justify-center gap-3 animate-fade-up">
          <span className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-2 w-2 rounded-full bg-accent animate-bounce"
                style={{ animationDelay: `${i * 0.2}s` }} />
            ))}
          </span>
          <p className="text-sm font-semibold text-text">Judge is evaluating both responses…</p>
        </div>
      )}

      {/* Split panes + VS divider */}
      <div className="relative" style={{ height: '420px' }}>
        <div className="grid grid-cols-2 gap-4 h-full">
          <AgentPane
            label="A"
            modelKey={configA.modelKey}
            tokens={state.tokensA}
            doneInfo={state.agentA}
            isStreaming={isStreaming}
            isBlind={isBlind}
          />
          <AgentPane
            label="B"
            modelKey={configB.modelKey}
            tokens={state.tokensB}
            doneInfo={state.agentB}
            isStreaming={isStreaming}
            isBlind={isBlind}
          />
        </div>

        {/* VS divider — centred between panes */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10
                        pointer-events-none flex flex-col items-center gap-1">
          {/* top line */}
          <div className="w-px h-14 bg-gradient-to-b from-transparent to-border" />
          {/* badge */}
          <div className={`relative flex items-center justify-center
                           h-8 w-8 rounded-full text-[10px] font-black
                           border transition-all duration-300
                           ${isStreaming
                             ? 'bg-accent text-white border-accent shadow-md shadow-accent/40'
                             : 'bg-white text-muted border-border'
                           }`}>
            {isStreaming && (
              <span className="absolute inset-0 rounded-full bg-accent/30 animate-ping" />
            )}
            <span className="relative">VS</span>
          </div>
          {/* bottom line */}
          <div className="w-px h-14 bg-gradient-to-t from-transparent to-border" />
        </div>
      </div>
    </div>
  )
}
