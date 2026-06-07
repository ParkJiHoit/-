/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Pretendard', 'Noto Sans KR', 'ui-sans-serif', 'system-ui']
      },
      colors: {
        ink: '#111827',
        panel: '#F8FAFC'
      },
      boxShadow: {
        dashboard: '0 12px 40px rgba(15, 23, 42, 0.08)'
      }
    }
  },
  plugins: []
};
