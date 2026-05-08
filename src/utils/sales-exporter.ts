import { formatString, formatNumber, formatCents, formatDate } from './afip-formatter';

export interface SalesRecord {
  fecha: string;
  tipoCbte: string;
  puntoVenta: number;
  numero: number;
  docTipo: string;
  docNro: string;
  cliente: string;
  total: number; // Stored as cents (integer)
  noGravado: number; // Stored as cents
  exento: number;
  percepcionIVA: number;
  percepcionOtrosNac: number;
  percepcionIIBB: number;
  percepcionMunic: number;
  impInternos: number;
  otrosTributos: number;
  neto: number;
  iva: number;
  alicuota: string;
}

export const generateCbteFile = (records: SalesRecord[]): string => {
  return records.map(r => {
    let line = '';
    line += formatDate(r.fecha); // 1-8
    line += r.tipoCbte.padStart(3, '0'); // 9-11
    line += r.puntoVenta.toString().padStart(5, '0'); // 12-16
    line += r.numero.toString().padStart(20, '0'); // 17-36
    line += r.numero.toString().padStart(20, '0'); // 37-56 (Hasta)
    line += r.docTipo.padStart(2, '0'); // 57-58
    line += r.docNro.replace(/[^0-9]/g, '').padStart(20, '0'); // 59-78
    line += formatString(r.cliente, 30); // 79-108
    line += formatCents(r.total, 15); // 109-123
    line += formatCents(r.noGravado, 15); // 124-138
    line += formatCents(r.exento, 15); // 139-153
    line += formatCents(r.percepcionIVA, 15); // 154-168
    line += formatCents(r.percepcionOtrosNac || 0, 15); // 169-183
    line += formatCents(r.percepcionIIBB, 15); // 184-198
    line += formatCents(r.percepcionMunic, 15); // 199-213
    line += formatCents(r.impInternos, 15); // 214-228
    line += 'PES'; // 229-231
    line += formatNumber(1, 10, 6); // 232-241
    line += r.neto > 0 ? '1' : '0'; // 242
    line += ' '; // 243 (Cod Operacion)
    line += formatCents(r.otrosTributos, 15); // 244-258
    line += '00000000'; // 259-266
    return line;
  }).join('\r\n');
};

export const generateAlicuotasFile = (records: SalesRecord[]): string => {
  return records
    .filter(r => r.neto > 0)
    .map(r => {
      let line = '';
      line += r.tipoCbte.padStart(3, '0'); // 3
      line += r.puntoVenta.toString().padStart(5, '0'); // 5
      line += r.numero.toString().padStart(20, '0'); // 20
      line += formatCents(r.neto, 15); // 15
      line += r.alicuota.padStart(4, '0'); // 4
      line += formatCents(r.iva, 15); // 15
      return line;
    }).join('\r\n');
};
