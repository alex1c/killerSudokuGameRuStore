/**
 * Board geometry helpers — ensure a true 9×9 grid fits the container.
 *
 * Root cause of “8 columns” clipping: outer board border + overflow:hidden
 * shrank the content box below 9×cellSize, so the last column wrapped/clipped.
 */

import { borders, spacing } from '../theme/tokens'

export interface BoardGeometry {
	/** Pixel size of one cell (integer). */
	cellSize: number
	/** Inner grid edge length = 9 × cellSize (no outer border). */
	gridSize: number
	/** Outer board edge including the outer border ring. */
	boardOuterSize: number
}

/**
 * Compute geometry from the *available* board-container width (already
 * excluding screen padding). Outer border is reserved *outside* the cell grid.
 */
export function computeBoardGeometry(availableWidth: number): BoardGeometry {
	const usable = Math.max(0, availableWidth)
	const capped = Math.min(usable, spacing.boardMaxWidth)
	const outer = borders.outer
	// Leave room for left+right outer border so cells never overflow.
	const innerBudget = Math.max(0, capped - outer * 2)
	const cellSize = Math.max(28, Math.floor(innerBudget / 9))
	const gridSize = cellSize * 9
	const boardOuterSize = gridSize + outer * 2
	return { cellSize, gridSize, boardOuterSize }
}

/**
 * Legacy helper: board size from window width (subtracts screen padding once).
 * Returns the outer board edge length (grid + outer border).
 */
export function computeBoardSize(windowWidth: number): number {
	const available = Math.max(
		0,
		windowWidth - spacing.screenPadding * 2,
	)
	return computeBoardGeometry(available).boardOuterSize
}

/**
 * Cell edge from an outer board size (subtracts outer border first).
 */
export function computeCellSize(boardOuterSize: number): number {
	const inner = Math.max(0, boardOuterSize - borders.outer * 2)
	return inner / 9
}

/**
 * Pure layout assertion helper for tests.
 * Returns per-column widths that sum to exactly gridSize.
 */
export function allocateColumnWidths(gridSize: number): number[] {
	const base = Math.floor(gridSize / 9)
	const widths = Array.from({ length: 9 }, () => base)
	let remainder = gridSize - base * 9
	let index = 0
	while (remainder > 0) {
		widths[index]! += 1
		remainder -= 1
		index = (index + 1) % 9
	}
	return widths
}

/**
 * True when 9 equal cells plus outer borders fit inside outerSize.
 */
export function boardFitsContainer(
	availableWidth: number,
): boolean {
	const geo = computeBoardGeometry(availableWidth)
	const columns = allocateColumnWidths(geo.gridSize)
	const sum = columns.reduce((a, b) => a + b, 0)
	return (
		columns.length === 9 &&
		sum === geo.gridSize &&
		geo.boardOuterSize <= availableWidth + 0.5 &&
		geo.cellSize * 9 === geo.gridSize
	)
}
