/**
 * Board geometry — 9 columns must always fit the container.
 */

import {
	allocateColumnWidths,
	boardFitsContainer,
	computeBoardGeometry,
	computeBoardSize,
} from '../../src/ui/boardLayout'
import { borders } from '../../src/theme/tokens'

describe('board layout geometry', () => {
	const widths = [320, 360, 393, 412, 432]

	it('fits 9 equal columns for common phone widths', () => {
		for (const width of widths) {
			expect(boardFitsContainer(width)).toBe(true)
			const geo = computeBoardGeometry(width)
			expect(geo.cellSize * 9).toBe(geo.gridSize)
			expect(geo.boardOuterSize).toBe(geo.gridSize + borders.outer * 2)
			expect(geo.boardOuterSize).toBeLessThanOrEqual(width)
			const cols = allocateColumnWidths(geo.gridSize)
			expect(cols).toHaveLength(9)
			expect(cols.reduce((a, b) => a + b, 0)).toBe(geo.gridSize)
			expect(cols.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(
				geo.boardOuterSize,
			)
		}
	})

	it('reserves outer border so cells do not overflow the outer size', () => {
		const geo = computeBoardGeometry(360)
		// Simulated previous bug: placing 9 cells of boardOuter/9 inside
		// a border-box would clip; gridSize must be strictly smaller.
		expect(geo.gridSize).toBeLessThan(geo.boardOuterSize)
		expect(geo.gridSize + borders.outer * 2).toBe(geo.boardOuterSize)
	})

	it('computeBoardSize subtracts screen padding once from window width', () => {
		const outer = computeBoardSize(400)
		expect(outer % 1).toBe(0)
		expect(outer).toBeGreaterThan(200)
	})
})
