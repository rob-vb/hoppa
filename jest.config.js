/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    // Mock convex generated files that may not exist during tests
    '^(\\.\\./)*convex/_generated/api$': '<rootDir>/__mocks__/convex-api.js',
    '^(\\.\\./)*convex/_generated/dataModel$': '<rootDir>/__mocks__/convex-dataModel.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|zustand)',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  collectCoverageFrom: [
    'utils/**/*.ts',
    'stores/**/*.ts',
    'db/**/*.ts',
    '!**/*.d.ts',
  ],
};
