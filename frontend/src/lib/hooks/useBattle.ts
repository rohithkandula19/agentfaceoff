import { useCallback, useEffect, useReducer, useRef } from 'react'
import type {
  BattleConfig, BattleMode, BattleState, AgentDoneInfo, DebateRound, Verdict,
} from '../types'

const WS_URL = import.meta.env.VITE_WS_URL ?? ''

// ── state machine ─────────────────────────────────────────────────────────────

type Action =
  | { type: 'CONNECTING' }
  | { type: 'SEARCHING' }
  | { type: 'SEARCH_IMAGES'; images: string[] }
  | { type: 'STARTED'; battleId: string; mode: BattleMode; totalRounds: number; isBlind: boolean; modelADisplay: string; modelBDisplay: string }
  | { type: 'DEBATE_ROUND_START'; round: number }
  | { type: 'TOKEN'; channel: 'agent_a' | 'agent_b'; round: number; content: string }
  | { type: 'AGENT_DONE'; info: AgentDoneInfo }
  | { type: 'JUDGING' }
  | { type: 'VERDICT'; verdict: Verdict }
  | { type: 'ERROR'; error: string }
  | { type: 'RESET' }
  | { type: 'SET_VOTE'; vote: 'A' | 'B' }

const initial: BattleState = {
  phase: 'idle',
  mode: 'model_vs_model',
  battleId: null,
  tokensA: '',
  tokensB: '',
  agentA: null,
  agentB: null,
  rounds: [],
  currentRound: 0,
  totalRounds: 1,
  verdict: null,
  error: null,
  userVote: null,
  isBlind: false,
  modelADisplay: '',
  modelBDisplay: '',
  searchImages: [],
}

function upsertRound(rounds: DebateRound[], roundNum: number, patch: Partial<DebateRound>): DebateRound[] {
  const idx = rounds.findIndex((r) => r.roundNum === roundNum)
  if (idx === -1) {
    return [...rounds, { roundNum, tokensA: '', tokensB: '', agentA: null, agentB: null, ...patch }]
  }
  const updated = [...rounds]
  updated[idx] = { ...updated[idx], ...patch }
  return updated
}

function reducer(state: BattleState, action: Action): BattleState {
  switch (action.type) {
    case 'CONNECTING':
      return { ...initial, phase: 'connecting' }

    case 'SEARCHING':
      return { ...state, phase: 'searching' }

    case 'SEARCH_IMAGES':
      return { ...state, searchImages: action.images }

    case 'STARTED':
      return {
        ...state,
        phase: 'streaming',
        battleId: action.battleId,
        mode: action.mode,
        totalRounds: action.totalRounds,
        isBlind: action.isBlind,
        modelADisplay: action.modelADisplay,
        modelBDisplay: action.modelBDisplay,
      }

    case 'DEBATE_ROUND_START':
      return {
        ...state,
        currentRound: action.round,
        rounds: upsertRound(state.rounds, action.round, {}),
      }

    case 'TOKEN': {
      const { channel, round, content } = action
      if (state.mode === 'adversarial_debate') {
        const existing = state.rounds.find((r) => r.roundNum === round)
        const patch = channel === 'agent_a'
          ? { tokensA: (existing?.tokensA ?? '') + content }
          : { tokensB: (existing?.tokensB ?? '') + content }
        return { ...state, rounds: upsertRound(state.rounds, round, patch) }
      }
      return channel === 'agent_a'
        ? { ...state, tokensA: state.tokensA + content }
        : { ...state, tokensB: state.tokensB + content }
    }

    case 'AGENT_DONE': {
      const { info } = action
      if (state.mode === 'adversarial_debate') {
        const patch = info.channel === 'agent_a' ? { agentA: info } : { agentB: info }
        return { ...state, rounds: upsertRound(state.rounds, info.round, patch) }
      }
      return info.channel === 'agent_a'
        ? { ...state, agentA: info }
        : { ...state, agentB: info }
    }

    case 'JUDGING':
      return { ...state, phase: 'judging' }

    case 'VERDICT':
      return { ...state, phase: 'verdict', verdict: action.verdict }

    case 'ERROR':
      return { ...state, phase: 'error', error: action.error }

    case 'RESET':
      return initial

    case 'SET_VOTE':
      return { ...state, userVote: action.vote }
  }
}

// ── hook ──────────────────────────────────────────────────────────────────────

export function useBattle() {
  const [state, dispatch] = useReducer(reducer, initial)
  const wsRef = useRef<WebSocket | null>(null)
  const phaseRef = useRef(state.phase)
  phaseRef.current = state.phase

  // Close WS on unmount to prevent resource leaks
  useEffect(() => {
    return () => { wsRef.current?.close() }
  }, [])

  const startBattle = useCallback((config: BattleConfig) => {
    wsRef.current?.close()
    dispatch({ type: 'CONNECTING' })

    const ws = new WebSocket(`${WS_URL}/ws/battles`)
    wsRef.current = ws

    ws.onopen = () => ws.send(JSON.stringify(config))

    ws.onmessage = (event: MessageEvent<string>) => {
      const msg = JSON.parse(event.data) as Record<string, unknown>
      switch (msg.type) {
        case 'battle_started':
          dispatch({
            type: 'STARTED',
            battleId: msg.battle_id as string,
            mode: msg.mode as BattleMode,
            totalRounds: (msg.max_rounds as number | undefined) ?? 1,
            isBlind: !!config.blind,
            modelADisplay: (msg.model_a_display as string | undefined) ?? '',
            modelBDisplay: (msg.model_b_display as string | undefined) ?? '',
          })
          break
        case 'debate_round_start':
          dispatch({ type: 'DEBATE_ROUND_START', round: msg.round as number })
          break
        case 'token':
          dispatch({
            type: 'TOKEN',
            channel: msg.channel as 'agent_a' | 'agent_b',
            round: (msg.round as number | undefined) ?? 1,
            content: msg.content as string,
          })
          break
        case 'agent_done':
          dispatch({ type: 'AGENT_DONE', info: msg as unknown as AgentDoneInfo })
          break
        case 'searching':
          dispatch({ type: 'SEARCHING' })
          break
        case 'search_images':
          dispatch({ type: 'SEARCH_IMAGES', images: msg.images as string[] })
          break
        case 'judging':
          dispatch({ type: 'JUDGING' })
          break
        case 'verdict':
          dispatch({ type: 'VERDICT', verdict: msg.data as Verdict })
          break
        case 'battle_complete':
          ws.close(1000)
          break
        case 'error':
          dispatch({ type: 'ERROR', error: msg.detail as string })
          break
      }
    }

    ws.onerror = () => dispatch({ type: 'ERROR', error: 'WebSocket connection failed' })
    ws.onclose = (e) => {
      if (e.code !== 1000 && phaseRef.current !== 'verdict' && phaseRef.current !== 'error') {
        dispatch({ type: 'ERROR', error: `Connection closed (code ${e.code})` })
      }
    }
  }, [])

  const reset = useCallback(() => {
    wsRef.current?.close()
    dispatch({ type: 'RESET' })
  }, [])

  const castVote = useCallback((vote: 'A' | 'B') => {
    dispatch({ type: 'SET_VOTE', vote })
  }, [])

  return { state, startBattle, reset, castVote }
}
