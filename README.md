# Pasapalabra
# Step-by-step to a functional app (host-only, local room)

Below you have:
1) setup commands
2) minimal Next.js + Tailwind project
3) game engine (TypeScript reducer)
4) local question source (JSON + selector)
5) React UI (rosco + host controls + timers + hotkeys)

This is **host-only**: players reply verbally; the host drives the UI. Each player has an **independent timer**. A letter can be **STARTS_WITH** *or* **CONTAINS** (per-letter constraint).

---

## 0) Create project & install deps

```bash
# Node 18+ recommended
npx create-next-app@latest pasapalabra-rosco --ts --eslint --app --src-dir --tailwind=false
cd pasapalabra-rosco

# Tailwind & deps
npm i -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# (Optional) Icons for UI
npm i lucide-react
```

---

## 1) Tailwind config

**tailwind.config.ts**
```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
export default config
```

**src/app/globals.css**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg: #0f172a; /* slate-900 */
  --card: #111827; /* gray-900 */
}

html, body { height: 100%; }
body { @apply bg-slate-900 text-slate-100; }
button { @apply rounded-2xl px-4 py-2 font-medium; }
```

---

## 2) Shared types & helpers

**src/lib/types.ts**
```ts
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
```

**src/lib/alphabet.ts**
```ts
export function getSpanishAlphabet(includeEnye = true) {
  const base = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('')
  if (!includeEnye) return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
  return base
}
```

**src/lib/normalize.ts**
```ts
export function normalizeWord(s: string) {
  // lower + remove accents/diacritics + trim + collapse hyphens
  const lowered = s.toLowerCase().trim()
  const noMarks = lowered.normalize('NFD').replace(/\p{M}+/gu, '')
  return noMarks.replace(/\s+/g, '').replace(/-+/g, '')
}
```

---

## 3) Local question source (JSON + selector)

**src/data/questions.es.json** (tiny seed; app falls back to generic prompts if a letter lacks data)
```json
[
  {"id":"q-a-1","letter":"A","prompt":"Ave rapaz nocturna.","answer":"aguila","language":"es"},
  {"id":"q-b-1","letter":"B","prompt":"Capital de Bélgica.","answer":"bruselas","language":"es"},
  {"id":"q-c-1","letter":"C","prompt":"País sudamericano con capital en Santiago.","answer":"chile","language":"es"},
  {"id":"q-d-1","letter":"D","prompt":"Científico que formuló la teoría de la evolución.","answer":"darwin","language":"es"},
  {"id":"q-e-1","letter":"E","prompt":"Gigante gaseoso del Sistema Solar con anillos notorios.","answer":"saturno","language":"es"},
  {"id":"q-f-1","letter":"F","prompt":"Instrumento de cuerda frotada, pequeño y agudo.","answer":"violin","language":"es"},
  {"id":"q-m-1","letter":"M","prompt":"Cordillera que recorre la Argentina.","answer":"andess","language":"es"}
]
```
> Note: This is just a **minimal** seed. The app generates **generic prompts** if no suitable question is found for a letter+constraint.

**src/lib/questionSource.ts**
```ts
import local from '@/data/questions.es.json'
import { LetterConstraint, Question, RoscoSlot } from './types'
import { normalizeWord } from './normalize'

function fitsConstraint(q: Question, letter: string, constraint: LetterConstraint) {
  const n = normalizeWord(q.answer)
  const L = normalizeWord(letter)
  if (constraint === 'STARTS_WITH') return n.startsWith(L)
  // CONTAINS: ensure it contains letter anywhere
  return n.includes(L)
}

function genericPrompt(letter: string, constraint: LetterConstraint): Question {
  const id = `generic-${letter}-${constraint}`
  const prompt =
    constraint === 'STARTS_WITH'
      ? `Cualquier palabra válida que empiece con la letra ${letter}.`
      : `Cualquier palabra válida que contenga la letra ${letter}.`
  // we allow host-only veredict, so the canonical answer is not enforced here
  return { id, letter, prompt, answer: letter.toLowerCase(), language: 'es' }
}

export async function buildRosco(
  alphabet: string[],
  constraints: Record<string, LetterConstraint>,
  language: 'es' = 'es',
): Promise<RoscoSlot[]> {
  const pool: Question[] = (local as Question[]).filter(q => q.language === language)
  return alphabet.map(letter => {
    const constraint = constraints[letter]
    const candidates = pool.filter(q => q.letter.toUpperCase() === letter && fitsConstraint(q, letter, constraint))
    const question = candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : genericPrompt(letter, constraint)
    return { letter, constraint, question }
  })
}
```

---

## 4) Game engine (pure reducer + helpers)

**src/lib/gameEngine.ts**
```ts
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
```

---

## 5) UI — Rosco & Panels

**src/components/Rosco.tsx** (SVG ring with letter chips)
```tsx
'use client'
import React from 'react'
import { LetterState } from '@/lib/types'

const COLOR: Record<LetterState, string> = {
  PENDING: 'bg-slate-600',
  PASSED: 'bg-amber-400 text-slate-900',
  CORRECT: 'bg-green-500 text-slate-900',
  WRONG: 'bg-red-500 text-slate-100',
}

export function Rosco({ letters, states, size = 320 }: { letters: string[]; states: LetterState[]; size?: number }) {
  const radius = size / 2 - 24
  const center = size / 2
  return (
    <div style={{ width: size, height: size }} className="relative">
      {letters.map((L, i) => {
        const angle = (2 * Math.PI * i) / letters.length - Math.PI / 2
        const x = center + radius * Math.cos(angle)
        const y = center + radius * Math.sin(angle)
        return (
          <div
            key={i}
            className={`absolute w-9 h-9 rounded-full grid place-items-center text-sm font-bold shadow ${COLOR[states[i]]}`}
            style={{ left: x - 18, top: y - 18 }}
            title={`${L} – ${states[i]}`}
          >
            {L}
          </div>
        )
      })}
      <div className="absolute inset-10 rounded-full border border-slate-700" />
    </div>
  )
}
```

**src/components/PlayerPanel.tsx**
```tsx
'use client'
import React from 'react'
import { Rosco } from './Rosco'
import { PlayerState } from '@/lib/types'

function formatMMSS(ms: number) {
  const s = Math.floor(ms / 1000)
  const mm = String(Math.floor(s / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

export function PlayerPanel({
  title,
  letters,
  player,
  active,
}: {
  title: string
  letters: string[]
  player: PlayerState
  active: boolean
}) {
  return (
    <div className={`rounded-3xl p-4 bg-slate-800 border border-slate-700 ${active ? 'ring-2 ring-cyan-400' : ''}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">{title}</h3>
        <div className={`text-2xl font-bold ${active ? 'text-cyan-300' : 'text-slate-300'}`}>{formatMMSS(player.timeLeft)}</div>
      </div>
      <div className="mt-4 flex items-center gap-6">
        <Rosco letters={letters} states={player.letterStates} />
        <div className="flex-1 space-y-2 text-slate-300">
          <div><span className="font-semibold">Score:</span> {player.score}</div>
          <div><span className="font-semibold">Current index:</span> {player.currentIdx + 1}</div>
          <div><span className="font-semibold">Queue:</span> {player.queue.join(', ') || '—'}</div>
          {player.finished && <div className="text-green-400 font-semibold">Finished</div>}
        </div>
      </div>
    </div>
  )
}
```

**src/components/HostPanel.tsx**
```tsx
'use client'
import React from 'react'
import { GameState, PlayerId } from '@/lib/types'

export function HostPanel({ state, onCmd }: { state: GameState; onCmd: (cmd: string, payload?: any) => void }) {
  const active = state.activePlayerId
  const slot = active != null ? state.rosco[state.players[active].currentIdx] : null

  return (
    <div className="rounded-3xl p-4 bg-slate-800 border border-slate-700">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Host Controls</h3>
        <div className="text-sm text-slate-400">Hotkeys: [1]/[2] select, [Space] pause/resume, [C] correct, [W] wrong, [P] pass</div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <button className="bg-cyan-600 hover:bg-cyan-500" onClick={() => onCmd('SET_ACTIVE', 'J1')}>Active: J1</button>
        <button className="bg-cyan-600 hover:bg-cyan-500" onClick={() => onCmd('SET_ACTIVE', 'J2')}>Active: J2</button>
        <button className="bg-slate-700 hover:bg-slate-600" onClick={() => onCmd('SET_ACTIVE', null)}>Active: none</button>

        <button className="bg-emerald-600 hover:bg-emerald-500" onClick={() => onCmd('CORRECT')}>✅ Correct</button>
        <button className="bg-rose-600 hover:bg-rose-500" onClick={() => onCmd('WRONG')}>❌ Wrong</button>
        <button className="bg-amber-500 hover:bg-amber-400 text-slate-900" onClick={() => onCmd('PASS')}>➿ Pasapalabra</button>

        <button className="bg-slate-700 hover:bg-slate-600" onClick={() => onCmd('PAUSE_RESUME')}>⏯ Pause/Resume active</button>
      </div>

      <div className="mt-6 p-4 rounded-2xl bg-slate-900/60 border border-slate-700">
        {slot ? (
          <>
            <div className="text-sm text-slate-400">Letter: <span className="font-semibold text-slate-200">{slot.letter}</span> · Constraint: <span className="font-semibold text-slate-200">{slot.constraint}</span></div>
            <div className="mt-2 text-lg">{slot.question.prompt}</div>
          </>
        ) : (
          <div className="text-slate-400">Select an active player to see the current definition.</div>
        )}
      </div>
    </div>
  )
}
```

---

## 6) Main page (setup + game view + hotkeys + timers)

**src/app/layout.tsx**
```tsx
import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Pasapalabra — Rosco (Host-only)', description: 'Local room, two players, per-letter constraints' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen">{children}</body>
    </html>
  )
}
```

**src/app/page.tsx**
```tsx
'use client'
import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { getSpanishAlphabet } from '@/lib/alphabet'
import { buildRosco } from '@/lib/questionSource'
import { reducer } from '@/lib/gameEngine'
import { EngineAction } from '@/lib/gameEngine'
import { GameState, LetterConstraint, PlayerId } from '@/lib/types'
import { PlayerPanel } from '@/components/PlayerPanel'
import { HostPanel } from '@/components/HostPanel'

function useEngineTick(dispatch: React.Dispatch<EngineAction>, started: boolean) {
  // 100ms granularity
  useEffect(() => {
    if (!started) return
    const h = setInterval(() => dispatch({ type: 'TICK' }), 100)
    return () => clearInterval(h)
  }, [started, dispatch])
}

export default function Page() {
  const [includeEnye, setIncludeEnye] = useState(true)
  const alphabet = useMemo(() => getSpanishAlphabet(includeEnye), [includeEnye])

  const [constraints, setConstraints] = useState<Record<string, LetterConstraint>>(() => {
    const obj: Record<string, LetterConstraint> = {}
    for (const L of getSpanishAlphabet(true)) obj[L] = Math.random() < 0.5 ? 'STARTS_WITH' : 'CONTAINS'
    return obj
  })

  const [timePerPlayer, setTimePerPlayer] = useState(180_000) // 3 minutes in ms

  const [state, dispatch] = useReducer(reducer, {
    language: 'es',
    alphabet: [],
    rosco: [],
    players: {
      J1: { id: 'J1', timeTotal: timePerPlayer, timeLeft: timePerPlayer, timerRunning: false, currentIdx: 0, queue: [], letterStates: [], score: 0, finished: false },
      J2: { id: 'J2', timeTotal: timePerPlayer, timeLeft: timePerPlayer, timerRunning: false, currentIdx: 0, queue: [], letterStates: [], score: 0, finished: false },
    },
    activePlayerId: null,
    started: false,
    createdAt: Date.now(),
  } as GameState)

  useEngineTick(dispatch, state.started)

  async function startGame() {
    const rosco = await buildRosco(alphabet, constraints)
    dispatch({ type: 'INIT', alphabet, rosco, timePerPlayer })
  }

  function randomizeConstraints() {
    const c: Record<string, LetterConstraint> = {}
    for (const L of alphabet) c[L] = Math.random() < 0.5 ? 'STARTS_WITH' : 'CONTAINS'
    setConstraints(c)
  }

  function setConstraint(letter: string, value: LetterConstraint) {
    setConstraints(prev => ({ ...prev, [letter]: value }))
  }

  function onCmd(cmd: string, payload?: any) {
    if (cmd === 'SET_ACTIVE') {
      const pid = payload as PlayerId | null
      dispatch({ type: 'SET_ACTIVE', playerId: pid })
      return
    }
    const active = state.activePlayerId
    if (!active) return
    switch (cmd) {
      case 'CORRECT':
        dispatch({ type: 'CORRECT', playerId: active })
        break
      case 'WRONG':
        dispatch({ type: 'WRONG', playerId: active })
        break
      case 'PASS':
        dispatch({ type: 'PASS', playerId: active })
        break
      case 'PAUSE_RESUME': {
        const running = state.players[active].timerRunning
        dispatch({ type: running ? 'PAUSE' : 'RESUME', playerId: active })
        break
      }
    }
  }

  // Hotkeys
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!state.started) return
      if (e.key === '1') onCmd('SET_ACTIVE', 'J1')
      else if (e.key === '2') onCmd('SET_ACTIVE', 'J2')
      else if (e.key.toLowerCase() === 'c') onCmd('CORRECT')
      else if (e.key.toLowerCase() === 'w') onCmd('WRONG')
      else if (e.key.toLowerCase() === 'p') onCmd('PASS')
      else if (e.code === 'Space') onCmd('PAUSE_RESUME')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state.started, state.activePlayerId, state.players])

  return (
    <main className="max-w-7xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Pasapalabra — Rosco (Host-only)</h1>

      {!state.started ? (
        <section className="rounded-3xl p-6 bg-slate-800 border border-slate-700">
          <h2 className="text-xl font-semibold">Setup</h2>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="block text-sm text-slate-300">Include Ñ</label>
              <input type="checkbox" checked={includeEnye} onChange={e => setIncludeEnye(e.target.checked)} />
            </div>
            <div className="space-y-2">
              <label className="block text-sm text-slate-300">Time per player (seconds)</label>
              <input
                type="number"
                min={30}
                max={900}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2"
                value={Math.floor(timePerPlayer / 1000)}
                onChange={e => setTimePerPlayer(Number(e.target.value) * 1000)}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm text-slate-300">Constraints</label>
              <div className="flex gap-2">
                <button className="bg-slate-700 hover:bg-slate-600" onClick={randomizeConstraints}>Randomize</button>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-2">
            {alphabet.map(L => (
              <div key={L} className="bg-slate-900 border border-slate-700 rounded-xl p-2">
                <div className="text-center font-semibold">{L}</div>
                <select
                  className="mt-2 w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1"
                  value={constraints[L]}
                  onChange={e => setConstraint(L, e.target.value as LetterConstraint)}
                >
                  <option value="STARTS_WITH">Starts with</option>
                  <option value="CONTAINS">Contains</option>
                </select>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <button className="bg-cyan-600 hover:bg-cyan-500 text-lg" onClick={startGame}>Start Game</button>
          </div>
        </section>
      ) : (
        <>
          <section className="grid md:grid-cols-2 gap-6">
            <PlayerPanel title="Player 1" letters={state.alphabet} player={state.players.J1} active={state.activePlayerId === 'J1'} />
            <PlayerPanel title="Player 2" letters={state.alphabet} player={state.players.J2} active={state.activePlayerId === 'J2'} />
          </section>
          <HostPanel state={state} onCmd={onCmd} />
        </>
      )}

      <footer className="pt-8 text-sm text-slate-400">Rules: Correct → timer keeps running & go next letter. Wrong/Pass → timer pauses. Per-letter constraints.</footer>
    </main>
  )
}
```

---

## 7) Run it

```bash
npm run dev
# open http://localhost:3000
```

**How to play (host):**
1) Setup: choose time & constraints per letter (or Randomize) → Start Game.
2) Choose active player with buttons (or [1]/[2]).
3) Read the prompt, then mark: ✅ Correct / ❌ Wrong / ➿ Pasapalabra.
   - Correct: timer keeps running; moves to next letter.
   - Wrong/Pass: timer pauses automatically; pick who plays next and ⏯ Resume.
4) Repeat until both players finish (all letters resolved or time = 0).

---

## 8) Next steps (DB/AI)
- Replace `buildRosco` with a backend call that queries PostgreSQL.
- Add an offline script that generates questions via an LLM and stores into DB.
- Persist matches locally (localStorage) or server-side.
- Add categories & difficulty; validate single-word answers if you later allow player input.
