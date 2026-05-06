import React, { useState, useEffect } from 'react';
import { Upload, FileText, Download, CheckCircle, AlertCircle, FileSpreadsheet, Search } from 'lucide-react';
import * as XLSX from 'xlsx';
import { motion } from 'framer-motion';
import type { SalesRecord } from './utils/sales-exporter';
import { generateCbteFile, generateAlicuotasFile } from './utils/sales-exporter';

function App() {
  const [records, setRecords] = useState<SalesRecord[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [rawData, setRawData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [showMapper, setShowMapper] = useState(false);

  const APP_FIELDS = [
    { id: 'fecha', label: 'Fecha' },
    { id: 'tipoCbte', label: 'Tipo Cbte' },
    { id: 'puntoVenta', label: 'Punto de Venta' },
    { id: 'numero', label: 'Número' },
    { id: 'docTipo', label: 'Tipo Doc' },
    { id: 'docNro', label: 'Nro Doc' },
    { id: 'cliente', label: 'Cliente' },
    { id: 'total', label: 'Total' },
    { id: 'neto', label: 'Neto Gravado' },
    { id: 'iva', label: 'IVA' },
    { id: 'alicuota', label: 'Alícuota' },
  ];

  const autoMap = (fileHeaders: string[]) => {
    const newMapping: Record<string, string> = {};
    const searchTerms: Record<string, string[]> = {
      fecha: ['fecha', 'date', 'fec'],
      tipoCbte: ['tipo', 'cbte', 'type'],
      puntoVenta: ['pv', 'punto', 'venta', 'pos'],
      numero: ['numero', 'nro', 'num'],
      docTipo: ['doctipo', 'doc_tipo', 'documento'],
      docNro: ['docnro', 'doc_nro', 'identificador'],
      cliente: ['cliente', 'nombre', 'razon', 'customer'],
      total: ['total', 'importe'],
      neto: ['neto', 'gravado', 'net'],
      iva: ['iva', 'vat'],
      alicuota: ['alicuota', 'tasa', 'rate'],
    };

    fileHeaders.forEach(header => {
      const lowerHeader = header.toLowerCase();
      Object.entries(searchTerms).forEach(([field, terms]) => {
        if (!newMapping[field] && terms.some(t => lowerHeader.includes(t))) {
          newMapping[field] = header;
        }
      });
    });
    setMapping(newMapping);
  };

  const parsePrinterFile = (content: string): SalesRecord[] => {
    const lines = content.split(/\r?\n/);
    const records: SalesRecord[] = [];
    
    for (const line of lines) {
      if (!line.startsWith('1') || line.length < 240) continue;
      
      const fechaRaw = line.substring(1, 9);
      const fecha = `${fechaRaw.substring(0, 4)}-${fechaRaw.substring(4, 6)}-${fechaRaw.substring(6, 8)}`;
      const tipoRaw = line.substring(9, 12);
      const tipoCbte = tipoRaw.replace(/[^0-9]/g, '').padStart(3, '0');
      const puntoVenta = parseInt(line.substring(12, 16));
      const numero = parseInt(line.substring(16, 36));
      const docTipo = line.substring(56, 58);
      const docNro = line.substring(58, 69).trim();
      const cliente = line.substring(69, 99).trim() || 'CONSUMIDOR FINAL';
      
      const parseAmount = (s: string) => {
        const val = parseInt(s);
        return isNaN(val) ? 0 : val / 100;
      };
      
      const total = parseAmount(line.substring(99, 114));
      const noGravado = parseAmount(line.substring(114, 129));
      const neto = parseAmount(line.substring(129, 144));
      const alicPercent = line.substring(144, 148);
      const iva = parseAmount(line.substring(148, 163));
      const exento = parseAmount(line.substring(163, 178));
      const percepcionIVA = parseAmount(line.substring(178, 193));
      const percepcionIIBB = parseAmount(line.substring(193, 208));
      const percepcionMunic = parseAmount(line.substring(208, 223));
      const impInternos = parseAmount(line.substring(223, 238));
      const otrosTributos = parseAmount(line.substring(238, 253));
      
      // Usually Neto and IVA are calculated if not present, 
      // but some files have them. If we have them, we use them.
      // However, for consistency with AFIP Sum, we prioritize:
      // Neto = Total - IVA - Exento - NoGravado - Tributos
      
      // Aliquot mapping
      let alicuota = '5'; // default 21%
      if (alicPercent === '1050') alicuota = '4';
      else if (alicPercent === '2700') alicuota = '6';
      else if (alicPercent === '0000') alicuota = '3';
      else if (alicPercent === '0500') alicuota = '8';
      else if (alicPercent === '0250') alicuota = '9';

      // Logical normalization to prevent doubling in AFIP:
      // If Total = Neto + IVA, then Exento and NoGravado must be 0.
      // If Total = Exento, then Neto and IVA must be 0.
      
      let finalNeto = neto;
      let finalIva = iva;
      let finalExento = exento;
      let finalNoGravado = noGravado;

      // If it's all zero but has a total, calculate it
      if (total > 0 && finalNeto === 0 && finalExento === 0 && finalNoGravado === 0) {
        const rate = alicuota === '4' ? 0.105 : alicuota === '6' ? 0.27 : 0.21;
        if (alicuota !== '3') {
          finalNeto = Number((total / (1 + rate)).toFixed(2));
          finalIva = Number((total - finalNeto).toFixed(2));
        } else {
          finalExento = total;
        }
      }

      // Type 082 / 081 etc handling
      if (tipoCbte === '082' || tipoCbte === '011') {
        // C and B to consumers are often reported as all exempt or all neto 0%
        if (finalNeto > 0 && alicuota === '3') {
           finalExento = (finalExento || 0) + finalNeto + finalIva;
           finalNeto = 0;
           finalIva = 0;
        }
      }
      
      records.push({
        fecha,
        tipoCbte,
        puntoVenta,
        numero,
        docTipo,
        docNro,
        cliente,
        total,
        noGravado: finalNoGravado,
        percepcionNoCat: 0,
        exento: finalExento,
        percepcionIVA,
        percepcionIIBB,
        percepcionMunic,
        impInternos,
        otrosTributos,
        neto: finalNeto,
        iva: finalIva,
        alicuota
      });
    }
    return records;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const isTxt = file.name.toLowerCase().endsWith('.txt');
        
        if (isTxt) {
          const content = event.target?.result as string;
          const mappedRecords = parsePrinterFile(content);
          if (mappedRecords.length === 0) {
            throw new Error("No se encontraron registros válidos en el archivo TXT.");
          }
          setRecords(mappedRecords);
          return;
        }

        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

        if (jsonData.length > 0) {
          const fileHeaders = Object.keys(jsonData[0]);
          setHeaders(fileHeaders);
          setRawData(jsonData);
          autoMap(fileHeaders);
          setShowMapper(true);
        } else {
          throw new Error("El archivo está vacío.");
        }
      } catch (err) {
        setError("Error al procesar el archivo. Asegúrate de que el formato sea correcto.");
        console.error(err);
      }
    };
    const isTxt = file.name.toLowerCase().endsWith('.txt');
    if (isTxt) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  };

  const applyMapping = () => {
    try {
      const mappedRecords: SalesRecord[] = rawData.map((row, index) => {
        const total = Number(row[mapping['total']] || 0);
        let neto = Number(row[mapping['neto']] || 0);
        let iva = Number(row[mapping['iva']] || 0);
        let exento = 0;
        let noGravado = Number(row[mapping['noGravado']] || 0);
        const alicuota = String(row[mapping['alicuota']] || '5').replace(/[^0-9]/g, '');

        // Normalization: If it's a Factura C or Alícuota 0, move everything to Neto with 0% or Exento
        // to avoid duplicating amounts between Neto Gravado and Exento fields.
        if (alicuota === '3') {
          exento = total - noGravado;
          neto = 0;
          iva = 0;
        } else if (neto === 0 && total > 0 && noGravado === 0) {
          // If Neto is not provided but we have a total, calculate it
          const rate = alicuota === '4' ? 0.105 : alicuota === '6' ? 0.27 : 0.21;
          neto = Number((total / (1 + rate)).toFixed(2));
          iva = Number((total - neto).toFixed(2));
        }

        // Final check: Neto + IVA + Exento + NoGravado should not exceed Total
        // If they do, it's likely because the user mapped the Total to multiple fields.
        if ((neto + iva + exento + noGravado) > total * 1.01) {
           // If they are equal to Total individually, prioritize Neto/IVA
           if (neto + iva >= total * 0.99) {
             exento = 0;
             noGravado = 0;
           }
        }

        return {
          fecha: row[mapping['fecha']] || new Date().toISOString(),
          tipoCbte: String(row[mapping['tipoCbte']] || '011').replace(/[^0-9]/g, '').padStart(3, '0'),
          puntoVenta: Number(row[mapping['puntoVenta']] || 1),
          numero: Number(row[mapping['numero']] || index + 1),
          docTipo: String(row[mapping['docTipo']] || '99'),
          docNro: String(row[mapping['docNro']] || '0'),
          cliente: String(row[mapping['cliente']] || 'Consumidor Final'),
          total: total,
          noGravado: noGravado,
          percepcionNoCat: 0,
          exento: exento,
          percepcionIVA: 0,
          percepcionIIBB: 0,
          percepcionMunic: 0,
          impInternos: 0,
          otrosTributos: 0,
          neto: neto,
          iva: iva,
          alicuota: alicuota,
        };
      });
      setRecords(mappedRecords);
      setShowMapper(false);
    } catch (err) {
      setError("Error al aplicar el mapeo. Verifica los campos seleccionados.");
    }
  };

  const downloadFile = (content: string, name: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.href = url;
    link.setAttribute('download', name);
    link.download = name;
    
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
  };

  const handleDownloadCbte = () => {
    const content = generateCbteFile(records);
    downloadFile(content, 'REGINFO_CV_VENTAS_CBTE.txt');
  };

  const handleDownloadAlicuotas = () => {
    const content = generateAlicuotasFile(records);
    downloadFile(content, 'REGINFO_CV_VENTAS_ALICUOTAS.txt');
  };

   const [filter, setFilter] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterClient, setFilterClient] = useState<string>('');
  const [filterNumber, setFilterNumber] = useState<string>('');
  const [visibleCount, setVisibleCount] = useState<number>(50);

   const filteredRecords = records.filter(r => {
    const matchType = filter === 'all' || r.tipoCbte === filter;
    const matchDate = !filterDate || r.fecha === filterDate;
    const matchClient = !filterClient || r.cliente.toLowerCase().includes(filterClient.toLowerCase()) || r.docNro.includes(filterClient);
    const matchNumber = !filterNumber || r.numero.toString().includes(filterNumber);
    return matchType && matchDate && matchClient && matchNumber;
  });

   useEffect(() => {
    setVisibleCount(50);
  }, [filter, filterDate, filterClient, filterNumber]);

  return (
    <div className="app-container">
      <header className="header">
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          ContabilidadQ
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          Importador de Ventas - Libro IVA Digital ARCA (AFIP)
        </motion.p>
      </header>

      <main>
        <motion.div 
          className="glass-card"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          {!records.length && !showMapper ? (
            <label className="upload-zone">
              <input type="file" hidden onChange={handleFileUpload} accept=".xlsx, .xls, .csv, .txt" />
              <div className="flex flex-col items-center">
                <Upload size={48} color="hsl(var(--primary))" style={{ marginBottom: '1rem' }} />
                <h3>Haz clic para subir o arrastra tu archivo</h3>
                <p>Formatos aceptados: Excel (.xlsx, .xls), CSV o Exportación de Impresora (.txt)</p>
                <div style={{ marginTop: '2rem', fontSize: '0.8rem', color: '#64748b' }}>
                  Soporte directo para archivos de impresoras fiscales y CITI Ventas.
                </div>
              </div>
            </label>
          ) : showMapper ? (
            <div className="animate-fade-in">
              <div style={{ marginBottom: '2rem' }}>
                <h3>Mapeo de Columnas</h3>
                <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Asigna cada campo de la aplicación a una columna de tu archivo "{fileName}".</p>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
                {APP_FIELDS.map(field => (
                  <div key={field.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1' }}>{field.label}</label>
                    <select 
                      value={mapping[field.id] || ''} 
                      onChange={(e) => setMapping({...mapping, [field.id]: e.target.value})}
                      style={{ 
                        background: 'rgba(30, 41, 59, 0.5)', 
                        border: '1px solid rgba(255, 255, 255, 0.1)', 
                        color: 'white',
                        padding: '0.6rem',
                        borderRadius: '8px',
                        outline: 'none'
                      }}
                    >
                      <option value="">-- No asignado --</option>
                      {headers.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setShowMapper(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={applyMapping}>Finalizar Importación</button>
              </div>
            </div>
          ) : (
            <div className="animate-fade-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ background: 'rgba(34, 197, 94, 0.2)', padding: '0.5rem', borderRadius: '50%' }}>
                    <CheckCircle color="#4ade80" size={24} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0 }}>{fileName}</h3>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>
                      {filteredRecords.length} de {records.length} registros mostrados
                    </p>
                  </div>
                </div>
                 <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', left: '10px', color: '#94a3b8' }} />
                    <input 
                      type="text"
                      placeholder="Filtrar por cliente o documento..."
                      value={filterClient}
                      onChange={(e) => setFilterClient(e.target.value)}
                      className="btn btn-secondary"
                      style={{ padding: '0.4rem 0.8rem 0.4rem 2rem', width: '250px', textAlign: 'left' }}
                    />
                    {filterClient && (
                      <button 
                        onClick={() => setFilterClient('')}
                        style={{ 
                          position: 'absolute', 
                          right: '10px', 
                          background: 'none', 
                          border: 'none', 
                          color: '#94a3b8', 
                          cursor: 'pointer',
                          fontSize: '1.2rem'
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', position: 'relative' }}>
                    <FileText size={16} style={{ position: 'absolute', left: '10px', color: '#94a3b8' }} />
                    <input 
                      type="text"
                      placeholder="Nro. Comprobante..."
                      value={filterNumber}
                      onChange={(e) => setFilterNumber(e.target.value)}
                      className="btn btn-secondary"
                      style={{ padding: '0.4rem 0.8rem 0.4rem 2rem', width: '180px', textAlign: 'left' }}
                    />
                    {filterNumber && (
                      <button 
                        onClick={() => setFilterNumber('')}
                        style={{ 
                          position: 'absolute', 
                          right: '10px', 
                          background: 'none', 
                          border: 'none', 
                          color: '#94a3b8', 
                          cursor: 'pointer',
                          fontSize: '1.2rem'
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Fecha:</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input 
                        type="date"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                        className="btn btn-secondary"
                        style={{ padding: '0.4rem 0.8rem' }}
                      />
                      {filterDate && (
                        <button 
                          onClick={() => setFilterDate('')}
                          style={{ 
                            position: 'absolute', 
                            right: '30px', 
                            background: 'none', 
                            border: 'none', 
                            color: '#94a3b8', 
                            cursor: 'pointer',
                            fontSize: '1.2rem'
                          }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Tipo:</label>
                    <select 
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                      className="btn btn-secondary"
                      style={{ appearance: 'auto', paddingRight: '2rem' }}
                    >
                      <option value="all">Todos</option>
                      <option value="081">A (081)</option>
                      <option value="082">B (082)</option>
                      <option value="083">Ticket (083)</option>
                    </select>
                  </div>
                  <button className="btn btn-secondary" onClick={() => setRecords([])}>
                    Cambiar archivo
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                <button className="btn btn-primary" onClick={handleDownloadCbte}>
                  <Download size={20} />
                  Descargar Comprobantes (.txt)
                </button>
                <button className="btn btn-primary" onClick={handleDownloadAlicuotas}>
                  <Download size={20} />
                  Descargar Alícuotas (.txt)
                </button>
              </div>

              <div className="table-container">
                <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                  <table>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#1e293b' }}>
                      <tr>
                        <th>Fecha</th>
                        <th>Tipo</th>
                        <th>Nro. Comprobante</th>
                        <th>Cliente</th>
                        <th>Doc. Nro</th>
                        <th>Total</th>
                        <th>Neto</th>
                        <th>IVA</th>
                        <th>Exento</th>
                        <th>No Grav.</th>
                        <th>P. IVA</th>
                        <th>P. IIBB</th>
                        <th>Int.</th>
                        <th>Otros</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecords.slice(0, visibleCount).map((r, i) => (
                        <tr key={i}>
                          <td>{r.fecha.includes('-') ? r.fecha.split('-').reverse().join('/') : r.fecha}</td>
                          <td>{r.tipoCbte}</td>
                          <td>{r.puntoVenta.toString().padStart(5, '0')}-{r.numero.toString().padStart(8, '0')}</td>
                          <td className="truncate" title={r.cliente}>{r.cliente}</td>
                          <td>{r.docNro}</td>
                          <td>${r.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td>${r.neto.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td>${r.iva.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td>${r.exento.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td>${r.noGravado.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td>${r.percepcionIVA.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td>${r.percepcionIIBB.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td>${r.impInternos.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td>${r.otrosTributos.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {visibleCount < filteredRecords.length && (
                  <div style={{ padding: '2rem', textAlign: 'center' }}>
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => setVisibleCount(prev => prev + 100)}
                      style={{ width: '200px' }}
                    >
                      Cargar 100 más...
                    </button>
                    <p style={{ marginTop: '1rem', color: '#64748b', fontSize: '0.8rem' }}>
                      Mostrando {visibleCount} de {filteredRecords.length} registros
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444' }}>
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}
        </motion.div>

        <section className="grid">
          <div className="glass-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <FileText color="hsl(var(--primary))" />
              <h3>REGINFO_CV_VENTAS_CBTE</h3>
            </div>
            <p style={{ fontSize: '0.9rem', color: '#94a3b8' }}>
              Archivo de cabecera con los datos generales de cada comprobante. Incluye importes totales, percepciones y datos del cliente.
            </p>
          </div>
          <div className="glass-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <FileSpreadsheet color="hsl(var(--primary))" />
              <h3>REGINFO_CV_VENTAS_ALICUOTAS</h3>
            </div>
            <p style={{ fontSize: '0.9rem', color: '#94a3b8' }}>
              Archivo de detalle con las bases imponibles y el IVA liquidado por cada alícuota informada en los comprobantes.
            </p>
          </div>
        </section>
      </main>
      
      <footer style={{ marginTop: '4rem', textAlign: 'center', color: '#475569', fontSize: '0.8rem' }}>
        ContabilidadQ &copy; 2026 - Desarrollado para cumplimiento fiscal ARCA/AFIP
      </footer>
    </div>
  );
}

export default App;
