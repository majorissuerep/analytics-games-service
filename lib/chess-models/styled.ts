export const BUILTIN_STYLED_OPENING = 'builtin-styled-opening'

export const STYLED_REPERTOIRE_IDS = [
  'white_italian',
  'white_queen_gambit',
  'black_caro_kann',
  'black_slav',
] as const

export type StyledRepertoireId = (typeof STYLED_REPERTOIRE_IDS)[number]
export type ModelColor = 'w' | 'b'

export const STYLED_REPERTOIRES: readonly {
  id: StyledRepertoireId
  label: string
  side: 'white' | 'black'
}[] = [
  { id: 'white_italian', label: 'White · Italian Game', side: 'white' },
  { id: 'white_queen_gambit', label: "White · Queen's Gambit", side: 'white' },
  { id: 'black_caro_kann', label: 'Black · Caro–Kann Defense', side: 'black' },
  { id: 'black_slav', label: 'Black · Slav Defense', side: 'black' },
]

export function defaultStyledRepertoireForModelColor(color: ModelColor): StyledRepertoireId {
  return color === 'w' ? 'white_italian' : 'black_caro_kann'
}

export function styledRepertoiresForModelColor(color: ModelColor) {
  const side = color === 'w' ? 'white' : 'black'
  return STYLED_REPERTOIRES.filter((repertoire) => repertoire.side === side)
}

export const BUILTIN_STYLED_OPENING_MODEL = {
  id: BUILTIN_STYLED_OPENING,
  slug: 'styled-opening-otter',
  displayName: 'Tuned Opening Style',
  description: 'Local selector-conditioned Otter policy with Italian, Queen’s Gambit, Caro–Kann, and Slav repertoires.',
  runtimeId: BUILTIN_STYLED_OPENING,
  revisionId: BUILTIN_STYLED_OPENING,
  sourceType: 'builtin-local',
  license: 'local-research-checkpoint',
  status: 'ready' as const,
}
