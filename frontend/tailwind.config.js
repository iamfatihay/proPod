/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./App.{js,jsx,ts,tsx}",
        "./app/**/*.{js,jsx,ts,tsx}",
        "./src/**/*.{js,jsx,ts,tsx}",
        "./index.js",
    ],
    presets: [require("nativewind/preset")],
    theme: {
        extend: {
            colors: {
                primary: "#D32F2F",
                accent: "#D32F2F",
                background: "#000000",
                panel: "#232323",
                card: "#181818",
                text: {
                    primary: "#FFFFFF",
                    secondary: "#CCCCCC",
                    muted: "#888888",
                },
                border: "#333333",
                borderLight: "#444444",
                success: "#10B981",
                warning: "#F59E0B",
                error: "#EF4444",
                info: "#3B82F6",
                recording: "#D32F2F",
                live: "#D32F2F",
                playing: "#10B981",
                paused: "#F59E0B",
                icon: "#FFFFFF",
            },
            fontSize: {
                title: 32,
                headline: 24,
                body: 16,
                caption: 13,
                small: 11,
            },
            spacing: {
                xs: 4,
                sm: 8,
                md: 16,
                lg: 24,
                xl: 32,
            },
            borderRadius: {
                sm: 6,
                md: 12,
                lg: 24,
            },
        },
    },
    plugins: [],
};
