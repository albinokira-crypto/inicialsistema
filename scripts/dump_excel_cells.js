const xlsx = require('xlsx');
const path = require('path');
const file = path.join(__dirname, '..', 'Relatorio de iniciais.xlsx');
const wb = xlsx.readFile(file);
for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  console.log('SHEET:', name);
  const cells = Object.keys(ws).filter((k) => k[0] !== '!').sort((a, b) => {
    const match = /([A-Z]+)(\d+)/.exec(a);
    const match2 = /([A-Z]+)(\d+)/.exec(b);
    const colA = xlsx.utils.decode_col(match[1]);
    const rowA = parseInt(match[2], 10);
    const colB = xlsx.utils.decode_col(match2[1]);
    const rowB = parseInt(match2[2], 10);
    return rowA - rowB || colA - colB;
  });
  for (const cell of cells) {
    console.log(cell, ws[cell].v);
  }
  console.log('---');
}
