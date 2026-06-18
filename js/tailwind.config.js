/* Tailwind CDN runtime configuration.
   Loaded as a classic script immediately after the Tailwind CDN. */
tailwind.config = {
  theme: {
    extend: {
      colors: {
        asphalt:  { DEFAULT: '#1a1a2e', light: '#252542', lighter: '#2f2f56' },
        amber:    { DEFAULT: '#f5a623', dark: '#d48f1e', light: '#f7b84a', glow: 'rgba(245,166,35,0.15)' },
        dawn:     { DEFAULT: '#e8e0d5', dim: '#b8b0a5' },
        sage:     { DEFAULT: '#7a9e7e', dark: '#5a7e5e' },
        crimson:  { DEFAULT: '#c2185b' },
        electric: { DEFAULT: '#26c6da' },
        burnt:    { DEFAULT: '#e65100' },
      },
      fontFamily: {
        display: ['"DM Serif Display"', 'Georgia', 'serif'],
        body:    ['Inter', 'system-ui', 'sans-serif'],
      },
      spacing: {
        18: '4.5rem',
        22: '5.5rem',
      },
    },
  },
};
