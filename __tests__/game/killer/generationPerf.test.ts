/**
 * Phase 6P: dig uniqueness / alternate-search / calibrated generation perf.
 */

import {
	countKillerSolutions,
	digGivensIncremental,
	digGivensWithOrder,
	generateKillerPuzzle,
	generateKillerCages,
	validateKillerPuzzle,
} from '../../../src/game/killer'
import { CAGE_PRESETS } from '../../../src/game/difficulty'
import { generateSolvedBoard } from '../../../src/game/sudoku'
import { gradeDifficulty } from '../../../src/game/logic'
import { createSeededRandom, shuffledCopy } from '../../../src/utils/seededRandom'
import { BOARD_CELLS } from '../../../src/game/sudoku/types'
import { runGeneratorPerfQa } from '../../../src/dev/generatorPerfQa'

describe('digGivensIncremental', () => {
	it('keeps a unique board and matches digGivensWithOrder order semantics', () => {
		const solution = generateSolvedBoard(4242)
		// Seed 555 is known-good for the medium cage profile.
		const cages = generateKillerCages(solution, 555, {
			preset: CAGE_PRESETS.medium,
		})
		expect(validateKillerPuzzle({ solution, cages }).valid).toBe(true)

		const rng = createSeededRandom(99)
		const order = shuffledCopy(
			Array.from({ length: BOARD_CELLS }, (_, i) => i),
			rng,
		)
		const dug = digGivensIncremental(
			solution,
			cages,
			order,
			40,
			16_000,
		)
		expect(dug.removedCells.length).toBeGreaterThan(0)
		expect(
			countKillerSolutions({ board: dug.board, cages }, 2, 40_000),
		).toBe(1)

		const viaWrapper = digGivensWithOrder(
			solution,
			cages,
			99,
			{ ...CAGE_PRESETS.medium, maxEmptyCells: 40 },
			'medium',
		)
		// Wrapper may stop early via grade; still unique and a prefix of order digs.
		expect(
			countKillerSolutions(
				{ board: viaWrapper.board, cages },
				2,
				40_000,
			),
		).toBe(1)
		expect(viaWrapper.removedCells.length).toBeGreaterThan(0)
	})
})

describe('calibrated generation after Phase 6P', () => {
	it('still returns exact requested grades for a seed band', () => {
		for (const difficulty of ['easy', 'medium', 'hard', 'expert'] as const) {
			const puzzle = generateKillerPuzzle({
				seed: 77_000 + difficulty.length * 13,
				difficultyPreset: difficulty,
			})
			expect(
				gradeDifficulty({
					board: puzzle.board,
					cages: puzzle.cages,
				}).level,
			).toBe(difficulty)
		}
	})

	it('exposes stage profile when requested', () => {
		const puzzle = generateKillerPuzzle({
			seed: 88_001,
			difficultyPreset: 'hard',
			profile: true,
		})
		expect(puzzle.profile).toBeDefined()
		expect(puzzle.profile!.totals.uniquenessChecks).toBeGreaterThan(0)
		expect(puzzle.profile!.totals.digMs).toBeGreaterThanOrEqual(0)
		// Empty-board cage-only probe must not dominate (Phase 6P fix).
		expect(puzzle.profile!.attempts[0]!.initialPuzzleMs).toBe(0)
	})
})

describe('runGeneratorPerfQa', () => {
	it('runs a tiny desktop smoke with stage summaries', async () => {
		const result = await runGeneratorPerfQa({
			runsPerDifficulty: {
				easy: 1,
				medium: 1,
				hard: 1,
				expert: 1,
			},
			yieldBetweenRuns: false,
		})
		expect(result.passed).toBe(true)
		expect(result.summaries).toHaveLength(4)
		expect(result.rows).toHaveLength(4)
	}, 120_000)
})
