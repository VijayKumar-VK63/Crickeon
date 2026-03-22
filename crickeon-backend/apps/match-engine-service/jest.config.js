module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }]
  },
  moduleNameMapper: {
    '^@lamcl/shared-contracts$': '<rootDir>/../../packages/shared-contracts/src',
    '^@lamcl/infra-redis/(.*)$': '<rootDir>/../../infra/redis/$1',
    '^@lamcl/infra-locks/(.*)$': '<rootDir>/../../infra/locks/$1',
    '^@lamcl/infra-outbox/(.*)$': '<rootDir>/../../infra/outbox/$1'
  },
  roots: ['<rootDir>/src', '<rootDir>/test'],
  moduleFileExtensions: ['ts', 'js'],
  testMatch: ['**/*.spec.ts']
};
