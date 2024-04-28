/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./app/client/index.html', './app/client/src/**/*.{vue,js,ts,jsx,tsx}'],
    theme: {
        extend: {
            screens: {
                max: '1640px',
            },
            colors: {
                // Shades of gray
                'skygray-white': 'rgb(var(--color-skygray-white) / <alpha-value>)',
                'skygray-lightest': 'rgb(var(--color-skygray-lightest) / <alpha-value>)',
                'skygray-lighter': 'rgb(var(--color-skygray-lighter) / <alpha-value>)',
                'skygray-light': 'rgb(var(--color-skygray-light) / <alpha-value>)',
                'skygray-casual': 'rgb(var(--color-skygray-casual) / <alpha-value>)',
                'skygray-dark': 'rgb(var(--color-skygray-dark) / <alpha-value>)',
                'skygray-darker': 'rgb(var(--color-skygray-darker) / <alpha-value>)',
                'skygray-black': 'rgb(var(--color-skygray-black) / <alpha-value>)',

                // Primary/Secondary/Tertiary colors
                primary: 'rgb(var(--color-primary) / <alpha-value>)',
                'primary-light': 'rgb(var(--color-primary-light) / <alpha-value>)',
                secondary: 'rgb(var(--color-secondary) / <alpha-value>)',
                'secondary-light': 'rgb(var(--color-secondary-light) / <alpha-value>)',
                tertiary: 'rgb(var(--color-tertiary) / <alpha-value>)',
                'tertiary-light': 'rgb(var(--color-tertiary-light) / <alpha-value>)',

                // Info/Warn/Danger colors
                info: 'rgb(var(--color-info) / <alpha-value>)',
                'info-light': 'rgb(var(--color-info-light) / <alpha-value>)',
                warn: 'rgb(var(--color-warn) / <alpha-value>)',
                'warn-light': 'rgb(var(--color-warn-light) / <alpha-value>)',
                danger: 'rgb(var(--color-danger) / <alpha-value>)',
                'danger-light': 'rgb(var(--color-danger-light) / <alpha-value>)',
            },
        },
    },
    plugins: [],
};
