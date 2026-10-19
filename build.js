const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 [Build] Starting KenyaPay Monorepo Build...');

// 1. Fallback environment variables for Prisma generation (generate only needs valid syntax, no live DB needed)
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';
process.env.DIRECT_URL = process.env.DIRECT_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';

// 2. Generate Prisma Client
console.log('📦 [1/3] Generating Prisma Client...');
const prismaBinRoot = path.join(__dirname, 'node_modules', 'prisma', 'build', 'index.js');
const prismaBinBackend = path.join(__dirname, 'backend', 'node_modules', 'prisma', 'build', 'index.js');

if (fs.existsSync(prismaBinRoot)) {
  execSync(`node "${prismaBinRoot}" generate --schema=backend/prisma/schema.prisma`, { stdio: 'inherit', env: process.env });
} else if (fs.existsSync(prismaBinBackend)) {
  execSync(`node "${prismaBinBackend}" generate --schema=backend/prisma/schema.prisma`, { stdio: 'inherit', env: process.env });
} else {
  execSync('npx prisma generate --schema=backend/prisma/schema.prisma', { stdio: 'inherit', env: process.env });
}

// 3. Install frontend dependencies
console.log('📦 [2/3] Installing frontend dependencies...');
execSync('npm --prefix frontend install --legacy-peer-deps', { stdio: 'inherit' });

// 4. Build Vite frontend
console.log('⚡ [3/3] Building Vite React frontend to frontend/dist...');
execSync('npm --prefix frontend run build', { stdio: 'inherit' });

console.log('✅ [Build] KenyaPay Monorepo Build successfully finished!');
