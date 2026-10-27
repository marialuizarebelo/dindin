/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'var(--ink)',
        ink2: 'var(--ink-2)',
        ink3: 'var(--ink-3)',
        hair: 'var(--hair)',
        glass: 'var(--glass)',
        surface: 'var(--surface)',
        accent: 'var(--accent)',
        income: 'var(--c-green)',
        expense: 'var(--c-red)',
        invest: 'var(--c-purple)',
      },
      fontFamily: {
        serif: ['Fraunces', 'Georgia', 'serif'],
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: { '2xl': '1.25rem', '3xl': '1.75rem' },
    },
  },
  plugins: [],
}
