/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
            colors: {
                brand: {
                    dark: '#0F172A', // Trustworthy Blue
                    primary: '#3B82F6',
                    success: '#10B981', // Success Green
                    accent: '#8B5CF6',
                }
            }
        },
    },
    plugins: [],
}
