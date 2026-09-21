/**
 * 9×9 Killer Sudoku board renderer.
 * Uses measured container width + reserved outer border so all 9 columns fit.
 */

import { useMemo, useState } from 'react'
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import { BOARD_SIZE } from '../game/sudoku'
import {
	buildCellCageMap,
	getCageBorderFlags,
	getCellAccessibilityLabel,
	getCellNotesMask,
	getCellValue,
	getConflictCells,
	getRelatedCells,
	getSameNumberCells,
	isGivenCell,
	type GameState,
} from '../gameplay'
import { borders, colors } from '../theme'
import { BoardCell } from './BoardCell'
import { getCageSumForCell } from './boardCellVisuals'
import { allocateColumnWidths, computeBoardGeometry } from './boardLayout'

export interface KillerBoardProps {
	state: GameState
	boardSize?: number
	onSelectCell: (cell: number) => void
	highlightRelated?: boolean
	highlightSameNumbers?: boolean
	checkAgainstSolution?: boolean
	hintHighlightCells?: ReadonlySet<number>
	hintTargetCells?: ReadonlySet<number>
}

export function KillerBoard(props: KillerBoardProps) {
	const {
		state,
		boardSize: fallbackOuter,
		onSelectCell,
		highlightRelated = true,
		highlightSameNumbers = true,
		checkAgainstSolution = false,
		hintHighlightCells,
		hintTargetCells,
	} = props

	const [measuredWidth, setMeasuredWidth] = useState<number | null>(null)
	const geometry = useMemo(() => {
		if (measuredWidth !== null && measuredWidth > 0) {
			return computeBoardGeometry(measuredWidth)
		}
		if (fallbackOuter !== undefined && fallbackOuter > 0) {
			return computeBoardGeometry(fallbackOuter)
		}
		return computeBoardGeometry(320)
	}, [measuredWidth, fallbackOuter])
	const columnWidths = useMemo(
		() => allocateColumnWidths(geometry.gridSize),
		[geometry.gridSize],
	)
	const cellToCage = useMemo(
		() => buildCellCageMap(state.puzzle.cages),
		[state.puzzle.cages],
	)
	const related = useMemo(() => {
		if (!highlightRelated || state.selectedCell === null) {
			return new Set<number>()
		}
		return getRelatedCells(state.selectedCell)
	}, [state.selectedCell, highlightRelated])
	const sameNumber = useMemo(() => {
		if (!highlightSameNumbers || state.selectedCell === null) {
			return new Set<number>()
		}
		const value = getCellValue(state, state.selectedCell)
		if (value === 0) return new Set<number>()
		return getSameNumberCells(state, value)
	}, [state, highlightSameNumbers])
	const conflicts = useMemo(() => {
		const set = getConflictCells(state)
		if (checkAgainstSolution) {
			for (let i = 0; i < state.values.length; i += 1) {
				const value = state.values[i] ?? 0
				if (value !== 0 && value !== (state.puzzle.solution[i] ?? 0)) {
					set.add(i)
				}
			}
		}
		return set
	}, [state, checkAgainstSolution])
	const handleLayout = (event: LayoutChangeEvent) => {
		const next = Math.floor(event.nativeEvent.layout.width)
		if (next > 0 && next !== measuredWidth) setMeasuredWidth(next)
	}

	const rows = []
	for (let row = 0; row < BOARD_SIZE; row += 1) {
		const cells = []
		for (let col = 0; col < BOARD_SIZE; col += 1) {
			const index = row * BOARD_SIZE + col
			const cellWidth = columnWidths[col]!
			cells.push(
				<BoardCell
					key={index}
					row={row}
					col={col}
					cellSize={cellWidth}
					value={getCellValue(state, index)}
					notesMask={getCellNotesMask(state, index)}
					isGiven={isGivenCell(state, index)}
					cageSum={getCageSumForCell(index, state.puzzle.cages)}
					cageBorders={getCageBorderFlags(index, cellToCage)}
					selected={state.selectedCell === index}
					related={related.has(index)}
					sameNumber={sameNumber.has(index)}
					conflict={conflicts.has(index)}
					hintHighlight={hintHighlightCells?.has(index) ?? false}
					hintTarget={hintTargetCells?.has(index) ?? false}
					accessibilityLabel={getCellAccessibilityLabel(state, index)}
					onPress={() => onSelectCell(index)}
				/>,
			)
		}
		rows.push(
			<View key={`row-${row}`} style={styles.row}>
				{cells}
			</View>,
		)
	}

	return (
		<View style={styles.measure} onLayout={handleLayout}>
			<View
				style={[
					styles.board,
					{
						width: geometry.boardOuterSize,
						height: geometry.boardOuterSize,
						borderWidth: borders.outer,
						borderColor: colors.gridThick,
					},
				]}
				accessibilityLabel="Игровое поле 9 на 9"
			>
				<View style={{ width: geometry.gridSize, height: geometry.gridSize }}>
					{rows}
				</View>
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	measure: { width: '100%', alignItems: 'center' },
	board: {
		backgroundColor: colors.boardBackground,
		alignItems: 'center',
		justifyContent: 'center',
		overflow: 'visible',
	},
	row: { flexDirection: 'row', width: '100%' },
})
