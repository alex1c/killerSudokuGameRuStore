/**
 * Phase 6: calibrated difficulty generation tests.
 */

import {
	calibrateBoardToGrade,
	countKillerSolutions,
	generateKillerPuzzle,
	KillerPuzzleGenerationError,
	validateKillerPuzzle,
} from '../../../src/game/killer'
import { PLAYABLE_DIFFICULTIES, type Difficulty } from '../../../src/game/difficulty'
import { gradeDifficulty } from '../../../src/game/logic'

describe('calibrated generateKillerPuzzle', () => {
	it.each(PLAYABLE_DIFFICULTIES)(
		'returns only %s when %s is requested',
		(difficulty: Difficulty) => {
			const puzzle = generateKillerPuzzle({
				seed: 42_000 + difficulty.length * 17,
				difficultyPreset: difficulty,
			})
			expect(puzzle.difficultyPreset).toBe(difficulty)
			expect(
				validateKillerPuzzle({
					solution: puzzle.solution,
					cages: puzzle.cages,
				}).valid,
			).toBe(true)
			expect(
				countKillerSolutions(
					{ board: puzzle.board, cages: puzzle.cages },
					2,
				),
			).toBe(1)
			const grade = gradeDifficulty({
				board: puzzle.board,
				cages: puzzle.cages,
			})
			expect(grade.level).toBe(difficulty)
			expect(grade.level).not.toBe('unrated')
			expect(grade.solvedLogically).toBe(true)
		},
	)

	it('is deterministic for the same seed and difficulty including retries', () => {
		for (const difficulty of PLAYABLE_DIFFICULTIES) {
			const seed = 55_000 + difficulty.length * 91
			const a = generateKillerPuzzle({
				seed,
				difficultyPreset: difficulty,
			})
			const b = generateKillerPuzzle({
				seed,
				difficultyPreset: difficulty,
			})
			expect(a.board).toEqual(b.board)
			expect(a.cages).toEqual(b.cages)
			expect(a.solution).toEqual(b.solution)
			expect(a.attempt).toBe(b.attempt)
		}
	})

	it('fails in a bounded controlled way without silent fallback', () => {
		expect(() =>
			generateKillerPuzzle({
				seed: 7,
				difficultyPreset: 'expert',
				maxAttempts: 0,
			}),
		).toThrow(KillerPuzzleGenerationError)

		try {
			generateKillerPuzzle({
				seed: 7,
				difficultyPreset: 'hard',
				maxAttempts: 0,
			})
			throw new Error('expected throw')
		} catch (error) {
			expect(error).toBeInstanceOf(KillerPuzzleGenerationError)
			const generationError = error as KillerPuzzleGenerationError
			expect(generationError.attempts).toBe(0)
			expect(generationError.targetDifficulty).toBe('hard')
			expect(generationError.message).toContain('target=hard')
			expect(generationError.message).not.toContain('fallback')
		}
	})

	it('does not accept unrated as any playable grade', () => {
		// Smoke across a small seed band: every success must be the request.
		for (const difficulty of PLAYABLE_DIFFICULTIES) {
			for (let i = 0; i < 3; i += 1) {
				const puzzle = generateKillerPuzzle({
					seed: (90_000 + difficulty.length * 1000 + i) >>> 0,
					difficultyPreset: difficulty,
				})
				const grade = gradeDifficulty({
					board: puzzle.board,
					cages: puzzle.cages,
				})
				expect(grade.level).toBe(difficulty)
			}
		}
	})
})

describe('calibrateBoardToGrade', () => {
	it('returns null when the dug board is already easier than target', () => {
		const easy = generateKillerPuzzle({
			seed: 12345,
			difficultyPreset: 'easy',
		})
		const result = calibrateBoardToGrade({
			solution: easy.solution,
			cages: easy.cages,
			board: easy.board,
			removedCells: [],
			target: 'expert',
			fillSeed: 1,
		})
		expect(result).toBeNull()
	})
})
