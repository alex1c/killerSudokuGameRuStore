/**
 * Note bitmask helpers (bits 1..9).
 */

import type { Digit } from '../game/sudoku'
import { BOARD_CELLS } from '../game/sudoku'

/** Empty notes grid for a new game. */
export function createEmptyNotes(): number[] {
	return Array.from({ length: BOARD_CELLS }, () => 0)
}

/** True when note digit is present in the cell mask. */
export function hasNote(mask: number, digit: number): boolean {
	return (mask & (1 << digit)) !== 0
}

/** Toggle a note digit in a mask. */
export function toggleNoteBit(mask: number, digit: number): number {
	return mask ^ (1 << digit)
}

/** Remove a note digit from a mask. */
export function clearNoteBit(mask: number, digit: number): number {
	return mask & ~(1 << digit)
}

/** List active note digits ascending. */
export function notesToDigits(mask: number): Digit[] {
	const digits: Digit[] = []
	for (let digit = 1; digit <= 9; digit += 1) {
		if (hasNote(mask, digit)) {
			digits.push(digit as Digit)
		}
	}
	return digits
}

/** Clone a notes array. */
export function cloneNotes(notes: readonly number[]): number[] {
	return notes.slice()
}
