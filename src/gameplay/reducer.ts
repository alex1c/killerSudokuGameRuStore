/**
 * Gameplay reducer — pure state transitions for Phase 2 input.
 */

import type { GameAction, GameState } from './types'
import { isGivenCell } from './selectors'

/**
 * Apply a gameplay action. Never mutates the previous state object.
 */
export function gameReducer(
	state: GameState,
	action: GameAction,
): GameState {
	switch (action.type) {
		case 'SELECT_CELL': {
			if (action.cell < 0 || action.cell >= 81) {
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
		case 'INPUT_DIGIT': {
			const { digit } = action
			if (digit < 1 || digit > 9) {
				return state
			}
			if (state.selectedCell === null) {
				return state
			}
			if (isGivenCell(state, state.selectedCell)) {
				return state
			}

			const current = state.values[state.selectedCell] ?? 0
			// Phase 2: same digit keeps the value (no erase-on-repeat).
			if (current === digit) {
				return state
			}

			const values = state.values.slice()
			values[state.selectedCell] = digit
			return {
				...state,
				values,
			}
		}
		default: {
			return state
		}
	}
}
