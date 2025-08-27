import { GameState, LetterConstraint, LetterState, PlayerId, PlayerState, RoscoSlot } from './types'

export type EngineAction =
  | { type: 'INIT'; alphabet: string[]; rosco: RoscoSlot[]; timePerPlayer: number }
  | { type: 'SET_ACTIVE'; playerId: PlayerId | null }
  | { type: 'TICK' } // called ~10 times/sec while active player's timerRunning=true
  | { type: 'PAUSE'; playerId: PlayerId }
  | { type: 'RESUME'; playerId: PlayerId }
  | { type: 'PASS'; playerId: PlayerId }
  | { type: 'CORRECT'; playerId: PlayerId }
  | { type: 'WRONG'; playerId: PlayerId }

export function createInitialPlayer(id: PlayerId, nLetters: number, time: number): PlayerState {
  return {
    id,
    timeTotal: time,
    timeLeft: time,
    timerRunning: false,
    currentIdx: 0,
    queue: [],
    letterStates: new Array<LetterState>(nLetters).fill('PENDING'),
    score: 0,
    finished: false,
  }
}

function nextAvailableIndex(player: PlayerState): number | null {
  const n = player.letterStates.length
  // prefer queued indices first
  while (player.queue.length) {
    const idx = player.queue.shift()!
    if (player.letterStates[idx] === 'PENDING' || player.letterStates[idx] === 'PASSED') return idx
  }
  // otherwise, walk forward from currentIdx
  for (let k = 0; k < n; k++) {
    const idx = (player.currentIdx + k) % n
    if (player.letterStates[idx] === 'PENDING' || player.letterStates[idx] === 'PASSED') return idx
  }
  return null
}

function allResolved(player: PlayerState): boolean {
  return player.letterStates.every(s => s === 'CORRECT' || s === 'WRONG')
}

export function reducer(state: GameState, action: EngineAction): GameState {
  switch (action.type) {
    case 'INIT': {
      const { alphabet, rosco, timePerPlayer } = action
      return {
        language: 'es',
        alphabet,
        rosco,
        players: {
          J1: createInitialPlayer('J1', rosco.length, timePerPlayer),
          J2: createInitialPlayer('J2', rosco.length, timePerPlayer),
        },
        activePlayerId: null,
        started: true,
        createdAt: Date.now(),
      }
    }
    case 'SET_ACTIVE': {
      const active = action.playerId
      // pause both first, then (optionally) resume chosen
      const J1 = { ...state.players.J1, timerRunning: false }
      const J2 = { ...state.players.J2, timerRunning: false }
      const players = { J1, J2 }
      if (active) players[active].timerRunning = true
      return { ...state, players, activePlayerId: active }
    }
    case 'TICK': {
      const id = state.activePlayerId
      if (!id) return state
      const p = state.players[id]
      if (!p.timerRunning || p.finished) return state
      const timeLeft = Math.max(0, p.timeLeft - 100) // 100ms resolution
      const finished = timeLeft === 0 || allResolved(p)
      return {
        ...state,
        players: { ...state.players, [id]: { ...p, timeLeft, finished, timerRunning: finished ? false : p.timerRunning } },
      }
    }
    case 'PAUSE': {
      const p = state.players[action.playerId]
      return { ...state, players: { ...state.players, [action.playerId]: { ...p, timerRunning: false } } }
    }
    case 'RESUME': {
      const p = state.players[action.playerId]
      return { ...state, players: { ...state.players, [action.playerId]: { ...p, timerRunning: true } } }
    }
    case 'PASS': {
      const id = action.playerId
      const p = state.players[id]
      const idx = p.currentIdx
      if (p.finished) return state
      // mark PASSED and enqueue to end
      const ls = [...p.letterStates]
      ls[idx] = 'PASSED'
      const queue = [...p.queue, idx]
      const nextIdx = nextAvailableIndex({ ...p, letterStates: ls, queue, currentIdx: (idx + 1) % ls.length })
      const updated: PlayerState = {
        ...p,
        letterStates: ls,
        queue,
        currentIdx: nextIdx ?? idx,
        timerRunning: false, // rule: pause on PASAPALABRA
        finished: nextIdx === null || p.timeLeft === 0 || allResolved({ ...p, letterStates: ls, queue }),
      }
      return { ...state, players: { ...state.players, [id]: updated } }
    }
    case 'WRONG': {
      const id = action.playerId
      const p = state.players[id]
      const idx = p.currentIdx
      if (p.finished) return state
      const ls = [...p.letterStates]
      ls[idx] = 'WRONG'
      const nextIdx = nextAvailableIndex({ ...p, letterStates: ls })
      const updated: PlayerState = {
        ...p,
        letterStates: ls,
        currentIdx: nextIdx ?? idx,
        timerRunning: false, // rule: pause on WRONG
        finished: nextIdx === null || p.timeLeft === 0 || allResolved({ ...p, letterStates: ls }),
      }
      return { ...state, players: { ...state.players, [id]: updated } }
    }
    case 'CORRECT': {
      const id = action.playerId
      const p = state.players[id]
      const idx = p.currentIdx
      if (p.finished) return state
      const ls = [...p.letterStates]
      if (ls[idx] !== 'CORRECT') ls[idx] = 'CORRECT'
      const score = p.score + 1
      const nextIdx = nextAvailableIndex({ ...p, letterStates: ls, currentIdx: (idx + 1) % ls.length })
      const finished = nextIdx === null || p.timeLeft === 0 || allResolved({ ...p, letterStates: ls })
      const updated: PlayerState = {
        ...p,
        letterStates: ls,
        currentIdx: nextIdx ?? idx,
        timerRunning: finished ? false : true, // rule: keep running on CORRECT
        score,
        finished,
      }
      return { ...state, players: { ...state.players, [id]: updated } }
    }
  }
}