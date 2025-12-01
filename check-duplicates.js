const fs = require('fs');

// Load logo data
const logoData = JSON.parse(fs.readFileSync('logo-data.json', 'utf8'));

// Group logos by organization name
const orgToLogos = {};

for (const [logoFile, data] of Object.entries(logoData)) {
    const orgKey = `${data.name} - ${data.country}`;
    if (!orgToLogos[orgKey]) {
        orgToLogos[orgKey] = [];
    }
    orgToLogos[orgKey].push(logoFile);
}

// Find duplicates
console.log('\n=== DUPLICATE ORGANIZATIONS (same org with multiple logos) ===\n');
let duplicateCount = 0;
const logosToDelete = [];

for (const [orgKey, logos] of Object.entries(orgToLogos)) {
    if (logos.length > 1) {
        duplicateCount++;
        console.log(`${orgKey}:`);
        logos.forEach((logo, i) => {
            console.log(`  ${i + 1}. ${logo}`);
            // Keep the first one, mark others for deletion
            if (i > 0) {
                logosToDelete.push(logo);
            }
        });
        console.log('');
    }
}

console.log(`\nTotal organizations with duplicate logos: ${duplicateCount}`);
console.log(`Logos to delete: ${logosToDelete.length}\n`);

if (logosToDelete.length > 0) {
    console.log('Logos marked for deletion:');
    logosToDelete.forEach(logo => console.log(`  - ${logo}`));
}
