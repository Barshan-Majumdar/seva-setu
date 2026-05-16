/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'accent-moss': '#2d6148',
        'accent-moss-dark': '#1e4231',
        'accent-moss-light': '#dcfce7',
        'accent-rose': '#f43f5e',
        'accent-rose-light': '#fff1f2',
        'accent-rust': '#c35d51',
        'text-primary': '#0f171d',
        'text-secondary': '#475569',
        'text-muted': '#64748b',
      }
    },
  },

  plugins: [],
};
