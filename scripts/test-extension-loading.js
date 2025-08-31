#!/usr/bin/env node

/**
 * Simple script to verify extension files are properly built and can be loaded
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying FeatBit Azure DevOps Extension build...\n');

// Check if dist directory exists
const distPath = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distPath)) {
  console.error('❌ dist directory not found. Run npm run build first.');
  process.exit(1);
}

// Check required files
const requiredFiles = [
  'feature-flag-panel.html',
  'feature-flag-panel.js',
  'configuration-hub.html', 
  'configuration-hub.js',
  'create-flag-dialog.html',
  'create-flag-dialog.js',
  'vendors.js'
];

let allFilesExist = true;

console.log('📁 Checking required files:');
requiredFiles.forEach(file => {
  const filePath = path.join(distPath, file);
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    console.log(`  ✅ ${file} (${Math.round(stats.size / 1024)}KB)`);
  } else {
    console.log(`  ❌ ${file} - MISSING`);
    allFilesExist = false;
  }
});

// Check HTML files have proper script references
console.log('\n🔗 Checking HTML files for script references:');
const htmlFiles = ['feature-flag-panel.html', 'configuration-hub.html', 'create-flag-dialog.html'];

htmlFiles.forEach(htmlFile => {
  const filePath = path.join(distPath, htmlFile);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check for VSS SDK
    const hasVSS = content.includes('VSS.SDK.min.js');
    
    // Check for webpack bundles
    const hasVendors = content.includes('vendors.js');
    const hasMainBundle = content.includes(htmlFile.replace('.html', '.js'));
    
    console.log(`  📄 ${htmlFile}:`);
    console.log(`    ${hasVSS ? '✅' : '❌'} VSS SDK reference`);
    console.log(`    ${hasVendors ? '✅' : '❌'} Vendors bundle`);
    console.log(`    ${hasMainBundle ? '✅' : '❌'} Main bundle`);
    
    if (!hasVSS || !hasVendors || !hasMainBundle) {
      allFilesExist = false;
    }
  }
});

// Check extension manifest
console.log('\n📋 Checking extension manifest:');
const manifestPath = path.join(__dirname, '..', 'vss-extension.json');
if (fs.existsSync(manifestPath)) {
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    
    console.log(`  ✅ Extension ID: ${manifest.id}`);
    console.log(`  ✅ Version: ${manifest.version}`);
    console.log(`  ✅ Contributions: ${manifest.contributions?.length || 0}`);
    
    // Check contributions
    const hasFeatureFlagPanel = manifest.contributions?.some(c => c.id === 'feature-flag-panel');
    const hasConfigHub = manifest.contributions?.some(c => c.id === 'configuration-hub');
    
    console.log(`  ${hasFeatureFlagPanel ? '✅' : '❌'} Feature Flag Panel contribution`);
    console.log(`  ${hasConfigHub ? '✅' : '❌'} Configuration Hub contribution`);
    
    if (!hasFeatureFlagPanel || !hasConfigHub) {
      allFilesExist = false;
    }
  } catch (error) {
    console.log(`  ❌ Invalid JSON: ${error.message}`);
    allFilesExist = false;
  }
} else {
  console.log('  ❌ vss-extension.json not found');
  allFilesExist = false;
}

// Final result
console.log('\n' + '='.repeat(50));
if (allFilesExist) {
  console.log('🎉 Extension build verification PASSED!');
  console.log('✅ All required files are present and properly configured.');
  console.log('\n📦 Ready for packaging with: tfx extension create');
  process.exit(0);
} else {
  console.log('❌ Extension build verification FAILED!');
  console.log('🔧 Please fix the issues above and rebuild.');
  process.exit(1);
}