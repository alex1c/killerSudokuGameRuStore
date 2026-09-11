/**
 * Digit keypad 1–9 for Phase 2 input.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ALL_DIGITS, type Digit } from '../game/sudoku'
import { colors, spacing, typography } from '../theme'

export interface NumberKeypadProps {
	onDigit: (digit: Digit) => void
	disabled?: boolean
}

export function NumberKeypad(props: NumberKeypadProps) {
	const { onDigit, disabled = false } = props
	const insets = useSafeAreaInsets()

	return (
		<View
			style={[
				styles.row,
				{ paddingBottom: Math.max(insets.bottom, 8) },
			]}
		>
			{ALL_DIGITS.map((digit) => (
				<Pressable
					key={digit}
					disabled={disabled}
					onPress={() => onDigit(digit)}
					accessibilityRole="button"
					accessibilityLabel={`Цифра ${digit}`}
					style={({ pressed }) => [
						styles.key,
						pressed && !disabled ? styles.keyPressed : null,
						disabled ? styles.keyDisabled : null,
					]}
				>
					<Text style={styles.keyText}>{digit}</Text>
				</Pressable>
			))}
		</View>
	)
}

const styles = StyleSheet.create({
	row: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		gap: spacing.keypadGap,
		width: '100%',
		paddingHorizontal: spacing.screenPadding,
	},
	key: {
		flex: 1,
		minHeight: 52,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: colors.keypadBackground,
		borderRadius: 10,
		borderWidth: 1,
		borderColor: colors.keypadBorder,
	},
	keyPressed: {
		backgroundColor: colors.related,
	},
	keyDisabled: {
		opacity: 0.45,
	},
	keyText: {
		fontSize: typography.keypadDigitSize,
		fontWeight: '600',
		color: colors.primaryText,
	},
})
