export function getSpanishAlphabet(includeEnye = true) {
  const base = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('')
  if (!includeEnye) return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
  return base
}