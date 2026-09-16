/**
 * Daily challenge hub — date, difficulties, streak, month calendar.
 * Does not generate puzzles on mount; generation starts only via onPlay.
 */

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
	DIFFICULTY_LABELS,
	PLAYABLE_DIFFICULTIES,
	type Difficulty,
} from '../game/difficulty'
import {
	isDayCompleted,
	monthCalendar,
	type DailyProgressV1,
	type LocalDateString,
} from '../storage/dailyProgress'
import { colors, spacing } from '../theme'

export interface DailyScreenProps {
	progress: DailyProgressV1
	todayStr: LocalDateString
	onBack: () => void
	/** Start (or resume cache load of) today's puzzle for a difficulty. */
	onPlay: (difficulty: Difficulty) => void
	/** Optional pull of fresh progress after returning from a game. */
	onRefreshProgress?: () => void
}

const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const

export function DailyScreen(props: DailyScreenProps) {
	const { progress, todayStr, onBack, onPlay, onRefreshProgress } = props
	const insets = useSafeAreaInsets()
	const todayProgress = progress.days[todayStr] ?? {}
	const { year, month } = parseYearMonth(todayStr)
	const monthDays = monthCalendar(year, month)
	const leadingBlanks = mondayBasedLeadingBlanks(year, month)

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

			<ScrollView
				contentContainerStyle={styles.content}
				showsVerticalScrollIndicator={false}
			>
				<Text style={styles.title}>Задача дня</Text>
				<Text style={styles.dateLabel}>{formatRuDate(todayStr)}</Text>
				<Text style={styles.hint}>
					Один день — четыре уровня. Головоломка создаётся только после
					выбора сложности.
				</Text>

				<View style={styles.streakRow}>
					<View style={styles.streakCard}>
						<Text style={styles.streakValue}>
							{progress.currentStreak}
						</Text>
						<Text style={styles.streakLabel}>Серия</Text>
					</View>
					<View style={styles.streakCard}>
						<Text style={styles.streakValue}>{progress.bestStreak}</Text>
						<Text style={styles.streakLabel}>Рекорд</Text>
					</View>
				</View>

				<View style={styles.list}>
					{PLAYABLE_DIFFICULTIES.map((difficulty) => {
						const done = todayProgress[difficulty] === true
						return (
							<Pressable
								key={difficulty}
								onPress={() => onPlay(difficulty)}
								accessibilityRole="button"
								accessibilityLabel={
									done
										? `${DIFFICULTY_LABELS[difficulty]}, решено`
										: DIFFICULTY_LABELS[difficulty]
								}
								style={({ pressed }) => [
									styles.difficultyButton,
									pressed ? styles.pressed : null,
								]}
							>
								<Text style={styles.difficultyText}>
									{DIFFICULTY_LABELS[difficulty]}
								</Text>
								<Text
									style={[
										styles.checkMark,
										done ? styles.checkDone : styles.checkEmpty,
									]}
								>
									{done ? '✓' : '○'}
								</Text>
							</Pressable>
						)
					})}
				</View>

				{onRefreshProgress ? (
					<Pressable
						onPress={onRefreshProgress}
						accessibilityRole="button"
						accessibilityLabel="Обновить прогресс"
						style={({ pressed }) => [
							styles.refreshButton,
							pressed ? styles.pressed : null,
						]}
					>
						<Text style={styles.refreshText}>Обновить прогресс</Text>
					</Pressable>
				) : null}

				<Text style={styles.calendarTitle}>
					{formatRuMonthTitle(year, month)}
				</Text>
				<View style={styles.weekdayRow}>
					{WEEKDAY_LABELS.map((label) => (
						<Text key={label} style={styles.weekdayLabel}>
							{label}
						</Text>
					))}
				</View>
				<View style={styles.calendarGrid}>
					{Array.from({ length: leadingBlanks }, (_, i) => (
						<View key={`blank-${i}`} style={styles.dayCell} />
					))}
					{monthDays.map((dateStr) => {
						const dayNum = Number(dateStr.slice(-2))
						const completed = isDayCompleted(progress.days[dateStr])
						const isToday = dateStr === todayStr
						const hardOrExpert =
							progress.days[dateStr]?.hard === true ||
							progress.days[dateStr]?.expert === true
						return (
							<View
								key={dateStr}
								style={[
									styles.dayCell,
									isToday ? styles.dayToday : null,
								]}
							>
								<Text
									style={[
										styles.dayNumber,
										isToday ? styles.dayNumberToday : null,
									]}
								>
									{dayNum}
								</Text>
								{completed ? (
									<View
										style={[
											styles.dot,
											hardOrExpert ? styles.dotHard : null,
										]}
									/>
								) : (
									<View style={styles.dotPlaceholder} />
								)}
							</View>
						)
					})}
				</View>
			</ScrollView>
		</View>
	)
}

function parseYearMonth(dateStr: LocalDateString): {
	year: number
	month: number
} {
	const [yearStr, monthStr] = dateStr.split('-')
	return { year: Number(yearStr), month: Number(monthStr) }
}

/** Empty cells before day 1 so columns align Monday → Sunday. */
function mondayBasedLeadingBlanks(year: number, month: number): number {
	const jsDay = new Date(year, month - 1, 1).getDay()
	// JS: 0=Sun … 6=Sat → Monday-first index 0..6
	return jsDay === 0 ? 6 : jsDay - 1
}

function formatRuDate(dateStr: LocalDateString): string {
	const [yearStr, monthStr, dayStr] = dateStr.split('-')
	return `${dayStr}.${monthStr}.${yearStr}`
}

function formatRuMonthTitle(year: number, month: number): string {
	const names = [
		'Январь',
		'Февраль',
		'Март',
		'Апрель',
		'Май',
		'Июнь',
		'Июль',
		'Август',
		'Сентябрь',
		'Октябрь',
		'Ноябрь',
		'Декабрь',
	]
	return `${names[month - 1] ?? ''} ${year}`
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
	content: {
		paddingBottom: 28,
	},
	title: {
		fontSize: 28,
		fontWeight: '700',
		color: colors.primaryText,
		marginBottom: 4,
	},
	dateLabel: {
		fontSize: 16,
		fontWeight: '600',
		color: colors.playerText,
		marginBottom: 8,
	},
	hint: {
		fontSize: 13,
		color: colors.secondaryText,
		marginBottom: 20,
		lineHeight: 18,
	},
	streakRow: {
		flexDirection: 'row',
		gap: 12,
		marginBottom: 20,
	},
	streakCard: {
		flex: 1,
		backgroundColor: colors.boardBackground,
		borderRadius: 14,
		paddingVertical: 14,
		alignItems: 'center',
		borderWidth: 1,
		borderColor: colors.keypadBorder,
	},
	streakValue: {
		fontSize: 24,
		fontWeight: '700',
		color: colors.primaryText,
	},
	streakLabel: {
		marginTop: 4,
		fontSize: 13,
		color: colors.secondaryText,
	},
	list: {
		gap: 12,
		marginBottom: 12,
	},
	difficultyButton: {
		backgroundColor: colors.boardBackground,
		borderRadius: 14,
		paddingVertical: 18,
		paddingHorizontal: 18,
		borderWidth: 1,
		borderColor: colors.keypadBorder,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	difficultyText: {
		fontSize: 18,
		fontWeight: '700',
		color: colors.primaryText,
	},
	checkMark: {
		fontSize: 20,
		fontWeight: '700',
	},
	checkDone: {
		color: colors.solvedBanner,
	},
	checkEmpty: {
		color: colors.keypadDimmed,
	},
	refreshButton: {
		alignSelf: 'center',
		paddingVertical: 10,
		paddingHorizontal: 12,
		marginBottom: 16,
	},
	refreshText: {
		color: colors.secondaryText,
		fontSize: 14,
		fontWeight: '600',
	},
	calendarTitle: {
		fontSize: 18,
		fontWeight: '700',
		color: colors.primaryText,
		marginTop: 8,
		marginBottom: 12,
	},
	weekdayRow: {
		flexDirection: 'row',
		marginBottom: 6,
	},
	weekdayLabel: {
		width: `${100 / 7}%`,
		textAlign: 'center',
		fontSize: 12,
		fontWeight: '600',
		color: colors.secondaryText,
	},
	calendarGrid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
	},
	dayCell: {
		width: `${100 / 7}%`,
		aspectRatio: 1,
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 4,
	},
	dayToday: {
		backgroundColor: colors.related,
		borderRadius: 10,
	},
	dayNumber: {
		fontSize: 14,
		fontWeight: '600',
		color: colors.primaryText,
	},
	dayNumberToday: {
		color: colors.playerText,
		fontWeight: '700',
	},
	dot: {
		width: 6,
		height: 6,
		borderRadius: 3,
		backgroundColor: colors.playerText,
		marginTop: 3,
	},
	dotHard: {
		backgroundColor: colors.solvedBanner,
	},
	dotPlaceholder: {
		width: 6,
		height: 6,
		marginTop: 3,
	},
	pressed: {
		opacity: 0.88,
	},
})
