import vue from '@vitejs/plugin-vue';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
    root: 'app/client/',
    build: {
        outDir: '../../dist',
        emptyOutDir: true,
    },
    plugins: [vue()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './app/client/src'),
        },
    },
    envPrefix: ['VAPID_PUBLIC_', 'VITE_'],
    server: {
        open: true,
        proxy: {
            '/ws': {
                target: process.env.PUBLIC_URL,
                changeOrigin: true,
                ws: true,
            },
            '/upload': {
                target: process.env.PUBLIC_URL,
                changeOrigin: true,
            },
        },
    },
});
