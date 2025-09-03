#!/usr/bin/env node

/**
 * Extension verification script
 * Validates that the extension can be built and packaged correctly
 */

const fs = require('fs');
const path = require('path');

function verifyExtensionManifest() {
  console.log('🔍 Verifying extension manifest...');
  
  const manifestPath = path.join(__dirname, '..', 'vss-extension.json');
  
  if (!fs.existsSync(manifestPath)) {
    throw new Error('Extension manifest (vss-extension.json) not found');
  }
  
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  
  // Verify required fields
  const requiredFields = ['id', 'name', 'version', 'publisher', 'contributions'];
  for (const field of requiredFields) {
    if (!manifest[field]) {
      throw new Error(`Missing required field in manifest: ${field}`);
    }
  }
  
  // Verify contributions
  const contributions = manifest.contributions;
  const expectedContributions = ['feature-flag-panel', 'configuration-hub'];
  
  for (const expectedId of expectedContributions) {
    const contribution = contributions.find(c => c.id === expectedId);
    if (!contribution) {
      throw new Error(`Missing expected contribution: ${expectedId}`);
    }
    
    if (!contribution.properties || !contribution.properties.uri) {
      throw new Error(`Contribution ${expectedId} missing URI property`);
    }
  }
  
  // Verify scopes
  const requiredScopes = ['vso.work', 'vso.work_write', 'vso.extension_manage', 'vso.extension.data_write'];
  for (const scope of requiredScopes) {
    if (!manifest.scopes.includes(scope)) {
      throw new Error(`Missing required scope: ${scope}`);
    }
  }
  
  console.log('✅ Extension manifest is valid');
  return manifest;
}

function verifyDistFiles(manifest) {
  console.log('🔍 Verifying distribution files...');
  
  const distPath = path.join(__dirname, '..', 'dist');
  
  if (!fs.existsSync(distPath)) {
    console.log('⚠️  Dist directory not found - run build first');
    return;
  }
  
  // Check for HTML files referenced in contributions
  const contributions = manifest.contributions;
  for (const contribution of contributions) {
    if (contribution.properties && contribution.properties.uri) {
      const filePath = path.join(__dirname, '..', contribution.properties.uri);
      if (!fs.existsSync(filePath)) {
        console.log(`⚠️  Referenced file not found: ${contribution.properties.uri}`);
      } else {
        console.log(`✅ Found: ${contribution.properties.uri}`);
      }
    }
  }
}

function verifySourceFiles() {
  console.log('🔍 Verifying source files...');
  
  const requiredFiles = [
    'src/components/FeatureFlagPanel/index.tsx',
    'src/components/ConfigurationHub/index.tsx',
    'src/utils/ExtensionInitializer.ts'
  ];
  
  for (const file of requiredFiles) {
    const filePath = path.join(__dirname, '..', file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Required source file not found: ${file}`);
    }
  }
  
  console.log('✅ All required source files found');
}

function verifyPackageJson() {
  console.log('🔍 Verifying package.json...');
  
  const packagePath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  
  // Check for required dependencies
  const requiredDeps = ['react', 'react-dom'];
  const requiredDevDeps = ['typescript', 'webpack', '@types/react'];
  
  for (const dep of requiredDeps) {
    if (!packageJson.dependencies || !packageJson.dependencies[dep]) {
      console.log(`⚠️  Missing dependency: ${dep}`);
    }
  }
  
  for (const dep of requiredDevDeps) {
    if (!packageJson.devDependencies || !packageJson.devDependencies[dep]) {
      console.log(`⚠️  Missing dev dependency: ${dep}`);
    }
  }
  
  console.log('✅ Package.json verified');
}

function main() {
  try {
    console.log('🚀 Starting extension verification...\n');
    
    const manifest = verifyExtensionManifest();
    verifySourceFiles();
    verifyPackageJson();
    verifyDistFiles(manifest);
    
    console.log('\n✅ Extension verification completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. Run "npm run build" to build the extension');
    console.log('   2. Run "npm test" to run all tests');
    console.log('   3. Package the extension with tfx-cli');
    
  } catch (error) {
    console.error('\n❌ Extension verification failed:');
    console.error(error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  verifyExtensionManifest,
  verifyDistFiles,
  verifySourceFiles,
  verifyPackageJson
};