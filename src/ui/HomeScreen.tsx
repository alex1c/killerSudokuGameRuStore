/**
 * Home screen — Continue / New Game. Never generates a puzzle on open.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
	DIFFICULTY_LABELS,
	type Difficulty,
} from '../game/difficulty'
import { formatElapsed } from '../gameplay'
import {
	computeEditableProgress,
	formatProgressPercent,
	type SavedGameV1,
} from '../storage'
import { colors, spacing } from '../theme'

export interface HomeScreenProps {
	savedGame: SavedGameV1 | null
	onContinue: () => void
	onNewGame: () => void
	/** Development-only Phase 4 QA entry (omit in production). */
	onOpenQa?: () => void
}

export function HomeScreen(props: HomeScreenProps) {
	const { savedGame, onContinue, onNewGame, onOpenQa } = props
	const insets = useSafeAreaInsets()

	const continueMeta = savedGame
		? buildContinueMeta(savedGame)
		: null

	return (
		<View
			style={[
				styles.screen,
				{
					paddingTop: insets.top + 24,
					paddingBottom: insets.bottom + 24,
				},
			]}
		>
			<Text style={styles.title}>Киллер Судоку</Text>
			<Text style={styles.subtitle}>Судоку с суммами</Text>

			<View style={styles.actions}>
				{savedGame && continueMeta ? (
					<Pressable
						onPress={onContinue}
						accessibilityRole="button"
						accessibilityLabel={`Продолжить, ${continueMeta.label}`}
						style={({ pressed }) => [
							styles.primaryButton,
							pressed ? styles.pressed : null,
						]}
					>
						<Text style={styles.primaryText}>Продолжить</Text>
						<Text style={styles.primaryMeta}>{continueMeta.label}</Text>
					</Pressable>
				) : null}

				<Pressable
					onPress={onNewGame}
					accessibilityRole="button"
					accessibilityLabel="Новая игра"
					style={({ pressed }) => [
						savedGame ? styles.secondaryButton : styles.primaryButton,
						pressed ? styles.pressed : null,
					]}
				>
					<Text
						style={
							savedGame ? styles.secondaryText : styles.primaryText
						}
					>
						Новая игра
					</Text>
				</Pressable>

				{typeof __DEV__ !== 'undefined' && __DEV__ && onOpenQa ? (
					<Pressable
						onPress={onOpenQa}
						accessibilityRole="button"
						accessibilityLabel="Phase 4 QA"
						style={({ pressed }) => [
							styles.qaButton,
							pressed ? styles.pressed : null,
						]}
					>
						<Text style={styles.qaText}>QA</Text>
					</Pressable>
				) : null}
			</View>
		</View>
	)
}

function buildContinueMeta(save: SavedGameV1): { label: string } {
	const difficulty = DIFFICULTY_LABELS[save.difficulty as Difficulty]
	const progress = formatProgressPercent(
		computeEditableProgress(save.puzzle.board, save.values),
	)
	const time = formatElapsed(save.elapsedMs)
	return { label: `${difficulty} · ${progress} · ${time}` }
}

const styles = StyleSheet.create({
	screen: {
		flex: 1,
		backgroundColor: colors.background,
		paddingHorizontal: spacing.screenPadding,
	},
	title: {
		fontSize: 32,
		fontWeight: '700',
		color: colors.primaryText,
		textAlign: 'center',
		marginTop: 48,
	},
	subtitle: {
		fontSize: 16,
		color: colors.secondaryText,
		textAlign: 'center',
		marginTop: 8,
		marginBottom: 48,
	},
	actions: {
		gap: 14,
	},
	primaryButton: {
		backgroundColor: colors.playerText,
		borderRadius: 14,
		paddingVertical: 18,
		paddingHorizontal: 20,
		alignItems: 'center',
	},
	primaryText: {
		color: '#FFFFFF',
		fontSize: 18,
		fontWeight: '700',
	},
	primaryMeta: {
		color: '#E8F5E9',
		fontSize: 14,
		marginTop: 6,
	},
	secondaryButton: {
		backgroundColor: colors.boardBackground,
		borderRadius: 14,
		paddingVertical: 18,
		paddingHorizontal: 20,
		alignItems: 'center',
		borderWidth: 1,
		borderColor: colors.keypadBorder,
	},
	secondaryText: {
		color: colors.primaryText,
		fontSize: 18,
		fontWeight: '700',
	},
	qaButton: {
		alignSelf: 'center',
		marginTop: 8,
		paddingVertical: 8,
		paddingHorizontal: 16,
	},
	qaText: {
		color: colors.secondaryText,
		fontSize: 14,
		fontWeight: '600',
	},
	pressed: {
		opacity: 0.88,
	},
})
