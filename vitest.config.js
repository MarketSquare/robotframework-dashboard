import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
    resolve: {
        alias: {
            '@js': resolve(__dirname, 'robotframework_dashboard/js'),
        },
    },
    test: {
        include: ['tests/javascript/**/*.test.js'],
        environment: 'node',
    },
});
