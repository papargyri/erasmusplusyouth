const https = require('https');
const fs = require('fs');

console.log('\n╔═══════════════════════════════════════════════════════════╗');
console.log('║     AUTO-SYNC FROM GOOGLE SHEETS (LIVE UPDATE)           ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

// Your Google Sheets details
const SPREADSHEET_ID = '1uIJ9MfdLTXnXJdvsRKhIQddY4OKoj6oQXYjKyip5iQ4';
const GID = '624427258';

// Convert to CSV export URL
const csvUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${GID}`;

console.log('📊 Fetching data from Google Sheets...');
console.log(`   Sheet ID: ${SPREADSHEET_ID}`);
console.log(`   Tab GID: ${GID}\n`);

// Fetch data from Google Sheets
https.get(csvUrl, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('✅ Data fetched successfully!\n');
        processSheetData(data);
    });

}).on('error', (err) => {
    console.error('❌ Error fetching Google Sheets:', err.message);
    console.log('\n⚠️  Make sure the sheet is set to "Anyone with the link can view"\n');
});

function processSheetData(csvData) {
    // Parse CSV data
    const lines = csvData.split('\n');
    const headers = parseCSVLine(lines[0]);

    console.log('📋 Headers found:', headers);
    console.log('');

    // Find column indices
    const nameCol = headers.findIndex(h => h.toLowerCase().includes('organization'));
    const countryCol = headers.findIndex(h => h.toLowerCase().includes('country'));
    const websiteCol = headers.findIndex(h => h.toLowerCase().includes('website'));
    const logoCol = 3; // Column 4 (0-indexed is 3) - as specified by user

    console.log('Column mapping:');
    console.log(`  - Organization Name: Column ${nameCol + 1} (${headers[nameCol]})`);
    console.log(`  - Country: Column ${countryCol + 1} (${headers[countryCol]})`);
    console.log(`  - Website: Column ${websiteCol + 1} (${headers[websiteCol]})`);
    console.log(`  - Logo: Column ${logoCol + 1} (${headers[logoCol]})`);
    console.log('');

    const organizations = [];
    const mappings = {};
    const driveUrls = [];

    // Process each row (skip header)
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        const row = parseCSVLine(lines[i]);

        const name = row[nameCol]?.trim();
        const country = row[countryCol]?.trim();
        const website = row[websiteCol]?.trim();
        const logoUrl = row[logoCol]?.trim();

        if (!name) continue;

        // Extract Google Drive ID
        let driveId = null;
        if (logoUrl) {
            const match = logoUrl.match(/[?&]id=([^&]+)/);
            if (match) {
                driveId = match[1];
            }
        }

        // Normalize website
        let cleanWebsite = null;
        if (website &&
            website !== 'null' &&
            website !== '-' &&
            website !== 'Not applicable' &&
            website !== 'Under construction' &&
            !website.startsWith('Its in the') &&
            !website.startsWith('E-mail:') &&
            !website.startsWith('Instagram:') &&
            !website.startsWith('Facebook:') &&
            !website.startsWith('(updating)') &&
            !website.startsWith('Twitter:')) {
            cleanWebsite = website;
        }

        if (driveId) {
            const directUrl = `https://drive.google.com/uc?export=view&id=${driveId}`;

            mappings[directUrl] = {
                name: name,
                country: country || null,
                website: cleanWebsite
            };

            driveUrls.push(directUrl);

            organizations.push({
                row: i + 1,
                name: name,
                country: country,
                website: cleanWebsite,
                driveId: driveId,
                driveUrl: directUrl
            });
        } else {
            console.log(`⚠️  Row ${i + 1}: "${name}" has no logo URL`);
        }
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('PROCESSING RESULTS');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log(`✅ Found ${organizations.length} organizations with logos`);
    console.log(`📊 Total rows processed: ${lines.length - 1}\n`);

    // Show first 10
    console.log('First 10 organizations:\n');
    for (let i = 0; i < Math.min(10, organizations.length); i++) {
        const org = organizations[i];
        console.log(`${i + 1}. [Row ${org.row}] "${org.name}" - ${org.country}`);
        if (org.website) {
            console.log(`   Website: ${org.website}`);
        }
        console.log(`   Drive ID: ${org.driveId.substring(0, 30)}...`);
        console.log('');
    }

    // Compare with existing HTML
    let existingCount = 0;
    try {
        const htmlContent = fs.readFileSync('index.html', 'utf-8');
        const existingMatch = htmlContent.match(/const logoDataMap = \{[\s\S]*?\};/);
        if (existingMatch) {
            const matches = existingMatch[0].match(/"https:\/\/drive\.google\.com\/uc\?export=view&id=/g);
            existingCount = matches ? matches.length : 0;
        }
    } catch (e) {
        console.log('⚠️  Could not read existing HTML file');
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log('COMPARISON WITH EXISTING HTML');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log(`Current HTML has: ${existingCount} mappings`);
    console.log(`Google Sheets has: ${organizations.length} organizations`);

    const difference = organizations.length - existingCount;
    if (difference > 0) {
        console.log(`\n🆕 NEW: ${difference} new organization(s) detected!\n`);
    } else if (difference < 0) {
        console.log(`\n⚠️  WARNING: ${Math.abs(difference)} organization(s) removed from sheet\n`);
    } else {
        console.log(`\n✅ No changes detected (counts match)\n`);
    }

    // Generate JavaScript code
    const mappingCode = generateMappingCode(mappings);
    const urlArrayCode = generateUrlArray(driveUrls);

    // Read and update HTML
    try {
        const htmlContent = fs.readFileSync('index.html', 'utf-8');

        // Create backup with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        const backupName = `index.html.backup-${timestamp}`;
        fs.writeFileSync(backupName, htmlContent);
        console.log(`💾 Created backup: ${backupName}\n`);

        // Update HTML
        let updatedHTML = htmlContent.replace(
            /const logoDataMap = \{[\s\S]*?\};/,
            `const logoDataMap = {\n${mappingCode}\n                        };`
        );

        updatedHTML = updatedHTML.replace(
            /const partnerLogos = \[[\s\S]*?\];/,
            `const partnerLogos = [\n${urlArrayCode}\n                ];`
        );

        fs.writeFileSync('index.html', updatedHTML);

        console.log('✅ HTML updated successfully!\n');

        // Save reference
        const reference = {
            lastUpdated: new Date().toISOString(),
            source: 'Google Sheets',
            spreadsheetId: SPREADSHEET_ID,
            gid: GID,
            totalOrganizations: organizations.length,
            organizations: organizations
        };

        fs.writeFileSync('sync-reference.json', JSON.stringify(reference, null, 2));
        console.log('📄 Saved sync reference: sync-reference.json\n');

        console.log('╔═══════════════════════════════════════════════════════════╗');
        console.log('║                    SYNC COMPLETE                          ║');
        console.log('╚═══════════════════════════════════════════════════════════╝\n');

        console.log(`✅ ${organizations.length} organizations mapped`);
        console.log(`✅ HTML file updated`);
        console.log(`✅ All logos linked to Google Drive\n`);

        if (difference > 0) {
            console.log(`🎉 Added ${difference} new organization(s)!\n`);
        }

        console.log('To sync again anytime, run: node update-from-google-sheets.js\n');

    } catch (err) {
        console.error('❌ Error updating HTML:', err.message);
    }
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);

    return result.map(field => field.replace(/^"|"$/g, '').trim());
}

function generateMappingCode(mappings) {
    const lines = [];

    Object.entries(mappings).forEach(([url, mapping]) => {
        const name = mapping.name.replace(/"/g, '\\"');
        const country = mapping.country ? mapping.country.replace(/"/g, '\\"') : null;

        lines.push(`                "${url}": {`);
        lines.push(`                    "name": "${name}",`);
        lines.push(`                    "country": ${country ? `"${country}"` : 'null'}`);

        if (mapping.website) {
            lines.push(`                    ,"website": "${mapping.website.replace(/"/g, '\\"')}"`);
        }

        lines.push(`                },`);
    });

    if (lines.length > 0) {
        const lastCommaIndex = lines.length - 1;
        lines[lastCommaIndex] = lines[lastCommaIndex].replace(/,$/, '');
    }

    return lines.join('\n');
}

function generateUrlArray(urls) {
    return urls.map(url => `                    "${url}"`).join(',\n');
}
