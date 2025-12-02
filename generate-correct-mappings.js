const XLSX = require('xlsx');
const fs = require('fs');

// Read Excel file
const workbook = XLSX.readFile('linked.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet);

// Get all logo files
const mainLogos = fs.readdirSync('images').filter(f =>
    /\.(jpg|jpeg|png|JPG|PNG|gif)$/.test(f) &&
    !f.startsWith('.') &&
    f !== 'Logo Hellas.png' &&
    f !== 'Ethnikos Logo.png'
);

const newLogosDir = 'images/new logos';
const newLogos = fs.readdirSync(newLogosDir).filter(f =>
    /\.(jpg|jpeg|png|JPG|PNG|gif)$/.test(f)
);

console.log('\n=== GENERATING ACCURATE MAPPINGS ===\n');
console.log(`Total organizations in Excel: ${data.length}`);
console.log(`Logo files in images/: ${mainLogos.length}`);
console.log(`Logo files in images/new logos/: ${newLogos.length}`);
console.log(`Total logo files: ${mainLogos.length + newLogos.length}\n`);

// Create a map of logo URLs to organization data
const logoUrlToOrg = new Map();
data.forEach(row => {
    const name = row["Organization's name: "];
    const country = row["Country: "];
    const website = row["Website:"];
    const logoUrl = row["Upload your LOGO"];

    if (logoUrl && name) {
        // Extract filename from the URL
        const urlParts = logoUrl.split('/');
        let filename = decodeURIComponent(urlParts[urlParts.length - 1]);

        // Normalize the website value
        let normalizedWebsite = null;
        if (website && website.trim() &&
            website !== 'null' &&
            website !== '-' &&
            website !== 'Not applicable' &&
            website !== 'Under construction' &&
            !website.startsWith('Its in the') &&
            !website.startsWith('E-mail:')) {
            normalizedWebsite = website.trim();
        }

        logoUrlToOrg.set(filename.toLowerCase(), {
            filename: filename,
            name: name.trim(),
            country: country ? country.trim() : null,
            website: normalizedWebsite
        });
    }
});

// Function to find best match for a logo file
function findBestMatch(logoFilename) {
    // Try exact match first (case-insensitive)
    const exactMatch = logoUrlToOrg.get(logoFilename.toLowerCase());
    if (exactMatch) {
        return exactMatch;
    }

    // Try to extract submitter name from filename
    const submitterMatch = logoFilename.match(/- ([^.]+)\.(jpg|jpeg|png|gif|JPG|PNG)$/i);
    if (submitterMatch) {
        const submitter = submitterMatch[1].trim();

        // Search for organization with similar name
        for (const [, orgData] of logoUrlToOrg) {
            const orgName = orgData.name.toLowerCase();
            const submitterLower = submitter.toLowerCase();

            if (orgName.includes(submitterLower) || submitterLower.includes(orgName.substring(0, Math.min(10, orgName.length)))) {
                return orgData;
            }
        }
    }

    return null;
}

// Generate mappings
const mappings = {};
const unmappedFiles = [];

// Process main logos
mainLogos.forEach(filename => {
    const match = findBestMatch(filename);
    if (match) {
        mappings[filename] = {
            name: match.name,
            country: match.country,
            website: match.website
        };
    } else {
        unmappedFiles.push(filename);
    }
});

// Process new logos
newLogos.forEach(filename => {
    const fullPath = `new logos/${filename}`;
    const match = findBestMatch(filename);
    if (match) {
        mappings[fullPath] = {
            name: match.name,
            country: match.country,
            website: match.website
        };
    } else {
        unmappedFiles.push(fullPath);
    }
});

console.log(`\n=== MAPPING RESULTS ===\n`);
console.log(`Successfully mapped: ${Object.keys(mappings).length}`);
console.log(`Unmapped files: ${unmappedFiles.length}\n`);

if (unmappedFiles.length > 0) {
    console.log('Unmapped files:');
    unmappedFiles.forEach(f => console.log(`  - ${f}`));
}

// Save to JSON file
fs.writeFileSync('logo-mappings.json', JSON.stringify(mappings, null, 4));
console.log('\n✅ Mappings saved to logo-mappings.json');

// Generate report
const report = {
    totalFiles: mainLogos.length + newLogos.length,
    mappedFiles: Object.keys(mappings).length,
    unmappedFiles: unmappedFiles.length,
    unmappedList: unmappedFiles,
    organizationsInExcel: data.length,
    mappings: mappings
};

fs.writeFileSync('mapping-report.json', JSON.stringify(report, null, 2));
console.log('✅ Report saved to mapping-report.json\n');
