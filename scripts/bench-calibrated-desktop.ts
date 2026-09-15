/**
 * Desktop regression for Phase 6P: 50 accepted puzzles per difficulty.
 * Usage: npx tsx scripts/bench-calibrated-desktop.ts
 */

import { generateKillerPuzzle } from '../src/game/killer'
import { gradeDifficulty } from '../src/game/logic'
import { PLAYABLE_DIFFICULTIES } from '../src/game/difficulty'

const N = Number(process.env.KILLER_BENCH_N ?? '50')

function percentile(sorted: number[], p: number): number {
	if (sorted.length === 0) return 0
	const idx = Math.min(
		sorted.length - 1,
		Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
	)
	return sorted[idx]!
}

for (const difficulty of PLAYABLE_DIFFICULTIES) {
	const times: number[] = []
	const attempts: number[] = []
	const givens: number[] = []
	let wrong = 0
	let unrated = 0
	for (let i = 0; i < N; i += 1) {
		const seed = (2_000_000 + i * 997 + difficulty.length * 131) >>> 0
		const t0 = performance.now()
		const puzzle = generateKillerPuzzle({
			seed,
			difficultyPreset: difficulty,
		})
		times.push(performance.now() - t0)
		attempts.push(puzzle.attempt)
		givens.push(puzzle.board.filter((v) => v !== 0).length)
		const grade = gradeDifficulty({
			board: puzzle.board,
			cages: puzzle.cages,
		}).level
		if (grade === 'unrated') unrated += 1
		if (grade !== difficulty) wrong += 1
	}
	times.sort((a, b) => a - b)
	attempts.sort((a, b) => a - b)
	const avgG =
		givens.reduce((a, b) => a + b, 0) / Math.max(1, givens.length)
	console.log(
		`${difficulty}: n=${N} median=${percentile(times, 50).toFixed(0)} p90=${percentile(times, 90).toFixed(0)} max=${times[times.length - 1]!.toFixed(0)} attMed=${percentile(attempts, 50)} avgGivens=${avgG.toFixed(1)} wrong=${wrong} unrated=${unrated}`,
	)
}
