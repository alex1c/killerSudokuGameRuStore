/**
 * Difficulty selection for New Game.
 * Presets change generation knobs — not a human difficulty grade.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
	DIFFICULTY_LABELS,
	PLAYABLE_DIFFICULTIES,
	type Difficulty,
} from '../game/difficulty'
import { colors, spacing } from '../theme'

export interface DifficultyScreenProps {
	onSelect: (difficulty: Difficulty) => void
	onBack: () => void
}

export function DifficultyScreen(props: DifficultyScreenProps) {
	const { onSelect, onBack } = props
	const insets = useSafeAreaInsets()

	return (
		<View
			style={[
				styles.screen,
				{
					paddingTop: insets.top + 16,
					paddingBottom: insets.bottom + 16,
				},
			]}
		>
			<Pressable
				onPress={onBack}
				accessibilityRole="button"
				accessibilityLabel="Назад"
				hitSlop={8}
				style={styles.back}
			>
				<Text style={styles.backText}>← Назад</Text>
			</Pressable>

			<Text style={styles.title}>Новая игра</Text>
			<Text style={styles.hint}>
				Уровни меняют параметры генерации. Это ещё не оценка человеческой
				сложности.
			</Text>

			<View style={styles.list}>
				{PLAYABLE_DIFFICULTIES.map((difficulty) => (
					<Pressable
						key={difficulty}
						onPress={() => onSelect(difficulty)}
						accessibilityRole="button"
						accessibilityLabel={DIFFICULTY_LABELS[difficulty]}
						style={({ pressed }) => [
							styles.item,
							pressed ? styles.pressed : null,
						]}
					>
						<Text style={styles.itemText}>
							{DIFFICULTY_LABELS[difficulty]}
						</Text>
					</Pressable>
				))}
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	screen: {
		flex: 1,
		backgroundColor: colors.background,
		paddingHorizontal: spacing.screenPadding,
	},
	back: {
		alignSelf: 'flex-start',
		marginBottom: 12,
	},
	backText: {
		color: colors.secondaryText,
		fontSize: 16,
		fontWeight: '600',
	},
	title: {
		fontSize: 28,
		fontWeight: '700',
		color: colors.primaryText,
		marginBottom: 8,
	},
	hint: {
		fontSize: 13,
		color: colors.secondaryText,
		marginBottom: 24,
		lineHeight: 18,
	},
	list: {
		gap: 12,
	},
	item: {
		backgroundColor: colors.boardBackground,
		borderRadius: 14,
		paddingVertical: 18,
		paddingHorizontal: 18,
		borderWidth: 1,
		borderColor: colors.keypadBorder,
	},
	itemText: {
		fontSize: 18,
		fontWeight: '700',
		color: colors.primaryText,
		textAlign: 'center',
	},
	pressed: {
		opacity: 0.88,
	},
})
