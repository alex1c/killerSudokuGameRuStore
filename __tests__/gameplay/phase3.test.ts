/**
 * Phase 3 gameplay tests: notes, erase, undo, timer, completion, new/replay.
 */

import { createEmptyBoard, type SudokuBoard } from '../../src/game/sudoku'
import type { KillerCage, KillerPuzzle } from '../../src/game/killer'
import {
	createGame,
	createGameFromPuzzle,
	formatElapsed,
	gameReducer,
	getElapsedMs,
	hasNote,
	hasPlayerProgress,
	isPuzzleSolved,
	pauseTimer,
	resumeTimer,
} from '../../src/gameplay'

function makePuzzle(
	board: SudokuBoard,
	cages: KillerCage[],
	solution?: SudokuBoard,
): KillerPuzzle {
	return {
		seed: 42,
		attempt: 0,
		difficultyPreset: 'medium',
		board,
		solution: solution ?? board,
		cages,
	}
}

function singletonCages(): KillerCage[] {
	return Array.from({ length: 81 }, (_, cell) => ({
		id: `c${cell}`,
		sum: 1,
		cells: [cell],
	}))
}

function baseState(): ReturnType<typeof createGameFromPuzzle> {
	const board = createEmptyBoard()
	board[0] = 5
	const cages = singletonCages()
	cages[0] = { id: 'c0', sum: 5, cells: [0] }
	return createGameFromPuzzle(makePuzzle(board, cages))
}

describe('notes mode', () => {
	it('adds and toggles notes off', () => {
		let state = baseState()
		state = gameReducer(state, { type: 'SELECT_CELL', cell: 1 })
		state = gameReducer(state, { type: 'TOGGLE_NOTES_MODE' })
		expect(state.notesMode).toBe(true)
		state = gameReducer(state, { type: 'INPUT_DIGIT', digit: 3 })
		expect(hasNote(state.notes[1]!, 3)).toBe(true)
		state = gameReducer(state, { type: 'INPUT_DIGIT', digit: 3 })
		expect(hasNote(state.notes[1]!, 3)).toBe(false)
	})

	it('supports multiple notes', () => {
		let state = baseState()
		state = gameReducer(state, { type: 'SELECT_CELL', cell: 2 })
		state = gameReducer(state, { type: 'TOGGLE_NOTES_MODE' })
		state = gameReducer(state, { type: 'INPUT_DIGIT', digit: 1 })
		state = gameReducer(state, { type: 'INPUT_DIGIT', digit: 5 })
		state = gameReducer(state, { type: 'INPUT_DIGIT', digit: 9 })
		expect(hasNote(state.notes[2]!, 1)).toBe(true)
		expect(hasNote(state.notes[2]!, 5)).toBe(true)
		expect(hasNote(state.notes[2]!, 9)).toBe(true)
	})

	it('blocks notes on givens', () => {
		let state = baseState()
		state = gameReducer(state, { type: 'SELECT_CELL', cell: 0 })
		state = gameReducer(state, { type: 'TOGGLE_NOTES_MODE' })
		state = gameReducer(state, { type: 'INPUT_DIGIT', digit: 2 })
		expect(state.notes[0]).toBe(0)
		expect(state.values[0]).toBe(5)
	})

	it('blocks notes when main value exists', () => {
		let state = baseState()
		state = gameReducer(state, { type: 'SELECT_CELL', cell: 3 })
		state = gameReducer(state, { type: 'INPUT_DIGIT', digit: 4 })
		state = gameReducer(state, { type: 'TOGGLE_NOTES_MODE' })
		state = gameReducer(state, { type: 'INPUT_DIGIT', digit: 7 })
		expect(state.values[3]).toBe(4)
		expect(state.notes[3]).toBe(0)
	})
})

describe('main value and auto-clear notes', () => {
	it('clears own notes when writing a main value', () => {
		let state = baseState()
		state = gameReducer(state, { type: 'SELECT_CELL', cell: 4 })
		state = gameReducer(state, { type: 'TOGGLE_NOTES_MODE' })
		state = gameReducer(state, { type: 'INPUT_DIGIT', digit: 2 })
		state = gameReducer(state, { type: 'TOGGLE_NOTES_MODE' })
		state = gameReducer(state, { type: 'INPUT_DIGIT', digit: 8 })
		expect(state.values[4]).toBe(8)
		expect(state.notes[4]).toBe(0)
	})

	it('auto-clears notes in row, column, box, and cage', () => {
		const board = createEmptyBoard()
		const cages: KillerCage[] = [
			{ id: 'cage', sum: 12, cells: [0, 1, 2] },
			...Array.from({ length: 78 }, (_, i) => ({
				id: `c${i + 3}`,
				sum: 1,
				cells: [i + 3],
			})),
		]
		let state = createGameFromPuzzle(makePuzzle(board, cages))

		// Put note 7 in row neighbor, column neighbor, box neighbor, cage neighbor.
		state = gameReducer(state, { type: 'SELECT_CELL', cell: 1 })
		state = gameReducer(state, { type: 'TOGGLE_NOTES_MODE' })
		state = gameReducer(state, { type: 'INPUT_DIGIT', digit: 7 })

		state = gameReducer(state, { type: 'SELECT_CELL', cell: 9 })
		state = gameReducer(state, { type: 'INPUT_DIGIT', digit: 7 })

		state = gameReducer(state, { type: 'SELECT_CELL', cell: 10 })
		state = gameReducer(state, { type: 'INPUT_DIGIT', digit: 7 })

		state = gameReducer(state, { type: 'SELECT_CELL', cell: 2 })
		state = gameReducer(state, { type: 'INPUT_DIGIT', digit: 7 })

		state = gameReducer(state, { type: 'TOGGLE_NOTES_MODE' })
		state = gameReducer(state, { type: 'SELECT_CELL', cell: 0 })
		state = gameReducer(state, { type: 'INPUT_DIGIT', digit: 7 })

		expect(state.values[0]).toBe(7)
		expect(hasNote(state.notes[1]!, 7)).toBe(false)
		expect(hasNote(state.notes[9]!, 7)).toBe(false)
		expect(hasNote(state.notes[10]!, 7)).toBe(false)
		expect(hasNote(state.notes[2]!, 7)).toBe(false)
	})
})

describe('erase', () => {
	it('erases a main value', () => {
		let state = baseState()
		state = gameReducer(state, { type: 'SELECT_CELL', cell: 1 })
		state = gameReducer(state, { type: 'INPUT_DIGIT', digit: 6 })
		state = gameReducer(state, { type: 'ERASE' })
		expect(state.values[1]).toBe(0)
	})

	it('erases notes when no main value', () => {
		let state = baseState()
		state = gameReducer(state, { type: 'SELECT_CELL', cell: 1 })
		state = gameReducer(state, { type: 'TOGGLE_NOTES_MODE' })
		state = gameReducer(state, { type: 'INPUT_DIGIT', digit: 2 })
		state = gameReducer(state, { type: 'INPUT_DIGIT', digit: 4 })
		state = gameReducer(state, { type: 'ERASE' })
		expect(state.notes[1]).toBe(0)
	})

	it('does not erase givens', () => {
		let state = baseState()
		state = gameReducer(state, { type: 'SELECT_CELL', cell: 0 })
		state = gameReducer(state, { type: 'ERASE' })
		expect(state.values[0]).toBe(5)
	})
})

describe('undo', () => {
	it('undoes value write and replace', () => {
		let state = baseState()
		state = gameReducer(state, { type: 'SELECT_CELL', cell: 1 })
		state = gameReducer(state, { type: 'INPUT_DIGIT', digit: 2 })
		state = gameReducer(state, { type: 'INPUT_DIGIT', digit: 9 })
		expect(state.values[1]).toBe(9)
		state = gameReducer(state, { type: 'UNDO' })
		expect(state.values[1]).toBe(2)
		state = gameReducer(state, { type: 'UNDO' })
		expect(state.values[1]).toBe(0)
	})

	it('undoes erase and note add/remove', () => {
		let state = baseState()
		state = gameReducer(state, { type: 'SELECT_CELL', cell: 1 })
		state = gameReducer(state, { type: 'TOGGLE_NOTES_MODE' })
		state = gameReducer(state, { type: 'INPUT_DIGIT', digit: 3 })
		state = gameReducer(state, { type: 'INPUT_DIGIT', digit: 3 })
		state = gameReducer(state, { type: 'UNDO' })
		expect(hasNote(state.notes[1]!, 3)).toBe(true)
		state = gameReducer(state, { type: 'ERASE' })
		expect(state.notes[1]).toBe(0)
		state = gameReducer(state, { type: 'UNDO' })
		expect(hasNote(state.notes[1]!, 3)).toBe(true)
	})

	it('restores auto-cleared notes', () => {
		const board = createEmptyBoard()
		const cages = singletonCages()
		let state = createGameFromPuzzle(makePuzzle(board, cages))
		state = gameReducer(state, { type: 'SELECT_CELL', cell: 1 })
		state = gameReducer(state, { type: 'TOGGLE_NOTES_MODE' })
		state = gameReducer(state, { type: 'INPUT_DIGIT', digit: 4 })
		state = gameReducer(state, { type: 'TOGGLE_NOTES_MODE' })
		state = gameReducer(state, { type: 'SELECT_CELL', cell: 0 })
		state = gameReducer(state, { type: 'INPUT_DIGIT', digit: 4 })
		expect(hasNote(state.notes[1]!, 4)).toBe(false)
		state = gameReducer(state, { type: 'UNDO' })
		expect(state.values[0]).toBe(0)
		expect(hasNote(state.notes[1]!, 4)).toBe(true)
	})
})

describe('timer helpers', () => {
	it('accumulates, pauses, and resumes without background time', () => {
		let accumulated = 0
		let runningSince: number | null = null
		const t0 = 1_000_000
		;({ accumulatedMs: accumulated, runningSince } = resumeTimer(
			accumulated,
			runningSince,
			t0,
		))
		expect(getElapsedMs(accumulated, runningSince, t0 + 5000)).toBe(5000)

		;({ accumulatedMs: accumulated, runningSince } = pauseTimer(
			accumulated,
			runningSince,
			t0 + 5000,
		))
		expect(runningSince).toBeNull()
		expect(accumulated).toBe(5000)

		// Background gap should not count.
		;({ accumulatedMs: accumulated, runningSince } = resumeTimer(
			accumulated,
			runningSince,
			t0 + 20_000,
		))
		expect(getElapsedMs(accumulated, runningSince, t0 + 21_000)).toBe(6000)
	})

	it('formats under and over one hour', () => {
		expect(formatElapsed(0)).toBe('00:00')
		expect(formatElapsed(5 * 60_000 + 37_000)).toBe('05:37')
		expect(formatElapsed(42 * 60_000 + 18_000)).toBe('42:18')
		expect(formatElapsed(3_600_000 + 3 * 60_000 + 27_000)).toBe('1:03:27')
	})
})

describe('completion and replay', () => {
	it('does not complete incomplete or invalid boards', () => {
		const state = baseState()
		expect(isPuzzleSolved(state)).toBe(false)
		const full = createEmptyBoard().map(() => 1)
		const cages = singletonCages()
		const invalid = createGameFromPuzzle(
			makePuzzle(
				createEmptyBoard(),
				cages,
				full.map(() => 2) as SudokuBoard,
			),
		)
		invalid.values = full
		expect(isPuzzleSolved(invalid)).toBe(false)
	})

	it('marks solved puzzle completed and blocks further edits', () => {
		const solution: SudokuBoard = [
			5, 3, 4, 6, 7, 8, 9, 1, 2,
			6, 7, 2, 1, 9, 5, 3, 4, 8,
			1, 9, 8, 3, 4, 2, 5, 6, 7,
			8, 5, 9, 7, 6, 1, 4, 2, 3,
			4, 2, 6, 8, 5, 3, 7, 9, 1,
			7, 1, 3, 9, 2, 4, 8, 5, 6,
			9, 6, 1, 5, 3, 7, 2, 8, 4,
			2, 8, 7, 4, 1, 9, 6, 3, 5,
			3, 4, 5, 2, 8, 6, 1, 7, 9,
		]
		const board = createEmptyBoard()
		board[0] = solution[0]!
		const cages = singletonCages()
		for (let i = 0; i < 81; i += 1) {
			cages[i] = { id: `c${i}`, sum: solution[i]!, cells: [i] }
		}
		let state = createGameFromPuzzle(makePuzzle(board, cages, solution))
		state = {
			...state,
			values: solution.slice(),
		}
		expect(isPuzzleSolved(state)).toBe(true)
		state = gameReducer(state, { type: 'COMPLETE' })
		expect(state.status).toBe('completed')
		state = gameReducer(state, { type: 'SELECT_CELL', cell: 1 })
		state = gameReducer(state, { type: 'INPUT_DIGIT', digit: 9 })
		expect(state.values[1]).toBe(solution[1])
	})

	it('replays the same seed and clears progress', () => {
		let state = baseState()
		state = gameReducer(state, { type: 'SELECT_CELL', cell: 1 })
		state = gameReducer(state, { type: 'INPUT_DIGIT', digit: 8 })
		const seed = state.puzzle.seed
		state = gameReducer(state, { type: 'REPLAY' })
		expect(state.puzzle.seed).toBe(seed)
		expect(state.values[1]).toBe(0)
		expect(state.notes.every((mask) => mask === 0)).toBe(true)
		expect(state.history).toEqual([])
		expect(state.timerAccumulatedMs).toBe(0)
		expect(state.status).toBe('playing')
	})

	it('new game can use a different seed', () => {
		const a = createGame({ seed: 100 })
		const b = createGame({ seed: 200 })
		expect(a.puzzle.seed).not.toBe(b.puzzle.seed)
		expect(hasPlayerProgress(a)).toBe(false)
	})
})
