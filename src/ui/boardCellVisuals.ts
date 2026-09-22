import type { Digit } from '../game/sudoku'
import type { KillerCage } from '../game/killer'
import { getCageSumAnchor, notesToDigits } from '../gameplay'

/** Only user-entered notes belong on the gameplay board. */
export function getVisibleNoteDigits(value: number, notesMask: number): Digit[] {
	return value === 0 ? notesToDigits(notesMask) : []
}

/** Return the 3x3 note-grid position for a user note digit. */
export function getNoteGridPosition(digit: Digit): { row: number; col: number } {
	const zeroBased = digit - 1
	return { row: Math.floor(zeroBased / 3), col: zeroBased % 3 }
}

export interface NoteGridInsets {
	top: number
	right: number
	bottom: number
	left: number
}

/** Keep the cage target anchor clear while preserving the 3x3 note slots. */
export function getNoteGridInsets(
	cellSize: number,
	hasCageSum: boolean,
): NoteGridInsets {
	if (!hasCageSum) {
		return { top: 12, right: 2, bottom: 8, left: 2 }
	}

	return {
		top: Math.min(15, Math.max(12, Math.round(cellSize * 0.42))),
		right: 2,
		bottom: Math.min(8, Math.max(4, Math.round(cellSize * 0.14))),
		left: 2,
	}
}

/** Render a cage target exactly once, at the cage's top-left-like anchor. */
export function getCageSumForCell(cell: number, cages: readonly KillerCage[]): number | null {
	for (const cage of cages) {
		if (getCageSumAnchor(cage) === cell) return cage.sum
	}
	return null
}
