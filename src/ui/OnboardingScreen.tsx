/**
 * Four-page first-run onboarding (and Settings manual reopen).
 */

import { useState } from 'react'
import {
	Pressable,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { APP_NAME } from '../app/constants'
import { colors, spacing } from '../theme'

export interface OnboardingScreenProps {
	/** Called when the user finishes the last page (persists completion). */
	onComplete: () => void
	/** Optional close without completing (manual reopen from Settings). */
	onClose?: () => void
	/** When true, last CTA is "Закрыть" and does not require re-completion. */
	manualReview?: boolean
}

const PAGES = [
	{
		title: APP_NAME,
		body: 'Классическое судоку с областями и суммами.',
		visual: 'intro' as const,
	},
	{
		title: 'Суммы областей',
		body: 'Цифры внутри области должны давать указанную сумму и не повторяться.',
		visual: 'cage' as const,
	},
	{
		title: 'Заметки и подсказки',
		body:
			'Заметки помогают держать кандидатов. Умная подсказка объясняет логику шага, а не просто выдаёт ответ.',
		visual: 'hints' as const,
	},
	{
		title: 'Готовы начать',
		body:
			'Четыре сложности, задача дня, обучение и полностью офлайн-игра.',
		visual: 'ready' as const,
	},
] as const

export function OnboardingScreen(props: OnboardingScreenProps) {
	const { onComplete, onClose, manualReview = false } = props
	const insets = useSafeAreaInsets()
	const [pageIndex, setPageIndex] = useState(0)
	const page = PAGES[pageIndex]!
	const isLast = pageIndex === PAGES.length - 1

	const handlePrimary = () => {
		if (!isLast) {
			setPageIndex((current) => current + 1)
			return
		}
		if (manualReview) {
			onClose?.()
			return
		}
		onComplete()
	}

	return (
		<View
			style={[
				styles.screen,
				{
					paddingTop: insets.top + 24,
					paddingBottom: insets.bottom + 24,
				},
			]}
			accessibilityLabel="Вводное обучение"
		>
			{manualReview && onClose ? (
				<Pressable
					onPress={onClose}
					accessibilityRole="button"
					accessibilityLabel="Закрыть обучение"
					hitSlop={8}
					style={styles.skip}
				>
					<Text style={styles.skipText}>Закрыть</Text>
				</Pressable>
			) : (
				<View style={styles.skipPlaceholder} />
			)}

			<View style={styles.body}>
				<Text style={styles.title}>{page.title}</Text>
				<Text style={styles.copy}>{page.body}</Text>
				{page.visual === 'cage' ? <CageExample /> : null}
				{page.visual === 'hints' ? (
					<View style={styles.bulletCard}>
						<Text style={styles.bullet}>• Заметки (Notes)</Text>
						<Text style={styles.bullet}>• Умная подсказка</Text>
						<Text style={styles.bullet}>
							• Объяснение логики, а не только ответ
						</Text>
					</View>
				) : null}
				{page.visual === 'ready' ? (
					<View style={styles.bulletCard}>
						<Text style={styles.bullet}>• 4 сложности</Text>
						<Text style={styles.bullet}>• Задача дня</Text>
						<Text style={styles.bullet}>• Обучение</Text>
						<Text style={styles.bullet}>• Игра offline</Text>
					</View>
				) : null}
			</View>

			<View style={styles.footer}>
				<View style={styles.dots}>
					{PAGES.map((_, index) => (
						<View
							key={index}
							style={[
								styles.dot,
								index === pageIndex ? styles.dotActive : null,
							]}
						/>
					))}
				</View>
				<Pressable
					onPress={handlePrimary}
					accessibilityRole="button"
					accessibilityLabel={
						isLast
							? manualReview
								? 'Закрыть'
								: 'Начать'
							: 'Далее'
					}
					style={({ pressed }) => [
						styles.primary,
						pressed ? styles.pressed : null,
					]}
				>
					<Text style={styles.primaryText}>
						{isLast
							? manualReview
								? 'Закрыть'
								: 'Начать'
							: 'Далее'}
					</Text>
				</Pressable>
			</View>
		</View>
	)
}

/** Tiny illustrative cage: three cells summing to 6. */
function CageExample() {
	return (
		<View
			style={styles.example}
			accessibilityLabel="Пример области: сумма 6"
		>
			<Text style={styles.exampleSum}>6</Text>
			<View style={styles.exampleRow}>
				{[1, 2, 3].map((digit) => (
					<View key={digit} style={styles.exampleCell}>
						<Text style={styles.exampleDigit}>{digit}</Text>
					</View>
				))}
			</View>
			<Text style={styles.exampleCaption}>1 + 2 + 3 = 6</Text>
		</View>
	)
}

const styles = StyleSheet.create({
	screen: {
		flex: 1,
		backgroundColor: colors.background,
		paddingHorizontal: spacing.screenPadding,
	},
	skip: {
		alignSelf: 'flex-end',
		marginBottom: 8,
	},
	skipPlaceholder: {
		height: 28,
		marginBottom: 8,
	},
	skipText: {
		color: colors.secondaryText,
		fontSize: 15,
		fontWeight: '600',
	},
	body: {
		flex: 1,
		justifyContent: 'center',
		gap: 16,
	},
	title: {
		fontSize: 30,
		fontWeight: '800',
		color: colors.primaryText,
	},
	copy: {
		fontSize: 17,
		lineHeight: 26,
		color: colors.secondaryText,
	},
	bulletCard: {
		gap: 8,
		paddingVertical: 12,
	},
	bullet: {
		fontSize: 16,
		lineHeight: 22,
		color: colors.primaryText,
		fontWeight: '600',
	},
	example: {
		alignSelf: 'flex-start',
		backgroundColor: colors.boardBackground,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: colors.keypadBorder,
		padding: 14,
		gap: 8,
	},
	exampleSum: {
		fontSize: 13,
		fontWeight: '700',
		color: colors.secondaryText,
	},
	exampleRow: {
		flexDirection: 'row',
		gap: 4,
	},
	exampleCell: {
		width: 40,
		height: 40,
		borderRadius: 6,
		borderWidth: 1,
		borderColor: colors.cageBorder,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: colors.keypadBackground,
	},
	exampleDigit: {
		fontSize: 18,
		fontWeight: '700',
		color: colors.playerText,
	},
	exampleCaption: {
		fontSize: 13,
		color: colors.secondaryText,
	},
	footer: {
		gap: 16,
	},
	dots: {
		flexDirection: 'row',
		justifyContent: 'center',
		gap: 8,
	},
	dot: {
		width: 8,
		height: 8,
		borderRadius: 4,
		backgroundColor: colors.keypadBorder,
	},
	dotActive: {
		backgroundColor: colors.playerText,
		width: 18,
	},
	primary: {
		backgroundColor: colors.playerText,
		borderRadius: 14,
		paddingVertical: 16,
		alignItems: 'center',
	},
	primaryText: {
		color: '#FFFFFF',
		fontSize: 17,
		fontWeight: '700',
	},
	pressed: {
		opacity: 0.88,
	},
})
