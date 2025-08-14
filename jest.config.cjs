module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/src/test/**/*.test.ts'],
    collectCoverageFrom: [
        'src/main/**/*.ts',
        '!src/main/**/*.d.ts',
    ],
};
