export function normalizeWord(s: string) {
  // lower + remove accents/diacritics + trim + collapse hyphens
  const lowered = s.toLowerCase().trim()
  const noMarks = lowered.normalize('NFD').replace(/\p{M}+/gu, '')
  return noMarks.replace(/\s+/g, '').replace(/-+/g, '')
}