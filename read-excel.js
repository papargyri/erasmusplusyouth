const XLSX = require('xlsx');

const workbook = XLSX.readFile('linked.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log('Column headers:');
console.log(data[0]);
console.log('\nFirst 5 rows of data:');
for (let i = 1; i <= 5 && i < data.length; i++) {
    console.log(`Row ${i}:`, data[i]);
}
console.log(`\nTotal rows: ${data.length - 1}`);
