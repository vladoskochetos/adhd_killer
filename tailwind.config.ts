import type { Config } from 'tailwindcss';
const config: Config = { content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'], theme: { extend: { colors: { base:'#0f0f0f', card:'#1a1a1a', muted:'#999999', accent:'#f3701e', good:'#22c55e', bad:'#ef4444' }, fontFamily: { sans: ['Inter','system-ui','sans-serif'] } } }, plugins: [] };
export default config;
