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