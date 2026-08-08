import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, 'index.ts'),
            name: 'Chorus',
            formats: ['es'],
            fileName: 'index',
        },
        rollupOptions: {
            // Externalize peer dependencies so the consumer provides them
            external: [
                'react',
                'react-dom',
                'react/jsx-runtime',
                'effector',
                'effector-react',
            ],
        },
        sourcemap: true,
        // Keep tsc-emitted .d.ts files (tsc runs before vite build)
        emptyOutDir: false,
    },
});
