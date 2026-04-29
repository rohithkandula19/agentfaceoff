import { useEffect, useRef, useState } from 'react'
import type { BattleConfig, BattleMode, ModelInfo, StrategyInfo } from '@/lib/types'
import { fetchModels, fetchStrategies, uploadFile, uploadUrl } from '@/lib/api'

interface Props {
  onStart: (config: BattleConfig) => void
  isConnecting: boolean
}

const MODES: { key: BattleMode; label: string; icon: string }[] = [
  { key: 'model_vs_model',       label: 'Model vs Model',       icon: '⚔' },
  { key: 'strategy_vs_strategy', label: 'Strategy vs Strategy', icon: '♟' },
  { key: 'adversarial_debate',   label: 'Adversarial Debate',   icon: '🗣' },
]

const PROMPT_CATEGORIES = [
  {
    label: 'Coding',
    prompts: [
      'Write a Python function to flatten a nested list of arbitrary depth.',
      'Implement a LRU cache in JavaScript with O(1) get and put.',
      'Design a rate limiter for a public API: walk through data structures and algorithm.',
      'Explain the difference between a mutex and a semaphore with a real-world analogy.',
    ],
  },
  {
    label: 'Reasoning',
    prompts: [
      'What are the trade-offs between microservices and a monolithic architecture?',
      'You have 8 balls, one is heavier. Find it in 2 weighings; explain the algorithm.',
      'Is it ever ethical to lie? Build the strongest case for both yes and no.',
      "Explain Gödel's incompleteness theorem to someone who knows high-school math.",
    ],
  },
  {
    label: 'Creative',
    prompts: [
      'Write a two-paragraph story that begins and ends with the same sentence.',
      'Describe the color blue to someone who has been blind from birth.',
      'Write a product review for the concept of "time" as if it were sold on Amazon.',
      'Invent a new sport that can be played in zero gravity.',
    ],
  },
  {
    label: 'Science',
    prompts: [
      'Explain quantum entanglement to a 10-year-old.',
      'Why is the sky blue? Give both the simple and the technically precise answer.',
      'What would actually happen if you fell into a black hole?',
      'Explain CRISPR gene editing as if explaining to a curious 15-year-old.',
    ],
  },
]

function timeGreeting(): { headline: string; sub: string } {
  const h = new Date().getHours()
  if (h < 12) return { headline: 'Rise and fight.', sub: 'Pick your fighters. One prompt. One winner.' }
  if (h < 17) return { headline: "Let's get ready to rumble.", sub: 'The arena is open. Who takes the crown?' }
  return { headline: "Tonight's main event.", sub: 'Lights on. Models ready. Throw the prompt.' }
}

export default function BattleSetup({ onStart, isConnecting }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [mode, setMode]               = useState<BattleMode>('model_vs_model')
  const [models, setModels]           = useState<ModelInfo[]>([])
  const [strategies, setStrategies]   = useState<StrategyInfo[]>([])
  const [modelA, setModelA]           = useState('groq-llama-4-scout')
  const [modelB, setModelB]           = useState('groq-llama-3.1-8b')
  const [strategyModel, setStrategyModel] = useState('groq-llama-3.3-70b')
  const [strategyA, setStrategyA]     = useState('react')
  const [strategyB, setStrategyB]     = useState('plan_execute')
  const [maxRounds, setMaxRounds]     = useState(2)
  const [prompt, setPrompt]           = useState('')
  const [temp, setTemp]               = useState(0.7)
  const [dualPass, setDualPass]       = useState(false)
  const [blind, setBlind]             = useState(false)
  const [webSearch, setWebSearch]     = useState(false)
  const [promptCat, setPromptCat]     = useState(0)
  const [contextText, setContextText] = useState('')
  const [uploadLoading, setUploadLoading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  useEffect(() => {
    fetchModels('FREE').then(setModels).catch(console.error)
    fetchStrategies().then(setStrategies).catch(console.error)
  }, [])

  const canStart = prompt.trim().length > 0 && !isConnecting &&
    (mode !== 'model_vs_model' || modelA !== modelB) &&
    (mode !== 'strategy_vs_strategy' || strategyA !== strategyB)

  const handleStart = () => {
    if (!canStart) return
    const finalPrompt = contextText
      ? `Context:\n${contextText}\n\n---\n\n${prompt.trim()}`
      : prompt.trim()
    onStart({
      mode,
      prompt: finalPrompt,
      agent_a_model: modelA,
      agent_b_model: modelB,
      strategy_model: strategyModel,
      strategy_a: strategyA,
      strategy_b: strategyB,
      temperature: temp,
      dual_pass: dualPass,
      max_rounds: maxRounds,
      blind,
      web_search: webSearch,
    })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-7 pt-2">

      {/* ── Greeting ── */}
      {(() => {
        const g = timeGreeting()
        return (
          <div className="text-center space-y-1.5">
            <h1 className="text-4xl font-bold tracking-tight text-text">{g.headline}</h1>
            <p className="text-base text-muted">{g.sub}</p>
          </div>
        )
      })()}

      {/* ── Mode tabs ── */}
      <div className="flex justify-center gap-1">
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
                        transition-all duration-150
              ${mode === m.key
                ? 'bg-text text-white'
                : 'text-muted hover:text-text hover:bg-surface-2'}`}
          >
            <span>{m.icon}</span>{m.label}
          </button>
        ))}
      </div>

      {/* ── Main input card ── */}
      <div className="bg-surface-2 border border-border rounded-2xl overflow-hidden shadow-sm">

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          className="w-full bg-transparent px-5 pt-5 pb-3 text-base text-text resize-none
                     outline-none placeholder:text-muted"
          rows={4}
          placeholder="Ask anything…"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              handleStart()
            }
          }}
        />

        {/* Context strip */}
        {contextText && (
          <div className="mx-4 mb-2 flex items-center gap-2 bg-accent-light/50 border border-accent/20
                          rounded-lg px-3 py-1.5 text-xs">
            <span className="text-accent font-semibold">
              📎 {contextText.length.toLocaleString()} chars attached
            </span>
            <button onClick={() => setContextText('')}
              className="ml-auto text-muted hover:text-text transition-colors">✕</button>
          </div>
        )}

        {uploadError && (
          <p className="px-5 pb-2 text-xs text-red-500">{uploadError}</p>
        )}

        {/* Bottom bar */}
        <div className="flex items-center gap-2 px-4 pb-4 pt-1 border-t border-border/60 flex-wrap">

          {/* Attach file button */}
          <div>
            <input
              type="file" id="ctx-file-input" className="hidden"
              accept=".txt,.pdf,.docx,.md,.rst,.csv"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                setUploadLoading(true); setUploadError('')
                try { const { text } = await uploadFile(file); setContextText(text) }
                catch (err: unknown) { setUploadError((err as Error).message) }
                finally { setUploadLoading(false) }
              }}
            />
            <label
              htmlFor="ctx-file-input"
              title="Attach file (.txt, .pdf, .docx, .md)"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-lg text-muted
                         hover:bg-border hover:text-text cursor-pointer transition-colors select-none"
            >
              {uploadLoading ? <span className="text-xs">…</span> : '+'}
            </label>
          </div>

          {/* Model / strategy selectors */}
          {(mode === 'model_vs_model' || mode === 'adversarial_debate') && (
            <>
              <InlineSelect
                badge="A" accent
                value={modelA} onChange={setModelA}
                options={models.filter((m) => m.key !== modelB).map((m) => ({ value: m.key, label: m.display_name }))}
              />
              <span className="text-xs font-bold text-muted">vs</span>
              <InlineSelect
                badge="B"
                value={modelB} onChange={setModelB}
                options={models.filter((m) => m.key !== modelA).map((m) => ({ value: m.key, label: m.display_name }))}
              />
            </>
          )}

          {mode === 'strategy_vs_strategy' && (
            <>
              <InlineSelect
                value={strategyModel} onChange={setStrategyModel}
                options={models.map((m) => ({ value: m.key, label: m.display_name }))}
                placeholder="Model"
              />
              <span className="text-xs font-bold text-muted">:</span>
              <InlineSelect
                badge="A" accent
                value={strategyA} onChange={setStrategyA}
                options={strategies.filter((s) => s.key !== strategyB).map((s) => ({ value: s.key, label: s.display_name }))}
              />
              <span className="text-xs text-muted">vs</span>
              <InlineSelect
                badge="B"
                value={strategyB} onChange={setStrategyB}
                options={strategies.filter((s) => s.key !== strategyA).map((s) => ({ value: s.key, label: s.display_name }))}
              />
            </>
          )}

          {/* Debate round picker */}
          {mode === 'adversarial_debate' && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted font-semibold uppercase tracking-wider mr-0.5">Rounds</span>
              {[2, 3, 4].map((r) => (
                <button
                  key={r}
                  onClick={() => setMaxRounds(r)}
                  className={`h-6 w-6 text-xs rounded-md font-bold transition-colors
                    ${maxRounds === r ? 'bg-accent text-white' : 'bg-border text-muted hover:text-text'}`}
                >
                  {r}
                </button>
              ))}
            </div>
          )}

          {/* Web search toggle */}
          <button
            type="button"
            onClick={() => setWebSearch((v) => !v)}
            title="Search the web before answering — both models get the same results"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                        border transition-all duration-150 select-none
              ${webSearch
                ? 'bg-accent/10 border-accent/40 text-accent'
                : 'border-border text-muted hover:text-text hover:border-zinc-300'}`}
          >
            🔍 {webSearch ? 'Web search on' : 'Web search'}
          </button>

          {/* Battle button */}
          <button
            className="ml-auto btn-accent flex items-center gap-1.5"
            onClick={handleStart}
            disabled={!canStart}
          >
            {isConnecting ? (
              <span className="flex gap-0.5">
                {[0, 1, 2].map((j) => (
                  <span key={j} className="h-1.5 w-1.5 rounded-full bg-white/70 animate-bounce"
                    style={{ animationDelay: `${j * 0.15}s` }} />
                ))}
              </span>
            ) : (
              <>Battle <span className="opacity-60 text-xs">→</span></>
            )}
          </button>
        </div>
      </div>

      {/* ── Prompt chips ── */}
      <div className="space-y-3">
        <div className="flex gap-1 justify-center">
          {PROMPT_CATEGORIES.map((cat, i) => (
            <button
              key={cat.label}
              onClick={() => setPromptCat(i)}
              className={`px-3 py-1 text-xs font-semibold rounded-full transition-all
                ${promptCat === i ? 'bg-text text-white' : 'text-muted hover:text-text hover:bg-surface-2'}`}
            >
              {cat.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 justify-center">
          {PROMPT_CATEGORIES[promptCat].prompts.map((p) => (
            <button
              key={p}
              onClick={() => {
                setPrompt(p)
                setTimeout(() => textareaRef.current?.focus(), 0)
              }}
              className="text-xs text-muted bg-white border border-border rounded-full
                         px-3 py-1.5 hover:border-accent/40 hover:text-accent transition-all
                         text-left max-w-[260px] truncate"
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* ── Advanced (collapsed) ── */}
      <details className="group">
        <summary className="flex items-center justify-center gap-1 text-xs font-semibold text-muted
                            hover:text-text cursor-pointer select-none list-none transition-colors">
          <span className="group-open:rotate-180 transition-transform inline-block">▾</span>
          Advanced options
        </summary>
        <div className="mt-4 card p-5 space-y-5">
          <div className="grid grid-cols-2 gap-6">
            {/* Temperature */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-text">Temperature</label>
                <span className="badge badge-muted">{temp.toFixed(1)}</span>
              </div>
              <input type="range" min={0} max={1} step={0.1} value={temp}
                onChange={(e) => setTemp(parseFloat(e.target.value))}
                className="w-full accent-accent" />
              <div className="flex justify-between text-[10px] text-muted">
                <span>Focused</span><span>Creative</span>
              </div>
            </div>
            {/* Dual-pass */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-text">Dual-pass judge</label>
              <p className="text-xs text-muted leading-snug">
                Run judge twice with swapped A/B order.
              </p>
              <Toggle value={dualPass} onChange={setDualPass} />
            </div>
          </div>
          {/* Blind */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text">Blind Battle</label>
            <p className="text-xs text-muted leading-snug">
              Model names hidden until you vote.
            </p>
            <Toggle value={blind} onChange={setBlind} />
          </div>
          {/* URL context */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text">Add URL context</label>
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://example.com/article"
                className="field flex-1 text-sm"
                onKeyDown={async (e) => {
                  if (e.key !== 'Enter') return
                  const url = (e.target as HTMLInputElement).value.trim()
                  if (!url) return
                  setUploadLoading(true); setUploadError('')
                  try { const { text } = await uploadUrl(url); setContextText(text) }
                  catch (err: unknown) { setUploadError((err as Error).message) }
                  finally { setUploadLoading(false) }
                }}
              />
              <span className="text-xs text-muted self-center whitespace-nowrap">Enter</span>
            </div>
          </div>
        </div>
      </details>

    </div>
  )
}

// ── helpers ───────────────────────────────────────────────────────────────────

interface InlineSelectProps {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  badge?: string
  accent?: boolean
  placeholder?: string
}

function InlineSelect({ value, onChange, options, badge, accent, placeholder }: InlineSelectProps) {
  return (
    <div className="flex items-center gap-1.5 bg-white border border-border rounded-lg px-2.5 py-1
                    shrink-0">
      {badge && (
        <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black
                         text-white shrink-0 ${accent ? 'bg-accent' : 'bg-text'}`}>
          {badge}
        </span>
      )}
      <select
        className="text-xs text-text bg-transparent outline-none cursor-pointer max-w-[140px]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 rounded-full transition-colors
        ${value ? 'bg-accent' : 'bg-border'}`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow-card mt-0.5
        transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  )
}
