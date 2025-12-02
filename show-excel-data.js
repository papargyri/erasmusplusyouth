const XLSX = require('xlsx');
const fs = require('fs');

// Read Excel file
const workbook = XLSX.readFile('linked.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet);

// Load unmapped files
const validationReport = JSON.parse(fs.readFileSync('validation-report.json', 'utf-8'));

console.log('\n╔═══════════════════════════════════════════════════════════╗');
console.log('║           EXCEL DATA + UNMAPPED FILES                    ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

console.log('═══════════════════════════════════════════════════════════');
console.log('UNMAPPED FILES (Need Manual Matching)');
console.log('═══════════════════════════════════════════════════════════\n');

validationReport.unmappedFiles.forEach((item, idx) => {
    console.log(`${idx + 1}. ${item.filename}`);
});

console.log('\n\n═══════════════════════════════════════════════════════════');
console.log('ALL ORGANIZATIONS FROM EXCEL (For Reference)');
console.log('═══════════════════════════════════════════════════════════\n');

// Filter out empty organizations and organize data
const organizations = data
    .filter(row => row["Organization's name: "])
    .map((row, index) => {
        const name = row["Organization's name: "];
        const country = row["Country: "] || null;
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
        }

        return {
            line: index + 2, // Excel row number (accounting for header)
            name: name.trim(),
            country: country ? country.trim() : null,
            website: website ? website.trim() : null
        };
    });

// Print all organizations
organizations.forEach((org, idx) => {
    console.log(`${idx + 1}. [Line ${org.line}] "${org.name}" - ${org.country}`);
    if (org.website) {
        console.log(`   Website: ${org.website}`);
    }
});

console.log(`\n\nTotal organizations in Excel: ${organizations.length}\n`);

// Create a CSV-like output for easy copy-paste
console.log('\n═══════════════════════════════════════════════════════════');
console.log('CSV FORMAT (Easy to Copy)');
console.log('═══════════════════════════════════════════════════════════\n');
console.log('Line#,Organization Name,Country,Website');

organizations.forEach(org => {
    const websiteStr = org.website || '';
    console.log(`${org.line},"${org.name}","${org.country}","${websiteStr}"`);
});

// Save to file for easier viewing
const outputLines = [
    '═══════════════════════════════════════════════════════════',
    'UNMAPPED FILES',
    '═══════════════════════════════════════════════════════════',
    '',
    ...validationReport.unmappedFiles.map((item, idx) => `${idx + 1}. ${item.filename}`),
    '',
    '',
    '═══════════════════════════════════════════════════════════',
    'ALL ORGANIZATIONS FROM EXCEL',
    '═══════════════════════════════════════════════════════════',
    '',
    ...organizations.map((org, idx) => {
        const lines = [`${idx + 1}. [Excel Line ${org.line}] "${org.name}" - ${org.country}`];
        if (org.website) {
            lines.push(`   Website: ${org.website}`);
        }
        return lines.join('\n');
    }),
    '',
    `\nTotal organizations: ${organizations.length}`,
    '',
    '',
    '═══════════════════════════════════════════════════════════',
    'SUGGESTED MATCHES (Based on Filenames)',
    '═══════════════════════════════════════════════════════════',
    ''
];

// Try to suggest matches for unmapped files
validationReport.unmappedFiles.forEach((item, idx) => {
    const filename = item.filename;

    // Extract submitter from filename
    const match = filename.match(/- ([^.]+)\.(jpg|jpeg|png|gif|JPG|PNG)$/i);
    const submitter = match ? match[1].trim() : null;

    outputLines.push(`\n${idx + 1}. FILE: ${filename}`);
    if (submitter) {
        outputLines.push(`   Submitter: "${submitter}"`);

        // Try to find matching organizations
        const possibleMatches = organizations.filter(org => {
            const orgLower = org.name.toLowerCase();
            const subLower = submitter.toLowerCase();
            const countryMatch = org.country && filename.toLowerCase().includes(org.country.toLowerCase());

            return orgLower.includes(subLower) ||
                   subLower.includes(orgLower.substring(0, Math.min(10, orgLower.length))) ||
                   countryMatch;
        });

        if (possibleMatches.length > 0) {
            outputLines.push(`   Possible matches:`);
            possibleMatches.forEach(match => {
                outputLines.push(`      → [Line ${match.line}] "${match.name}" (${match.country})`);
            });
        } else {
            outputLines.push(`   ⚠️  No obvious matches found - manual review needed`);
        }
    }
});

fs.writeFileSync('excel-organizations-list.txt', outputLines.join('\n'));
console.log('\n\n✅ Saved detailed list to: excel-organizations-list.txt\n');
