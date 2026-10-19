// Simple frontend-only build script for Vercel
const { execSync } = require('child_process');
const fs = require('fs');

console.log('[1/3] Installing frontend dependencies...');
execSync('npm --prefix frontend install --legacy-peer-deps', { stdio: 'inherit' });

console.log('[2/3] Building Vite React frontend...');
execSync('npm --prefix frontend run build', { stdio: 'inherit' });

console.log('[3/3] Copying frontend/dist -> dist (Vercel output)...');
if (fs.existsSync('dist')) fs.rmSync('dist', { recursive: true, force: true });
fs.cpSync('frontend/dist', 'dist', { recursive: true });

console.log('Done! dist/ ready for Vercel.');
