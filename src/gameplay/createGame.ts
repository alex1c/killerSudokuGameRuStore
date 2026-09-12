/**
 * Create a fresh GameState from a Killer puzzle / seed / difficulty.
 */

import type { Difficulty } from '../game/difficulty'
import { cloneBoard } from '../game/sudoku'
import { generateKillerPuzzle, type KillerPuzzle } from '../game/killer'
import { createEmptyNotes } from './notes'
import {
	createRandomSeed,
	hashSeedLabel,
	type GameState,
} from './types'

/**
 * Build gameplay state from an already-generated puzzle.
 * Timer starts paused — UI resumes after the board is playable.
 */
export function createGameFromPuzzle(puzzle: KillerPuzzle): GameState {
	return {
		puzzle,
		values: cloneBoard(puzzle.board),
		notes: createEmptyNotes(),
		selectedCell: null,
		notesMode: false,
		timerAccumulatedMs: 0,
		timerRunningSince: null,
		status: 'playing',
		history: [],
		mistakes: 0,
	}
}

export interface CreateGameOptions {
	/** Numeric seed override. */
	seed?: number
	/** String label hashed into a seed. */
	seedLabel?: string
	/** Generation profile (not a human difficulty grade). */
	difficulty?: Difficulty
}

/**
 * Resolve a seed from options, or create a fresh local seed.
 */
export function resolveGameSeed(options: CreateGameOptions = {}): number {
	if (options.seed !== undefined) {
		return options.seed >>> 0
	}
	if (options.seedLabel !== undefined) {
		return hashSeedLabel(options.seedLabel)
	}
	return createRandomSeed()
}

/**
 * Generate a Killer puzzle and wrap it in GameState.
 */
export function createGame(options: CreateGameOptions = {}): GameState {
	const seed = resolveGameSeed(options)
	const puzzle = generateKillerPuzzle({
		seed,
		difficultyPreset: options.difficulty ?? 'medium',
	})
	return createGameFromPuzzle(puzzle)
}

/**
 * Replay the same puzzle with cleared progress and timer.
 */
export function createReplayGame(puzzle: KillerPuzzle): GameState {
	return createGameFromPuzzle(puzzle)
}
