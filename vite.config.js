var fs = require('fs');
var path = require('path');
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

var realAppLocation = JSON.parse(fs.readFileSync('.env.json').toString()).location;

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
    },
    server: {
        proxy: {
            '/ws': {
                target: realAppLocation,
                changeOrigin: true,
                ws: true,
            },
        },
    },
});
