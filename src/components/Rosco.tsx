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