/**
 * Undo / Notes / Erase / Hint toolbar.
 * Notes active state must be unmistakable on a real device.
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
		<View style={styles.wrap}>
			{notesMode ? (
				<Text
					style={styles.notesBanner}
					accessibilityLiveRegion="polite"
				>
					Режим заметок · цифры ставятся мелкими кандидатами
				</Text>
			) : null}
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
					label={notesMode ? 'Заметки' : 'Заметки'}
					subLabel={notesMode ? 'ВКЛ' : 'ВЫКЛ'}
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
		</View>
	)
}

interface ToolbarButtonProps {
	symbol: string
	label: string
	subLabel?: string
	accessibilityLabel: string
	active?: boolean
	disabled?: boolean
	onPress: () => void
}

function ToolbarButton(props: ToolbarButtonProps) {
	const {
		symbol,
		label,
		subLabel,
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
			<Text
				style={[styles.symbol, active ? styles.symbolActive : null]}
			>
				{symbol}
			</Text>
			<Text
				style={[styles.label, active ? styles.labelActive : null]}
			>
				{label}
			</Text>
			{subLabel ? (
				<Text
					style={[
						styles.subLabel,
						active ? styles.subLabelActive : null,
					]}
				>
					{subLabel}
				</Text>
			) : null}
		</Pressable>
	)
}

const styles = StyleSheet.create({
	wrap: {
		paddingHorizontal: spacing.screenPadding,
		marginBottom: 8,
		gap: 6,
	},
	notesBanner: {
		textAlign: 'center',
		fontSize: 13,
		fontWeight: '700',
		color: colors.playerText,
		backgroundColor: colors.toolbarActive,
		borderRadius: 8,
		paddingVertical: 6,
		paddingHorizontal: 10,
		overflow: 'hidden',
	},
	row: {
		flexDirection: 'row',
		gap: spacing.toolbarGap,
	},
	button: {
		flex: 1,
		minHeight: 56,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: colors.toolbarBackground,
		borderRadius: 12,
		borderWidth: 2,
		borderColor: colors.keypadBorder,
		paddingVertical: 6,
	},
	buttonActive: {
		backgroundColor: colors.playerText,
		borderColor: colors.givenText,
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
	symbolActive: {
		color: '#FFFFFF',
	},
	label: {
		fontSize: typography.toolbarLabelSize,
		color: colors.secondaryText,
		fontWeight: '700',
	},
	labelActive: {
		color: '#FFFFFF',
	},
	subLabel: {
		marginTop: 1,
		fontSize: 10,
		fontWeight: '800',
		letterSpacing: 0.6,
		color: colors.secondaryText,
	},
	subLabelActive: {
		color: '#E8F5E9',
	},
})
