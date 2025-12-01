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

// Create a map from filename to organization data for easier lookup
// Format: filename -> { name, country, website }
const filenameParts = {};

// First pass: create a lookup by extracting organization info
for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    const name = (row[0] || '').trim();
    const country = (row[1] || '').trim();
    const website = row[2] ? row[2].trim() : null;

    if (!name || !country) continue;

    // Store by normalized organization name for lookup
    const normalizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    filenameParts[normalizedName] = { name, country, website };
}

// Second pass: match logo files to organizations
for (const logo of allLogos) {
    // Extract organization name parts from filename
    // Format is usually: "LogoName - SubmitterName.ext" or just "LogoName.ext"
    const baseName = logo.replace(/\.(jpg|jpeg|png|JPG|PNG|gif)$/i, '');
    const parts = baseName.split(' - ');
    const logoNamePart = parts[0].trim();

    // Try exact match first (normalize both)
    const normalizedLogo = logoNamePart.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Check for matches
    let bestMatch = null;
    let bestMatchScore = 0;

    for (const [normalizedOrg, orgData] of Object.entries(filenameParts)) {
        // Calculate similarity score
        let score = 0;

        // Exact match
        if (normalizedLogo === normalizedOrg) {
            score = 1000;
        }
        // Contains full organization name
        else if (normalizedLogo.includes(normalizedOrg) && normalizedOrg.length > 3) {
            score = 500 + normalizedOrg.length;
        }
        // Organization name contains logo name
        else if (normalizedOrg.includes(normalizedLogo) && normalizedLogo.length > 3) {
            score = 400 + normalizedLogo.length;
        }
        // Partial word matches
        else {
            const logoWords = logoNamePart.toLowerCase().split(/\s+/);
            const orgWords = orgData.name.toLowerCase().split(/\s+/);
            let matchedWords = 0;

            for (const logoWord of logoWords) {
                if (logoWord.length > 2) {
                    for (const orgWord of orgWords) {
                        if (orgWord.includes(logoWord) || logoWord.includes(orgWord)) {
                            matchedWords++;
                        }
                    }
                }
            }

            if (matchedWords > 0) {
                score = matchedWords * 50;
            }
        }

        if (score > bestMatchScore) {
            bestMatchScore = score;
            bestMatch = orgData;
        }
    }

    // Only add if confidence is high enough
    if (bestMatchScore >= 100) {
        logoData[logo] = bestMatch;
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
