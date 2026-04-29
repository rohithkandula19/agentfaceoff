export interface ModelInfo {
  key: string
  display_name: string
  family: string
  tier: 'FREE' | 'PAID'
  provider: 'groq' | 'openrouter'
  description: string
  context_window: number
}

export interface StrategyInfo {
  key: string
  display_name: string
  description: string
}

export type BattleMode = 'model_vs_model' | 'strategy_vs_strategy' | 'adversarial_debate'

export interface ConversationTurn {
  user_message: string
  response_a: string
  response_b: string
}

export interface BattleConfig {
  mode: BattleMode
  prompt: string
  // Mode 1 & 3
  agent_a_model: string
  agent_b_model: string
  // Mode 2
  strategy_model: string
  strategy_a: string
  strategy_b: string
  // Shared
  judge_model?: string
  system_prompt?: string
  temperature?: number
  dual_pass?: boolean
  // Mode 3
  max_rounds?: number
  // Blind mode
  blind?: boolean
  // Web search
  web_search?: boolean
  // Follow-up chat
  conversation_turns?: ConversationTurn[]
  is_followup?: boolean
}

export interface RubricScores {
  accuracy: number
  reasoning: number
  clarity: number
  completeness: number
}

export interface Verdict {
  winner: 'A' | 'B' | 'tie'
  scores_a: RubricScores
  scores_b: RubricScores
  key_differences: string[]
  reasoning: string
}

export interface AgentDoneInfo {
  channel: 'agent_a' | 'agent_b'
  round: number
  model_display_name: string
  latency_ms: number
  error: string | null
}

export interface DebateRound {
  roundNum: number
  tokensA: string
  tokensB: string
  agentA: AgentDoneInfo | null
  agentB: AgentDoneInfo | null
}

export type BattlePhase = 'idle' | 'connecting' | 'searching' | 'streaming' | 'judging' | 'verdict' | 'error'

export interface BattleState {
  phase: BattlePhase
  mode: BattleMode
  battleId: string | null
  // Mode 1 & 2: single round
  tokensA: string
  tokensB: string
  agentA: AgentDoneInfo | null
  agentB: AgentDoneInfo | null
  // Mode 3: multi-round
  rounds: DebateRound[]
  currentRound: number
  totalRounds: number
  verdict: Verdict | null
  error: string | null
  // Blind mode
  userVote?: 'A' | 'B' | null
  isBlind?: boolean
  // Model display names (available from battle_started, before agent_done)
  modelADisplay: string
  modelBDisplay: string
  // Web search images
  searchImages: string[]
}

export interface HistoryBattle {
  battle_id: string
  mode: string
  agent_a_model: string
  agent_a_display_name: string
  agent_b_model: string
  agent_b_display_name: string
  judge_model: string
  winner: string | null
  created_at: string
}

export interface SharedBattleAgent {
  model_key: string
  model_display_name: string
  response: string
  error: string | null
  latency_ms: number
}

export interface SharedBattle {
  battle_id: string
  mode: string
  prompt: string
  system_prompt: string | null
  judge_model: string
  temperature: number
  dual_pass: boolean
  agent_a: SharedBattleAgent
  agent_b: SharedBattleAgent
  verdict: Verdict | null
  created_at: string
}
