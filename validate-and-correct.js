const XLSX = require('xlsx');
const fs = require('fs');

console.log('\n╔═══════════════════════════════════════════════════════════╗');
console.log('║   VALIDATION & CORRECTION - EXISTING MAPPINGS FIRST       ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

// Read Excel data
const workbook = XLSX.readFile('linked.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const excelData = XLSX.utils.sheet_to_json(sheet);

// Build lookup by organization name
const orgLookup = new Map();
excelData.forEach(row => {
    const name = row["Organization's name: "];
    if (!name) return;

    const trimmedName = name.trim();
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

    orgLookup.set(trimmedName.toLowerCase(), {
        name: trimmedName,
        country: country,
        website: website
    });
});

console.log(`📊 Loaded ${orgLookup.size} organizations from Excel\n`);

// Load existing HTML mappings
const htmlContent = fs.readFileSync('index.html', 'utf-8');
const logoDataMapMatch = htmlContent.match(/const logoDataMap = \{([\s\S]*?)\};/);

if (!logoDataMapMatch) {
    console.error('❌ Could not find logoDataMap in HTML file');
    process.exit(1);
}

const existingMappings = eval('({' + logoDataMapMatch[1] + '})');
console.log(`📊 Loaded ${Object.keys(existingMappings).length} existing HTML mappings\n`);

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

console.log(`📁 Total actual logo files: ${allActualFiles.length}\n`);

// ========================================
// VALIDATION PHASE
// ========================================

console.log('🔍 PHASE 1: VALIDATING EXISTING MAPPINGS\n');

const results = {
    correct: [],
    needsCorrection: [],
    fileNotFound: [],
    notInExcel: [],
    unmappedFiles: []
};

Object.entries(existingMappings).forEach(([filename, mapping]) => {
    // Check 1: Does the file exist?
    if (!allActualFiles.includes(filename)) {
        results.fileNotFound.push({
            filename: filename,
            mapping: mapping,
            issue: 'File does not exist on disk'
        });
        return;
    }

    // Check 2: Does the organization exist in Excel?
    const orgKey = mapping.name.toLowerCase();
    const excelOrg = orgLookup.get(orgKey);

    if (!excelOrg) {
        results.notInExcel.push({
            filename: filename,
            mapping: mapping,
            issue: 'Organization not found in Excel data'
        });
        return;
    }

    // Check 3: Are country and website correct?
    const corrections = {};
    let needsCorrection = false;

    if (mapping.country !== excelOrg.country) {
        corrections.country = {
            current: mapping.country,
            correct: excelOrg.country
        };
        needsCorrection = true;
    }

    // Normalize websites for comparison
    const normalizeWebsite = (w) => {
        if (!w) return null;
        return w.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
    };

    const currentWeb = normalizeWebsite(mapping.website);
    const excelWeb = normalizeWebsite(excelOrg.website);

    if (currentWeb !== excelWeb) {
        // Only flag if both exist and are different, or one is null
        if (!(currentWeb && excelWeb && excelWeb.includes(currentWeb))) {
            corrections.website = {
                current: mapping.website,
                correct: excelOrg.website
            };
            needsCorrection = true;
        }
    }

    if (needsCorrection) {
        results.needsCorrection.push({
            filename: filename,
            name: mapping.name,
            corrections: corrections
        });
    } else {
        results.correct.push({
            filename: filename,
            name: mapping.name
        });
    }
});

// Check for unmapped files
results.unmappedFiles = allActualFiles.filter(f => !existingMappings[f]);

// ========================================
// RESULTS
// ========================================

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║                   VALIDATION RESULTS                      ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

console.log(`✅ Correct mappings: ${results.correct.length}`);
console.log(`⚠️  Need correction: ${results.needsCorrection.length}`);
console.log(`❌ File not found: ${results.fileNotFound.length}`);
console.log(`⚠️  Not in Excel: ${results.notInExcel.length}`);
console.log(`📝 Unmapped files: ${results.unmappedFiles.length}\n`);

// Show details
if (results.needsCorrection.length > 0) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('CORRECTIONS NEEDED:\n');
    results.needsCorrection.forEach((item, idx) => {
        console.log(`${idx + 1}. ${item.filename}`);
        console.log(`   Organization: ${item.name}`);
        if (item.corrections.country) {
            console.log(`   Country: "${item.corrections.country.current}" → "${item.corrections.country.correct}"`);
        }
        if (item.corrections.website) {
            console.log(`   Website: "${item.corrections.website.current}" → "${item.corrections.website.correct}"`);
        }
        console.log('');
    });
}

if (results.fileNotFound.length > 0) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('FILES NOT FOUND (should be removed from HTML):\n');
    results.fileNotFound.forEach((item, idx) => {
        console.log(`${idx + 1}. ${item.filename} - "${item.mapping.name}"`);
    });
    console.log('');
}

if (results.notInExcel.length > 0) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('NOT IN EXCEL (manual mappings - need verification):\n');
    results.notInExcel.forEach((item, idx) => {
        console.log(`${idx + 1}. ${item.filename} - "${item.mapping.name}" (${item.mapping.country})`);
    });
    console.log('');
}

if (results.unmappedFiles.length > 0) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('UNMAPPED FILES (need manual mapping):\n');
    results.unmappedFiles.forEach((file, idx) => {
        console.log(`${idx + 1}. ${file}`);
    });
    console.log('');
}

// ========================================
// GENERATE CORRECTED MAPPINGS
// ========================================

const correctedMappings = {};

// Add all correct mappings
results.correct.forEach(item => {
    correctedMappings[item.filename] = existingMappings[item.filename];
});

// Add corrected versions
results.needsCorrection.forEach(item => {
    const orgKey = item.name.toLowerCase();
    const excelOrg = orgLookup.get(orgKey);

    correctedMappings[item.filename] = {
        name: excelOrg.name,
        country: excelOrg.country,
        website: excelOrg.website
    };
});

// Keep "not in Excel" items (they might be correct manual entries)
results.notInExcel.forEach(item => {
    correctedMappings[item.filename] = existingMappings[item.filename];
});

// Save corrected mappings
fs.writeFileSync('corrected-mappings.json', JSON.stringify(correctedMappings, null, 2));

// Save detailed report
const report = {
    summary: {
        totalMappings: Object.keys(existingMappings).length,
        totalFiles: allActualFiles.length,
        correct: results.correct.length,
        corrected: results.needsCorrection.length,
        filesNotFound: results.fileNotFound.length,
        notInExcel: results.notInExcel.length,
        unmappedFiles: results.unmappedFiles.length
    },
    corrections: results.needsCorrection,
    filesToRemove: results.fileNotFound,
    manualVerificationNeeded: results.notInExcel,
    unmappedFiles: results.unmappedFiles.map(f => ({
        filename: f,
        note: 'Needs manual mapping - suggest comparing with Excel organization list'
    }))
};

fs.writeFileSync('validation-report.json', JSON.stringify(report, null, 2));

console.log('✅ Corrected mappings saved to: corrected-mappings.json');
console.log('✅ Detailed report saved to: validation-report.json\n');

// Final summary
console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║                      SUMMARY                              ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

const totalIssues = results.needsCorrection.length + results.fileNotFound.length;
const accuracyRate = ((results.correct.length / Object.keys(existingMappings).length) * 100).toFixed(1);

console.log(`Accuracy of existing mappings: ${accuracyRate}%`);
console.log(`Issues found and corrected: ${totalIssues}`);
console.log(`Files needing manual mapping: ${results.unmappedFiles.length}\n`);

if (totalIssues === 0 && results.unmappedFiles.length === 0) {
    console.log('🎉 Perfect! All mappings are correct and all files are mapped.\n');
} else if (totalIssues > 0) {
    console.log('⚠️  Issues found. Review validation-report.json for details.\n');
    console.log('   To apply corrections, you can use corrected-mappings.json\n');
} else {
    console.log('✅ All existing mappings are correct!\n');
    if (results.unmappedFiles.length > 0) {
        console.log(`   ${results.unmappedFiles.length} files still need mapping.\n`);
    }
}
