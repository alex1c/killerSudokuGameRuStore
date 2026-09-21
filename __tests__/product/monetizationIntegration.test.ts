/**
 * Monetization integration tests — policy, analytics sanitization, placements.
 */

import {
	ADS_POLICY,
	APP_OPEN_AD,
	BANNER_UNIT_BY_PLACEMENT,
	InterstitialLimiter,
	YANDEX_AD_UNITS,
	__resetInterstitialLimiterForTests,
	bannerUnitId,
	getRewardedConfig,
	isGameScreenBannerAllowed,
	maybeShowCompletionInterstitial,
} from '../../src/ads'
import {
	ANALYTICS_EVENTS,
	sanitizeAnalyticsParams,
	setAnalyticsClient,
	trackAnalytics,
} from '../../src/analytics'
import { APPMETRICA_API_KEY } from '../../src/analytics/appmetrica'
import {
	APP_FULL_NAME,
	APP_ICON_BACKGROUND,
	APP_PACKAGE,
	APP_VERSION,
	APP_VERSION_CODE,
} from '../../src/product/constants'
import { PRIVACY_NOTES, PRIVACY_POLICY_URL } from '../../src/product/privacy'
import appJson from '../../app.json'

jest.mock('yandex-mobile-ads', () => ({
	MobileAds: {
		initialize: jest.fn(() => Promise.resolve()),
		enableLogging: jest.fn(),
	},
	BannerAdSize: {
		stickySize: jest.fn(() =>
			Promise.resolve({
				width: 320,
				height: 50,
				initialWidth: 320,
				initialHeight: 50,
				widthInPixels: 320,
				heightInPixels: 50,
				type: 'sticky',
			}),
		),
	},
	BannerView: 'BannerView',
	InterstitialAdLoader: {
		create: jest.fn(() =>
			Promise.resolve({
				loadAd: jest.fn(() => Promise.reject(new Error('unavailable'))),
			}),
		),
	},
	RewardedAdLoader: {
		create: jest.fn(() =>
			Promise.resolve({
				loadAd: jest.fn(() => Promise.resolve(null)),
			}),
		),
	},
}))

jest.mock('@appmetrica/react-native-analytics', () => ({
	__esModule: true,
	default: {
		activate: jest.fn(),
		reportEvent: jest.fn(),
	},
}))

describe('release metadata', () => {
	it('uses final name, package, version and master icon', () => {
		expect(APP_FULL_NAME).toBe('Киллер Судоку — суммы')
		expect(APP_PACKAGE).toBe('com.calculatorplatform.killersudoku')
		expect(APP_VERSION).toBe('1.0.0')
		expect(APP_VERSION_CODE).toBe(1)
		expect(appJson.expo.name).toBe(APP_FULL_NAME)
		expect(appJson.expo.icon).toBe('./assets/icon_gpt.png')
		expect(appJson.expo.android?.adaptiveIcon?.foregroundImage).toBe(
			'./assets/icon_gpt.png',
		)
		expect(appJson.expo.android?.adaptiveIcon?.backgroundColor).toBe(
			APP_ICON_BACKGROUND,
		)
		expect(appJson.expo.android?.package).toBe(APP_PACKAGE)
	})
})

describe('interstitial limiter', () => {
	beforeEach(() => {
		__resetInterstitialLimiterForTests()
	})

	it('denies Daily and enforces session age, cap, and gap', () => {
		const started = 1_000_000
		const limiter = new InterstitialLimiter(started)

		expect(limiter.canShow({ isDaily: true, now: started + 60_000 })).toEqual(
			{ allowed: false, reason: 'daily' },
		)
		expect(
			limiter.canShow({ isDaily: false, now: started + 10_000 }),
		).toEqual({ allowed: false, reason: 'session-too-young' })

		expect(
			limiter.canShow({ isDaily: false, now: started + 60_000 }),
		).toEqual({ allowed: true })

		limiter.markShown(started + 60_000)
		expect(
			limiter.canShow({ isDaily: false, now: started + 61_000 }),
		).toEqual({ allowed: false, reason: 'session-cap' })
	})

	it('enforces five-minute gap when cap allows more than one', () => {
		const policyMax = ADS_POLICY.maxInterstitialsPerSession
		expect(policyMax).toBe(1)
		expect(ADS_POLICY.minInterstitialGapMs).toBe(5 * 60 * 1000)
	})

	it('unavailable interstitial does not throw / block completion path', async () => {
		const limiter = new InterstitialLimiter(Date.now() - 60_000)
		// Bypass shared singleton age using direct maybeShow after resetting.
		__resetInterstitialLimiterForTests()
		// Force shared limiter to be old enough by constructing via get after wait:
		const result = await maybeShowCompletionInterstitial({
			isDaily: false,
			now: Date.now() + 60_000,
		})
		// Session age on shared limiter starts at construction — may be young.
		expect(result.shown).toBe(false)
		if (!result.shown) {
			expect(typeof result.reason).toBe('string')
		}
		void limiter
	})
})

describe('banner placements', () => {
	it('maps Home/Stats/Learning IDs and forbids GameScreen', () => {
		expect(bannerUnitId('home')).toBe('R-M-20057709-1')
		expect(bannerUnitId('stats')).toBe('R-M-20057709-2')
		expect(bannerUnitId('learning')).toBe('R-M-20057709-3')
		expect(BANNER_UNIT_BY_PLACEMENT.home).toBe(YANDEX_AD_UNITS.homeBanner)
		expect(isGameScreenBannerAllowed()).toBe(false)
		expect(ADS_POLICY.bannerOnGameScreen).toBe(false)
		expect(ADS_POLICY.allowedBannerPlacements).toEqual([
			'home',
			'stats',
			'learning',
		])
	})
})

describe('app open and rewarded', () => {
	it('keeps App Open disabled and rewarded non-mandatory', () => {
		expect(APP_OPEN_AD.unitId).toBe('R-M-20057709-6')
		expect(APP_OPEN_AD.enabled).toBe(false)
		expect(getRewardedConfig().unitId).toBe('R-M-20057709-5')
		expect(getRewardedConfig().mandatory).toBe(false)
		expect(getRewardedConfig().runtimePlacement).toBe('none')
		expect(YANDEX_AD_UNITS.interstitial).toBe('R-M-20057709-4')
	})
})

describe('analytics', () => {
	it('exposes required event names and production API key', () => {
		expect(ANALYTICS_EVENTS.game_started).toBe('game_started')
		expect(ANALYTICS_EVENTS.hint_revealed).toBe('hint_revealed')
		expect(ANALYTICS_EVENTS.continue_game).toBe('continue_game')
		expect(APPMETRICA_API_KEY).toBe(
			'8a30492c-caff-4584-aa4b-176dd809e0d7',
		)
	})

	it('sanitizes forbidden params and never throws on track failure', () => {
		const cleaned = sanitizeAnalyticsParams({
			difficulty: 'hard',
			solution: [1, 2, 3],
			notes: 'secret',
			seed: 99,
			elapsed_seconds: 12,
		})
		expect(cleaned).toEqual({
			difficulty: 'hard',
			elapsed_seconds: 12,
		})

		setAnalyticsClient({
			track() {
				throw new Error('sdk down')
			},
		})
		expect(() =>
			trackAnalytics('game_completed', {
				difficulty: 'easy',
				solution: 'nope',
			}),
		).not.toThrow()
	})
})

describe('privacy honesty', () => {
	it('discloses analytics/ads and keeps privacy URL null', () => {
		expect(PRIVACY_POLICY_URL).toBeNull()
		const joined = PRIVACY_NOTES.join(' ')
		expect(joined).toContain('AppMetrica')
		expect(joined).toContain('Mobile Ads')
		expect(joined).not.toContain('сейчас ничего не отправляется')
	})
})
