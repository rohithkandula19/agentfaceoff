import { useCallback, useEffect, useRef, useState } from 'react'
import type { AgentDoneInfo, BattleConfig } from '../types'

const WS_URL = import.meta.env.VITE_WS_URL ?? ''

export interface FollowUpTurn {
  question: string
  tokensA: string
  tokensB: string
  doneA: AgentDoneInfo | null
  doneB: AgentDoneInfo | null
}

export function useFollowUp() {
  const [turns, setTurns] = useState<FollowUpTurn[]>([])
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const turnsRef = useRef<FollowUpTurn[]>(turns)
  turnsRef.current = turns
  const streamingRef = useRef(false)
  streamingRef.current = streaming

  // Close open socket on unmount
  useEffect(() => {
    return () => { wsRef.current?.close() }
  }, [])

  const reset = useCallback(() => {
    wsRef.current?.close()
    wsRef.current = null
    setTurns([])
    setStreaming(false)
    setError(null)
  }, [])

  const sendFollowUp = useCallback((
    question: string,
    originalConfig: BattleConfig,
    initialResponseA: string,
    initialResponseB: string,
  ) => {
    if (streamingRef.current) return
    setStreaming(true)
    setError(null)

    const currentTurns = turnsRef.current
    const turnIdx = currentTurns.length

    const conversationTurns = [
      { user_message: originalConfig.prompt, response_a: initialResponseA, response_b: initialResponseB },
      ...currentTurns.map((t) => ({ user_message: t.question, response_a: t.tokensA, response_b: t.tokensB })),
    ]

    // For strategy_vs_strategy, both agents use the same strategy_model (not individual agent models)
    const modelA = originalConfig.mode === 'strategy_vs_strategy'
      ? originalConfig.strategy_model
      : originalConfig.agent_a_model
    const modelB = originalConfig.mode === 'strategy_vs_strategy'
      ? originalConfig.strategy_model
      : originalConfig.agent_b_model

    const wsConfig = {
      mode: originalConfig.mode === 'strategy_vs_strategy' ? 'strategy_vs_strategy' : 'model_vs_model',
      prompt: question,
      agent_a_model: modelA,
      agent_b_model: modelB,
      strategy_model: originalConfig.strategy_model,
      strategy_a: originalConfig.strategy_a,
      strategy_b: originalConfig.strategy_b,
      temperature: originalConfig.temperature ?? 0.7,
      dual_pass: false,
      conversation_turns: conversationTurns,
      is_followup: true,
    }

    setTurns((prev) => [...prev, { question, tokensA: '', tokensB: '', doneA: null, doneB: null }])

    const ws = new WebSocket(`${WS_URL}/ws/battles`)
    wsRef.current = ws

    ws.onopen = () => ws.send(JSON.stringify(wsConfig))

    ws.onmessage = (event: MessageEvent<string>) => {
      const msg = JSON.parse(event.data) as Record<string, unknown>
      if (msg.type === 'token') {
        const channel = msg.channel as string
        const content = msg.content as string
        setTurns((prev) => {
          const updated = [...prev]
          if (channel === 'agent_a') {
            updated[turnIdx] = { ...updated[turnIdx], tokensA: updated[turnIdx].tokensA + content }
          } else {
            updated[turnIdx] = { ...updated[turnIdx], tokensB: updated[turnIdx].tokensB + content }
          }
          return updated
        })
      } else if (msg.type === 'agent_done') {
        const info = msg as unknown as AgentDoneInfo
        setTurns((prev) => {
          const updated = [...prev]
          if (info.channel === 'agent_a') {
            updated[turnIdx] = { ...updated[turnIdx], doneA: info }
          } else {
            updated[turnIdx] = { ...updated[turnIdx], doneB: info }
          }
          return updated
        })
      } else if (msg.type === 'battle_complete') {
        setStreaming(false)
        ws.close(1000)
      } else if (msg.type === 'error') {
        setError(msg.detail as string)
        setStreaming(false)
      }
    }

    ws.onerror = () => { setError('Connection failed'); setStreaming(false) }
    ws.onclose = (e) => { if (e.code !== 1000) setStreaming(false) }
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return { turns, streaming, error, sendFollowUp, reset, clearError }
}
