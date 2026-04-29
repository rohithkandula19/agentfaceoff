import { useNavigate } from 'react-router-dom'

const STEPS = [
  {
    n: '01',
    title: 'Choose your fighters',
    body: 'Pick any two free LLMs: Llama 4 Scout, Qwen3 32B, Gemma 4, Qwen3 Coder, and more — all on Groq or OpenRouter.',
  },
  {
    n: '02',
    title: 'Watch them respond live',
    body: 'Both agents stream their answers simultaneously, token by token, in a split-screen view.',
  },
  {
    n: '03',
    title: 'An LLM judge decides',
    body: 'A third model scores accuracy, reasoning, clarity, and completeness, then declares a winner.',
  },
]

const FEATURES = [
  {
    icon: '⚡',
    title: 'Parallel execution',
    body: "Agents A and B run concurrently via LangGraph's Send API. Real latency, real competition.",
  },
  {
    icon: '🎲',
    title: 'Position-blind judge',
    body: 'Responses shown to the judge in randomised order every call. Optional dual-pass catches flip-flop verdicts.',
  },
  {
    icon: '📊',
    title: 'Structured verdict',
    body: 'Four rubric dimensions, a radar chart, key differences, and expandable judge reasoning.',
  },
  {
    icon: '🆓',
    title: 'Free models + Groq speed',
    body: 'Llama 4 Scout, Qwen3 32B, Gemma 4, Qwen3 Coder, GPT-OSS, Nemotron Super, plus Groq ultra-fast inference.',
  },
  {
    icon: '🔍',
    title: 'Live web search',
    body: 'Toggle web search on and both models get identical real-time results as context — compare reasoning, not data access.',
  },
]

const CANNED = [
  { a: 'Llama 4 Scout (Groq)', b: 'Llama 3.1 (Groq)',  tag: 'Speed'     },
  { a: 'Qwen3 32B (Groq)',     b: 'Qwen3 Coder',        tag: 'Coding'    },
  { a: 'Llama 4 Scout (Groq)', b: 'Qwen3 32B (Groq)',   tag: 'Reasoning' },
]

export default function Landing() {
  const nav = useNavigate()

  return (
    <div>

      {/* ── Dark hero ────────────────────────────────────────── */}
      <section className="bg-zinc-950 text-white relative overflow-hidden">
        {/* Glow behind VS */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 55% 45% at 50% 55%, rgba(232,108,58,0.1) 0%, transparent 70%)' }}
        />

        <div className="relative mx-auto max-w-5xl px-6 pt-20 pb-24 space-y-14">

          {/* Fighter columns */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6 max-w-2xl mx-auto">
            {/* Fighter A */}
            <div className="flex justify-end">
              <div className="flex items-center gap-3 border border-accent/30 bg-accent/10
                              rounded-2xl px-5 py-3.5 text-right">
                <div>
                  <p className="font-bold text-sm text-white leading-none">Llama 4 Scout</p>
                  <p className="text-[11px] text-accent mt-1">Groq</p>
                </div>
                <span className="h-9 w-9 rounded-full bg-accent flex items-center justify-center
                                 text-sm font-black text-white shrink-0 shadow-lg shadow-accent/40">A</span>
              </div>
            </div>

            {/* VS badge */}
            <div className="flex flex-col items-center">
              <div className="relative">
                <div className="absolute inset-0 bg-accent/40 blur-2xl rounded-full scale-[2]" />
                <div className="relative bg-accent text-white font-black text-base
                                w-14 h-14 rounded-full flex items-center justify-center
                                tracking-wider shadow-xl shadow-accent/50">
                  VS
                </div>
              </div>
            </div>

            {/* Fighter B */}
            <div className="flex justify-start">
              <div className="flex items-center gap-3 border border-white/10 bg-white/5
                              rounded-2xl px-5 py-3.5">
                <span className="h-9 w-9 rounded-full bg-zinc-100 flex items-center justify-center
                                 text-sm font-black text-zinc-900 shrink-0">B</span>
                <div>
                  <p className="font-bold text-sm text-white leading-none">Llama 3.1</p>
                  <p className="text-[11px] text-zinc-400 mt-1">Groq</p>
                </div>
              </div>
            </div>
          </div>

          {/* Headline + CTA */}
          <div className="text-center space-y-5">
            <h1 className="text-5xl sm:text-6xl font-black tracking-tighter leading-[1.05]">
              The AI Arena.
            </h1>
            <p className="text-zinc-400 text-lg leading-relaxed max-w-lg mx-auto">
              Pick two free LLMs, throw them the same question, and let a third model
              judge who answered better, live, token by token.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => nav('/battle')}
                className="bg-accent hover:bg-[#D45E2E] text-white font-bold px-8 py-3
                           rounded-full text-base transition-colors shadow-lg shadow-accent/30"
              >
                Start a Battle →
              </button>
              <button
                onClick={() => nav('/history')}
                className="text-zinc-400 hover:text-white border border-zinc-700
                           hover:border-zinc-500 px-6 py-3 rounded-full text-base transition-colors"
              >
                View History
              </button>
            </div>
          </div>

        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────── */}
      <section className="mx-auto max-w-4xl px-6 py-20 space-y-10">
        <p className="text-xs font-bold tracking-widest text-muted uppercase text-center">
          How it works
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {STEPS.map((s, i) => (
            <div key={s.n} className="relative space-y-3">
              {i < STEPS.length - 1 && (
                <div className="hidden sm:block absolute top-4 left-[calc(100%+1px)] w-full h-px
                                bg-gradient-to-r from-border to-transparent" />
              )}
              <div className="flex items-center gap-3">
                <span className="h-8 w-8 rounded-full bg-accent text-white flex items-center
                                 justify-center text-xs font-black shrink-0">
                  {s.n}
                </span>
              </div>
              <p className="font-bold text-text text-sm">{s.title}</p>
              <p className="text-xs text-muted leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Try a match-up (dark) ─────────────────────────────── */}
      <section className="bg-zinc-950 text-white">
        <div className="mx-auto max-w-4xl px-6 py-20 space-y-8">
          <p className="text-xs font-bold tracking-widest text-zinc-500 uppercase text-center">
            Try a match-up
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {CANNED.map((c) => (
              <button
                key={c.tag}
                onClick={() => nav('/battle')}
                className="group border border-zinc-800 hover:border-accent/50 bg-zinc-900
                           hover:bg-zinc-800/80 rounded-2xl p-5 text-left space-y-4
                           transition-all duration-200"
              >
                <span className="inline-flex items-center gap-1.5 bg-accent/15 text-accent
                                 border border-accent/20 rounded-full px-2.5 py-0.5
                                 text-[10px] font-bold uppercase tracking-widest">
                  {c.tag}
                </span>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full bg-accent text-white text-[8px]
                                     font-black flex items-center justify-center shrink-0">A</span>
                    <p className="text-sm font-semibold text-white truncate">{c.a}</p>
                  </div>
                  <p className="text-[10px] font-bold text-zinc-600 pl-6">vs</p>
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full bg-zinc-200 text-zinc-900 text-[8px]
                                     font-black flex items-center justify-center shrink-0">B</span>
                    <p className="text-sm font-semibold text-white truncate">{c.b}</p>
                  </div>
                </div>
                <p className="text-xs text-accent font-bold group-hover:translate-x-1 transition-transform">
                  Fight →
                </p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Under the hood ───────────────────────────────────── */}
      <section className="mx-auto max-w-4xl px-6 py-20 space-y-8">
        <p className="text-xs font-bold tracking-widest text-muted uppercase text-center">
          Under the hood
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-6 space-y-2 hover:shadow-card-md transition-shadow">
              <div className="flex items-center gap-3">
                <span className="text-xl">{f.icon}</span>
                <p className="font-bold text-sm text-text">{f.title}</p>
              </div>
              <p className="text-xs text-muted leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>


    </div>
  )
}
