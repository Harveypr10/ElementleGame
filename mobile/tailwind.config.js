/** @type {import('tailwindcss').Config} */
module.exports = {
    // NativeWind v2 requires 'class' mode for manual dark mode toggling
    darkMode: 'class',
    // [WEB FIX] Ensure styles override browser defaults
    important: 'html',
    content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}", "./lib/**/*.{js,jsx,ts,tsx}"],
    theme: {
        extend: {
            colors: {
                game: {
                    correct: "hsl(142, 71%, 45%)",
                    inSequence: "hsl(38, 92%, 55%)",
                    notInSequence: "hsl(0, 0%, 60%)",
                    ruledOut: "hsl(0, 0%, 80%)",
                },
                brand: {
                    blue: "#7DAAE8",
                    yellow: "#FFD429",
                    green: "#A4DB57",
                    grey: "#C4C9D4",
                    purple: "#8e57db",
                    background: "#FAFAFA",
                }
            }
        },
        fontFamily: {
            sans: ['Nunito_400Regular'],
            heading: ['Nunito_700Bold'], // Keep for Title
            'n-regular': ['Nunito_400Regular'],
            'n-medium': ['Nunito_500Medium'],
            'n-semibold': ['Nunito_600SemiBold'],
            'n-bold': ['Nunito_700Bold'],
            'n-extrabold': ['Nunito_800ExtraBold'],
        },
    },
    plugins: [],
}
