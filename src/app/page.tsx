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