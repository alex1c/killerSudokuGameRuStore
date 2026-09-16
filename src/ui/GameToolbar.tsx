/**
 * Undo / Notes / Erase toolbar for Phase 3.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, spacing, typography } from '../theme'

export interface GameToolbarProps {
	notesMode: boolean
	canUndo: boolean
	disabled?: boolean
	onUndo: () => void
	onToggleNotes: () => void
	onErase: () => void
	onHint?: () => void
	hintActive?: boolean
}

export function GameToolbar(props: GameToolbarProps) {
	const {
		notesMode,
		canUndo,
		disabled = false,
		onUndo,
		onToggleNotes,
		onErase,
		onHint,
		hintActive = false,
	} = props

	return (
		<View style={styles.row}>
			<ToolbarButton
				symbol="↶"
				label="Отмена"
				accessibilityLabel="Отменить"
				disabled={disabled || !canUndo}
				onPress={onUndo}
			/>
			<ToolbarButton
				symbol="✎"
				label="Заметки"
				accessibilityLabel={
					notesMode ? 'Заметки включены' : 'Заметки выключены'
				}
				active={notesMode}
				disabled={disabled}
				onPress={onToggleNotes}
			/>
			<ToolbarButton
				symbol="⌫"
				label="Стереть"
				accessibilityLabel="Стереть"
				disabled={disabled}
				onPress={onErase}
			/>
			{onHint ? (
				<ToolbarButton
					symbol="💡"
					label="Подсказка"
					accessibilityLabel="Подсказка"
					active={hintActive}
					disabled={disabled}
					onPress={onHint}
				/>
			) : null}
		</View>
	)
}

interface ToolbarButtonProps {
	symbol: string
	label: string
	accessibilityLabel: string
	active?: boolean
	disabled?: boolean
	onPress: () => void
}

function ToolbarButton(props: ToolbarButtonProps) {
	const {
		symbol,
		label,
		accessibilityLabel,
		active = false,
		disabled = false,
		onPress,
	} = props

	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel}
			accessibilityState={{ disabled, selected: active }}
			style={({ pressed }) => [
				styles.button,
				active ? styles.buttonActive : null,
				pressed && !disabled ? styles.buttonPressed : null,
				disabled ? styles.buttonDisabled : null,
			]}
		>
			<Text style={styles.symbol}>{symbol}</Text>
			<Text style={styles.label}>{label}</Text>
		</Pressable>
	)
}

const styles = StyleSheet.create({
	row: {
		flexDirection: 'row',
		gap: spacing.toolbarGap,
		paddingHorizontal: spacing.screenPadding,
		marginBottom: 8,
	},
	button: {
		flex: 1,
		minHeight: 52,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: colors.toolbarBackground,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: colors.keypadBorder,
		paddingVertical: 6,
	},
	buttonActive: {
		backgroundColor: colors.toolbarActive,
		borderColor: colors.playerText,
	},
	buttonPressed: {
		opacity: 0.85,
	},
	buttonDisabled: {
		opacity: 0.4,
	},
	symbol: {
		fontSize: 20,
		color: colors.primaryText,
		marginBottom: 2,
	},
	label: {
		fontSize: typography.toolbarLabelSize,
		color: colors.secondaryText,
		fontWeight: '600',
	},
})
