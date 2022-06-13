var path = require('path');
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
    root: 'app/client/',
    build: {
        outDir: '../../dist',
    },
    plugins: [vue()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './app/client/src'),
        },
    }
});
