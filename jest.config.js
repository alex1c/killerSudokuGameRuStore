/** @type {import('jest').Config} */
module.exports = {
	preset: 'jest-expo',
	setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
	testMatch: ['**/__tests__/**/*.test.ts?(x)'],
	testPathIgnorePatterns: ['/node_modules/', '/__tests__/stress/'],
	moduleNameMapper: {
		'^@/(.*)$': '<rootDir>/src/$1',
	},
	moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
	clearMocks: true,
}
