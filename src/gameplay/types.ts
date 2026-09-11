/**
 * Pure gameplay types for Phase 2 board interaction.
 * Kept free of React Native so selectors/reducer stay Jest-testable.
 */

import type { KillerPuzzle } from '../game/killer'
import type { CellIndex } from '../game/sudoku'

/**
 * Mutable session state for one Killer puzzle.
 * `puzzle.solution` must never be rendered by the UI.
 */
export interface GameState {
	/** Immutable generated puzzle (cages + givens + hidden solution). */
	puzzle: KillerPuzzle
	/**
	 * Length-81 player-facing board.
	 * Initialized from puzzle.board (givens); empties start at 0.
	 */
	values: number[]
	/** Currently selected flat cell index, or null. */
	selectedCell: CellIndex | null
	/**
	 * Mistake counter foundation for later phases.
	 * Phase 2 does not increment this from hidden solution checks.
	 */
	mistakes: number
}

export type GameAction =
	| { type: 'SELECT_CELL'; cell: CellIndex }
	| { type: 'INPUT_DIGIT'; digit: number }
	| { type: 'CLEAR_SELECTION' }

/** Stable development seed label for Cursor ↔ Codex shared boards. */
export const PHASE2_DEMO_SEED_LABEL = 'phase2-demo-001'

/**
 * FNV-1a 32-bit hash so string seeds map to reproducible numeric seeds.
 */
export function hashSeedLabel(label: string): number {
	let hash = 0x811c9dc5
	for (let i = 0; i < label.length; i += 1) {
		hash ^= label.charCodeAt(i)
		hash = Math.imul(hash, 0x01000193)
	}
	return hash >>> 0
}
