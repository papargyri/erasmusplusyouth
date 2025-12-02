const fs = require('fs');

console.log('\n╔═══════════════════════════════════════════════════════════╗');
console.log('║          APPLYING CORRECTIONS TO HTML FILE               ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

// Load corrected mappings
const correctedMappings = JSON.parse(fs.readFileSync('corrected-mappings.json', 'utf-8'));
const validationReport = JSON.parse(fs.readFileSync('validation-report.json', 'utf-8'));

console.log('📊 Loaded corrected mappings\n');

// Get all actual logo files
const mainLogos = fs.readdirSync('images').filter(f =>
    /\.(jpg|jpeg|png|JPG|PNG|gif)$/.test(f) &&
    !f.startsWith('.') &&
    f !== 'Logo Hellas.png' &&
    f !== 'Ethnikos Logo.png'
);

const newLogos = fs.readdirSync('images/new logos')
    .filter(f => /\.(jpg|jpeg|png|JPG|PNG|gif)$/.test(f))
    .map(f => `new logos/${f}`);

const allActualFiles = [...mainLogos, ...newLogos];

// Clean up mappings
const finalMappings = {};
let removedCount = 0;
let cleanedCount = 0;

Object.entries(correctedMappings).forEach(([filename, mapping]) => {
    // Skip if file doesn't exist
    if (!allActualFiles.includes(filename)) {
        console.log(`  ❌ Removing: ${filename} (file not found)`);
        removedCount++;
        return;
    }

    // Clean up the mapping - omit website if null
    const cleanMapping = {
        name: mapping.name,
        country: mapping.country
    };

    // Only add website if it exists and is not null/empty
    if (mapping.website && mapping.website !== 'null') {
        cleanMapping.website = mapping.website;
        cleanedCount++;
    }

    finalMappings[filename] = cleanMapping;
});

console.log(`\n✅ Removed ${removedCount} non-existent file references`);
console.log(`✅ Cleaned ${Object.keys(finalMappings).length} mappings`);
console.log(`✅ ${cleanedCount} mappings have websites\n`);

// Generate JavaScript object string for HTML
function generateMappingCode(mappings) {
    const lines = [];

    Object.entries(mappings).forEach(([filename, mapping]) => {
        const name = mapping.name.replace(/"/g, '\\"');
        const country = mapping.country ? mapping.country.replace(/"/g, '\\"') : 'null';

        lines.push(`                "${filename}": {`);
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

const mappingCode = generateMappingCode(finalMappings);

// Read HTML file
const htmlContent = fs.readFileSync('index.html', 'utf-8');

// Replace the logoDataMap section
const updatedHTML = htmlContent.replace(
    /const logoDataMap = \{[\s\S]*?\};/,
    `const logoDataMap = {\n${mappingCode}\n                        };`
);

// Backup original
fs.writeFileSync('index.html.backup', htmlContent);
console.log('💾 Created backup: index.html.backup\n');

// Write updated HTML
fs.writeFileSync('index.html', updatedHTML);
console.log('✅ Updated index.html with corrected mappings\n');

// Generate summary
console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║                      CHANGES APPLIED                      ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

console.log(`Total mappings in HTML: ${Object.keys(finalMappings).length}`);
console.log(`Removed non-existent files: ${removedCount}`);
console.log(`Corrected data errors: ${validationReport.summary.corrected}`);
console.log(`\nUnmapped files remaining: ${validationReport.summary.unmappedFiles}`);

if (validationReport.summary.unmappedFiles > 0) {
    console.log('\n⚠️  The following files still need manual mapping:\n');
    validationReport.unmappedFiles.forEach((item, idx) => {
        console.log(`${idx + 1}. ${item.filename}`);
    });
}

console.log('\n✅ All corrections applied successfully!\n');
