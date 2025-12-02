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

function extractKeywords(str) {
    if (!str) return [];
    const normalized = normalizeString(str);
    return normalized.split(' ').filter(w => w.length > 2);
}

function containsKeyword(text, keyword) {
    const normalized = normalizeString(text);
    return normalized.includes(normalizeString(keyword));
}

function extractSubmitterFromFilename(filename) {
    const baseName = filename.replace('new logos/', '');
    const match = baseName.match(/(.+?)\s*-\s*([^.]+)\.(jpg|jpeg|png|gif|JPG|PNG)$/i);

    if (match) {
        return {
            description: match[1].trim(),
            submitter: match[2].trim(),
            extension: match[3]
        };
    }

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
console.log('║   ULTIMATE LOGO MATCHER - DESCRIPTION-FIRST APPROACH     ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

// Read Excel data
const workbook = XLSX.readFile('linked.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const excelData = XLSX.utils.sheet_to_json(sheet);

// Load existing HTML mappings for cross-validation
const htmlContent = fs.readFileSync('index.html', 'utf-8');
const logoDataMapMatch = htmlContent.match(/const logoDataMap = \{([\s\S]*?)\};/);
let existingMappings = {};
if (logoDataMapMatch) {
    try {
        existingMappings = eval('({' + logoDataMapMatch[1] + '})');
    } catch (e) {
        console.log('⚠️  Could not parse existing HTML mappings');
    }
}

console.log(`📊 Loaded ${excelData.length} organizations from Excel`);
console.log(`📊 Loaded ${Object.keys(existingMappings).length} existing HTML mappings\n`);

// Prepare organization data
const organizations = excelData
    .filter(row => row["Organization's name: "])
    .map((row, index) => {
        const name = row["Organization's name: "].trim();
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
            website.startsWith('(updating)')
        )) {
            website = null;
        } else if (website) {
            website = website.trim();
            // Remove protocols for comparison
            website = website.replace(/^https?:\/\//, '').replace(/^www\./, '');
        }

        return {
            id: index,
            name: name,
            normalizedName: normalizeString(name),
            keywords: extractKeywords(name),
            country: country,
            website: website
        };
    });

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

console.log(`📁 Total: ${allLogos.length} logo files\n`);

// ========================================
// COMPREHENSIVE MATCHING STRATEGY
// ========================================

const matches = [];
const manualReviewNeeded = [];

console.log('🔍 Starting comprehensive matching...\n');

allLogos.forEach((filename, idx) => {
    const parts = extractSubmitterFromFilename(filename);
    const description = parts.description;
    const submitter = parts.submitter;

    console.log(`[${idx + 1}/${allLogos.length}] Processing: ${filename}`);

    // Track all possible matches with scores
    const candidates = [];

    organizations.forEach(org => {
        let score = 0;
        const reasons = [];

        const orgNorm = org.normalizedName;
        const descNorm = normalizeString(description);
        const subNorm = normalizeString(submitter || '');

        // RULE 1: Exact match in description (highest priority)
        if (descNorm === orgNorm) {
            score += 100;
            reasons.push('Exact match in description');
        }

        // RULE 2: Exact match in submitter
        if (subNorm && subNorm === orgNorm) {
            score += 100;
            reasons.push('Exact match in submitter');
        }

        // RULE 3: Description contains full org name
        if (descNorm.includes(orgNorm) && orgNorm.length > 5) {
            score += 80;
            reasons.push(`Description contains "${org.name}"`);
        }

        // RULE 4: Org name contains description
        if (orgNorm.includes(descNorm) && descNorm.length > 5) {
            score += 75;
            reasons.push(`"${org.name}" contains description`);
        }

        // RULE 5: Submitter contains org name
        if (subNorm && subNorm.includes(orgNorm) && orgNorm.length > 5) {
            score += 70;
            reasons.push(`Submitter contains "${org.name}"`);
        }

        // RULE 6: Org name contains submitter
        if (subNorm && orgNorm.includes(subNorm) && subNorm.length > 5) {
            score += 65;
            reasons.push(`"${org.name}" contains submitter`);
        }

        // RULE 7: Keyword matching
        let keywordMatches = 0;
        org.keywords.forEach(keyword => {
            if (keyword.length > 3 && (descNorm.includes(keyword) || subNorm.includes(keyword))) {
                keywordMatches++;
            }
        });
        if (keywordMatches > 0) {
            score += keywordMatches * 10;
            reasons.push(`${keywordMatches} keyword(s) matched`);
        }

        // RULE 8: Acronym matching
        if (org.keywords.length >= 3) {
            const acronym = org.keywords.map(k => k[0]).join('');
            if (descNorm.includes(acronym) || descNorm.replace(/\s/g, '') === acronym) {
                score += 50;
                reasons.push('Acronym matched');
            }
        }

        // RULE 9: Cross-validate with existing HTML mapping
        const existingMapping = existingMappings[filename];
        if (existingMapping) {
            const existingNorm = normalizeString(existingMapping.name);
            if (existingNorm === orgNorm) {
                score += 30;
                reasons.push('Confirmed by existing HTML mapping');
            }

            // Check country match
            if (existingMapping.country === org.country) {
                score += 10;
                reasons.push('Country matches existing mapping');
            }
        }

        if (score > 0) {
            candidates.push({
                org: org,
                score: score,
                reasons: reasons
            });
        }
    });

    // Sort by score
    candidates.sort((a, b) => b.score - a.score);

    // Decision logic
    if (candidates.length === 0) {
        console.log(`  ❌ NO MATCH FOUND\n`);
        manualReviewNeeded.push({
            filename: filename,
            description: description,
            submitter: submitter,
            reason: 'No candidates found',
            existingMapping: existingMappings[filename] || null
        });
    } else {
        const best = candidates[0];
        const second = candidates[1];

        // High confidence if:
        // 1. Score >= 80 (strong match)
        // 2. OR score >= 60 AND significantly better than second choice
        const confidenceThreshold = 80;
        const gapThreshold = 30;

        if (best.score >= confidenceThreshold ||
            (best.score >= 60 && (!second || best.score - second.score >= gapThreshold))) {

            console.log(`  ✅ MATCHED: "${best.org.name}" (${best.org.country})`);
            console.log(`     Score: ${best.score} | ${best.reasons.join(', ')}\n`);

            matches.push({
                filename: filename,
                description: description,
                submitter: submitter,
                matched: {
                    name: best.org.name,
                    country: best.org.country,
                    website: best.org.website ? 'https://www.' + best.org.website : null
                },
                score: best.score,
                confidence: best.score >= 100 ? 'PERFECT' : best.score >= 80 ? 'HIGH' : 'MEDIUM',
                reasons: best.reasons
            });
        } else {
            console.log(`  ⚠️  UNCERTAIN - needs review`);
            console.log(`     Top candidate: "${best.org.name}" (score: ${best.score})`);
            if (second) {
                console.log(`     Second: "${second.org.name}" (score: ${second.score})\n`);
            }

            manualReviewNeeded.push({
                filename: filename,
                description: description,
                submitter: submitter,
                reason: 'Low confidence or multiple candidates',
                topCandidates: candidates.slice(0, 3).map(c => ({
                    name: c.org.name,
                    country: c.org.country,
                    score: c.score,
                    reasons: c.reasons
                })),
                existingMapping: existingMappings[filename] || null
            });
        }
    }
});

// ========================================
// GENERATE RESULTS
// ========================================

console.log('\n╔═══════════════════════════════════════════════════════════╗');
console.log('║                    FINAL RESULTS                          ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

console.log(`✅ High-confidence matches: ${matches.length}/${allLogos.length}`);
console.log(`⚠️  Manual review needed: ${manualReviewNeeded.length}\n`);

const confidenceDist = {
    PERFECT: matches.filter(m => m.confidence === 'PERFECT').length,
    HIGH: matches.filter(m => m.confidence === 'HIGH').length,
    MEDIUM: matches.filter(m => m.confidence === 'MEDIUM').length
};

console.log('Confidence Distribution:');
console.log(`  Perfect matches: ${confidenceDist.PERFECT}`);
console.log(`  High confidence: ${confidenceDist.HIGH}`);
console.log(`  Medium confidence: ${confidenceDist.MEDIUM}\n`);

// Save final mappings
const finalMappings = {};
matches.forEach(m => {
    finalMappings[m.filename] = {
        name: m.matched.name,
        country: m.matched.country,
        website: m.matched.website
    };
});

fs.writeFileSync('verified-mappings.json', JSON.stringify(finalMappings, null, 2));
console.log('✅ Verified mappings saved to: verified-mappings.json');

// Save detailed report
const detailedReport = {
    summary: {
        totalLogos: allLogos.length,
        matchedLogos: matches.length,
        manualReviewNeeded: manualReviewNeeded.length,
        successRate: ((matches.length / allLogos.length) * 100).toFixed(2) + '%',
        perfectMatches: confidenceDist.PERFECT,
        highConfidence: confidenceDist.HIGH,
        mediumConfidence: confidenceDist.MEDIUM
    },
    matches: matches,
    needsReview: manualReviewNeeded
};

fs.writeFileSync('ultimate-matching-report.json', JSON.stringify(detailedReport, null, 2));
console.log('✅ Detailed report saved to: ultimate-matching-report.json\n');

if (manualReviewNeeded.length > 0) {
    console.log('⚠️  Please review ultimate-matching-report.json for items needing manual verification.\n');
} else {
    console.log('🎉 100% AUTOMATIC MATCHING SUCCESS!\n');
}
