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
                        // Slack theme variables
                sidebar: "var(--slack-sidebar)",
                "sidebar-text": "var(--slack-sidebar-text)",
                primary: {
                    DEFAULT: "var(--slack-primary)",
                    foreground: "var(--slack-primary-text)",
                },
                sidebar: {
                    DEFAULT: "var(--slack-sidebar)",
                    foreground: "var(--slack-sidebar-text)",
                    hover: "var(--slack-sidebar-hover)",
                },
                active: {
                    DEFAULT: "var(--slack-active)",
                    bg: "var(--slack-active-bg)",
                },
                active: "var(--slack-active)",
                hover: "var(--slack-hover)",
                border: "var(--slack-border)",
                background: "var(--slack-bg)",
                text: "var(--slack-text)",
                "text-muted": "var(--slack-text-muted)",
                notification: "var(--slack-notification)"
            },
        },
    },
    plugins: [],
}
