# 🧪 Local Testing Guide for FeatBit Azure DevOps Extension

This guide explains how to test your Azure DevOps extension locally before uploading it to the marketplace or your organization.

## 🚀 Quick Start

### 1. **Development Server Testing** (Recommended)

```bash
# Start the development server
npm run dev

# In another terminal, create the development package
npm run package:local

# Install the generated VSIX file:
# AhmedHasanin.featbit-azure-devops-extension-dev-1.0.6-dev.vsix
```

### 2. **Static Build Testing**

```bash
# Build the extension
npm run build:dev

# Package it
npm run package:dev

# Install the generated VSIX file
```

## 📋 Detailed Steps

### **Method 1: Live Development Server**

**Advantages:**
- ✅ Hot reload - changes appear instantly
- ✅ Better debugging with source maps
- ✅ Console logs and error messages
- ✅ No need to rebuild/reinstall for code changes

**Steps:**

1. **Start Development Server:**
   ```bash
   npm run dev
   ```
   - Server runs on `http://localhost:3000`
   - Serves your extension files with hot reload

2. **Create Development Extension:**
   ```bash
   npm run package:local
   ```
   - Creates: `AhmedHasanin.featbit-azure-devops-extension-dev-1.0.6-dev.vsix`
   - Extension loads content from `localhost:3000`

3. **Install in Azure DevOps:**
   - Go to `Organization Settings` → `Extensions`
   - Click `Upload new extension`
   - Upload the `-dev.vsix` file
   - Install it for your organization

4. **Test Your Extension:**
   - Navigate to a work item (User Story, Bug, etc.)
   - Look for the "Feature Flags" tab
   - Open browser developer tools to see console logs

5. **Make Changes:**
   - Edit your React components in `src/`
   - Changes appear automatically (hot reload)
   - No need to rebuild or reinstall

### **Method 2: Static File Testing**

**Advantages:**
- ✅ Tests the actual bundled files
- ✅ Simulates production environment
- ✅ No need for local server

**Steps:**

1. **Build Extension:**
   ```bash
   npm run build:dev
   ```

2. **Package Extension:**
   ```bash
   npm run package:dev
   ```

3. **Install and Test:**
   - Upload the generated `.vsix` file
   - Test functionality
   - For changes: rebuild → repackage → reinstall

## 🛠 Testing Different Components

### **Feature Flag Panel**
- **URL:** `http://localhost:3000/feature-flag-panel.html`
- **Location:** Work item form tabs
- **Test on:** User Stories, Requirements, Bugs

### **Configuration Hub**
- **URL:** `http://localhost:3000/configuration-hub.html`
- **Location:** Project Settings → FeatBit Settings
- **Test:** FeatBit connection settings

### **Create Feature Flag Dialog**
- **URL:** `http://localhost:3000/create-flag-dialog.html`
- **Location:** Triggered from Feature Flag Panel
- **Test:** Feature flag creation workflow

## 🐛 Debugging Tips

### **Browser Developer Tools**
1. **Open DevTools** (F12) in Azure DevOps
2. **Check Console** for errors and logs
3. **Network Tab** - verify assets load from localhost
4. **Sources Tab** - set breakpoints in your code

### **Common Issues**

**CORS Errors:**
- Development server includes CORS headers
- If issues persist, check Azure DevOps CSP settings

**Extension Not Loading:**
- Verify dev server is running: `curl http://localhost:3000/feature-flag-panel.html`
- Check extension is installed and enabled
- Try hard refresh (Ctrl+F5)

**Work Item Type Restrictions:**
- Development extension only shows on specific work item types
- Test with User Stories, Requirements, or Bugs
- Check `vss-extension.dev.json` → `WorkItemTypeRefNames`

## 📁 File Structure

```
├── src/                          # Source code
├── dist/                         # Built files (generated)
├── assets/                       # Icons and static files
├── vss-extension.json           # Production manifest
├── vss-extension.dev.json       # Development manifest (localhost URLs)
├── webpack.config.js            # Build configuration
└── LOCAL_TESTING.md             # This guide
```

## 🎯 Testing Checklist

- [ ] Extension installs without errors
- [ ] Feature Flag panel appears on work items
- [ ] Configuration hub loads in project settings
- [ ] Console shows no errors
- [ ] Extension initializes successfully
- [ ] FeatBit SDK integration works
- [ ] UI components render correctly
- [ ] Error handling works properly

## 🚀 Ready for Production?

When local testing is complete:

1. **Build Production Version:**
   ```bash
   npm run build
   npm run package
   ```

2. **Test Production Package:**
   - Install the production `.vsix`
   - Verify everything works without localhost

3. **Upload to Azure DevOps:**
   - Use the production `.vsix` file
   - Update version numbers as needed

## 🔧 Useful Commands

```bash
# Development
npm run dev                 # Start dev server
npm run watch              # Build and watch for changes
npm run package:local      # Create development package

# Production
npm run build              # Production build
npm run package           # Create production package

# Utilities
npm run lint              # Check code quality
npm run test              # Run tests
```

Happy testing! 🎉 