/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'bg-primary': '#0d0f18',
                'bg-secondary': '#13162b',
                'bg-card': '#1a1e35',
                'bg-card-hover': '#1f2540',
                'accent': '#6c63ff',
                'accent-hover': '#7b74ff',
                'accent-danger': '#e05250',
                'accent-success': '#27c274',
            },
        },
    },
    plugins: [],
}
