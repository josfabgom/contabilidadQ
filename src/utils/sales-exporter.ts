import { formatString, formatNumber, formatDate } from './afip-formatter';

export interface SalesRecord {
  fecha: string;
  tipoCbte: string;
  puntoVenta: number;
  numero: number;
  docTipo: string;
  docNro: string;
  cliente: string;
  total: number;
  noGravado: number;
  percepcionNoCat: number;
  exento: number;
  percepcionIVA: number;
  percepcionIIBB: number;
  percepcionMunic: number;
  impInternos: number;
  otrosTributos: number;
  neto: number;
  iva: number;
  alicuota: string; // '3', '4', '5', '6', etc.
}

export const generateCbteFile = (records: SalesRecord[]): string => {
  return records.map(r => {
    let line = '';
    line += formatDate(r.fecha); // 1-8
    line += r.tipoCbte.padStart(3, '0'); // 9-11
    line += r.puntoVenta.toString().padStart(5, '0'); // 12-16
    line += r.numero.toString().padStart(20, '0'); // 17-36
    line += r.numero.toString().padStart(20, '0'); // 37-56 (hasta)
    line += r.docTipo.padStart(2, '0'); // 57-58
    line += r.docNro.replace(/[^0-9]/g, '').padStart(20, '0'); // 59-78 (Ceros a la izquierda)
    line += formatString(r.cliente, 30); // 79-108
    line += formatNumber(r.total, 15); // 109-123
    line += formatNumber(r.noGravado, 15); // 124-138
    line += formatNumber(r.percepcionNoCat || 0, 15); // 139-153
    line += formatNumber(r.exento, 15); // 154-168
    line += formatNumber(r.percepcionIVA, 15); // 169-183
    line += formatNumber(r.percepcionIIBB, 15); // 184-198
    line += formatNumber(r.percepcionMunic, 15); // 199-213
    line += formatNumber(r.impInternos, 15); // 214-228
    line += 'PES'; // 229-231 (Moneda)
    line += formatNumber(1, 10, 6); // 232-241 (Tipo de Cambio: 4 enteros, 6 decimales)
    line += '1'; // 242 (Cant Alicuotas)
    line += ' '; // 243 (Cod Operacion)
    line += formatNumber(r.otrosTributos, 15); // 244-258
    line += '00000000'; // 259-266 (Fecha Venc)
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
      line += formatNumber(r.neto, 15); // 15
      line += r.alicuota.padStart(4, '0'); // 4
      line += formatNumber(r.iva, 15); // 15
      return line;
    }).join('\r\n');
};
