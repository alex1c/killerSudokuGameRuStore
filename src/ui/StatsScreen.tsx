/**
 * Lifetime stats overview — overall totals + per-difficulty breakdown.
 */

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AdBanner } from '../ads'
import {
	DIFFICULTY_LABELS,
	PLAYABLE_DIFFICULTIES,
	type Difficulty,
} from '../game/difficulty'
import { formatElapsed } from '../gameplay'
import type { DifficultyStatsV1, StatsV1 } from '../stats/types'
import { colors, spacing } from '../theme'

export interface StatsScreenProps {
	stats: StatsV1
	onBack: () => void
}

export function StatsScreen(props: StatsScreenProps) {
	const { stats, onBack } = props
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

			<ScrollView
				contentContainerStyle={styles.content}
				showsVerticalScrollIndicator={false}
			>
				<Text style={styles.title}>Статистика</Text>

				<View style={styles.card}>
					<Text style={styles.sectionTitle}>Всего</Text>
					<StatRow label="Решено" value={String(stats.totalCompleted)} />
					<StatRow
						label="Игровое время"
						value={formatElapsed(stats.totalPlayTimeMs)}
					/>
					<StatRow
						label="Уникальных партий"
						value={String(stats.uniqueSolvedSeeds.length)}
					/>
					<StatRow
						label="Серия Daily"
						value={String(stats.currentDailyStreak)}
					/>
					<StatRow
						label="Рекорд Daily"
						value={String(stats.bestDailyStreak)}
					/>
				</View>

				{PLAYABLE_DIFFICULTIES.map((difficulty) => (
					<DifficultyCard
						key={difficulty}
						difficulty={difficulty}
						row={stats.byDifficulty[difficulty]}
					/>
				))}

				<View style={styles.bannerSlot}>
					<AdBanner placement="stats" />
				</View>
			</ScrollView>
		</View>
	)
}

function DifficultyCard(props: {
	difficulty: Difficulty
	row: DifficultyStatsV1
}) {
	const { difficulty, row } = props
	const rate =
		row.started > 0
			? Math.round((row.completed / row.started) * 100)
			: null
	const averageMs =
		row.completed > 0
			? Math.round(row.totalCompletedTimeMs / row.completed)
			: null

	return (
		<View style={styles.card}>
			<Text style={styles.sectionTitle}>
				{DIFFICULTY_LABELS[difficulty]}
			</Text>
			<StatRow label="Начато" value={String(row.started)} />
			<StatRow label="Решено" value={String(row.completed)} />
			<StatRow
				label="Доля завершения"
				value={rate === null ? '—' : `${rate}%`}
			/>
			<StatRow
				label="Лучшее время"
				value={
					row.bestTimeMs === null ? '—' : formatElapsed(row.bestTimeMs)
				}
			/>
			<StatRow
				label="Среднее время"
				value={averageMs === null ? '—' : formatElapsed(averageMs)}
			/>
		</View>
	)
}

function StatRow(props: { label: string; value: string }) {
	return (
		<View style={styles.row}>
			<Text style={styles.rowLabel}>{props.label}</Text>
			<Text style={styles.rowValue}>{props.value}</Text>
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
	content: {
		paddingBottom: 28,
		gap: 14,
	},
	title: {
		fontSize: 28,
		fontWeight: '700',
		color: colors.primaryText,
		marginBottom: 4,
	},
	card: {
		backgroundColor: colors.boardBackground,
		borderRadius: 14,
		paddingVertical: 14,
		paddingHorizontal: 16,
		borderWidth: 1,
		borderColor: colors.keypadBorder,
		gap: 8,
	},
	sectionTitle: {
		fontSize: 16,
		fontWeight: '700',
		color: colors.playerText,
		marginBottom: 4,
	},
	row: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		gap: 12,
	},
	rowLabel: {
		flex: 1,
		fontSize: 14,
		color: colors.secondaryText,
	},
	rowValue: {
		fontSize: 15,
		fontWeight: '700',
		color: colors.primaryText,
	},
	bannerSlot: {
		marginTop: 8,
		minHeight: 0,
	},
})
