const XLSX = require('xlsx');
const fs = require('fs');

console.log('\n╔═══════════════════════════════════════════════════════════╗');
console.log('║    APPLYING GOOGLE DRIVE BASED MAPPINGS TO HTML          ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

// Read Excel file
const workbook = XLSX.readFile('linked.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet);

// Extract organization data with Google Drive IDs
const mappings = {};
const driveUrls = [];

data.forEach((row, index) => {
    const name = row["Organization's name: "];
    if (!name) return;

    const country = row["Country: "] ? row["Country: "].trim() : null;
    const logoUrl = row["Upload your LOGO"];
    let website = row["Website:"] || null;

    // Normalize website
    if (website && (
        website === 'null' ||
        website === '-' ||
        website === 'Not applicable' ||
        website === 'Under construction' ||
        website.startsWith('Its in the') ||
        website.startsWith('E-mail:') ||
        website.startsWith('Instagram:') ||
        website.startsWith('Facebook:') ||
        website.startsWith('(updating)') ||
        website.startsWith('Twitter:')
    )) {
        website = null;
    } else if (website) {
        website = website.trim();
    }

    // Extract Google Drive ID
    let driveId = null;
    if (logoUrl) {
        const match = logoUrl.match(/[?&]id=([^&]+)/);
        if (match) {
            driveId = match[1];
        }
    }

    if (driveId) {
        // Convert to direct image URL
        const directUrl = `https://drive.google.com/uc?export=view&id=${driveId}`;

        mappings[directUrl] = {
            name: name.trim(),
            country: country,
            website: website
        };

        driveUrls.push(directUrl);

        console.log(`${index + 1}. "${name.trim()}" (${country})`);
        console.log(`   Drive URL: ${directUrl.substring(0, 60)}...`);
    }
});

console.log(`\n✅ Generated ${Object.keys(mappings).length} mappings\n`);

// Generate JavaScript code for HTML
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

    // Remove trailing comma from last entry
    if (lines.length > 0) {
        const lastCommaIndex = lines.length - 1;
        lines[lastCommaIndex] = lines[lastCommaIndex].replace(/,$/, '');
    }

    return lines.join('\n');
}

function generateUrlArray(urls) {
    return urls.map(url => `                    "${url}"`).join(',\n');
}

const mappingCode = generateMappingCode(mappings);
const urlArrayCode = generateUrlArray(driveUrls);

// Read HTML file
const htmlContent = fs.readFileSync('index.html', 'utf-8');

// Backup
fs.writeFileSync('index.html.backup-before-drive', htmlContent);
console.log('💾 Created backup: index.html.backup-before-drive\n');

// Replace the logoDataMap section
let updatedHTML = htmlContent.replace(
    /const logoDataMap = \{[\s\S]*?\};/,
    `const logoDataMap = {\n${mappingCode}\n                        };`
);

// Replace the partnerLogos array
updatedHTML = updatedHTML.replace(
    /const partnerLogos = \[[\s\S]*?\];/,
    `const partnerLogos = [\n${urlArrayCode}\n                ];`
);

// Write updated HTML
fs.writeFileSync('index.html', updatedHTML);

console.log('✅ Updated index.html with Google Drive mappings\n');

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║                    CHANGES APPLIED                        ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

console.log(`Total mappings: ${Object.keys(mappings).length}`);
console.log(`All logos now use Google Drive direct URLs`);
console.log(`Mapping is based on Excel row order (rows 2-${data.length + 1})\n`);

console.log('✅ COMPLETE! Your HTML now uses Google Drive URLs.\n');
console.log('⚠️  NOTE: Images will load from Google Drive (requires internet).\n');

// Save mapping reference
const reference = {
    totalMappings: Object.keys(mappings).length,
    mappings: Object.entries(mappings).map(([url, data], idx) => ({
        position: idx + 1,
        excelRow: idx + 2,
        driveUrl: url,
        organization: data.name,
        country: data.country,
        website: data.website
    }))
};

fs.writeFileSync('drive-url-mappings-reference.json', JSON.stringify(reference, null, 2));
console.log('📄 Saved reference: drive-url-mappings-reference.json\n');
