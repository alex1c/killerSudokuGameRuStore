/**
 * Interactive learning list + lesson detail.
 * Any lesson is openable; progress is reported via callbacks (persistence owned by app).
 */

import { useState } from 'react'
import {
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AdBanner } from '../ads'
import {
	LESSONS,
	getLessonById,
	type Lesson,
} from '../learning'
import type { LearningProgressV1 } from '../learning/types'
import { colors, spacing } from '../theme'

export interface LearningScreenProps {
	progress: LearningProgressV1
	onBack: () => void
	/** Mark lesson viewed when the detail opens. */
	onViewLesson: (lessonId: string) => void
	/** Mark interactive complete after a correct digit answer. */
	onCompleteInteractive: (lessonId: string) => void
}

type Feedback = 'correct' | 'wrong' | null

export function LearningScreen(props: LearningScreenProps) {
	const { progress, onBack, onViewLesson, onCompleteInteractive } = props
	const insets = useSafeAreaInsets()
	const [activeLessonId, setActiveLessonId] = useState<string | null>(null)
	const [feedback, setFeedback] = useState<Feedback>(null)

	const activeLesson = activeLessonId
		? getLessonById(activeLessonId) ?? null
		: null

	const handleOpenLesson = (lesson: Lesson) => {
		setFeedback(null)
		setActiveLessonId(lesson.id)
		onViewLesson(lesson.id)
	}

	const handleBackFromDetail = () => {
		setActiveLessonId(null)
		setFeedback(null)
	}

	const handleDigitPress = (digit: number) => {
		if (!activeLesson?.interactive) {
			return
		}
		const expected = activeLesson.interactive.correctDigit
		if (digit === expected) {
			setFeedback('correct')
			onCompleteInteractive(activeLesson.id)
		} else {
			setFeedback('wrong')
		}
	}

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
			{activeLesson ? (
				<LessonDetail
					lesson={activeLesson}
					progress={progress}
					feedback={feedback}
					onBack={handleBackFromDetail}
					onDigitPress={handleDigitPress}
				/>
			) : (
				<LessonList
					progress={progress}
					onBack={onBack}
					onOpen={handleOpenLesson}
				/>
			)}
		</View>
	)
}

function LessonList(props: {
	progress: LearningProgressV1
	onBack: () => void
	onOpen: (lesson: Lesson) => void
}) {
	const { progress, onBack, onOpen } = props
	return (
		<>
			<Pressable
				onPress={onBack}
				accessibilityRole="button"
				accessibilityLabel="Назад"
				hitSlop={8}
				style={styles.back}
			>
				<Text style={styles.backText}>← Назад</Text>
			</Pressable>
			<Text style={styles.title}>Обучение</Text>
			<Text style={styles.hint}>
				Откройте любой урок. Прогресс сохраняется локально.
			</Text>
			<ScrollView
				contentContainerStyle={styles.list}
				showsVerticalScrollIndicator={false}
			>
				{LESSONS.map((lesson, index) => {
					const viewed = progress.viewedLessonIds.includes(lesson.id)
					const completed =
						progress.completedInteractiveIds.includes(lesson.id)
					return (
						<Pressable
							key={lesson.id}
							onPress={() => onOpen(lesson)}
							accessibilityRole="button"
							accessibilityLabel={lesson.title}
							style={({ pressed }) => [
								styles.item,
								pressed ? styles.pressed : null,
							]}
						>
							<View style={styles.itemRow}>
								<Text style={styles.itemIndex}>{index + 1}</Text>
								<View style={styles.itemBody}>
									<Text style={styles.itemText}>{lesson.title}</Text>
									<Text style={styles.itemMeta}>
										{completed
											? 'Интерактив пройден'
											: viewed
												? 'Просмотрено'
												: lesson.interactive
													? 'Есть упражнение'
													: 'Теория'}
									</Text>
								</View>
							</View>
						</Pressable>
					)
				})}
				<View style={styles.bannerSlot}>
					<AdBanner placement="learning" />
				</View>
			</ScrollView>
		</>
	)
}

function LessonDetail(props: {
	lesson: Lesson
	progress: LearningProgressV1
	feedback: Feedback
	onBack: () => void
	onDigitPress: (digit: number) => void
}) {
	const { lesson, progress, feedback, onBack, onDigitPress } = props
	const interactiveDone = progress.completedInteractiveIds.includes(
		lesson.id,
	)

	return (
		<>
			<Pressable
				onPress={onBack}
				accessibilityRole="button"
				accessibilityLabel="К списку уроков"
				hitSlop={8}
				style={styles.back}
			>
				<Text style={styles.backText}>← К урокам</Text>
			</Pressable>
			<ScrollView
				contentContainerStyle={styles.detailContent}
				showsVerticalScrollIndicator={false}
			>
				<Text style={styles.title}>{lesson.title}</Text>
				{lesson.body.map((paragraph, index) => (
					<Text key={index} style={styles.paragraph}>
						{paragraph}
					</Text>
				))}

				{lesson.interactive ? (
					<View style={styles.interactiveCard}>
						<Text style={styles.interactiveLabel}>Упражнение</Text>
						{lesson.interactive.boardVisual ? (
							<Text style={styles.boardVisual}>
								{lesson.interactive.boardVisual}
							</Text>
						) : null}
						<Text style={styles.interactivePrompt}>
							{lesson.interactive.prompt}
						</Text>
						<View style={styles.digitRow}>
							{[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
								<Pressable
									key={digit}
									onPress={() => onDigitPress(digit)}
									accessibilityRole="button"
									accessibilityLabel={`Цифра ${digit}`}
									style={({ pressed }) => [
										styles.digitButton,
										pressed ? styles.pressed : null,
									]}
								>
									<Text style={styles.digitText}>{digit}</Text>
								</Pressable>
							))}
						</View>
						{feedback === 'correct' || interactiveDone ? (
							<Text style={styles.successText}>
								{lesson.interactive.successMessage}
							</Text>
						) : null}
						{feedback === 'wrong' ? (
							<Text style={styles.wrongText}>
								Пока неверно — попробуйте ещё раз.
							</Text>
						) : null}
					</View>
				) : null}
			</ScrollView>
		</>
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
		marginBottom: 20,
		lineHeight: 18,
	},
	list: {
		gap: 12,
		paddingBottom: 24,
	},
	bannerSlot: {
		marginTop: 8,
		minHeight: 0,
	},
	item: {
		backgroundColor: colors.boardBackground,
		borderRadius: 14,
		paddingVertical: 16,
		paddingHorizontal: 16,
		borderWidth: 1,
		borderColor: colors.keypadBorder,
	},
	itemRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
	},
	itemIndex: {
		width: 28,
		fontSize: 16,
		fontWeight: '700',
		color: colors.playerText,
		textAlign: 'center',
	},
	itemBody: {
		flex: 1,
	},
	itemText: {
		fontSize: 17,
		fontWeight: '700',
		color: colors.primaryText,
	},
	itemMeta: {
		marginTop: 4,
		fontSize: 13,
		color: colors.secondaryText,
	},
	detailContent: {
		paddingBottom: 32,
		gap: 12,
	},
	paragraph: {
		fontSize: 15,
		lineHeight: 22,
		color: colors.primaryText,
	},
	interactiveCard: {
		marginTop: 8,
		backgroundColor: colors.boardBackground,
		borderRadius: 14,
		padding: 16,
		borderWidth: 1,
		borderColor: colors.keypadBorder,
		gap: 12,
	},
	interactiveLabel: {
		fontSize: 13,
		fontWeight: '700',
		color: colors.playerText,
		textTransform: 'uppercase',
		letterSpacing: 0.4,
	},
	boardVisual: {
		fontFamily: 'monospace',
		fontSize: 14,
		lineHeight: 20,
		color: colors.givenText,
		backgroundColor: colors.related,
		padding: 10,
		borderRadius: 8,
		overflow: 'hidden',
	},
	interactivePrompt: {
		fontSize: 15,
		lineHeight: 22,
		color: colors.primaryText,
		fontWeight: '600',
	},
	digitRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
	},
	digitButton: {
		width: 40,
		height: 40,
		borderRadius: 10,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: colors.keypadBackground,
		borderWidth: 1,
		borderColor: colors.keypadBorder,
	},
	digitText: {
		fontSize: 18,
		fontWeight: '700',
		color: colors.primaryText,
	},
	successText: {
		fontSize: 15,
		fontWeight: '600',
		color: colors.solvedBanner,
		lineHeight: 21,
	},
	wrongText: {
		fontSize: 14,
		fontWeight: '600',
		color: colors.conflictText,
	},
	pressed: {
		opacity: 0.88,
	},
})
