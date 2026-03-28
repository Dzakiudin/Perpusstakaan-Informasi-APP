/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                primary: "var(--color-primary)",
                "accent-gold": "var(--color-accent-gold)",
                "cream": "var(--color-cream)",
                "background-light": "var(--color-background-light)",
                "background-dark": "var(--color-background-dark)",
                "surface-light": "var(--color-surface-light)",
                "surface-dark": "var(--color-surface-dark)",
                "sidebar-dark": "#111827",
            },
            fontFamily: {
                display: ["Inter", "sans-serif"],
            },
            borderRadius: {
                DEFAULT: "0.625rem",
            },
        },
    },
    plugins: [],
}
