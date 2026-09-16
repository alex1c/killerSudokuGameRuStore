/**
 * Collapsible sticky banner for Home / Stats / Learning — never GameScreen.
 */

import { useEffect, useState } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import {
	BannerAdSize,
	BannerView,
} from 'yandex-mobile-ads'
import {
	ADS_POLICY,
	bannerUnitId,
	type BannerPlacement,
} from './config'
import { initializeYandexAds } from './sdk'

export interface AdBannerProps {
	placement: BannerPlacement
}

/**
 * Sticky banner that collapses to zero height until loaded / on failure.
 */
export function AdBanner(props: AdBannerProps) {
	const { placement } = props
	const { width } = useWindowDimensions()
	const [size, setSize] = useState<BannerAdSize | null>(null)
	const [visible, setVisible] = useState(false)

	useEffect(() => {
		let cancelled = false
		void (async () => {
			try {
				await initializeYandexAds()
				const bannerWidth = Math.max(320, Math.floor(width))
				const next = await BannerAdSize.stickySize(bannerWidth)
				if (!cancelled) {
					setSize(next)
				}
			} catch {
				if (!cancelled) {
					setSize(null)
					setVisible(false)
				}
			}
		})()
		return () => {
			cancelled = true
		}
	}, [width])

	if (!ADS_POLICY.allowedBannerPlacements.includes(placement)) {
		return null
	}
	if (!size) {
		return null
	}

	const unitId = bannerUnitId(placement)

	return (
		<View
			style={[
				styles.wrap,
				visible ? null : styles.collapsed,
			]}
			accessibilityElementsHidden={!visible}
			importantForAccessibility={visible ? 'yes' : 'no-hide-descendants'}
		>
			<BannerView
				size={size}
				adRequest={{ adUnitId: unitId }}
				style={{
					width: size.width,
					height: visible ? size.height : 0,
					alignSelf: 'center',
				}}
				onAdLoaded={() => setVisible(true)}
				onAdFailedToLoad={() => setVisible(false)}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	wrap: {
		width: '100%',
		alignItems: 'center',
		justifyContent: 'flex-end',
	},
	collapsed: {
		height: 0,
		overflow: 'hidden',
	},
})
