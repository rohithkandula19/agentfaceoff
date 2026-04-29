import { useEffect, useRef, useState } from 'react'
import type { FollowUpTurn } from '@/lib/hooks/useFollowUp'
import { cleanText } from '@/lib/cleanText'

interface Props {
  turns: FollowUpTurn[]
  streaming: boolean
  error: string | null
  onSend: (question: string) => void
  onClearError: () => void
  modelA: string
  modelB: string
}

export default function FollowUpChat({ turns, streaming, error, onSend, onClearError, modelA, modelB }: Props) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll when a new turn is added (e.g. question sent)
  useEffect(() => {
    if (turns.length === 0) return
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)
  }, [turns.length])

  const handleSend = () => {
    const q = input.trim()
    if (!q || streaming) return
    setInput('')
    onSend(q)
  }

  return (
    <div className="space-y-4 animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-base">💬</span>
        <p className="text-xs font-bold tracking-widest text-muted uppercase">Continue the conversation</p>
      </div>

      {/* Turn history */}
      {turns.length > 0 && (
        <div className="space-y-6">
          {turns.map((turn, i) => {
            const isCurrentTurn = i === turns.length - 1 && streaming
            return (
              <div key={i} className="space-y-3 animate-fade-up">
                {/* User bubble */}
                <div className="flex justify-center">
                  <div className="card-flat rounded-xl px-4 py-2.5 max-w-lg text-center">
                    <p className="text-sm text-text font-medium">{turn.question}</p>
                  </div>
                </div>
                {/* Split responses */}
                <div className="grid grid-cols-2 gap-3">
                  {(['A', 'B'] as const).map((label) => {
                    const tokens = label === 'A' ? turn.tokensA : turn.tokensB
                    const done = label === 'A' ? turn.doneA : turn.doneB
                    const modelKey = label === 'A' ? modelA : modelB
                    const isDone = done !== null
                    return (
                      <div key={label} className="card flex flex-col" style={{ minHeight: '120px', maxHeight: '260px' }}>
                        <div className="flex items-center justify-between border-b border-border px-4 py-2">
                          <div className="flex items-center gap-2">
                            <span className={`flex h-5 w-5 items-center justify-center rounded-full
                              text-[10px] font-black ${label === 'A' ? 'bg-accent text-white' : 'bg-text text-white'}`}>
                              {label}
                            </span>
                            <p className="text-[10px] text-muted truncate max-w-[120px]">{modelKey}</p>
                          </div>
                          {isDone && !done!.error && (
                            <span className="badge badge-muted text-[10px]">{done!.latency_ms.toLocaleString()} ms</span>
                          )}
                          {isCurrentTurn && !isDone && (
                            <span className="flex gap-0.5">
                              {[0,1,2].map((j) => (
                                <span key={j} className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce"
                                  style={{ animationDelay: `${j * 0.15}s` }} />
                              ))}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 overflow-y-auto scroll-pane px-4 py-3">
                          {tokens.length === 0 && !isDone && (
                            <div className="flex items-center gap-2 text-muted text-xs">
                              <span className="flex gap-1">
                                {[0,1,2].map((j) => (
                                  <span key={j} className="h-1 w-1 rounded-full bg-border animate-bounce"
                                    style={{ animationDelay: `${j*0.15}s` }} />
                                ))}
                              </span>
                              Waiting…
                            </div>
                          )}
                          {tokens.length > 0 && (
                            <p className={`text-xs text-text leading-relaxed whitespace-pre-wrap font-mono
                              ${!isDone ? 'cursor-blink' : ''}`}>
                              {isDone ? cleanText(tokens) : tokens}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="card border-red-200 p-4 flex items-center justify-between gap-3">
          <p className="text-sm text-red-600">{error}</p>
          <button onClick={onClearError} className="text-xs text-muted hover:text-text">✕</button>
        </div>
      )}

      {/* Input */}
      <div className="card p-4 space-y-3">
        <textarea
          className="field resize-none text-sm"
          rows={3}
          placeholder={streaming ? 'Waiting for responses…' : 'Ask a follow-up question…'}
          value={input}
          disabled={streaming}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              handleSend()
            }
          }}
        />
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-muted">⌘ + Enter to send</p>
          <button
            className="btn-accent"
            onClick={handleSend}
            disabled={!input.trim() || streaming}
          >
            {streaming ? (
              <span className="flex items-center gap-2">
                <span className="flex gap-0.5">
                  {[0,1,2].map((j) => (
                    <span key={j} className="h-1.5 w-1.5 rounded-full bg-white/70 animate-bounce"
                      style={{ animationDelay: `${j*0.15}s` }} />
                  ))}
                </span>
                Generating
              </span>
            ) : 'Send →'}
          </button>
        </div>
      </div>

      <div ref={bottomRef} />
    </div>
  )
}
