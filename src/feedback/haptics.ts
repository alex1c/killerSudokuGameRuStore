/**
 * Haptic feedback helpers — respects Settings.hapticEnabled.
 */

import * as Haptics from 'expo-haptics'

export type HapticKind = 'light' | 'error' | 'success' | 'selection'

/**
 * Fire a short haptic when enabled. Failures are swallowed (simulator / no vibrator).
 */
export async function playHaptic(
	enabled: boolean,
	kind: HapticKind,
): Promise<void> {
	if (!enabled) {
		return
	}
	try {
		switch (kind) {
			case 'light':
				await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
				return
			case 'selection':
				await Haptics.selectionAsync()
				return
			case 'error':
				await Haptics.notificationAsync(
					Haptics.NotificationFeedbackType.Error,
				)
				return
			case 'success':
				await Haptics.notificationAsync(
					Haptics.NotificationFeedbackType.Success,
				)
				return
			default:
				return
		}
	} catch {
		// Native haptics unavailable — ignore.
	}
}
