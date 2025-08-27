export type LetterConstraint = 'STARTS_WITH' | 'CONTAINS'
export type LetterState = 'PENDING' | 'PASSED' | 'CORRECT' | 'WRONG'

export type Question = {
  id: string
  letter: string // single uppercase letter (A..Z or Ñ)
  prompt: string
  answer: string // canonical answer (single word)
  accepted?: string[]
  language: 'es'
}

export type RoscoSlot = {
  letter: string
  constraint: LetterConstraint
  question: Question
}

export type PlayerId = 'J1' | 'J2'

export type PlayerState = {
  id: PlayerId
  timeTotal: number
  timeLeft: number
  timerRunning: boolean
  currentIdx: number
  queue: number[]
  letterStates: LetterState[] // per rosco index
  score: number
  finished: boolean
}

export type GameState = {
  language: 'es'
  alphabet: string[]
  rosco: RoscoSlot[]
  players: Record<PlayerId, PlayerState>
  activePlayerId: PlayerId | null
  started: boolean
  createdAt: number
}