/**
 * Calm completion overlay for a solved Killer puzzle.
 */

import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, spacing } from '../theme'

export interface CompletionOverlayProps {
	visible: boolean
	elapsedLabel: string
	onNewGame: () => void
	onReplay: () => void
}

export function CompletionOverlay(props: CompletionOverlayProps) {
	const { visible, elapsedLabel, onNewGame, onReplay } = props

	return (
		<Modal visible={visible} transparent animationType="fade">
			<View style={styles.scrim}>
				<View style={styles.card}>
					<Text style={styles.title}>Готово!</Text>
					<Text style={styles.meta}>Сложность: Классическая</Text>
					<Text style={styles.meta}>Время: {elapsedLabel}</Text>
					<Text style={styles.praise}>Отличная работа</Text>

					<Pressable
						onPress={onNewGame}
						accessibilityRole="button"
						accessibilityLabel="Новая игра"
						style={({ pressed }) => [
							styles.primaryButton,
							pressed ? styles.pressed : null,
						]}
					>
						<Text style={styles.primaryText}>Новая игра</Text>
					</Pressable>

					<Pressable
						onPress={onReplay}
						accessibilityRole="button"
						accessibilityLabel="Переиграть"
						style={({ pressed }) => [
							styles.secondaryButton,
							pressed ? styles.pressed : null,
						]}
					>
						<Text style={styles.secondaryText}>Переиграть</Text>
					</Pressable>
				</View>
			</View>
		</Modal>
	)
}

const styles = StyleSheet.create({
	scrim: {
		flex: 1,
		backgroundColor: colors.overlayScrim,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: spacing.screenPadding,
	},
	card: {
		width: '100%',
		maxWidth: 340,
		backgroundColor: colors.overlayCard,
		borderRadius: 16,
		paddingHorizontal: 24,
		paddingVertical: 28,
		alignItems: 'center',
	},
	title: {
		fontSize: 28,
		fontWeight: '700',
		color: colors.primaryText,
		marginBottom: 12,
	},
	meta: {
		fontSize: 16,
		color: colors.secondaryText,
		marginBottom: 4,
	},
	praise: {
		fontSize: 16,
		color: colors.solvedBanner,
		fontWeight: '600',
		marginTop: 12,
		marginBottom: 24,
	},
	primaryButton: {
		width: '100%',
		backgroundColor: colors.playerText,
		borderRadius: 12,
		paddingVertical: 14,
		alignItems: 'center',
		marginBottom: 10,
	},
	primaryText: {
		color: '#FFFFFF',
		fontWeight: '700',
		fontSize: 16,
	},
	secondaryButton: {
		width: '100%',
		borderRadius: 12,
		paddingVertical: 14,
		alignItems: 'center',
		borderWidth: 1,
		borderColor: colors.keypadBorder,
		backgroundColor: colors.boardBackground,
	},
	secondaryText: {
		color: colors.primaryText,
		fontWeight: '600',
		fontSize: 16,
	},
	pressed: {
		opacity: 0.88,
	},
})
