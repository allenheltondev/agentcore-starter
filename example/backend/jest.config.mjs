export default {
  transform: {
    '^.+\\.[tj]sx?$': 'babel-jest',
  },
  transformIgnorePatterns: ['/node_modules/(?!(@aws-sdk))'],
  testMatch: ['**/?(*.)+(spec|test).mjs'],
  testPathIgnorePatterns: ['/node_modules/', '/.aws-sam/'],
  testEnvironment: 'node',
};
