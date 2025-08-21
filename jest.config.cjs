module.exports = {
    preset: 'ts-jest/presets/default-esm',
    testEnvironment: 'node',
    testMatch: ['**/src/test/**/*.test.ts'],
    extensionsToTreatAsEsm: ['.ts'],
    transform: {
        '^.+\\.(ts|js)$': ['ts-jest', { 
            useESM: true,
            isolatedModules: true
        }]
    },
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1'
    },
    transformIgnorePatterns: [
        'node_modules/(?!(ethers|@noble)/)'
    ],
    collectCoverageFrom: [
        'src/main/**/*.{ts,js}',
        '!src/main/**/*.d.ts',
        '!src/generated/**/*'
    ]
};
