/**
 * Smart Hint types — UI-facing hint session built on LogicalStep.
 * No Russian strings here; formatters produce locale text separately.
 */

import type { CellIndex, Digit } from '../game/sudoku'
import type { LogicalStep, TechniqueId } from '../game/logic'

export type HintLevel = 1 | 2 | 3 | 4

export interface FormattedHint {
	technique: TechniqueId
	level: HintLevel
	/** Russian UI copy for the current level. */
	title: string
	body: string
	highlightCells: CellIndex[]
	targetCells: CellIndex[]
	eliminationHints: { cell: CellIndex; digit: Digit }[]
	canAdvance: boolean
	canApply: boolean
	stalled: boolean
}

export interface HintSession {
	step: LogicalStep | null
	level: HintLevel
	stalled: boolean
}

export type HintProgressAction =
	| { type: 'start' }
	| { type: 'advance' }
	| { type: 'dismiss' }
	| { type: 'apply' }
