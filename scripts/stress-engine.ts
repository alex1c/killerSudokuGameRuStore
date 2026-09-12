/**
 * Stress runner for the Killer Sudoku engine.
 *
 * Usage:
 *   npm run test:engine:stress
 *
 * Generates and validates many puzzles. Non-zero exit on any failure.
 */

import {
	countKillerSolutions,
	generateKillerPuzzle,
	validateKillerPuzzle,
} from '../src/game/killer'

interface StressSummary {
	generated: number
	validated: number
	unique: number
	failed: number
	elapsedMs: number
}

function parseCount(): number {
	const fromEnv = Number(process.env.KILLER_STRESS_COUNT ?? '250')
	if (!Number.isFinite(fromEnv) || fromEnv <= 0) {
		return 250
	}
	return Math.floor(fromEnv)
}

function main(): void {
	const target = parseCount()
	const baseSeed = Number(process.env.KILLER_STRESS_SEED ?? '900000')
	const started = Date.now()

	const summary: StressSummary = {
		generated: 0,
		validated: 0,
		unique: 0,
		failed: 0,
		elapsedMs: 0,
	}

	for (let i = 0; i < target; i += 1) {
		const seed = (baseSeed + i) >>> 0
		try {
			const puzzle = generateKillerPuzzle({ seed })
			summary.generated += 1

			const validation = validateKillerPuzzle({
				solution: puzzle.solution,
				cages: puzzle.cages,
			})
			if (!validation.valid) {
				summary.failed += 1
				console.error(
					`[stress] seed=${seed} validation failed:`,
					validation.errors,
				)
				continue
			}
			summary.validated += 1

			const solutions = countKillerSolutions(
				{ board: puzzle.board, cages: puzzle.cages },
				2,
				80_000,
			)
			if (solutions !== 1) {
				summary.failed += 1
				console.error(
					`[stress] seed=${seed} non-unique solutions=${solutions}`,
				)
				continue
			}
			summary.unique += 1
		} catch (error) {
			summary.failed += 1
			console.error(
				`[stress] seed=${seed} error:`,
				error instanceof Error ? error.message : error,
			)
		}
	}

	summary.elapsedMs = Date.now() - started

	console.log('generated', summary.generated)
	console.log('validated', summary.validated)
	console.log('unique', summary.unique)
	console.log('failed', summary.failed)
	console.log('elapsed', `${summary.elapsedMs}ms`)

	if (
		summary.failed > 0 ||
		summary.unique < target ||
		summary.validated < target
	) {
		process.exitCode = 1
	}
}

main()
