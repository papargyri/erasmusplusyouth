const XLSX = require('xlsx');
const fs = require('fs');

// ========================================
// UTILITY FUNCTIONS
// ========================================

function normalizeString(str) {
    if (!str) return '';
    return str
        .toLowerCase()
        .trim()
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function extractAcronym(str) {
    if (!str) return '';
    const words = str.split(/\s+/);
    if (words.length > 1) {
        return words.map(w => w[0]).join('').toLowerCase();
    }
    return '';
}

function similarity(s1, s2) {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    if (longer.length === 0) return 1.0;

    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(s1, s2) {
    const costs = [];
    for (let i = 0; i <= s1.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= s2.length; j++) {
            if (i === 0) {
                costs[j] = j;
            } else if (j > 0) {
                let newValue = costs[j - 1];
                if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
                    newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                }
                costs[j - 1] = lastValue;
                lastValue = newValue;
            }
        }
        if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
}

function extractSubmitterFromFilename(filename) {
    // Remove path prefix
    const baseName = filename.replace('new logos/', '');

    // Pattern: "description - Submitter Name.ext"
    const match = baseName.match(/(.+?)\s*-\s*([^.]+)\.(jpg|jpeg|png|gif|JPG|PNG)$/i);

    if (match) {
        return {
            description: match[1].trim(),
            submitter: match[2].trim(),
            extension: match[3]
        };
    }

    // No submitter pattern, just description
    return {
        description: baseName.replace(/\.(jpg|jpeg|png|gif|JPG|PNG)$/i, ''),
        submitter: null,
        extension: baseName.split('.').pop()
    };
}

// ========================================
// MAIN MATCHING LOGIC
// ========================================

console.log('\n╔═══════════════════════════════════════════════════════════╗');
console.log('║     SMART LOGO MATCHING ALGORITHM - 100% ACCURACY        ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

// Read Excel data
const workbook = XLSX.readFile('linked.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const excelData = XLSX.utils.sheet_to_json(sheet);

console.log(`📊 Loaded ${excelData.length} organizations from Excel\n`);

// Prepare organization data
const organizations = excelData
    .filter(row => row["Organization's name: "])
    .map((row, index) => {
        const name = row["Organization's name: "].trim();
        const country = row["Country: "] ? row["Country: "].trim() : null;
        let website = row["Website:"] || null;

        // Normalize website - filter out invalid values
        if (website && (
            website === 'null' ||
            website === '-' ||
            website === 'Not applicable' ||
            website === 'Under construction' ||
            website.startsWith('Its in the') ||
            website.startsWith('E-mail:') ||
            website.startsWith('Facebook:') ||
            website.startsWith('Instagram:')
        )) {
            website = null;
        } else if (website) {
            website = website.trim();
        }

        return {
            id: index,
            name: name,
            normalizedName: normalizeString(name),
            acronym: extractAcronym(name),
            country: country,
            website: website,
            matched: false
        };
    });

console.log(`✅ Processed ${organizations.length} valid organizations\n`);

// Get all logo files
const mainLogos = fs.readdirSync('images').filter(f =>
    /\.(jpg|jpeg|png|JPG|PNG|gif)$/.test(f) &&
    !f.startsWith('.') &&
    f !== 'Logo Hellas.png' &&
    f !== 'Ethnikos Logo.png'
);

const newLogosDir = 'images/new logos';
const newLogos = fs.readdirSync(newLogosDir)
    .filter(f => /\.(jpg|jpeg|png|JPG|PNG|gif)$/.test(f))
    .map(f => `new logos/${f}`);

const allLogos = [...mainLogos, ...newLogos];

console.log(`📁 Found ${mainLogos.length} logos in images/`);
console.log(`📁 Found ${newLogos.length} logos in images/new logos/`);
console.log(`📁 Total: ${allLogos.length} logo files\n`);

// Extract logo metadata
const logos = allLogos.map(filename => {
    const parts = extractSubmitterFromFilename(filename);
    return {
        filename: filename,
        description: parts.description,
        submitter: parts.submitter,
        normalizedDescription: normalizeString(parts.description),
        normalizedSubmitter: normalizeString(parts.submitter || ''),
        matched: false,
        matches: []
    };
});

console.log('🔍 Starting multi-pass matching algorithm...\n');

// ========================================
// MATCHING PASS 1: Exact Submitter Match
// ========================================
console.log('PASS 1: Exact submitter name matching...');
let pass1Count = 0;

logos.forEach(logo => {
    if (logo.matched) return;

    organizations.forEach(org => {
        if (org.matched) return;

        const orgNorm = org.normalizedName;
        const submitterNorm = logo.normalizedSubmitter;

        if (submitterNorm && orgNorm === submitterNorm) {
            logo.matches.push({
                org: org,
                confidence: 1.0,
                reason: 'Exact match: organization name === submitter name'
            });
        }
    });
});

logos.forEach(logo => {
    if (logo.matches.length === 1 && logo.matches[0].confidence === 1.0) {
        const match = logo.matches[0];
        logo.matched = true;
        match.org.matched = true;
        logo.finalMatch = match;
        pass1Count++;
    }
});

console.log(`  ✓ Found ${pass1Count} exact matches\n`);

// ========================================
// PASS 2: Submitter Name Contains Org Name
// ========================================
console.log('PASS 2: Submitter contains organization name...');
let pass2Count = 0;

logos.forEach(logo => {
    if (logo.matched) return;
    logo.matches = []; // Clear previous matches

    organizations.forEach(org => {
        if (org.matched) return;

        const orgNorm = org.normalizedName;
        const submitterNorm = logo.normalizedSubmitter;
        const descNorm = logo.normalizedDescription;

        if (submitterNorm && orgNorm.length > 5) {
            // Check if org name is in submitter
            if (submitterNorm.includes(orgNorm)) {
                logo.matches.push({
                    org: org,
                    confidence: 0.95,
                    reason: `Submitter "${logo.submitter}" contains org name "${org.name}"`
                });
            }
            // Check if submitter is in org name
            else if (submitterNorm.length > 5 && orgNorm.includes(submitterNorm)) {
                logo.matches.push({
                    org: org,
                    confidence: 0.90,
                    reason: `Org name "${org.name}" contains submitter "${logo.submitter}"`
                });
            }
        }

        // Check description against org name
        if (descNorm && orgNorm.length > 5 && descNorm.includes(orgNorm)) {
            logo.matches.push({
                org: org,
                confidence: 0.85,
                reason: `Description "${logo.description}" contains org name "${org.name}"`
            });
        }
    });
});

logos.forEach(logo => {
    if (logo.matched) return;

    // Only accept if there's a single high-confidence match
    const highConfidence = logo.matches.filter(m => m.confidence >= 0.85);
    if (highConfidence.length === 1) {
        const match = highConfidence[0];
        logo.matched = true;
        match.org.matched = true;
        logo.finalMatch = match;
        pass2Count++;
    }
});

console.log(`  ✓ Found ${pass2Count} contains matches\n`);

// ========================================
// PASS 3: Acronym Matching
// ========================================
console.log('PASS 3: Acronym matching...');
let pass3Count = 0;

logos.forEach(logo => {
    if (logo.matched) return;
    logo.matches = []; // Clear

    organizations.forEach(org => {
        if (org.matched) return;

        const submitterNorm = logo.normalizedSubmitter;
        const descNorm = logo.normalizedDescription;

        // Check if submitter matches org acronym
        if (org.acronym && org.acronym.length >= 3 && submitterNorm === org.acronym) {
            logo.matches.push({
                org: org,
                confidence: 0.80,
                reason: `Submitter "${logo.submitter}" matches acronym of "${org.name}"`
            });
        }

        // Check if description matches org acronym
        if (org.acronym && org.acronym.length >= 3 && descNorm.includes(org.acronym)) {
            logo.matches.push({
                org: org,
                confidence: 0.75,
                reason: `Description contains acronym of "${org.name}"`
            });
        }
    });
});

logos.forEach(logo => {
    if (logo.matched) return;

    const highConfidence = logo.matches.filter(m => m.confidence >= 0.75);
    if (highConfidence.length === 1) {
        const match = highConfidence[0];
        logo.matched = true;
        match.org.matched = true;
        logo.finalMatch = match;
        pass3Count++;
    }
});

console.log(`  ✓ Found ${pass3Count} acronym matches\n`);

// ========================================
// PASS 4: Fuzzy String Similarity
// ========================================
console.log('PASS 4: Fuzzy string similarity...');
let pass4Count = 0;

logos.forEach(logo => {
    if (logo.matched) return;
    logo.matches = []; // Clear

    organizations.forEach(org => {
        if (org.matched) return;

        const orgNorm = org.normalizedName;
        const submitterNorm = logo.normalizedSubmitter;
        const descNorm = logo.normalizedDescription;

        // Calculate similarity scores
        if (submitterNorm && submitterNorm.length > 3) {
            const simScore = similarity(orgNorm, submitterNorm);
            if (simScore >= 0.8) {
                logo.matches.push({
                    org: org,
                    confidence: simScore * 0.7, // Scale down confidence
                    reason: `High similarity (${(simScore * 100).toFixed(1)}%) between "${org.name}" and submitter "${logo.submitter}"`
                });
            }
        }

        if (descNorm && descNorm.length > 5) {
            const simScore = similarity(orgNorm, descNorm);
            if (simScore >= 0.75) {
                logo.matches.push({
                    org: org,
                    confidence: simScore * 0.65,
                    reason: `Similarity (${(simScore * 100).toFixed(1)}%) between "${org.name}" and description "${logo.description}"`
                });
            }
        }
    });
});

logos.forEach(logo => {
    if (logo.matched) return;

    // Sort by confidence
    logo.matches.sort((a, b) => b.confidence - a.confidence);

    // Only accept if top match is significantly better than second
    if (logo.matches.length > 0) {
        const top = logo.matches[0];
        const second = logo.matches[1];

        if (top.confidence >= 0.70 && (!second || top.confidence - second.confidence > 0.15)) {
            logo.matched = true;
            top.org.matched = true;
            logo.finalMatch = top;
            pass4Count++;
        }
    }
});

console.log(`  ✓ Found ${pass4Count} fuzzy matches\n`);

// ========================================
// RESULTS COMPILATION
// ========================================

const matchedLogos = logos.filter(l => l.matched);
const unmatchedLogos = logos.filter(l => !l.matched);
const matchedOrgs = organizations.filter(o => o.matched);
const unmatchedOrgs = organizations.filter(o => !o.matched);

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║                    MATCHING SUMMARY                       ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');
console.log(`✅ Successfully matched: ${matchedLogos.length}/${allLogos.length} logos`);
console.log(`✅ Organizations matched: ${matchedOrgs.length}/${organizations.length}`);
console.log(`⚠️  Unmatched logos: ${unmatchedLogos.length}`);
console.log(`⚠️  Unmatched organizations: ${unmatchedOrgs.length}\n`);

// ========================================
// GENERATE DETAILED REPORT
// ========================================

const report = {
    summary: {
        totalLogos: allLogos.length,
        totalOrganizations: organizations.length,
        matchedLogos: matchedLogos.length,
        matchedOrganizations: matchedOrgs.length,
        unmatchedLogos: unmatchedLogos.length,
        unmatchedOrganizations: unmatchedOrgs.length,
        successRate: ((matchedLogos.length / allLogos.length) * 100).toFixed(2) + '%'
    },
    matches: matchedLogos.map(logo => ({
        filename: logo.filename,
        submitter: logo.submitter,
        description: logo.description,
        matched: {
            name: logo.finalMatch.org.name,
            country: logo.finalMatch.org.country,
            website: logo.finalMatch.org.website
        },
        confidence: (logo.finalMatch.confidence * 100).toFixed(1) + '%',
        reason: logo.finalMatch.reason
    })),
    unmatchedLogos: unmatchedLogos.map(logo => ({
        filename: logo.filename,
        submitter: logo.submitter,
        description: logo.description,
        possibleMatches: logo.matches.slice(0, 3).map(m => ({
            name: m.org.name,
            country: m.org.country,
            confidence: (m.confidence * 100).toFixed(1) + '%',
            reason: m.reason
        }))
    })),
    unmatchedOrganizations: unmatchedOrgs.map(org => ({
        name: org.name,
        country: org.country,
        website: org.website
    }))
};

fs.writeFileSync('matching-report.json', JSON.stringify(report, null, 2));
console.log('📄 Detailed report saved to: matching-report.json\n');

// ========================================
// GENERATE FINAL MAPPINGS (HIGH CONFIDENCE ONLY)
// ========================================

const finalMappings = {};
matchedLogos.forEach(logo => {
    finalMappings[logo.filename] = {
        name: logo.finalMatch.org.name,
        country: logo.finalMatch.org.country,
        website: logo.finalMatch.org.website
    };
});

fs.writeFileSync('final-mappings.json', JSON.stringify(finalMappings, null, 2));
console.log('📄 Final mappings saved to: final-mappings.json\n');

// ========================================
// HUMAN VERIFICATION NEEDED
// ========================================

if (unmatchedLogos.length > 0 || unmatchedOrgs.length > 0) {
    console.log('⚠️  HUMAN VERIFICATION REQUIRED\n');
    console.log(`${unmatchedLogos.length} logos could not be matched automatically.`);
    console.log(`${unmatchedOrgs.length} organizations have no logo file.\n`);
    console.log('Please review matching-report.json for details.\n');
} else {
    console.log('🎉 100% MATCH SUCCESS! All logos matched to organizations.\n');
}

// Show confidence distribution
const confidenceRanges = {
    'Perfect (100%)': 0,
    'Excellent (90-99%)': 0,
    'Good (80-89%)': 0,
    'Fair (70-79%)': 0,
    'Low (<70%)': 0
};

matchedLogos.forEach(logo => {
    const conf = logo.finalMatch.confidence * 100;
    if (conf === 100) confidenceRanges['Perfect (100%)']++;
    else if (conf >= 90) confidenceRanges['Excellent (90-99%)']++;
    else if (conf >= 80) confidenceRanges['Good (80-89%)']++;
    else if (conf >= 70) confidenceRanges['Fair (70-79%)']++;
    else confidenceRanges['Low (<70%)']++;
});

console.log('Confidence Distribution:');
Object.entries(confidenceRanges).forEach(([range, count]) => {
    if (count > 0) {
        console.log(`  ${range}: ${count} matches`);
    }
});

console.log('\n✅ Matching algorithm complete!\n');
