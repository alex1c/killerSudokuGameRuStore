/**
 * High-level Killer puzzle validation with structured error reporting.
 */

import {
	assertBoardLength,
	type SudokuBoard,
} from '../sudoku/types'
import { isSolvedSudoku, isValidSudoku } from '../sudoku/validation'
import {
	type KillerCage,
	validateCageTopology,
	validateCagesAgainstSolution,
	type CageTopologyError,
} from './cages'

export type KillerValidationErrorCode =
	| 'INVALID_SOLUTION_LENGTH'
	| 'INVALID_SOLUTION_SUDOKU'
	| 'SOLUTION_NOT_COMPLETE'
	| CageTopologyError['code']

export interface KillerValidationError {
	code: KillerValidationErrorCode
	message: string
	cageId?: string
}

export interface KillerValidationResult {
	valid: boolean
	errors: KillerValidationError[]
}

export interface ValidateKillerPuzzleInput {
	solution: SudokuBoard
	cages: readonly KillerCage[]
}

/**
 * Validate a Killer puzzle against Sudoku + cage invariants.
 * Returns structured errors for QA and generator diagnostics.
 */
export function validateKillerPuzzle(
	input: ValidateKillerPuzzleInput,
): KillerValidationResult {
	const errors: KillerValidationError[] = []

	try {
		assertBoardLength(input.solution)
	} catch (error) {
		errors.push({
			code: 'INVALID_SOLUTION_LENGTH',
			message:
				error instanceof Error
					? error.message
					: 'Invalid solution length',
		})
		return { valid: false, errors }
	}

	if (!isValidSudoku(input.solution)) {
		errors.push({
			code: 'INVALID_SOLUTION_SUDOKU',
			message: 'Solution violates classic Sudoku constraints',
		})
	}

	if (!isSolvedSudoku(input.solution)) {
		errors.push({
			code: 'SOLUTION_NOT_COMPLETE',
			message: 'Solution is not a complete valid Sudoku grid',
		})
	}

	for (const error of validateCageTopology(input.cages)) {
		errors.push(error)
	}

	for (const error of validateCagesAgainstSolution(
		input.cages,
		input.solution,
	)) {
		errors.push(error)
	}

	return {
		valid: errors.length === 0,
		errors,
	}
}
