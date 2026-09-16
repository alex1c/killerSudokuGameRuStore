/**
 * Smart Hint session — wraps findNextLogicalStep without using the solution.
 */

import {
	findNextLogicalStep,
	initializeLogicalState,
	type LogicalStep,
} from '../game/logic'
import type { GameState } from '../gameplay'
import { formatHint, formatStalledHint } from './formatHint'
import type { FormattedHint, HintLevel, HintSession } from './hintTypes'

/**
 * Build a LogicalPuzzle view from the current player board (givens + entries).
 * Candidates come from initializeLogicalState — never from the hidden solution.
 */
export function findHintStep(state: GameState): LogicalStep | null {
	const puzzle = {
		board: state.values,
		cages: state.puzzle.cages,
	}
	const logical = initializeLogicalState(puzzle)
	return findNextLogicalStep(puzzle, logical)
}

export function createHintSession(state: GameState): HintSession {
	const step = findHintStep(state)
	if (step === null) {
		return { step: null, level: 1, stalled: true }
	}
	return { step, level: 1, stalled: false }
}

export function advanceHintSession(session: HintSession): HintSession {
	if (session.stalled || session.step === null) {
		return session
	}
	if (session.level >= 4) {
		return session
	}
	return {
		...session,
		level: (session.level + 1) as HintLevel,
	}
}

export function presentHint(session: HintSession): FormattedHint {
	if (session.stalled || session.step === null) {
		return formatStalledHint()
	}
	return formatHint(session.step, session.level)
}

/**
 * Apply a placement step to gameplay state via selected cell + digit.
 * Returns null when the step has no placements (eliminations are visual-only).
 */
export function placementFromHint(
	step: LogicalStep,
): { cell: number; digit: number } | null {
	const placement = step.placements[0]
	if (!placement) {
		return null
	}
	return { cell: placement.cell, digit: placement.digit }
}
