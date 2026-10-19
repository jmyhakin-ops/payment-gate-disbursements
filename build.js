// Simple frontend-only build script for Vercel
const { execSync } = require('child_process');
const fs = require('fs');

console.log('[1/3] Installing frontend dependencies (including devDependencies)...');
// NODE_ENV=production causes npm to skip devDependencies (vite, etc.)
// We must explicitly include them for the build to work
execSync('npm --prefix frontend install --legacy-peer-deps --include=dev', {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'development' }
});

console.log('[2/3] Building Vite React frontend...');
execSync('npm --prefix frontend run build', {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production' }
});

console.log('[3/3] Copying frontend/dist -> dist (Vercel output)...');
if (fs.existsSync('dist')) fs.rmSync('dist', { recursive: true, force: true });
fs.cpSync('frontend/dist', 'dist', { recursive: true });

console.log('Done! dist/ ready for Vercel.');
