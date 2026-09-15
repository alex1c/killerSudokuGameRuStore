import { generateKillerPuzzle, validateKillerPuzzle } from '../src/game/killer'
import { PLAYABLE_DIFFICULTIES, type Difficulty } from '../src/game/difficulty'
import { getCageCombinations } from '../src/game/killer/combinations'
import { isValidSudoku } from '../src/game/sudoku/validation'
import { applyLogicalStep, gradeDifficulty, initializeLogicalState, solveLogically, type LogicalState, type TechniqueId } from '../src/game/logic'

const PER_PRESET = Number(process.env.KILLER_AUDIT_PER_PRESET ?? '250')

interface AuditStats {
	generated: number
	solved: number
	stalled: number
	invalidPlacements: number
	invalidEliminations: number
	solutionCandidatesRemoved: number
	zeroCandidateStates: number
	determinismFailures: number
	mutationFailures: number
	elapsedMs: number
	hardest: Partial<Record<TechniqueId | 'stalled', number>>
}

function solutionCandidateIsPresent(state: LogicalState, solution: number[]): boolean {
	for (let cell = 0; cell < 81; cell += 1) {
		if (state.values[cell] === 0 && (state.candidates[cell]! & (1 << solution[cell]!)) === 0) return false
	}
	return true
}

function cagesRemainViable(state: LogicalState, cages: readonly { sum: number; cells: number[] }[]): boolean {
	for (const cage of cages) {
		const known = new Set<number>()
		let knownSum = 0
		let empty = 0
		for (const cell of cage.cells) {
			const value = state.values[cell]!
			if (value === 0) empty += 1
			else {
				if (known.has(value)) return false
				known.add(value)
				knownSum += value
			}
		}
		if (empty === 0) {
			if (cage.sum !== knownSum) return false
			continue
		}
		if (!getCageCombinations(empty, cage.sum - knownSum, known).length) return false
	}
	return true
}

function main(): void {
	const started = performance.now()
	const stats: AuditStats = { generated: 0, solved: 0, stalled: 0, invalidPlacements: 0, invalidEliminations: 0, solutionCandidatesRemoved: 0, zeroCandidateStates: 0, determinismFailures: 0, mutationFailures: 0, elapsedMs: 0, hardest: {} }
	for (const difficulty of PLAYABLE_DIFFICULTIES) {
		for (let index = 0; index < PER_PRESET; index += 1) {
			const seed = (900000 + difficulty.length * 10000 + index) >>> 0
			const puzzle = generateKillerPuzzle({ seed, difficultyPreset: difficulty })
			if (!validateKillerPuzzle({ solution: puzzle.solution, cages: puzzle.cages }).valid) throw new Error(`${difficulty} seed=${seed} failed authoritative validation`)
			const before = JSON.stringify({ board: puzzle.board, solution: puzzle.solution, cages: puzzle.cages })
			const first = solveLogically(puzzle)
			const after = JSON.stringify({ board: puzzle.board, solution: puzzle.solution, cages: puzzle.cages })
			if (before !== after) stats.mutationFailures += 1
			const second = solveLogically(puzzle)
			const firstTrace = JSON.stringify({ solved: first.solved, stalled: first.stalled, steps: first.steps, finalState: first.finalState })
			const secondTrace = JSON.stringify({ solved: second.solved, stalled: second.stalled, steps: second.steps, finalState: second.finalState })
			const firstGrade = gradeDifficulty(puzzle)
			const secondGrade = gradeDifficulty(puzzle)
			if (firstTrace !== secondTrace || JSON.stringify(firstGrade) !== JSON.stringify(secondGrade)) stats.determinismFailures += 1
			let state = initializeLogicalState(puzzle)
			if (!solutionCandidateIsPresent(state, puzzle.solution)) stats.solutionCandidatesRemoved += 1
			for (const logicalStep of first.steps) {
				for (const placement of logicalStep.placements) if (placement.digit !== puzzle.solution[placement.cell]) stats.invalidPlacements += 1
				for (const elimination of logicalStep.eliminations) if (elimination.digit === puzzle.solution[elimination.cell]) stats.invalidEliminations += 1
				try { state = applyLogicalStep(state, logicalStep) } catch { stats.zeroCandidateStates += 1; break }
				if (!isValidSudoku(state.values) || !cagesRemainViable(state, puzzle.cages)) stats.zeroCandidateStates += 1
				if (!solutionCandidateIsPresent(state, puzzle.solution)) stats.solutionCandidatesRemoved += 1
			}
			if (state.values.some((value, cell) => value === 0 && state.candidates[cell] === 0)) stats.zeroCandidateStates += 1
			stats.generated += 1
			if (first.solved) stats.solved += 1
			else { stats.stalled += 1; stats.hardest.stalled = (stats.hardest.stalled ?? 0) + 1 }
			const grade = firstGrade
			if (grade.hardestTechnique) stats.hardest[grade.hardestTechnique] = (stats.hardest[grade.hardestTechnique] ?? 0) + 1
		}
	}
	stats.elapsedMs = performance.now() - started
	console.log(JSON.stringify(stats, null, 2))
	if (stats.invalidPlacements || stats.invalidEliminations || stats.solutionCandidatesRemoved || stats.zeroCandidateStates || stats.determinismFailures || stats.mutationFailures) process.exitCode = 1
}

main()
