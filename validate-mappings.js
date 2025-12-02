const XLSX = require('xlsx');
const fs = require('fs');

// Read Excel file
const workbook = XLSX.readFile('linked.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet);

// Read current logo mappings from HTML
const htmlContent = fs.readFileSync('index.html', 'utf-8');
const logoDataMapMatch = htmlContent.match(/const logoDataMap = \{([\s\S]*?)\};/);

if (!logoDataMapMatch) {
    console.error('Could not find logoDataMap in HTML file');
    process.exit(1);
}

// Parse the current mappings
const currentMappingsText = '{' + logoDataMapMatch[1] + '}';
let currentMappings = {};
try {
    currentMappings = eval('(' + currentMappingsText + ')');
} catch (e) {
    console.error('Error parsing current mappings:', e.message);
}

// Get all logo files
const mainLogos = fs.readdirSync('images').filter(f =>
    /\.(jpg|jpeg|png|JPG|PNG|gif)$/.test(f) &&
    !f.startsWith('.') &&
    f !== 'Logo Hellas.png' &&
    f !== 'Ethnikos Logo.png'
);

const newLogos = fs.readdirSync('images/new logos').filter(f =>
    /\.(jpg|jpeg|png|JPG|PNG|gif)$/.test(f)
);

const allLogoFiles = [
    ...mainLogos,
    ...newLogos.map(f => 'new logos/' + f)
];

console.log('\n=== VALIDATION REPORT ===\n');
console.log(`Total organizations in Excel: ${data.length}`);
console.log(`Total logo files found: ${allLogoFiles.length}`);
console.log(`Total mappings in HTML: ${Object.keys(currentMappings).length}`);

// Create lookup maps from Excel data
const orgByName = new Map();
const orgByLogoUrl = new Map();

data.forEach(row => {
    const name = row["Organization's name: "];
    const country = row["Country: "];
    const website = row["Website:"];
    const logoUrl = row["Upload your LOGO"];

    if (name) {
        orgByName.set(name.trim().toLowerCase(), { name, country, website });
    }
    if (logoUrl) {
        // Extract filename from URL
        const urlParts = logoUrl.split('/');
        const filename = decodeURIComponent(urlParts[urlParts.length - 1]);
        orgByLogoUrl.set(filename.toLowerCase(), { name, country, website });
    }
});

console.log(`\n=== CHECKING MISMATCHES ===\n`);

let errorCount = 0;
let warningCount = 0;
const errors = [];
const warnings = [];

// Check each mapping
Object.entries(currentMappings).forEach(([filename, mapping]) => {
    const issues = [];

    // Check if file exists
    if (!allLogoFiles.includes(filename)) {
        issues.push(`❌ File not found: ${filename}`);
        errorCount++;
    }

    // Try to match with Excel data
    const lowerName = mapping.name.toLowerCase();
    const excelMatch = orgByName.get(lowerName);

    if (excelMatch) {
        // Compare country
        if (excelMatch.country !== mapping.country) {
            issues.push(`⚠️  Country mismatch for "${mapping.name}": HTML="${mapping.country}" vs Excel="${excelMatch.country}"`);
            warningCount++;
        }

        // Compare website
        const excelWebsite = excelMatch.website || null;
        const htmlWebsite = mapping.website || null;

        if (excelWebsite !== htmlWebsite &&
            !(excelWebsite && htmlWebsite && excelWebsite.includes(htmlWebsite))) {
            issues.push(`⚠️  Website mismatch for "${mapping.name}": HTML="${htmlWebsite}" vs Excel="${excelWebsite}"`);
            warningCount++;
        }
    } else {
        // Try to extract submitter name from filename
        const submitterMatch = filename.match(/- ([^.]+)\.(jpg|jpeg|png|gif|JPG|PNG)$/i);
        if (submitterMatch) {
            issues.push(`⚠️  Organization "${mapping.name}" not found in Excel. Filename suggests submitter: "${submitterMatch[1]}"`);
            warningCount++;
        } else {
            issues.push(`⚠️  Organization "${mapping.name}" not found in Excel. No submitter info in filename.`);
            warningCount++;
        }
    }

    if (issues.length > 0) {
        console.log(`\n${filename}:`);
        issues.forEach(issue => console.log(`  ${issue}`));

        if (issues.some(i => i.startsWith('❌'))) {
            errors.push({ filename, issues });
        } else {
            warnings.push({ filename, issues });
        }
    }
});

// Check for unmapped logos
console.log(`\n=== UNMAPPED LOGO FILES ===\n`);
const mappedFiles = Object.keys(currentMappings);
const unmappedFiles = allLogoFiles.filter(f => !mappedFiles.includes(f));

if (unmappedFiles.length > 0) {
    console.log(`Found ${unmappedFiles.length} logo files without mappings:\n`);
    unmappedFiles.forEach(f => {
        console.log(`  - ${f}`);

        // Try to find matching org in Excel
        const submitterMatch = f.match(/- ([^.]+)\.(jpg|jpeg|png|gif|JPG|PNG)$/i);
        if (submitterMatch) {
            const submitter = submitterMatch[1];
            console.log(`    Submitter: "${submitter}"`);

            // Search Excel for this submitter or similar name
            const possibleMatches = data.filter(row => {
                const name = row["Organization's name: "];
                return name && (
                    name.toLowerCase().includes(submitter.toLowerCase()) ||
                    submitter.toLowerCase().includes(name.toLowerCase().substring(0, 10))
                );
            });

            if (possibleMatches.length > 0) {
                console.log(`    Possible matches in Excel:`);
                possibleMatches.forEach(m => {
                    console.log(`      → "${m["Organization's name: "]}" (${m["Country: "]})`);
                });
            }
        }
    });
} else {
    console.log('✅ All logo files are mapped');
}

// Summary
console.log(`\n=== SUMMARY ===\n`);
console.log(`Total errors: ${errorCount}`);
console.log(`Total warnings: ${warningCount}`);
console.log(`Unmapped logo files: ${unmappedFiles.length}`);

if (errorCount > 0) {
    console.log('\n⚠️  CRITICAL ISSUES FOUND - Please review errors above');
    process.exit(1);
} else if (warningCount > 0) {
    console.log('\n⚠️  Warnings found - Please review above');
} else if (unmappedFiles.length > 0) {
    console.log('\n⚠️  Unmapped files found - Please review above');
} else {
    console.log('\n✅ All validations passed!');
}
