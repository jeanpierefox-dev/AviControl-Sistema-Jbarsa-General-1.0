import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ClientOrder, WeighingType, AppConfig } from '../types';

export const handlePDFOutput = (doc: jsPDF, filename: string) => {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile) {
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const newWindow = window.open(url, '_blank');
    if (!newWindow) {
      window.location.href = url;
    }
  } else {
    doc.save(filename);
  }
};

export const getOrderTotals = (order: ClientOrder) => {
  const full = order.records.filter(r => r.type === 'FULL');
  const empty = order.records.filter(r => r.type === 'EMPTY');
  const mort = order.records.filter(r => r.type === 'MORTALITY');

  const wF = full.reduce((a, b) => a + b.weight, 0);
  const wE = empty.reduce((a, b) => a + b.weight, 0);
  const wM = mort.reduce((a, b) => a + b.weight, 0);

  const qF = full.reduce((a, b) => a + b.quantity, 0);
  const qE = empty.reduce((a, b) => a + b.quantity, 0);
  const qM = mort.reduce((a, b) => a + b.quantity, 0);

  let net = wF - wE - wM;
  if (order.weighingMode === WeighingType.SOLO_POLLO) net = wF;

  return { wF, wE, wM, qF, qE, qM, net };
};

/**
 * Genera el Ticket Resumen de Carga (80mm) sin el desglose de pesas individuales.
 * Muestra:
 * - Total de jabas llenas y vacías (Cantidad y Peso)
 * - Pollos vivos y muertos (Cantidad y Peso)
 * - Promedio de peso calculado con las jabas llenas y vacías
 * - Promedio de peso de pollos muertos
 */
export const generateSummaryTicketPDF = (order: ClientOrder, config: AppConfig) => {
  const t = getOrderTotals(order);
  const wNetLive = t.wF - t.wE; // Peso neto de carga viva (bruto - tara)

  const avgFull = t.qF > 0 ? t.wF / t.qF : 0;
  const avgEmpty = t.qE > 0 ? t.wE / t.qE : 0;
  const avgNetPerCrate = t.qF > 0 ? wNetLive / t.qF : 0;
  const avgDead = t.qM > 0 ? t.wM / t.qM : 0;

  const doc = new jsPDF({ unit: 'mm', format: [80, 190] });
  const companyName = (config.companyName || 'AVI CONTROL').toUpperCase();

  doc.setFontSize(13).setFont("helvetica", "bold");
  doc.text(companyName, 40, 9, { align: 'center' });

  doc.setFontSize(9).setFont("helvetica", "bold");
  doc.text("TICKET RESUMEN DE CARGA", 40, 14, { align: 'center' });
  doc.setFontSize(7).setFont("helvetica", "normal");
  doc.text("(SIN DESGLOSE DE PESAS)", 40, 18, { align: 'center' });
  doc.text(new Date().toLocaleString(), 40, 22, { align: 'center' });

  doc.setLineWidth(0.3);
  doc.line(5, 24, 75, 24);

  doc.setFontSize(9).setFont("helvetica", "bold");
  doc.text(`CLIENTE: ${order.clientName.toUpperCase()}`, 5, 29);
  doc.setFontSize(8).setFont("helvetica", "normal");
  doc.text(`ID: ${order.id.slice(-6)} | MODO: ${order.weighingMode || 'LOTE'}`, 5, 33);

  doc.line(5, 35, 75, 35);

  let y = 40;

  // 1. TOTAL DE JABAS LLENAS Y VACÍAS
  doc.setFont("helvetica", "bold").setFontSize(8);
  doc.text("1. TOTAL DE JABAS", 5, y);
  y += 5;

  doc.setFont("helvetica", "normal").setFontSize(8);
  doc.text(`• Jabas Llenas:   ${t.qF} und | ${t.wF.toFixed(2)} kg`, 7, y);
  y += 4.5;
  doc.text(`  Prom. Jaba Llena: ${avgFull.toFixed(2)} kg/jaba`, 9, y);
  y += 5;

  doc.text(`• Jabas Vacías:   ${t.qE} und | ${t.wE.toFixed(2)} kg`, 7, y);
  y += 4.5;
  doc.text(`  Prom. Jaba Vacía: ${avgEmpty.toFixed(2)} kg/jaba`, 9, y);
  y += 5;

  doc.line(5, y, 75, y);
  y += 5;

  // 2. POLLOS VIVOS (CARGA VIVA - JABAS LLENAS Y VACÍAS)
  doc.setFont("helvetica", "bold").setFontSize(8);
  doc.text("2. POLLOS VIVOS (NETO JABAS)", 5, y);
  y += 5;

  doc.setFont("helvetica", "normal").setFontSize(8);
  doc.text(`• Cantidad Jabas: ${t.qF} und`, 7, y);
  y += 4.5;
  doc.text(`• Peso Neto Vivo: ${wNetLive.toFixed(2)} kg`, 7, y);
  y += 4.5;
  doc.setFont("helvetica", "bold");
  doc.text(`• Promedio Neto/Jaba: ${avgNetPerCrate.toFixed(2)} kg/jaba`, 7, y);
  y += 5;

  doc.line(5, y, 75, y);
  y += 5;

  // 3. POLLOS MUERTOS (MERMA)
  doc.setFont("helvetica", "bold").setFontSize(8);
  doc.text("3. POLLOS MUERTOS (MERMA)", 5, y);
  y += 5;

  doc.setFont("helvetica", "normal").setFontSize(8);
  doc.text(`• Cantidad Muertos: ${t.qM} pollos`, 7, y);
  y += 4.5;
  doc.text(`• Peso Total Muertos: ${t.wM.toFixed(2)} kg`, 7, y);
  y += 4.5;
  doc.setFont("helvetica", "bold");
  doc.text(`• Promedio/Pollo Muerto: ${avgDead.toFixed(2)} kg/pollo`, 7, y);
  y += 5;

  doc.line(5, y, 75, y);
  y += 6;

  // 4. RESUMEN FINAL Y LIQUIDACIÓN
  doc.rect(5, y, 70, 28);
  y += 5;
  doc.setFontSize(9).setFont("helvetica", "bold");
  doc.text(`PESO NETO TOTAL: ${t.net.toFixed(2)} kg`, 8, y);
  y += 5;
  doc.setFontSize(8).setFont("helvetica", "normal");
  doc.text(`PRECIO X KG: S/. ${order.pricePerKg.toFixed(2)}`, 8, y);
  y += 6;
  doc.setFontSize(10).setFont("helvetica", "bold");
  doc.text(`TOTAL A PAGAR: S/. ${(t.net * order.pricePerKg).toFixed(2)}`, 8, y);

  if (order.paymentMethod) {
    y += 5;
    doc.setFontSize(7).setFont("helvetica", "normal");
    doc.text(`FORMA DE PAGO: ${order.paymentMethod === 'CASH' ? 'CONTADO' : 'CRÉDITO'}`, 8, y);
  }

  y += 12;
  doc.setFontSize(8).setFont("helvetica", "italic");
  doc.text("Gracias por su preferencia", 40, y, { align: 'center' });

  handlePDFOutput(doc, `Ticket_Resumen_${order.clientName}.pdf`);
};

export const generateTicketPDF = (order: ClientOrder, config: AppConfig) => {
  const t = getOrderTotals(order);
  const doc = new jsPDF({ unit: 'mm', format: [80, 150] });
  const companyName = (config.companyName || 'AVI CONTROL').toUpperCase();

  doc.setFontSize(14).setFont("helvetica", "bold");
  doc.text(companyName, 40, 10, { align: 'center' });
  doc.setFontSize(8).setFont("helvetica", "normal");
  doc.text("TICKET DE CARGA (DETALLADO)", 40, 15, { align: 'center' });
  doc.text(new Date().toLocaleString(), 40, 19, { align: 'center' });
  doc.line(5, 22, 75, 22);
  doc.setFontSize(10).text(`CLIENTE: ${order.clientName.toUpperCase()}`, 5, 28);
  doc.rect(5, 33, 70, 35);
  doc.text(`BRUTO (${t.qF} jabas): ${t.wF.toFixed(2)} kg`, 10, 42);
  doc.text(`TARA (${t.qE} jabas): -${t.wE.toFixed(2)} kg`, 10, 48);
  doc.text(`MERMA (${t.qM} muertos): -${t.wM.toFixed(2)} kg`, 10, 54);
  doc.setFontSize(12).setFont("helvetica", "bold").text(`NETO: ${t.net.toFixed(2)} kg`, 10, 63);
  doc.setFontSize(9).text(`TOTAL: S/. ${(t.net * order.pricePerKg).toFixed(2)}`, 5, 75);
  doc.text("Gracias por su preferencia", 40, 100, { align: 'center' });
  handlePDFOutput(doc, `Ticket_${order.clientName}.pdf`);
};

export const generateA4ClientPDF = (order: ClientOrder, config: AppConfig) => {
  const t = getOrderTotals(order);
  const doc = new jsPDF();
  const companyName = (config.companyName || 'AVI CONTROL').toUpperCase();

  doc.setFont("helvetica", "bold").setFontSize(18);
  doc.text(companyName, 105, 15, { align: 'center' });
  doc.setFontSize(10).setFont("helvetica", "normal").text("REPORTE DETALLADO DE PESAJE", 105, 22, { align: 'center' });

  doc.setFontSize(11).setFont("helvetica", "bold").text(`CLIENTE: ${order.clientName.toUpperCase()}`, 14, 35);
  doc.setFontSize(9).setFont("helvetica", "normal").text(`ID ORDEN: ${order.id} | FECHA: ${new Date().toLocaleDateString()}`, 14, 40);

  autoTable(doc, {
    startY: 45,
    head: [['CATEGORÍA', 'PESO TOTAL', 'CANTIDAD']],
    body: [
      ['PESO BRUTO (LLENAS)', `${t.wF.toFixed(2)} kg`, `${t.qF} jabas`],
      ['PESO TARA (VACÍAS)', `${t.wE.toFixed(2)} kg`, `${t.qE} jabas`],
      ['PESO MERMA (MORTALIDAD)', `${t.wM.toFixed(2)} kg`, `${t.qM} muertos`],
      [{ content: 'PESO NETO TOTAL', styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, { content: `${t.net.toFixed(2)} kg`, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, '']
    ],
    theme: 'grid'
  });

  doc.text("DESGLOSE DE PESADAS (FORMATO MULTI-COLUMNA)", 14, (doc as any).lastAutoTable.finalY + 10);

  const fullRecords = order.records.filter(r => r.type === 'FULL');
  const cols = 8;
  const bodyRows = [];
  for (let i = 0; i < fullRecords.length; i += cols) {
    const row = [];
    for (let j = 0; j < cols; j++) {
      const r = fullRecords[i + j];
      row.push(r ? `${r.weight.toFixed(1)}` : '');
    }
    bodyRows.push(row);
  }

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 15,
    head: [Array(cols).fill(0).map((_, i) => `P.${i + 1}`)],
    body: bodyRows,
    theme: 'grid',
    headStyles: { fillColor: [40, 40, 40], halign: 'center' },
    styles: { halign: 'center', fontSize: 8, cellPadding: 1 }
  });

  handlePDFOutput(doc, `Reporte_A4_${order.clientName}.pdf`);
};
