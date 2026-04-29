import type { AgentDoneInfo } from '@/lib/types'
import { cleanText } from '@/lib/cleanText'

/** Pull a human-readable message out of raw API error strings */
function friendlyError(raw: string): string {
  // 429 rate-limit
  if (raw.includes('429') || raw.toLowerCase().includes('rate limit') || raw.toLowerCase().includes('rate-limit')) {
    const model = raw.match(/([\w./:-]+:free)/)?.[1]
    return model
      ? `${model} is rate-limited right now. Try a Groq model or retry in a moment.`
      : 'Model is rate-limited right now. Try a different model or retry in a moment.'
  }
  // 503 / upstream
  if (raw.includes('503') || raw.toLowerCase().includes('upstream')) {
    return 'Provider is temporarily unavailable. Try a different model.'
  }
  // 401 / auth
  if (raw.includes('401') || raw.toLowerCase().includes('api key') || raw.toLowerCase().includes('authentication')) {
    return 'API key invalid or missing. Check your OPENROUTER_API_KEY.'
  }
  // context length
  if (raw.toLowerCase().includes('context') || raw.toLowerCase().includes('tokens')) {
    return 'Prompt exceeded the model\'s context window. Try a shorter prompt.'
  }
  // trim long raw JSON blobs
  if (raw.length > 120) return raw.slice(0, 120) + '…'
  return raw
}

interface Props {
  label: string
  modelKey: string
  tokens: string
  doneInfo: AgentDoneInfo | null
  isStreaming: boolean
  isBlind?: boolean
}

export default function AgentPane({ label, modelKey, tokens, doneInfo, isStreaming, isBlind }: Props) {
  const isDone = doneInfo !== null
  const hasError = isDone && doneInfo.error

  return (
    <div className="card flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2.5">
          <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-black
            ${label === 'A' ? 'bg-accent text-white' : 'bg-text text-white'}`}>
            {label}
          </span>
          <div>
            <p className="text-xs font-semibold text-text leading-none">Agent {label}</p>
            <p className="text-[10px] text-muted mt-0.5 leading-none">{isBlind ? '???' : modelKey}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isDone && !hasError && (
            <span className="badge badge-muted">{doneInfo.latency_ms.toLocaleString()} ms</span>
          )}
          {hasError && (
            <span className="badge bg-red-50 text-red-600">error</span>
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
      </div>

      {/* Token stream */}
      <div className="flex-1 overflow-y-auto scroll-pane px-5 py-4">
        {tokens.length === 0 && !isDone && (
          <div className="flex items-center gap-2 text-muted text-sm">
            <span className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-border animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </span>
            Waiting for response…
          </div>
        )}

        {tokens.length > 0 && (
          <p className={`text-sm text-text leading-relaxed whitespace-pre-wrap font-mono
            ${!isDone ? 'cursor-blink' : ''}`}>
            {isDone ? cleanText(tokens) : tokens}
          </p>
        )}

        {hasError && (
          <p className="text-sm text-red-500 mt-2">
            ⚠ {friendlyError(doneInfo!.error!)}
          </p>
        )}
      </div>

      {/* Footer score bar - shown after done */}
      {isDone && !hasError && (
        <div className="border-t border-border px-5 py-2.5 flex items-center justify-between">
          <span className="text-xs text-muted">{doneInfo!.model_display_name}</span>
          <span className="text-xs font-semibold text-text">
            {(tokens.split(' ').length)} words
          </span>
        </div>
      )}
    </div>
  )
}
