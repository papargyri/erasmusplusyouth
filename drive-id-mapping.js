const XLSX = require('xlsx');
const fs = require('fs');

console.log('\n╔═══════════════════════════════════════════════════════════╗');
console.log('║      GOOGLE DRIVE ID BASED MAPPING                        ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

// Read Excel file
const workbook = XLSX.readFile('linked.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet);

console.log(`📊 Processing ${data.length} rows from Excel\n`);

// Extract organization data with Google Drive IDs
const organizations = [];
const driveIdMap = new Map();

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

    const orgData = {
        excelRow: index + 2,
        position: organizations.length + 1,
        name: name.trim(),
        country: country,
        website: website,
        driveUrl: logoUrl,
        driveId: driveId
    };

    organizations.push(orgData);

    if (driveId) {
        driveIdMap.set(driveId, orgData);
    }
});

console.log(`✅ Extracted ${organizations.length} organizations`);
console.log(`✅ Found ${driveIdMap.size} Google Drive IDs\n`);

// Show first 20 with Drive links
console.log('═══════════════════════════════════════════════════════════');
console.log('FIRST 20 ORGANIZATIONS WITH GOOGLE DRIVE LINKS');
console.log('═══════════════════════════════════════════════════════════\n');

for (let i = 0; i < Math.min(20, organizations.length); i++) {
    const org = organizations[i];
    console.log(`${org.position}. [Excel Row ${org.excelRow}] "${org.name}" - ${org.country}`);
    if (org.driveId) {
        console.log(`   Drive ID: ${org.driveId}`);
        console.log(`   Drive URL: ${org.driveUrl.substring(0, 60)}...`);
    } else {
        console.log(`   ⚠️  NO LOGO LINK`);
    }
    if (org.website) {
        console.log(`   Website: ${org.website}`);
    }
    console.log('');
}

// Check local files for Drive ID hints
const mainLogos = fs.readdirSync('images').filter(f =>
    /\.(jpg|jpeg|png|JPG|PNG|gif)$/.test(f) &&
    !f.startsWith('.') &&
    f !== 'Logo Hellas.png' &&
    f !== 'Ethnikos Logo.png'
);

const newLogos = fs.readdirSync('images/new logos')
    .filter(f => /\.(jpg|jpeg|png|JPG|PNG|gif)$/.test(f))
    .map(f => `new logos/${f}`);

const allLogos = [...mainLogos, ...newLogos];

console.log('\n═══════════════════════════════════════════════════════════');
console.log('APPROACH OPTIONS');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('Option 1: USE GOOGLE DRIVE LINKS DIRECTLY');
console.log('  - Store Drive ID in mapping instead of local filenames');
console.log('  - Convert Drive IDs to direct image URLs');
console.log('  - Pros: Perfect 1:1 mapping guaranteed');
console.log('  - Cons: Requires internet, may need Drive API');
console.log('');

console.log('Option 2: MANUAL MATCHING');
console.log('  - Create a CSV for you to manually map files to Drive IDs');
console.log('  - Pros: 100% accurate, you control it');
console.log('  - Cons: Manual work required');
console.log('');

console.log('Option 3: DOWNLOAD ORDER MATCHING');
console.log('  - Assume files were downloaded in Excel row order');
console.log('  - Match by position');
console.log('  - Pros: Automatic');
console.log('  - Cons: Only works if download was sequential');
console.log('');

// Generate Drive URL to direct image URL conversion
const driveUrlMappings = {};

organizations.forEach(org => {
    if (org.driveId) {
        // Convert Google Drive ID to direct image URL
        const directUrl = `https://drive.google.com/uc?export=view&id=${org.driveId}`;

        driveUrlMappings[org.driveId] = {
            name: org.name,
            country: org.country,
            website: org.website,
            driveUrl: directUrl
        };
    }
});

// Save mappings
fs.writeFileSync('drive-id-mappings.json', JSON.stringify(driveUrlMappings, null, 2));

// Create CSV for manual matching
const csvLines = [
    'Excel Row,Organization Name,Country,Website,Google Drive ID,Google Drive URL,LOCAL FILE (fill this in)'
];

organizations.forEach(org => {
    const website = org.website || '';
    const driveId = org.driveId || '';
    const driveUrl = org.driveUrl || '';
    csvLines.push(`${org.excelRow},"${org.name}","${org.country}","${website}","${driveId}","${driveUrl}",""`);
});

fs.writeFileSync('manual-mapping-template.csv', csvLines.join('\n'));

console.log('✅ Saved drive-id-mappings.json (Drive ID → Organization data)');
console.log('✅ Saved manual-mapping-template.csv (for manual file matching)');
console.log('');

console.log('═══════════════════════════════════════════════════════════');
console.log('RECOMMENDATION');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('Since you have Google Drive links in Excel, I recommend:');
console.log('');
console.log('1. Use Google Drive IDs directly as image source');
console.log('   - Update HTML to use: https://drive.google.com/uc?export=view&id=DRIVE_ID');
console.log('   - This ensures perfect 1:1 mapping');
console.log('');
console.log('2. OR: Tell me the download order/method you used');
console.log('   - If you downloaded them in Excel row order, I can auto-map');
console.log('');
console.log('Which approach would you prefer?\n');

// Count organizations with and without logos
const withLogos = organizations.filter(o => o.driveId).length;
const withoutLogos = organizations.filter(o => !o.driveId).length;

console.log(`\n📊 Summary:`);
console.log(`   Organizations with logos: ${withLogos}`);
console.log(`   Organizations without logos: ${withoutLogos}`);
console.log(`   Local logo files: ${allLogos.length}\n`);
