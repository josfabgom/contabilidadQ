export const formatString = (value: string, length: number): string => {
  return value.substring(0, length).padEnd(length, ' ');
};

export const formatNumber = (value: number, length: number, decimals: number = 2): string => {
  const isNegative = value < 0;
  const absoluteValue = Math.abs(value);
  const multiplier = Math.pow(10, decimals);
  const intValue = Math.round(absoluteValue * multiplier);
  
  let formatted = intValue.toString().padStart(length, '0');
  
  if (isNegative) {
    formatted = '-' + formatted.substring(1);
  }
  
  return formatted;
};

export const formatDate = (date: Date | string): string => {
  if (typeof date === 'string' && date.includes('-')) {
    const [year, month, day] = date.split('-');
    return `${year}${month}${day}`;
  }
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

export const AFIP_TABLES = {
  COMPROBANTES: {
    '001': 'Factura A',
    '002': 'Nota de Débito A',
    '003': 'Nota de Crédito A',
    '006': 'Factura B',
    '007': 'Nota de Débito B',
    '008': 'Nota de Crédito B',
    '011': 'Factura C',
    '012': 'Nota de Débito C',
    '013': 'Nota de Crédito C',
    // ... add more if needed
  },
  DOCUMENTOS: {
    '80': 'CUIT',
    '86': 'CUIL',
    '96': 'DNI',
    '99': 'Consumidor Final',
  },
  ALICUOTAS: {
    '3': '0%',
    '4': '10.5%',
    '5': '21%',
    '6': '27%',
    '8': '5%',
    '9': '2.5%',
  }
};
