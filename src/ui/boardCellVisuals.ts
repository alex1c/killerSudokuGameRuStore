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

/** Render a cage target exactly once, at the cage's top-left-like anchor. */
export function getCageSumForCell(cell: number, cages: readonly KillerCage[]): number | null {
	for (const cage of cages) {
		if (getCageSumAnchor(cage) === cell) return cage.sum

	}
	return null
}
