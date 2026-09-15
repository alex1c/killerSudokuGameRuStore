import type { CellIndex, Digit, SudokuBoard } from '../sudoku/types'
import type { KillerCage } from '../killer/cages'

export type CandidateMask = number
export type TechniqueId =
	| 'naked_single'
	| 'hidden_single'
	| 'cage_single'
	| 'cage_combination'
	| 'cage_candidate_elimination'
	| 'rule_of_45'
	| 'locked_candidate'
	| 'cage_intersection'
	| 'innie_outie'

export interface LogicalPuzzle {
	board: SudokuBoard
	cages: readonly KillerCage[]
}

export interface LogicalState {
	values: SudokuBoard
	candidates: CandidateMask[]
}

export interface LogicalStep {
	technique: TechniqueId
	placements: { cell: CellIndex; digit: Digit }[]
	eliminations: { cell: CellIndex; digit: Digit }[]
	relatedCells: CellIndex[]
	cageIds?: string[]
	explanationData: Record<string, unknown>
	difficultyWeight: number
}

export interface LogicalSolveResult {
	solved: boolean
	steps: LogicalStep[]
	finalState: LogicalState
	stalled: boolean
}

export type DifficultyLevel = 'easy' | 'medium' | 'hard' | 'expert' | 'unrated'

export interface DifficultyGrade {
	level: DifficultyLevel
	score: number
	hardestTechnique: TechniqueId | null
	stepCount: number
	techniqueCounts: Partial<Record<TechniqueId, number>>
	solvedLogically: boolean
}

export const FULL_CANDIDATE_MASK = 0b1111111110

export function digitMask(digit: Digit): CandidateMask {
	return 1 << digit
}

export function maskToDigits(mask: CandidateMask): Digit[] {
	const digits: Digit[] = []
	for (let digit = 1; digit <= 9; digit += 1) {
		if ((mask & digitMask(digit as Digit)) !== 0) digits.push(digit as Digit)
	}
	return digits
}

export function countMaskBits(mask: CandidateMask): number {
	let count = 0
	for (let digit = 1; digit <= 9; digit += 1) {
		if ((mask & digitMask(digit as Digit)) !== 0) count += 1
	}
	return count
}
