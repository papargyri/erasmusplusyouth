#!/usr/bin/env node

const XLSX = require('xlsx');
const fs = require('fs');

// Read Excel file
const workbook = XLSX.readFile('linked.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

// Get logo filenames from images folders
const mainLogos = fs.readdirSync('images').filter(f => /\.(jpg|jpeg|png|JPG|PNG|gif)$/.test(f) && !f.startsWith('.'));
const newLogos = fs.readdirSync('images/new logos').filter(f => /\.(jpg|jpeg|png|JPG|PNG|gif)$/.test(f));
const allLogos = [...mainLogos, ...newLogos.map(f => 'new logos/' + f)];

// Create mapping object
const logoData = {};

// Parse Excel data (skip header row)
for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    const name = row[0] || '';
    const country = row[1] || '';
    const website = row[2] || '';
    const logoUrl = row[3] || '';

    // Try to find matching logo file
    // Look for logo files that contain parts of the organization name
    const nameParts = name.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(p => p.length > 2);

    let matchedLogo = null;
    for (const logo of allLogos) {
        const logoLower = logo.toLowerCase();
        // Check if any significant word from the name appears in the logo filename
        for (const part of nameParts) {
            if (logoLower.includes(part)) {
                matchedLogo = logo;
                break;
            }
        }
        if (matchedLogo) break;
    }

    if (matchedLogo) {
        logoData[matchedLogo] = {
            name: name.trim(),
            country: country.trim(),
            website: website ? website.trim() : null
        };
    }
}

// Write to JSON file
fs.writeFileSync('logo-data.json', JSON.stringify(logoData, null, 2));

console.log(`✅ Generated logo-data.json with ${Object.keys(logoData).length} mappings out of ${data.length - 1} organizations`);
console.log(`\nSample entries:`);
const sampleKeys = Object.keys(logoData).slice(0, 5);
sampleKeys.forEach(key => {
    console.log(`\n${key}:`);
    console.log(`  Name: ${logoData[key].name}`);
    console.log(`  Country: ${logoData[key].country}`);
    console.log(`  Website: ${logoData[key].website || 'N/A'}`);
});
