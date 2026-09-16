/**
 * Gameplay reducer — Phase 3 notes / erase / undo / timer / completion.
 */

import {
	BOARD_CELLS,
	cloneBoard,
	type CellIndex,
} from '../game/sudoku'
import {
	clearNoteBit,
	cloneNotes,
	toggleNoteBit,
} from './notes'
import {
	getCageCellsFor,
	getRelatedCells,
	isGivenCell,
	isPuzzleSolved,
} from './selectors'
import { pauseTimer, resumeTimer } from './timer'
import {
	HISTORY_LIMIT,
	type GameAction,
	type GameHistoryEntry,
	type GameState,
} from './types'

/**
 * Push a pre-change snapshot onto the undo stack.
 */
function pushHistory(state: GameState): GameHistoryEntry[] {
	const entry: GameHistoryEntry = {
		values: state.values.slice(),
		notes: cloneNotes(state.notes),
		selectedCell: state.selectedCell,
		notesMode: state.notesMode,
	}
	const next = [...state.history, entry]
	if (next.length > HISTORY_LIMIT) {
		return next.slice(next.length - HISTORY_LIMIT)
	}
	return next
}

/**
 * Remove digit notes from related cells (row/col/box) and the same cage.
 */
function autoClearNotes(
	notes: number[],
	values: number[],
	origin: CellIndex,
	digit: number,
	state: GameState,
): number[] {
	const next = notes.slice()
	const related = getRelatedCells(origin)
	for (const cell of related) {
		if (cell === origin) {
			continue
		}
		if ((values[cell] ?? 0) !== 0) {
			continue
		}
		next[cell] = clearNoteBit(next[cell] ?? 0, digit)
	}

	for (const cell of getCageCellsFor(state, origin)) {
		if (cell === origin) {
			continue
		}
		if ((values[cell] ?? 0) !== 0) {
			continue
		}
		next[cell] = clearNoteBit(next[cell] ?? 0, digit)
	}

	next[origin] = 0
	return next
}

/**
 * After a board-changing action, mark completed when the puzzle is solved.
 */
function withCompletionCheck(state: GameState): GameState {
	if (state.status === 'completed') {
		return state
	}
	if (!isPuzzleSolved(state)) {
		return state
	}
	const paused = pauseTimer(
		state.timerAccumulatedMs,
		state.timerRunningSince,
		Date.now(),
	)
	return {
		...state,
		timerAccumulatedMs: paused.accumulatedMs,
		timerRunningSince: paused.runningSince,
		status: 'completed',
		notesMode: false,
	}
}

/**
 * Optional gameplay preferences applied by the reducer (from Settings).
 */
export interface GameplayOptions {
	autoClearNotes?: boolean
}

/**
 * Apply a gameplay action. Never mutates the previous state object.
 */
export function gameReducer(
	state: GameState,
	action: GameAction,
	options: GameplayOptions = {},
): GameState {
	const autoClear = options.autoClearNotes !== false
	if (
		state.status === 'completed' &&
		action.type !== 'REPLAY' &&
		action.type !== 'TIMER_PAUSE' &&
		action.type !== 'TIMER_RESUME'
	) {
		// Completion overlay owns the session until New Game / Replay.
		return state
	}

	switch (action.type) {
		case 'SELECT_CELL': {
			if (action.cell < 0 || action.cell >= BOARD_CELLS) {
				return state
			}
			return {
				...state,
				selectedCell: action.cell,
			}
		}
		case 'CLEAR_SELECTION': {
			return {
				...state,
				selectedCell: null,
			}
		}
		case 'TOGGLE_NOTES_MODE': {
			return {
				...state,
				notesMode: !state.notesMode,
			}
		}
		case 'INPUT_DIGIT': {
			const { digit } = action
			if (digit < 1 || digit > 9) {
				return state
			}
			if (state.selectedCell === null) {
				return state
			}
			const cell = state.selectedCell
			if (isGivenCell(state, cell)) {
				return state
			}

			if (state.notesMode) {
				const main = state.values[cell] ?? 0
				if (main !== 0) {
					return state
				}
				const currentMask = state.notes[cell] ?? 0
				const nextMask = toggleNoteBit(currentMask, digit)
				if (nextMask === currentMask) {
					return state
				}
				const notes = cloneNotes(state.notes)
				notes[cell] = nextMask
				return {
					...state,
					history: pushHistory(state),
					notes,
				}
			}

			const current = state.values[cell] ?? 0
			if (current === digit) {
				return state
			}

			const values = state.values.slice()
			values[cell] = digit
			const notes = autoClear
				? autoClearNotes(
						state.notes,
						values,
						cell,
						digit,
						state,
					)
				: (() => {
						const next = cloneNotes(state.notes)
						next[cell] = 0
						return next
					})()

			return withCompletionCheck({
				...state,
				history: pushHistory(state),
				values,
				notes,
			})
		}
		case 'ERASE': {
			if (state.selectedCell === null) {
				return state
			}
			const cell = state.selectedCell
			if (isGivenCell(state, cell)) {
				return state
			}

			const value = state.values[cell] ?? 0
			const noteMask = state.notes[cell] ?? 0
			if (value === 0 && noteMask === 0) {
				return state
			}

			const values = state.values.slice()
			const notes = cloneNotes(state.notes)
			if (value !== 0) {
				values[cell] = 0
			} else {
				notes[cell] = 0
			}

			return {
				...state,
				history: pushHistory(state),
				values,
				notes,
			}
		}
		case 'UNDO': {
			if (state.history.length === 0) {
				return state
			}
			const previous = state.history[state.history.length - 1]!
			return {
				...state,
				history: state.history.slice(0, -1),
				values: previous.values.slice(),
				notes: cloneNotes(previous.notes),
				selectedCell: previous.selectedCell,
				notesMode: previous.notesMode,
				status: 'playing',
			}
		}
		case 'TIMER_PAUSE': {
			const paused = pauseTimer(
				state.timerAccumulatedMs,
				state.timerRunningSince,
				action.now,
			)
			return {
				...state,
				timerAccumulatedMs: paused.accumulatedMs,
				timerRunningSince: paused.runningSince,
			}
		}
		case 'TIMER_RESUME': {
			if (state.status === 'completed') {
				return state
			}
			const resumed = resumeTimer(
				state.timerAccumulatedMs,
				state.timerRunningSince,
				action.now,
			)
			return {
				...state,
				timerAccumulatedMs: resumed.accumulatedMs,
				timerRunningSince: resumed.runningSince,
			}
		}
		case 'COMPLETE': {
			if (!isPuzzleSolved(state)) {
				return state
			}
			const paused = pauseTimer(
				state.timerAccumulatedMs,
				state.timerRunningSince,
				Date.now(),
			)
			return {
				...state,
				timerAccumulatedMs: paused.accumulatedMs,
				timerRunningSince: paused.runningSince,
				status: 'completed',
				notesMode: false,
			}
		}
		case 'REPLAY': {
			return {
				...state,
				values: cloneBoard(state.puzzle.board),
				notes: Array.from({ length: BOARD_CELLS }, () => 0),
				selectedCell: null,
				notesMode: false,
				timerAccumulatedMs: 0,
				timerRunningSince: null,
				status: 'playing',
				history: [],
				mistakes: 0,
			}
		}
		case 'DEV_FILL_SOLUTION': {
			// Development-only QA helper; production builds never take this path.
			if (typeof __DEV__ !== 'undefined' && !__DEV__) {
				return state
			}
			return withCompletionCheck({
				...state,
				history: pushHistory(state),
				values: cloneBoard(state.puzzle.solution),
				notes: Array.from({ length: BOARD_CELLS }, () => 0),
			})
		}
		default: {
			return state
		}
	}
}
