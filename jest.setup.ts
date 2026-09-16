// Jest setup for engine + product tests.
// Native monetization SDKs are mocked so Jest stays offline-safe.

jest.mock('yandex-mobile-ads', () => ({
	MobileAds: {
		initialize: jest.fn(() => Promise.resolve()),
		enableLogging: jest.fn(),
		getLibraryVersion: jest.fn(() => '8.4.0'),
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
		inlineSize: jest.fn(() =>
			Promise.resolve({
				width: 320,
				height: 50,
				initialWidth: 320,
				initialHeight: 50,
				widthInPixels: 320,
				heightInPixels: 50,
				type: 'inline',
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
	AppOpenAdLoader: {
		create: jest.fn(() => Promise.resolve(null)),
	},
}))

jest.mock('@appmetrica/react-native-analytics', () => ({
	__esModule: true,
	default: {
		activate: jest.fn(),
		reportEvent: jest.fn(),
	},
}))
