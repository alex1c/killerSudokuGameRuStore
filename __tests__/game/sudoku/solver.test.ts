import {
	countSolutions,
	isSolvedSudoku,
	isValidSudoku,
	solveSudoku,
} from '../../../src/game/sudoku'
import {
	CLASSIC_PUZZLE,
	CLASSIC_SOLUTION,
	EMPTY_BOARD,
	INVALID_BOARD,
	NO_SOLUTION_BOARD,
} from '../../fixtures/sudoku'

describe('classic sudoku solver', () => {
	it('solves a known puzzle', () => {
		const solved = solveSudoku(CLASSIC_PUZZLE)
		expect(solved).toEqual(CLASSIC_SOLUTION)
		expect(isSolvedSudoku(solved!)).toBe(true)
	})

	it('accepts an already solved valid board', () => {
		expect(isValidSudoku(CLASSIC_SOLUTION)).toBe(true)
		expect(isSolvedSudoku(CLASSIC_SOLUTION)).toBe(true)
		expect(solveSudoku(CLASSIC_SOLUTION)).toEqual(CLASSIC_SOLUTION)
		expect(countSolutions(CLASSIC_SOLUTION, 2)).toBe(1)
	})

	it('rejects an invalid board', () => {
		expect(isValidSudoku(INVALID_BOARD)).toBe(false)
		expect(solveSudoku(INVALID_BOARD)).toBeNull()
		expect(countSolutions(INVALID_BOARD, 2)).toBe(0)
	})

	it('reports no solution for an unsatisfiable board', () => {
		expect(isValidSudoku(NO_SOLUTION_BOARD)).toBe(true)
		expect(solveSudoku(NO_SOLUTION_BOARD)).toBeNull()
		expect(countSolutions(NO_SOLUTION_BOARD, 2)).toBe(0)
	})

	it('detects multiple solutions and respects limit=2', () => {
		const count = countSolutions(EMPTY_BOARD, 2)
		expect(count).toBe(2)
	})

	it('does not mutate the input board', () => {
		const copy = CLASSIC_PUZZLE.slice()
		solveSudoku(CLASSIC_PUZZLE)
		countSolutions(CLASSIC_PUZZLE, 2)
		expect(CLASSIC_PUZZLE).toEqual(copy)
	})
})
