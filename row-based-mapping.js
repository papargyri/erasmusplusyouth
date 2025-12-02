const XLSX = require('xlsx');
const fs = require('fs');

console.log('\n╔═══════════════════════════════════════════════════════════╗');
console.log('║          ROW-BASED SEQUENTIAL MAPPING                     ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

// Read Excel file
const workbook = XLSX.readFile('linked.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet);

console.log(`📊 Loaded ${data.length} rows from Excel\n`);

// Get all logo files
const mainLogos = fs.readdirSync('images').filter(f =>
    /\.(jpg|jpeg|png|JPG|PNG|gif)$/.test(f) &&
    !f.startsWith('.') &&
    f !== 'Logo Hellas.png' &&
    f !== 'Ethnikos Logo.png'
);

const newLogos = fs.readdirSync('images/new logos')
    .filter(f => /\.(jpg|jpeg|png|JPG|PNG|gif)$/.test(f))
    .map(f => `new logos/${f}`);

// Combine and sort alphabetically
const allLogos = [...mainLogos, ...newLogos].sort();

console.log(`📁 Found ${allLogos.length} logo files\n`);

// Check if there's an existing order in HTML
const htmlContent = fs.readFileSync('index.html', 'utf-8');
const partnerLogosMatch = htmlContent.match(/const partnerLogos = \[([\s\S]*?)\];/);

let htmlOrder = [];
if (partnerLogosMatch) {
    // Extract filenames from HTML array
    const arrayContent = partnerLogosMatch[1];
    const filenameMatches = arrayContent.match(/"([^"]+)"/g);
    if (filenameMatches) {
        htmlOrder = filenameMatches.map(m => m.replace(/"/g, ''));
        console.log(`📄 Found ${htmlOrder.length} logos in HTML (in this order)\n`);
    }
}

console.log('═══════════════════════════════════════════════════════════');
console.log('LOGO FILES - CURRENT ORDER IN HTML');
console.log('═══════════════════════════════════════════════════════════\n');

if (htmlOrder.length > 0) {
    htmlOrder.forEach((file, idx) => {
        console.log(`${idx + 1}. ${file}`);
    });
} else {
    console.log('⚠️  No existing order found in HTML partnerLogos array\n');
    console.log('Using ALPHABETICAL order instead:\n');
    allLogos.forEach((file, idx) => {
        console.log(`${idx + 1}. ${file}`);
    });
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log('EXCEL DATA - IN ROW ORDER');
console.log('═══════════════════════════════════════════════════════════\n');

const organizations = [];
data.forEach((row, index) => {
    const name = row["Organization's name: "];
    if (!name) return;

    const country = row["Country: "] ? row["Country: "].trim() : null;
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

    organizations.push({
        excelRow: index + 2, // Row number in Excel (accounting for header)
        name: name.trim(),
        country: country,
        website: website
    });

    console.log(`${index + 1}. [Excel Row ${index + 2}] "${name.trim()}" - ${country}`);
});

console.log('\n═══════════════════════════════════════════════════════════');
console.log('MAPPING PREVIEW');
console.log('═══════════════════════════════════════════════════════════\n');

const logoOrder = htmlOrder.length > 0 ? htmlOrder : allLogos;
const maxShow = Math.min(20, Math.max(logoOrder.length, organizations.length));

console.log('First 20 mappings (Logo → Organization):\n');

for (let i = 0; i < maxShow; i++) {
    const logo = logoOrder[i] || '❌ NO LOGO';
    const org = organizations[i];

    if (org) {
        console.log(`${i + 1}. ${logo}`);
        console.log(`   → [Excel Row ${org.excelRow}] "${org.name}" (${org.country})`);
        if (org.website) {
            console.log(`      Website: ${org.website}`);
        }
        console.log('');
    } else {
        console.log(`${i + 1}. ${logo}`);
        console.log(`   → ❌ NO ORGANIZATION (more logos than Excel rows)`);
        console.log('');
    }
}

// Generate the mapping
console.log('\n═══════════════════════════════════════════════════════════');
console.log('WARNINGS & CONFIRMATION NEEDED');
console.log('═══════════════════════════════════════════════════════════\n');

if (logoOrder.length !== organizations.length) {
    console.log(`⚠️  MISMATCH: ${logoOrder.length} logos but ${organizations.length} organizations`);
    console.log(`   Difference: ${Math.abs(logoOrder.length - organizations.length)}\n`);
}

console.log('❓ QUESTIONS FOR YOU:\n');
console.log('1. Is this the correct ORDER for the logos?');
if (htmlOrder.length > 0) {
    console.log('   (Currently using the order from your HTML file)');
} else {
    console.log('   (Currently using ALPHABETICAL order)');
}
console.log('');
console.log('2. Should logo #1 map to Excel Row 2 (first data row)?');
console.log('   Logo #1:', logoOrder[0]);
console.log('   Excel Row 2:', organizations[0] ? organizations[0].name : 'N/A');
console.log('');
console.log('3. Do you want to proceed with this sequential mapping?\n');

// Save preview
const preview = {
    logoOrder: logoOrder,
    totalLogos: logoOrder.length,
    totalOrganizations: organizations.length,
    mismatch: logoOrder.length !== organizations.length,
    preview: logoOrder.slice(0, 20).map((logo, idx) => ({
        position: idx + 1,
        logoFile: logo,
        organization: organizations[idx] || null
    }))
};

fs.writeFileSync('row-mapping-preview.json', JSON.stringify(preview, null, 2));
console.log('💾 Saved preview to: row-mapping-preview.json');
console.log('\n⚠️  PLEASE REVIEW THE PREVIEW ABOVE BEFORE PROCEEDING!\n');
