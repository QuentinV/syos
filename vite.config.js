import { defineConfig } from 'vite';
import glslify from 'rollup-plugin-glslify';

export default defineConfig({
    root: '',
    base: '/syos',
    build: {
        outDir: 'dist',
    },
    server: {
        host: true,
        port: 3000,
        // allowedHosts: [],
    },
    plugins: [glslify()],
});
