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
        port: 80,
        host: '0.0.0.0',
    },
});
