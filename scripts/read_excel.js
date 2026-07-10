const xlsx = require('xlsx');
const path = require('path');
const file = path.join(__dirname, '..', 'Relatorio de iniciais.xlsx');
const wb = xlsx.readFile(file);
console.log('SHEETS:');
console.log(wb.SheetNames.join('\n'));
for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  const ref = ws['!ref'] || 'A1:A1';
  const range = xlsx.utils.decode_range(ref);
  console.log(`\nSHEET: ${name}`);
  for (let r = range.s.r; r <= Math.min(range.s.r + 10, range.e.r); r += 1) {
    const row = [];
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const cell = ws[xlsx.utils.encode_cell({ r, c })];
      row.push(cell ? String(cell.v).replace(/\n/g, ' ') : '');
    }
    console.log(row.join(' | '));
  }
}
