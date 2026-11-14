import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { 700: '#1B4373', 800: '#143458', 900: '#0F2A4A' },
        green: { 100: '#DDF3E6', 600: '#1F9D55', 700: '#188046' },
        ink: { 600: '#4A5568', 900: '#1A2230' },
        gray: { 50: '#F8F9FB', 100: '#F3F5F8', 200: '#E6EAF0', 300: '#D5DAE1', 500: '#6B7685' },
        red: { 100: '#FBE3E3', 600: '#C62828', 700: '#A61F1F' },
        amber: { 100: '#FFF3CC', 500: '#E0A100', 700: '#8A6400' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
