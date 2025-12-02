const XLSX = require('xlsx');
const fs = require('fs');

// Read Excel file
const workbook = XLSX.readFile('linked.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet);

// Get all logos
const mainLogos = fs.readdirSync('images').filter(f => /\.(jpg|jpeg|png|JPG|PNG|gif)$/.test(f) && !f.startsWith('.') && f !== 'Logo Hellas.png' && f !== 'Ethnikos Logo.png');
const newLogos = fs.readdirSync('images/new logos').filter(f => /\.(jpg|jpeg|png|JPG|PNG|gif)$/.test(f));

console.log('\n=== ORGANIZATIONS FROM EXCEL ===\n');
console.log('Total rows:', data.length);
console.log('\nFirst 10 organizations:');

for (let i = 0; i < Math.min(10, data.length); i++) {
    const row = data[i];
    const name = row["Organization's name: "];
    const country = row["Country: "];
    const website = row["Website:"];
    const logo = row["Upload your LOGO"];

    console.log(`${i + 1}. "${name}" - ${country}`);
    if (website) console.log(`   Website: ${website}`);
    if (logo) console.log(`   Logo URL: ${logo.substring(0, 60)}...`);
    console.log('');
}

// Export for manual matching
const exportData = data.map(row => ({
    name: row["Organization's name: "],
    country: row["Country: "],
    website: row["Website:"] || null
}));

fs.writeFileSync('organizations-list.json', JSON.stringify(exportData, null, 2));
console.log('\n✅ Exported organizations to organizations-list.json');
console.log(`\nTotal logos to map: ${mainLogos.length + newLogos.length}`);
