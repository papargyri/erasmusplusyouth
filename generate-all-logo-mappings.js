#!/usr/bin/env node

const XLSX = require('xlsx');
const fs = require('fs');

// Read Excel file
const workbook = XLSX.readFile('linked.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

// Get all logo files
const mainLogos = fs.readdirSync('images').filter(f => /\.(jpg|jpeg|png|JPG|PNG|gif)$/.test(f) && !f.startsWith('.') && f !== 'Logo Hellas.png' && f !== 'Ethnikos Logo.png');
const newLogos = fs.readdirSync('images/new logos').filter(f => /\.(jpg|jpeg|png|JPG|PNG|gif)$/.test(f));
const allLogos = [...mainLogos, ...newLogos.map(f => 'new logos/' + f)];

console.log(`\nTotal logos to map: ${allLogos.length}`);
console.log(`Total organizations in Excel: ${data.length - 1}\n`);

// Parse Excel and create organization lookup
const organizations = [];
for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    const name = (row[0] || '').trim();
    const country = (row[1] || '').trim();
    const website = row[2] ? row[2].trim() : null;

    if (name && country) {
        organizations.push({ name, country, website });
    }
}

// Function to normalize text for matching
function normalize(text) {
    return text.toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// Function to extract organization name from logo filename
function extractOrgName(filename) {
    // Remove "new logos/" prefix
    let name = filename.replace('new logos/', '');
    // Remove file extension
    name = name.replace(/\.(jpg|jpeg|png|JPG|PNG|gif)$/i, '');
    // Remove submitter name (after " - ")
    const parts = name.split(' - ');
    return parts[0].trim();
}

// Match each logo to an organization
const logoData = {};
const unmatchedLogos = [];

for (const logo of allLogos) {
    const orgNameFromFile = extractOrgName(logo);
    const normalizedFileName = normalize(orgNameFromFile);

    let bestMatch = null;
    let bestScore = 0;

    // Try to find best matching organization
    for (const org of organizations) {
        const normalizedOrgName = normalize(org.name);
        let score = 0;

        // Exact match after normalization
        if (normalizedFileName === normalizedOrgName) {
            score = 1000;
        }
        // Filename contains org name
        else if (normalizedFileName.includes(normalizedOrgName)) {
            score = 800 + normalizedOrgName.length;
        }
        // Org name contains filename
        else if (normalizedOrgName.includes(normalizedFileName)) {
            score = 700 + normalizedFileName.length;
        }
        // Check word matches
        else {
            const fileWords = normalizedFileName.split(' ').filter(w => w.length > 2);
            const orgWords = normalizedOrgName.split(' ').filter(w => w.length > 2);

            let matchCount = 0;
            let matchLength = 0;

            for (const fw of fileWords) {
                for (const ow of orgWords) {
                    if (fw === ow) {
                        matchCount++;
                        matchLength += fw.length;
                    } else if (fw.length > 3 && ow.length > 3 && (fw.includes(ow) || ow.includes(fw))) {
                        matchCount += 0.5;
                        matchLength += Math.min(fw.length, ow.length);
                    }
                }
            }

            if (matchCount > 0) {
                score = matchCount * 100 + matchLength;
            }
        }

        if (score > bestScore) {
            bestScore = score;
            bestMatch = org;
        }
    }

    // Accept match if score is high enough
    if (bestScore >= 100 && bestMatch) {
        logoData[logo] = {
            name: bestMatch.name,
            country: bestMatch.country,
            website: bestMatch.website,
            score: bestScore
        };
    } else {
        unmatchedLogos.push({ logo, orgName: orgNameFromFile, bestScore });
    }
}

console.log(`✅ Successfully matched: ${Object.keys(logoData).length} logos`);
console.log(`⚠️  Unmatched logos: ${unmatchedLogos.length}\n`);

if (unmatchedLogos.length > 0) {
    console.log('Unmatched logos (showing first 20):');
    unmatchedLogos.slice(0, 20).forEach(item => {
        console.log(`  - ${item.logo} (extracted: "${item.orgName}", best score: ${item.bestScore})`);
    });
}

// Write to JSON
const outputData = {};
for (const [logo, data] of Object.entries(logoData)) {
    outputData[logo] = {
        name: data.name,
        country: data.country,
        website: data.website
    };
}

fs.writeFileSync('logo-data-all.json', JSON.stringify(outputData, null, 2));
console.log(`\n✅ Saved to logo-data-all.json`);
