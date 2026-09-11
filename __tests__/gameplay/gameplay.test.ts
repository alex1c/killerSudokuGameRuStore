/**
 * Gameplay reducer / selector unit tests for Phase 2.
 */

import { createEmptyBoard, type SudokuBoard } from '../../src/game/sudoku'
import type { KillerCage, KillerPuzzle } from '../../src/game/killer'
import {
	createGameFromPuzzle,
	gameReducer,
	getConflictCells,
	getRelatedCells,
	getSameNumberCells,
	isGivenCell,
	isBoardComplete,
	isBoardValid,
} from '../../src/gameplay'

/**
 * Minimal fixture puzzle: one pair cage + rest singletons as givens omitted.
 * Uses an empty starting board with synthetic cages for conflict tests.
 */
function makePuzzle(
	board: SudokuBoard,
	cages: KillerCage[],
	solution: SudokuBoard = board,
): KillerPuzzle {
	return {
		seed: 1,
		attempt: 0,
		difficultyPreset: 'medium',
		board,
		solution,
		cages,
	}
}

describe('gameplay selection and input', () => {
	const board = createEmptyBoard()
	board[0] = 5 // given
	const cages: KillerCage[] = [
		{ id: 'c0', sum: 5, cells: [0] },
		...Array.from({ length: 80 }, (_, i) => {
			const cell = i + 1
			return {
				id: `c${cell}`,
				sum: 1,
				cells: [cell],
			}
		}),
	]
	const puzzle = makePuzzle(board, cages)
	const base = createGameFromPuzzle(puzzle)

	it('selects an editable cell', () => {
		const next = gameReducer(base, { type: 'SELECT_CELL', cell: 1 })
		expect(next.selectedCell).toBe(1)
		expect(isGivenCell(next, 1)).toBe(false)
	})

	it('selects a given cell without making it editable', () => {
		const next = gameReducer(base, { type: 'SELECT_CELL', cell: 0 })
		expect(next.selectedCell).toBe(0)
		expect(isGivenCell(next, 0)).toBe(true)
	})

	it('writes a value into an editable cell', () => {
		let state = gameReducer(base, { type: 'SELECT_CELL', cell: 1 })
		state = gameReducer(state, { type: 'INPUT_DIGIT', digit: 7 })
		expect(state.values[1]).toBe(7)
	})

	it('replaces an existing player value', () => {
		let state = gameReducer(base, { type: 'SELECT_CELL', cell: 1 })
		state = gameReducer(state, { type: 'INPUT_DIGIT', digit: 7 })
		state = gameReducer(state, { type: 'INPUT_DIGIT', digit: 3 })
		expect(state.values[1]).toBe(3)
	})

	it('does not clear on repeated same digit', () => {
		let state = gameReducer(base, { type: 'SELECT_CELL', cell: 1 })
		state = gameReducer(state, { type: 'INPUT_DIGIT', digit: 7 })
		state = gameReducer(state, { type: 'INPUT_DIGIT', digit: 7 })
		expect(state.values[1]).toBe(7)
	})

	it('cannot change a given', () => {
		let state = gameReducer(base, { type: 'SELECT_CELL', cell: 0 })
		state = gameReducer(state, { type: 'INPUT_DIGIT', digit: 9 })
		expect(state.values[0]).toBe(5)
		expect(state.puzzle.board[0]).toBe(5)
	})

	it('does not mutate the generated puzzle board unexpectedly', () => {
		const original = puzzle.board.slice()
		let state = gameReducer(base, { type: 'SELECT_CELL', cell: 1 })
		state = gameReducer(state, { type: 'INPUT_DIGIT', digit: 4 })
		expect(state.puzzle.board).toEqual(original)
		expect(puzzle.board).toEqual(original)
	})
})

describe('related and same-number selectors', () => {
	it('returns row, column, and box cells', () => {
		const related = getRelatedCells(10) // row1 col1
		expect(related.has(10)).toBe(true)
		expect(related.has(9)).toBe(true) // same row
		expect(related.has(1)).toBe(true) // same col
		expect(related.has(0)).toBe(true) // same box
		expect(related.has(80)).toBe(false)
	})

	it('finds same-number cells across givens and player values', () => {
		const board = createEmptyBoard()
		board[0] = 8
		const cages: KillerCage[] = Array.from({ length: 81 }, (_, cell) => ({
			id: `c${cell}`,
			sum: board[cell] || 1,
			cells: [cell],
		}))
		let state = createGameFromPuzzle(makePuzzle(board, cages))
		state = gameReducer(state, { type: 'SELECT_CELL', cell: 5 })
		state = gameReducer(state, { type: 'INPUT_DIGIT', digit: 8 })
		const same = getSameNumberCells(state, 8)
		expect(same.has(0)).toBe(true)
		expect(same.has(5)).toBe(true)
	})
})

describe('explicit-rule conflicts', () => {
	function stateWithValues(
		values: number[],
		cages: KillerCage[],
	) {
		const board = createEmptyBoard()
		const puzzle = makePuzzle(board, cages, values as SudokuBoard)
		let state = createGameFromPuzzle(puzzle)
		state = {
			...state,
			values: values.slice(),
		}
		return state
	}

	it('detects row conflict', () => {
		const values = createEmptyBoard()
		values[0] = 4
		values[1] = 4
		const cages: KillerCage[] = [
			{ id: 'a', sum: 8, cells: [0, 1] },
			...Array.from({ length: 79 }, (_, i) => ({
				id: `x${i}`,
				sum: 1,
				cells: [i + 2],
			})),
		]
		const conflicts = getConflictCells(stateWithValues(values, cages))
		expect(conflicts.has(0)).toBe(true)
		expect(conflicts.has(1)).toBe(true)
	})

	it('detects column conflict', () => {
		const values = createEmptyBoard()
		values[0] = 6
		values[9] = 6
		const cages: KillerCage[] = Array.from({ length: 81 }, (_, cell) => ({
			id: `c${cell}`,
			sum: 9,
			cells: [cell],
		}))
		const conflicts = getConflictCells(stateWithValues(values, cages))
		expect(conflicts.has(0)).toBe(true)
		expect(conflicts.has(9)).toBe(true)
	})

	it('detects box conflict', () => {
		const values = createEmptyBoard()
		values[0] = 2
		values[11] = 2 // row1 col2 — same top-left box
		const cages: KillerCage[] = Array.from({ length: 81 }, (_, cell) => ({
			id: `c${cell}`,
			sum: 9,
			cells: [cell],
		}))
		const conflicts = getConflictCells(stateWithValues(values, cages))
		expect(conflicts.has(0)).toBe(true)
		expect(conflicts.has(11)).toBe(true)
	})

	it('detects cage duplicate', () => {
		const values = createEmptyBoard()
		values[0] = 3
		values[1] = 3
		const cages: KillerCage[] = [
			{ id: 'pair', sum: 6, cells: [0, 1] },
			...Array.from({ length: 79 }, (_, i) => ({
				id: `c${i + 2}`,
				sum: 1,
				cells: [i + 2],
			})),
		]
		const conflicts = getConflictCells(stateWithValues(values, cages))
		expect(conflicts.has(0)).toBe(true)
		expect(conflicts.has(1)).toBe(true)
	})

	it('detects cage exceeded sum', () => {
		const values = createEmptyBoard()
		values[0] = 9
		values[1] = 8
		const cages: KillerCage[] = [
			{ id: 'pair', sum: 10, cells: [0, 1] },
			...Array.from({ length: 79 }, (_, i) => ({
				id: `c${i + 2}`,
				sum: 1,
				cells: [i + 2],
			})),
		]
		const conflicts = getConflictCells(stateWithValues(values, cages))
		expect(conflicts.has(0)).toBe(true)
		expect(conflicts.has(1)).toBe(true)
	})

	it('detects cage completed with wrong sum', () => {
		const values = createEmptyBoard()
		values[0] = 1
		values[1] = 2
		const cages: KillerCage[] = [
			{ id: 'pair', sum: 10, cells: [0, 1] },
			...Array.from({ length: 79 }, (_, i) => ({
				id: `c${i + 2}`,
				sum: 1,
				cells: [i + 2],
			})),
		]
		const conflicts = getConflictCells(stateWithValues(values, cages))
		expect(conflicts.has(0)).toBe(true)
		expect(conflicts.has(1)).toBe(true)
	})

	it('does not flag a non-conflicting wrong-vs-solution digit', () => {
		// Value 1 in an incomplete multi-cell cage with room left — not an
		// explicit conflict even if it differs from a hidden solution.
		const values = createEmptyBoard()
		values[0] = 1
		const cages: KillerCage[] = [
			{ id: 'pair', sum: 17, cells: [0, 1] },
			...Array.from({ length: 79 }, (_, i) => ({
				id: `c${i + 2}`,
				sum: 9,
				cells: [i + 2],
			})),
		]
		const conflicts = getConflictCells(stateWithValues(values, cages))
		expect(conflicts.has(0)).toBe(false)
	})
})

describe('completion selectors', () => {
	it('reports incomplete boards', () => {
		const board = createEmptyBoard()
		const cages: KillerCage[] = Array.from({ length: 81 }, (_, cell) => ({
			id: `c${cell}`,
			sum: 1,
			cells: [cell],
		}))
		const state = createGameFromPuzzle(makePuzzle(board, cages))
		expect(isBoardComplete(state)).toBe(false)
		expect(isBoardValid(state)).toBe(false)
	})
})
