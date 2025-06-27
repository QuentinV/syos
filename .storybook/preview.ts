import type { Preview } from '@storybook/react-vite';
import 'primereact/resources/themes/lara-dark-amber/theme.css';
import 'primeflex/primeflex.css';
import 'primeicons/primeicons.css';
import '../src/theme.css';

const preview: Preview = {
    parameters: {
        controls: {
            matchers: {
                color: /(background|color)$/i,
                date: /Date$/i,
            },
        },
    },
};

export default preview;
