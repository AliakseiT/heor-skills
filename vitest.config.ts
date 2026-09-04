import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'packages/heor-engine/tests/**/*.test.ts',
      'tests/**/*.test.ts',
    ],
    reporters: ['default', 'junit'],
    outputFile: 'test-results.xml',
  },
});
