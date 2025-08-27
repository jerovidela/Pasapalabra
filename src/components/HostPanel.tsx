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