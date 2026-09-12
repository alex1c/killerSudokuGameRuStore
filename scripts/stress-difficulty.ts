/**
 * Cross-difficulty correctness stress.
 * Usage: npm run test:engine:stress:difficulty
 */

import {
	countKillerSolutions,
	generateKillerPuzzle,
	validateKillerPuzzle,
} from '../src/game/killer'
import {
	CAGE_PRESETS,
	PLAYABLE_DIFFICULTIES,
} from '../src/game/difficulty'

const PER_PRESET = Number(process.env.KILLER_STRESS_PER_PRESET ?? '100')

function main(): void {
	const started = Date.now()
	let total = 0
	let failed = 0

	for (const difficulty of PLAYABLE_DIFFICULTIES) {
		let generated = 0
		let unique = 0
		let invalid = 0
		const cageCounts: number[] = []
		const givenCounts: number[] = []

		for (let i = 0; i < PER_PRESET; i += 1) {
			const seed = (200000 + difficulty.length * 10000 + i) >>> 0
			try {
				const puzzle = generateKillerPuzzle({
					seed,
					difficultyPreset: difficulty,
				})
				generated += 1
				total += 1
				cageCounts.push(puzzle.cages.length)
				givenCounts.push(puzzle.board.filter((v) => v !== 0).length)

				const validation = validateKillerPuzzle({
					solution: puzzle.solution,
					cages: puzzle.cages,
				})
				if (!validation.valid) {
					invalid += 1
					failed += 1
					continue
				}

				const nodeLimit = CAGE_PRESETS[difficulty].digNodeLimit * 4
				const solutions = countKillerSolutions(
					{ board: puzzle.board, cages: puzzle.cages },
					2,
					nodeLimit,
				)
				if (solutions !== 1) {
					failed += 1
					console.error(
						`[${difficulty}] seed=${seed} non-unique=${solutions}`,
					)
					continue
				}
				unique += 1

				// Determinism
				const again = generateKillerPuzzle({
					seed,
					difficultyPreset: difficulty,
				})
				if (
					again.board.join(',') !== puzzle.board.join(',') ||
					again.cages.length !== puzzle.cages.length
				) {
					failed += 1
					console.error(`[${difficulty}] seed=${seed} non-deterministic`)
				}
			} catch (error) {
				failed += 1
				console.error(
					`[${difficulty}] seed=${seed}`,
					error instanceof Error ? error.message : error,
				)
			}
		}

		const avgCages =
			cageCounts.reduce((a, b) => a + b, 0) / Math.max(1, cageCounts.length)
		const avgGivens =
			givenCounts.reduce((a, b) => a + b, 0) / Math.max(1, givenCounts.length)

		console.log(
			difficulty,
			`generated=${generated}`,
			`unique=${unique}`,
			`invalid=${invalid}`,
			`avgCages=${avgCages.toFixed(1)}`,
			`avgGivens=${avgGivens.toFixed(1)}`,
		)
	}

	console.log('total', total)
	console.log('failed', failed)
	console.log('elapsed', `${Date.now() - started}ms`)

	assertPresetDiversity()

	if (failed > 0 || total < PLAYABLE_DIFFICULTIES.length * PER_PRESET) {
		process.exitCode = 1
	}
}

/**
 * Ensure presets are not identical in generation knobs / typical output.
 */
function assertPresetDiversity(): void {
	const easy = CAGE_PRESETS.easy
	const expert = CAGE_PRESETS.expert
	if (
		easy.maxEmptyCells === expert.maxEmptyCells &&
		easy.sizeWeights.join(',') === expert.sizeWeights.join(',')
	) {
		console.error('presets are not diversified')
		process.exitCode = 1
	}
}

main()
