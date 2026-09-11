/**
 * Compute an exact 9×9 board pixel size without leftover rounding drift.
 */

import { spacing } from '../theme/tokens'

/**
 * Return a board edge length divisible by 9 so every cell is equal width.
 */
export function computeBoardSize(windowWidth: number): number {
	const available = Math.max(
		0,
		windowWidth - spacing.screenPadding * 2,
	)
	const capped = Math.min(available, spacing.boardMaxWidth)
	const cell = Math.floor(capped / 9)
	return Math.max(cell * 9, 9 * 28)
}

/**
 * Cell edge length derived from board size.
 */
export function computeCellSize(boardSize: number): number {
	return boardSize / 9
}
