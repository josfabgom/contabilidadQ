const XLSX = require('xlsx');

const data = [
  {
    Fecha: '2026-04-01',
    Tipo: '001',
    PV: 1,
    Numero: 1,
    DocTipo: '80',
    DocNro: '30123456789',
    Cliente: 'Empresa Test SA',
    Total: 12100,
    Neto: 10000,
    IVA: 2100,
    Alicuota: '5'
  },
  {
    Fecha: '2026-04-05',
    Tipo: '006',
    PV: 1,
    Numero: 2,
    DocTipo: '96',
    DocNro: '20123456789',
    Cliente: 'Juan Perez',
    Total: 605,
    Neto: 500,
    IVA: 105,
    Alicuota: '4'
  },
  {
    Fecha: '2026-04-10',
    Tipo: '011',
    PV: 1,
    Numero: 3,
    DocTipo: '99',
    DocNro: '0',
    Cliente: 'Consumidor Final',
    Total: 1000,
    Neto: 1000,
    IVA: 0,
    Alicuota: '3'
  }
];

const ws = XLSX.utils.json_to_sheet(data);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Ventas");
XLSX.writeFile(wb, "Ejemplo_Ventas.xlsx");
