/**
 * Profile generateKillerPuzzle across difficulty presets.
 * Usage: npm run profile:generator
 */

import { performance } from 'node:perf_hooks'
import {
	PLAYABLE_DIFFICULTIES,
	type Difficulty,
} from '../src/game/difficulty'
import { generateKillerPuzzle } from '../src/game/killer'

const SEEDS = Number(process.env.KILLER_PROFILE_SEEDS ?? '20')

function percentile(sorted: number[], p: number): number {
	if (sorted.length === 0) {
		return 0
	}
	const idx = Math.min(
		sorted.length - 1,
		Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
	)
	return sorted[idx]!
}

function main(): void {
	console.log(`profile seeds=${SEEDS}`)
	for (const difficulty of PLAYABLE_DIFFICULTIES) {
		const times: number[] = []
		const attempts: number[] = []
		const givens: number[] = []
		let cageOnly = 0

		for (let i = 0; i < SEEDS; i += 1) {
			const seed = (12_000 + i * 17) >>> 0
			const t0 = performance.now()
			const puzzle = generateKillerPuzzle({
				seed,
				difficultyPreset: difficulty as Difficulty,
			})
			const ms = performance.now() - t0
			times.push(ms)
			attempts.push(puzzle.attempt)
			const givenCount = puzzle.board.filter((v) => v !== 0).length
			givens.push(givenCount)
			if (givenCount === 0) {
				cageOnly += 1
			}
		}

		times.sort((a, b) => a - b)
		const mean = times.reduce((a, b) => a + b, 0) / times.length
		const avgAttempts =
			attempts.reduce((a, b) => a + b, 0) / attempts.length
		const avgGivens = givens.reduce((a, b) => a + b, 0) / givens.length

		console.log(
			difficulty,
			`min=${times[0]!.toFixed(0)}`,
			`median=${percentile(times, 50).toFixed(0)}`,
			`p90=${percentile(times, 90).toFixed(0)}`,
			`max=${times[times.length - 1]!.toFixed(0)}`,
			`mean=${mean.toFixed(0)}`,
			`avgAttempts=${avgAttempts.toFixed(2)}`,
			`avgGivens=${avgGivens.toFixed(1)}`,
			`cageOnly%=${((cageOnly / SEEDS) * 100).toFixed(0)}`,
		)
	}
}

main()
