/**
 * Create a fresh GameState from a Killer puzzle.
 */

import { cloneBoard } from '../game/sudoku'
import { generateKillerPuzzle, type KillerPuzzle } from '../game/killer'
import {
	hashSeedLabel,
	PHASE2_DEMO_SEED_LABEL,
	type GameState,
} from './types'

/**
 * Build gameplay state from an already-generated puzzle.
 * Copies givens into `values`; does not expose solution to UI paths.
 */
export function createGameFromPuzzle(puzzle: KillerPuzzle): GameState {
	return {
		puzzle,
		values: cloneBoard(puzzle.board),
		selectedCell: null,
		mistakes: 0,
	}
}

export interface CreateGameOptions {
	/** Numeric seed override. Defaults to hashed Phase 2 demo label. */
	seed?: number
	/** String label hashed into a seed (e.g. phase2-demo-001). */
	seedLabel?: string
}

/**
 * Generate a reproducible Phase 2 demo puzzle and wrap it in GameState.
 */
export function createGame(options: CreateGameOptions = {}): GameState {
	const seed =
		options.seed ??
		hashSeedLabel(options.seedLabel ?? PHASE2_DEMO_SEED_LABEL)
	const puzzle = generateKillerPuzzle({ seed })
	return createGameFromPuzzle(puzzle)
}
