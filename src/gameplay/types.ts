/**
 * Pure gameplay types for Phase 3 interactive loop.
 * Kept free of React Native so selectors/reducer stay Jest-testable.
 */

import type { KillerPuzzle } from '../game/killer'
import type { CellIndex } from '../game/sudoku'

/** Playing vs finished session. */
export type GameStatus = 'playing' | 'completed'

/**
 * Snapshot used by multi-level Undo.
 * Stores enough data to restore auto-cleared neighbor notes.
 */
export interface GameHistoryEntry {
	values: number[]
	notes: number[]
	selectedCell: CellIndex | null
	notesMode: boolean
}

/**
 * Mutable session state for one Killer puzzle.
 * `puzzle.solution` must never be rendered by the UI during play.
 */
export interface GameState {
	/** Immutable generated puzzle (cages + givens + hidden solution). */
	puzzle: KillerPuzzle
	/**
	 * Length-81 player-facing board.
	 * Initialized from puzzle.board (givens); empties start at 0.
	 */
	values: number[]
	/**
	 * Length-81 note bitmasks (bits 1..9).
	 * Empty when the cell has a main value.
	 */
	notes: number[]
	/** Currently selected flat cell index, or null. */
	selectedCell: CellIndex | null
	/** When true, keypad toggles notes instead of main values. */
	notesMode: boolean
	/** Accumulated playtime while paused / completed (ms). */
	timerAccumulatedMs: number
	/**
	 * Wall-clock timestamp when the current running segment started.
	 * `null` means the timer is paused.
	 */
	timerRunningSince: number | null
	status: GameStatus
	/** Undo stack (oldest → newest), capped by HISTORY_LIMIT. */
	history: GameHistoryEntry[]
	/**
	 * Mistake counter foundation for later phases.
	 * Phase 3 does not increment this from hidden solution checks.
	 */
	mistakes: number
}

export type GameAction =
	| { type: 'SELECT_CELL'; cell: CellIndex }
	| { type: 'CLEAR_SELECTION' }
	| { type: 'TOGGLE_NOTES_MODE' }
	| { type: 'INPUT_DIGIT'; digit: number }
	| { type: 'ERASE' }
	| { type: 'UNDO' }
	| { type: 'TIMER_RESUME'; now: number }
	| { type: 'TIMER_PAUSE'; now: number }
	| { type: 'COMPLETE' }
	| { type: 'REPLAY' }
	| { type: 'DEV_FILL_SOLUTION' }

/** Max Undo depth for ordinary play. */
export const HISTORY_LIMIT = 200

/** Bitmask with digits 1–9 set. */
export const FULL_NOTES_MASK = 0b1111111110

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

/**
 * Create a local random seed from time + Math.random (no server).
 */
export function createRandomSeed(): number {
	const mixed =
		Date.now() ^ Math.floor(Math.random() * 0xffffffff) ^ 0x9e3779b9
	return mixed >>> 0
}

/** @deprecated Kept for older tests / docs references. */
export const PHASE2_DEMO_SEED_LABEL = 'phase2-demo-001'
