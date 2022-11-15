import fs from 'fs';
import path from 'path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';


const envLocation = JSON.parse(fs.readFileSync('.env.json').toString()).location;

export default defineConfig({
    root: 'app/client/',
    build: {
        outDir: '../../dist',
        emptyOutDir: true,
    },
    plugins: [
        vue()
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './app/client/src'),
        },
    },
    server: {
        open: true,
        proxy: {
            '/ws': {
                target: envLocation,
                changeOrigin: true,
                ws: true,
            },
            '/upload': {
                target: envLocation,
                changeOrigin: true,
            },
        },
    },
});
