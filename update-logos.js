#!/usr/bin/env node

/**
 * Auto Logo Updater for Erasmus+ Youth Platform
 * This script scans the images folders and automatically updates index.html with all logos
 */

const fs = require('fs');
const path = require('path');

const IMAGES_DIR = path.join(__dirname, 'images');
const NEW_LOGOS_DIR = path.join(IMAGES_DIR, 'new logos');
const INDEX_HTML = path.join(__dirname, 'index.html');

// Files to exclude (non-logo files)
const EXCLUDE_FILES = [
    '.DS_Store',
    'Logo Hellas.png', // This is handled separately as the first logo
    'Ethnikos Logo.png'
];

// Supported image extensions
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG', '.gif'];

function getLogoFiles(directory, prefix = '') {
    if (!fs.existsSync(directory)) {
        return [];
    }

    const files = fs.readdirSync(directory);
    const logos = [];

    for (const file of files) {
        const fullPath = path.join(directory, file);
        const stat = fs.statSync(fullPath);

        // Skip directories and excluded files
        if (stat.isDirectory() || EXCLUDE_FILES.includes(file)) {
            continue;
        }

        // Check if it's an image file
        const ext = path.extname(file);
        if (IMAGE_EXTENSIONS.includes(ext)) {
            logos.push(prefix + file);
        }
    }

    return logos.sort();
}

function updateIndexHtml() {
    console.log('🔍 Scanning for logos...\n');

    // Get all logos from main images folder
    const mainLogos = getLogoFiles(IMAGES_DIR);
    console.log(`✓ Found ${mainLogos.length} logos in main images folder`);

    // Get all logos from new logos folder
    const newLogos = getLogoFiles(NEW_LOGOS_DIR, 'new logos/');
    console.log(`✓ Found ${newLogos.length} logos in new logos folder`);

    // Remove duplicates from main logos
    const uniqueMainLogos = [...new Set(mainLogos)];
    const uniqueNewLogos = [...new Set(newLogos)];

    if (mainLogos.length !== uniqueMainLogos.length) {
        console.log(`⚠️  Removed ${mainLogos.length - uniqueMainLogos.length} duplicate(s) from main folder`);
    }
    if (newLogos.length !== uniqueNewLogos.length) {
        console.log(`⚠️  Removed ${newLogos.length - uniqueNewLogos.length} duplicate(s) from new logos folder`);
    }

    // IMPORTANT: Main logos first, then new logos at the END
    const allLogos = [...uniqueMainLogos, ...uniqueNewLogos];
    console.log(`\n📊 Total unique logos: ${allLogos.length}\n`);

    // Read the current index.html
    let html = fs.readFileSync(INDEX_HTML, 'utf8');

    // Create the JavaScript array content
    const logosArray = allLogos.map(logo => `                    "${logo}"`).join(',\n');

    // Find and replace the partnerLogos array
    const startMarker = 'const partnerLogos = [';
    const endMarker = '];';

    const startIndex = html.indexOf(startMarker);
    if (startIndex === -1) {
        console.error('❌ Error: Could not find partnerLogos array in index.html');
        process.exit(1);
    }

    const endIndex = html.indexOf(endMarker, startIndex);
    if (endIndex === -1) {
        console.error('❌ Error: Could not find end of partnerLogos array');
        process.exit(1);
    }

    // Replace the array content
    const before = html.substring(0, startIndex + startMarker.length);
    const after = html.substring(endIndex);
    const newHtml = before + '\n' + logosArray + '\n                ' + after;

    // Write back to file
    fs.writeFileSync(INDEX_HTML, newHtml, 'utf8');

    console.log('✅ Successfully updated index.html!');
    console.log('\n📝 Next steps:');
    console.log('   1. Refresh your browser to see the new logos');
    console.log('   2. The logos will appear on the Network page\n');
}

// Run the update
try {
    updateIndexHtml();
} catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
}
