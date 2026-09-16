/**
 * Async createGame helpers for cooperative generation / pool fallback.
 */

import {
	generateKillerPuzzleAsync,
	type GenerateKillerPuzzleAsyncOptions,
} from '../game/killer/generateAsync'
import {
	createGameFromPuzzle,
	resolveGameSeed,
	type CreateGameOptions,
} from './createGame'
import type { GameState } from './types'
import type { KillerPuzzle } from '../game/killer'

export async function createGameAsync(
	options: CreateGameOptions &
		Pick<
			GenerateKillerPuzzleAsyncOptions,
			'cancelToken' | 'digYieldEvery'
		> = {},
): Promise<GameState> {
	const seed = resolveGameSeed(options)
	const puzzle = await generateKillerPuzzleAsync({
		seed,
		difficultyPreset: options.difficulty ?? 'medium',
		cancelToken: options.cancelToken,
		digYieldEvery: options.digYieldEvery,
	})
	return createGameFromPuzzle(puzzle)
}

export function createGameFromPreparedPuzzle(
	puzzle: KillerPuzzle,
): GameState {
	return createGameFromPuzzle(puzzle)
}
