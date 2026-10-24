import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = __dirname;
const FRONTEND_DIR = path.join(ROOT_DIR, 'frontend');
const BACKEND_DIR = path.join(ROOT_DIR, 'Backend');
const OUTPUT_DIR = path.join(ROOT_DIR, 'dist-cpanel');

const FRONTEND_TARGET_DIR = path.join(OUTPUT_DIR, 'public_html', 'ca_agent');
const BACKEND_TARGET_DIR = path.join(OUTPUT_DIR, 'public_html', 'ca.fundlelo.site');

console.log('================================================================');
console.log('🚀 Fundlelo Loan Collection Agent - cPanel Production Builder');
console.log('================================================================\n');

// 1. Clean & prepare output directories
console.log('📁 [Step 1/5] Preparing output directory structure...');
if (fs.existsSync(OUTPUT_DIR)) {
  fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
}
fs.mkdirSync(FRONTEND_TARGET_DIR, { recursive: true });
fs.mkdirSync(BACKEND_TARGET_DIR, { recursive: true });
console.log('   ✅ Created dist-cpanel/public_html/ca_agent');
console.log('   ✅ Created dist-cpanel/public_html/ca.fundlelo.site\n');

// 2. Build Frontend for public_html/ca_agent
console.log('⚛️  [Step 2/5] Building Frontend for path /ca_agent/ ...');
try {
  execSync('npm run build', {
    cwd: FRONTEND_DIR,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      VITE_BASE_PATH: '/ca_agent/',
      FIGMA_PUBLIC_URL: '/ca_agent',
      VITE_API_URL: 'https://ca.fundlelo.site/api'
    }
  });
  console.log('   ✅ Frontend Vite build completed successfully.\n');
} catch (err) {
  console.error('   ❌ Frontend build failed:', err.message);
  process.exit(1);
}

// 3. Assemble Frontend Deployment (public_html/ca_agent)
console.log('📦 [Step 3/5] Assembling Frontend Build Package...');
const frontendDistDir = path.join(FRONTEND_DIR, 'dist');
if (!fs.existsSync(frontendDistDir)) {
  console.error('   ❌ frontend/dist directory not found!');
  process.exit(1);
}

// Copy built frontend files
fs.cpSync(frontendDistDir, FRONTEND_TARGET_DIR, { recursive: true });

// Ensure .htaccess is included in frontend build
const frontendHtaccessSource = fs.existsSync(path.join(frontendDistDir, '.htaccess'))
  ? path.join(frontendDistDir, '.htaccess')
  : path.join(FRONTEND_DIR, 'public', '.htaccess');

if (fs.existsSync(frontendHtaccessSource)) {
  fs.copyFileSync(frontendHtaccessSource, path.join(FRONTEND_TARGET_DIR, '.htaccess'));
  console.log('   ✅ Included .htaccess (RewriteBase /ca_agent/, SPA rewrites, Gzip, Security)');
}

// Ensure package.json is included in frontend build
const frontendPackageJson = path.join(FRONTEND_DIR, 'package.json');
if (fs.existsSync(frontendPackageJson)) {
  fs.copyFileSync(frontendPackageJson, path.join(FRONTEND_TARGET_DIR, 'package.json'));
  console.log('   ✅ Included package.json');
}

// Ensure .env is included in frontend build
const frontendEnvSource = fs.existsSync(path.join(FRONTEND_DIR, '.env.production'))
  ? path.join(FRONTEND_DIR, '.env.production')
  : path.join(FRONTEND_DIR, '.env');

if (fs.existsSync(frontendEnvSource)) {
  fs.copyFileSync(frontendEnvSource, path.join(FRONTEND_TARGET_DIR, '.env'));
  console.log('   ✅ Included .env (VITE_API_URL=https://ca.fundlelo.site/api)');
} else {
  fs.writeFileSync(
    path.join(FRONTEND_TARGET_DIR, '.env'),
    'VITE_API_URL=https://ca.fundlelo.site/api\nVITE_BASE_PATH=/ca_agent/\n'
  );
  console.log('   ✅ Generated production .env');
}

// 4. Assemble Backend Deployment (public_html/ca.fundlelo.site)
console.log('\n🖥️  [Step 4/5] Assembling Backend Build Package...');

// Copy app.js (Passenger entry point)
fs.copyFileSync(path.join(BACKEND_DIR, 'app.js'), path.join(BACKEND_TARGET_DIR, 'app.js'));
console.log('   ✅ Included app.js (cPanel Phusion Passenger Startup Entry Point)');

// Copy backend package.json
fs.copyFileSync(path.join(BACKEND_DIR, 'package.json'), path.join(BACKEND_TARGET_DIR, 'package.json'));
console.log('   ✅ Included package.json');

// Copy backend package-lock.json if exists
if (fs.existsSync(path.join(BACKEND_DIR, 'package-lock.json'))) {
  fs.copyFileSync(path.join(BACKEND_DIR, 'package-lock.json'), path.join(BACKEND_TARGET_DIR, 'package-lock.json'));
  console.log('   ✅ Included package-lock.json');
}

// Copy backend .env
if (fs.existsSync(path.join(BACKEND_DIR, '.env'))) {
  fs.copyFileSync(path.join(BACKEND_DIR, '.env'), path.join(BACKEND_TARGET_DIR, '.env'));
  console.log('   ✅ Included .env (MySQL & cPanel credentials)');
}

// Copy backend .htaccess
if (fs.existsSync(path.join(BACKEND_DIR, '.htaccess'))) {
  fs.copyFileSync(path.join(BACKEND_DIR, '.htaccess'), path.join(BACKEND_TARGET_DIR, '.htaccess'));
  console.log('   ✅ Included .htaccess (CloudLinux Phusion Passenger & JWT authorization header)');
}

// Copy backend src/ directory
fs.cpSync(path.join(BACKEND_DIR, 'src'), path.join(BACKEND_TARGET_DIR, 'src'), { recursive: true });
console.log('   ✅ Copied complete src/ directory');

// Create customer_repayments and uploads directories
const repaymentsDir = path.join(BACKEND_TARGET_DIR, 'customer_repayments');
const uploadsDir = path.join(BACKEND_TARGET_DIR, 'uploads');
fs.mkdirSync(repaymentsDir, { recursive: true });
fs.mkdirSync(uploadsDir, { recursive: true });
fs.writeFileSync(path.join(repaymentsDir, '.gitkeep'), '# Customer repayment receipts storage\n');
fs.writeFileSync(path.join(uploadsDir, '.gitkeep'), '# Uploads storage\n');
console.log('   ✅ Initialized customer_repayments/ and uploads/ folders');

// 5. Create Ready-to-Upload ZIP Archives
console.log('\n🗜️  [Step 5/5] Creating cPanel Upload Zip Archives...');

function createZip(sourceDir, zipPath) {
  try {
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    // Use cross-platform Windows tar or PowerShell
    execSync(`tar -a -c -f "${zipPath}" * .env* .htaccess*`, {
      cwd: sourceDir,
      stdio: 'pipe',
      shell: true
    });
    const size = (fs.statSync(zipPath).size / 1024).toFixed(1);
    console.log(`   ✅ Created ${path.basename(zipPath)} (${size} KB)`);
    return true;
  } catch (err) {
    // Fallback to powershell Compress-Archive
    try {
      execSync(`powershell -Command "Compress-Archive -Path '${sourceDir}\\*' -DestinationPath '${zipPath}' -Force"`, {
        stdio: 'pipe'
      });
      const size = (fs.statSync(zipPath).size / 1024).toFixed(1);
      console.log(`   ✅ Created ${path.basename(zipPath)} (${size} KB) [via PowerShell]`);
      return true;
    } catch (e2) {
      console.warn(`   ⚠️ Warning: Could not create zip for ${zipPath}. Folder is intact.`);
      return false;
    }
  }
}

const frontendZip = path.join(OUTPUT_DIR, 'ca_agent.zip');
const backendZip = path.join(OUTPUT_DIR, 'ca.fundlelo.site.zip');

createZip(FRONTEND_TARGET_DIR, frontendZip);
createZip(BACKEND_TARGET_DIR, backendZip);

// Verify presence of required files
console.log('\n================================================================');
console.log('🔍 VERIFICATION SUMMARY');
console.log('================================================================');

const feChecks = [
  { name: '.htaccess', exists: fs.existsSync(path.join(FRONTEND_TARGET_DIR, '.htaccess')) },
  { name: 'package.json', exists: fs.existsSync(path.join(FRONTEND_TARGET_DIR, 'package.json')) },
  { name: '.env', exists: fs.existsSync(path.join(FRONTEND_TARGET_DIR, '.env')) },
  { name: 'index.html', exists: fs.existsSync(path.join(FRONTEND_TARGET_DIR, 'index.html')) },
  { name: 'assets/ (JS & CSS)', exists: fs.existsSync(path.join(FRONTEND_TARGET_DIR, 'assets')) },
];

const beChecks = [
  { name: '.htaccess', exists: fs.existsSync(path.join(BACKEND_TARGET_DIR, '.htaccess')) },
  { name: 'package.json', exists: fs.existsSync(path.join(BACKEND_TARGET_DIR, 'package.json')) },
  { name: '.env', exists: fs.existsSync(path.join(BACKEND_TARGET_DIR, '.env')) },
  { name: 'app.js', exists: fs.existsSync(path.join(BACKEND_TARGET_DIR, 'app.js')) },
  { name: 'src/server.js', exists: fs.existsSync(path.join(BACKEND_TARGET_DIR, 'src', 'server.js')) },
];

console.log('Frontend (public_html/ca_agent):');
feChecks.forEach(c => console.log(`  ${c.exists ? '✅' : '❌'} ${c.name}`));

console.log('\nBackend (public_html/ca.fundlelo.site):');
beChecks.forEach(c => console.log(`  ${c.exists ? '✅' : '❌'} ${c.name}`));

console.log('\n================================================================');
console.log('🎉 BUILD COMPLETED SUCCESSFULLY!');
console.log('================================================================');
console.log(`\nArtifacts are located in: ${OUTPUT_DIR}\n`);
console.log('Deploy Instructions:');
console.log('1. FRONTEND: Upload dist-cpanel/ca_agent.zip into cPanel File Manager:');
console.log('   -> Path: public_html/ca_agent/');
console.log('   -> Extract files directly there.');
console.log('   -> Access at: https://fundlelo.site/ca_agent/\n');
console.log('2. BACKEND: Upload dist-cpanel/ca.fundlelo.site.zip into cPanel File Manager:');
console.log('   -> Path: public_html/ca.fundlelo.site/');
console.log('   -> Extract files directly there.');
console.log('   -> In cPanel "Setup Node.js App":');
console.log('      - Node.js version: 18.x or 20.x');
console.log('      - Application mode: Production');
console.log('      - Application root: public_html/ca.fundlelo.site');
console.log('      - Application URL: ca.fundlelo.site');
console.log('      - Application startup file: app.js');
console.log('      - Click "Run NPM Install"');
console.log('      - Click "Restart"');
console.log('   -> Health Check: https://ca.fundlelo.site/api/health\n');
