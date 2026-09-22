/**
 * Single board cell: digit / user notes, cage sum, highlights, cage borders.
 */

import { memo, useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { CageBorderFlags } from '../gameplay'
import { borders, colors, typography } from '../theme'
import {
	getNoteGridInsets,
	getNoteGridPosition,
	getVisibleNoteDigits,
} from './boardCellVisuals'

export interface BoardCellProps {
	row: number
	col: number
	cellSize: number
	value: number
	notesMask: number
	isGiven: boolean
	cageSum: number | null
	cageBorders: CageBorderFlags
	selected: boolean
	related: boolean
	sameNumber: boolean
	conflict: boolean
	/** Smart Hint highlight (secondary to conflict/selected). */
	hintHighlight?: boolean
	hintTarget?: boolean
	accessibilityLabel: string
	onPress: () => void
}

function BoardCellComponent(props: BoardCellProps) {
	const {
		row,
		col,
		cellSize,
		value,
		notesMask,
		isGiven,
		cageSum,
		cageBorders,
		selected,
		related,
		sameNumber,
		conflict,
		hintHighlight = false,
		hintTarget = false,
		accessibilityLabel,
		onPress,
	} = props

	const backgroundColor = useMemo(() => {
		if (conflict) return colors.conflict
		if (selected) return colors.selected
		if (hintTarget) return colors.toolbarActive
		if (hintHighlight) return colors.related
		if (sameNumber) return colors.sameNumber
		if (related) return colors.related
		return colors.boardBackground
	}, [conflict, selected, sameNumber, related, hintHighlight, hintTarget])

	const digitSize = Math.round(cellSize * typography.digitSizeRatio)
	const sumSize = Math.max(11, Math.round(cellSize * typography.sumSizeRatio))
	const noteSize = Math.max(
		11,
		Math.round(cellSize * Math.max(typography.noteSizeRatio, 0.2)),
	)
	const noteLineHeight = Math.max(
		noteSize + 8,
		Math.ceil(noteSize * 1.35),
	)
	const noteDigits = getVisibleNoteDigits(value, notesMask)
	const noteGridInsets = getNoteGridInsets(cellSize, cageSum !== null)

	const borderTopWidth = row % 3 === 0 ? borders.gridThick : borders.gridThin
	const borderLeftWidth = col % 3 === 0 ? borders.gridThick : borders.gridThin
	const borderRightWidth =
		col === 8 ? borders.gridThick : col % 3 === 2 ? borders.gridThick : 0
	const borderBottomWidth =
		row === 8 ? borders.gridThick : row % 3 === 2 ? borders.gridThick : 0

	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel}
			style={[
				styles.cell,
				{
					width: cellSize,
					height: cellSize,
					backgroundColor,
					borderTopWidth,
					borderLeftWidth,
					borderRightWidth,
					borderBottomWidth,
					borderColor: colors.gridThick,
					borderTopColor:
						row % 3 === 0 ? colors.gridThick : colors.gridThin,
					borderLeftColor:
						col % 3 === 0 ? colors.gridThick : colors.gridThin,
					borderRightColor: colors.gridThick,
					borderBottomColor: colors.gridThick,
				},
			]}
		>
			<View
				pointerEvents="none"
				style={[
					styles.cageInset,
					{
						borderTopWidth: cageBorders.top ? borders.cageInset : 0,
						borderRightWidth: cageBorders.right ? borders.cageInset : 0,
						borderBottomWidth: cageBorders.bottom
							? borders.cageInset
							: 0,
						borderLeftWidth: cageBorders.left ? borders.cageInset : 0,
						borderColor: colors.boardCageBorder,
					},
				]}
			/>
			{cageSum !== null ? (
				<Text
					style={[
						styles.sum,
						{ fontSize: sumSize, lineHeight: sumSize + 1 },
					]}
					numberOfLines={1}
				>
					{cageSum}
				</Text>
			) : null}
			{value !== 0 ? (
				<Text
					style={[
						styles.digit,
						{
							fontSize: digitSize,
						transform: [{ translateX: 2 }, { translateY: 1 }],
							color: conflict
								? colors.conflictText
								: isGiven
									? colors.givenText
									: colors.playerText,
							fontWeight: isGiven ? '700' : '500',
						},
					]}
				>
					{value}
				</Text>
			) : (
				<View
					style={[styles.notesGrid, noteGridInsets]}
					pointerEvents="none"
				>
					{noteDigits.map((digit) => {
						const position = getNoteGridPosition(digit)
						return (
							<View
								key={digit}
								style={[
									styles.noteSlot,
									{
										left: `${(position.col / 3) * 100}%`,
										top: `${(position.row / 3) * 100}%`,
									},
								]}
							>
								<Text
									style={[
										styles.note,
										{
											fontSize: noteSize,
											lineHeight: noteLineHeight,
											minHeight: noteLineHeight,
											height: noteLineHeight,
										},
									]}
								>
									{digit}
								</Text>
							</View>
						)
					})}
				</View>
			)}
		</Pressable>
	)
}

export const BoardCell = memo(BoardCellComponent)

const styles = StyleSheet.create({
	cell: {
		alignItems: 'center',
		justifyContent: 'center',
		overflow: 'hidden',
	},
	cageInset: {
		...StyleSheet.absoluteFill,
		margin: 2,
		borderRadius: 2,
	},
	sum: {
		position: 'absolute',
		top: 1,
		left: 3,
		paddingHorizontal: 2,
		paddingVertical: 0,
		borderRadius: 2,
		backgroundColor: colors.boardBackground,
		color: colors.sumText,
		fontWeight: '600',
		zIndex: 3,
	},
	digit: {
		textAlign: 'center',
		zIndex: 1,
	},
	notesGrid: {
		position: 'absolute',
		top: 12,
		left: 2,
		right: 2,
		bottom: 8,
	},
	noteSlot: {
		position: 'absolute',
		width: '33.333%',
		height: '33.333%',
		alignItems: 'center',
		justifyContent: 'center',
		overflow: 'visible',
	},
	note: {
		textAlign: 'center',
		textAlignVertical: 'center',
		includeFontPadding: true,
		fontWeight: '500',
		color: colors.noteText,
	},
})
