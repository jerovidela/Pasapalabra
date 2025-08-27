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