/**
 * Digit keypad 1–9 with optional dimming for completed digits.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native'
import { ALL_DIGITS, type Digit } from '../game/sudoku'
import { colors, spacing, typography } from '../theme'

export interface NumberKeypadProps {
	onDigit: (digit: Digit) => void
	disabled?: boolean
	/** Digits that already appear 9 times — visually dimmed, still pressable. */
	dimmedDigits?: ReadonlySet<number>
}

export function NumberKeypad(props: NumberKeypadProps) {
	const {
		onDigit,
		disabled = false,
		dimmedDigits = new Set<number>(),
	} = props

	return (
		<View style={styles.row}>
			{ALL_DIGITS.map((digit) => {
				const dimmed = dimmedDigits.has(digit)
				return (
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
							dimmed ? styles.keyDimmed : null,
						]}
					>
						<Text
							style={[
								styles.keyText,
								dimmed ? styles.keyTextDimmed : null,
							]}
						>
							{digit}
						</Text>
					</Pressable>
				)
			})}
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
		minHeight: 48,
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
	keyDimmed: {
		opacity: 0.4,
	},
	keyText: {
		fontSize: typography.keypadDigitSize,
		fontWeight: '600',
		color: colors.primaryText,
	},
	keyTextDimmed: {
		color: colors.keypadDimmed,
	},
})
