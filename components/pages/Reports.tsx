
import React, { useEffect, useState, useContext } from 'react';
import { getBatches, getOrders, getConfig } from '../../services/storage';
import { Batch, ClientOrder, WeighingType, UserRole, WeighingRecord } from '../../types';
import { 
  ChevronDown, ChevronUp, Package, ShoppingCart, List, Printer, 
  Eye, FileText, Download, Table as TableIcon, FileCheck, Calendar, Search, Receipt
} from 'lucide-react';
import { AuthContext } from '../../App';
import { generateTicketPDF, generateSummaryTicketPDF, generateA4ClientPDF } from '../../services/pdfHelper';

const Reports: React.FC = () => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [orders, setOrders] = useState<ClientOrder[]>([]);
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  const [showDetailOrder, setShowDetailOrder] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { user } = useContext(AuthContext);
  const config = getConfig();

  useEffect(() => {
    refresh();
    const handleUpdate = () => refresh();
    window.addEventListener('avi_data_orders', handleUpdate);
    window.addEventListener('avi_data_batches', handleUpdate);
    return () => {
      window.removeEventListener('avi_data_orders', handleUpdate);
      window.removeEventListener('avi_data_batches', handleUpdate);
    };
  }, [user]);

  const refresh = () => {
      const allBatches = getBatches();
      const allOrders = getOrders();
      if (user?.role === UserRole.ADMIN) {
          setBatches(allBatches);
          setOrders(allOrders);
      } else {
          setBatches(allBatches.filter(b => !b.createdBy || b.createdBy === user?.id));
          setOrders(allOrders.filter(o => !o.createdBy || o.createdBy === user?.id));
      }
  }

  const handlePDFOutput = (doc: jsPDF, filename: string) => {
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

  const getTotals = (order: ClientOrder) => {
    const wFull = order.records.filter(r => r.type === 'FULL').reduce((a, b) => a + b.weight, 0);
    const wEmpty = order.records.filter(r => r.type === 'EMPTY').reduce((a, b) => a + b.weight, 0);
    const wMort = order.records.filter(r => r.type === 'MORTALITY').reduce((a, b) => a + b.weight, 0);
    const qFull = order.records.filter(r => r.type === 'FULL').reduce((a, b) => a + b.quantity, 0);
    const qEmpty = order.records.filter(r => r.type === 'EMPTY').reduce((a, b) => a + b.quantity, 0);
    const qMort = order.records.filter(r => r.type === 'MORTALITY').reduce((a, b) => a + b.quantity, 0);
    let net = wFull - wEmpty - wMort;
    if (order.weighingMode === WeighingType.SOLO_POLLO) net = wFull;
    return { wFull, wEmpty, wMort, qFull, qEmpty, qMort, net };
  };

  const generateTicketPDF = (order: ClientOrder) => {
    const t = getTotals(order);
    const doc = new jsPDF({ unit: 'mm', format: [80, 150] });
    doc.setFontSize(14).setFont("helvetica", "bold");
    doc.text(config.companyName.toUpperCase(), 40, 10, { align: 'center' });
    doc.setFontSize(8).setFont("helvetica", "normal");
    doc.text("TICKET DE CARGA", 40, 15, { align: 'center' });
    doc.text(new Date().toLocaleString(), 40, 19, { align: 'center' });
    doc.line(5, 22, 75, 22);
    doc.setFontSize(10).text(`CLIENTE: ${order.clientName.toUpperCase()}`, 5, 28);
    doc.rect(5, 33, 70, 35);
    doc.text(`BRUTO: ${t.wFull.toFixed(2)} kg`, 10, 42);
    doc.text(`TARA: -${t.wEmpty.toFixed(2)} kg`, 10, 48);
    doc.text(`MERMA: -${t.wMort.toFixed(2)} kg`, 10, 54);
    doc.setFontSize(12).setFont("helvetica", "bold").text(`NETO: ${t.net.toFixed(2)} kg`, 10, 63);
    doc.setFontSize(9).text(`TOTAL: S/. ${(t.net * order.pricePerKg).toFixed(2)}`, 5, 75);
    doc.text("Gracias por su preferencia", 40, 100, { align: 'center' });
    handlePDFOutput(doc, `Ticket_${order.clientName}.pdf`);
  };

  const generateA4ClientPDF = (order: ClientOrder) => {
    const t = getTotals(order);
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold").setFontSize(18);
    doc.text(config.companyName.toUpperCase(), 105, 15, { align: 'center' });
    doc.setFontSize(10).setFont("helvetica", "normal").text("REPORTE DETALLADO DE PESAJE", 105, 22, { align: 'center' });
    
    doc.setFontSize(11).setFont("helvetica", "bold").text(`CLIENTE: ${order.clientName.toUpperCase()}`, 14, 35);
    doc.setFontSize(9).setFont("helvetica", "normal").text(`ID ORDEN: ${order.id} | FECHA: ${new Date().toLocaleDateString()}`, 14, 40);

    autoTable(doc, {
      startY: 45,
      head: [['CATEGORÍA', 'PESO TOTAL', 'CANTIDAD JABAS']],
      body: [
        ['PESO BRUTO (LLENAS)', `${t.wFull.toFixed(2)} kg`, t.qFull],
        ['PESO TARA (VACÍAS)', `${t.wEmpty.toFixed(2)} kg`, t.qEmpty],
        ['PESO MERMA (MORTALIDAD)', `${t.wMort.toFixed(2)} kg`, t.qMort],
        [{ content: 'PESO NETO TOTAL', styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, { content: `${t.net.toFixed(2)} kg`, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, '']
      ],
      theme: 'grid'
    });

    doc.text("DESGLOSE DE PESADAS (FORMATO COMPACTO PARA AHORRO DE HOJAS)", 14, (doc as any).lastAutoTable.finalY + 10);
    
    // Multi-column grouping for weights
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
      head: [Array(cols).fill(0).map((_, i) => `P.${i+1}`)],
      body: bodyRows,
      theme: 'grid',
      headStyles: { fillColor: [40, 40, 40], halign: 'center' },
      styles: { halign: 'center', fontSize: 8, cellPadding: 1 }
    });

    handlePDFOutput(doc, `Reporte_A4_${order.clientName}.pdf`);
  };

  const getStats = (filterFn: (o: ClientOrder) => boolean) => {
    const filteredOrders = orders.filter(filterFn);
    let totalFull = 0, totalEmpty = 0, totalNet = 0, totalMort = 0;
    
    filteredOrders.forEach(o => {
      const stats = getTotals(o);
      totalFull += stats.wFull;
      totalEmpty += stats.wEmpty;
      totalMort += stats.wMort;
      totalNet += stats.net;
    });

    return { totalFull, totalEmpty, totalMort, totalNet, orderCount: filteredOrders.length, batchOrders: filteredOrders };
  };

  const ReportCard = ({ id, title, subtitle, icon, stats }: any) => {
      const isExpanded = expandedBatch === id;
      const filteredBatchOrders = stats.batchOrders.filter((o: ClientOrder) => o.clientName.toLowerCase().includes(searchTerm.toLowerCase()));

      return (
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden mb-6 text-left">
            <div className="p-6 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => setExpandedBatch(isExpanded ? null : id)}>
                <div className="flex items-center space-x-5">
                    <div className={`p-4 rounded-2xl ${id === 'direct-sales' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-800'}`}>
                    {icon}
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">{title}</h3>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{subtitle} • {stats.orderCount} Clientes</p>
                    </div>
                </div>
                <div className="flex items-center space-x-8">
                    <div className="text-right hidden md:block">
                        <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Peso Neto Acumulado</p>
                        <p className="text-2xl font-black font-digital text-slate-900">{stats.totalNet.toFixed(1)} kg</p>
                    </div>
                    {isExpanded ? <ChevronUp className="text-slate-400" /> : <ChevronDown className="text-slate-400" />}
                </div>
            </div>

            {isExpanded && (
            <div className="bg-slate-50 border-t border-slate-100 p-6 animate-fade-in">
                <div className="flex justify-between items-center mb-6">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Clientes en este grupo</h4>
                </div>

                <div className="space-y-4">
                    {filteredBatchOrders.map((order: ClientOrder) => {
                        const t = getTotals(order);
                        const isDetailOpen = showDetailOrder === order.id;

                        return (
                            <div key={order.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:border-blue-300 transition-all">
                                <div className="p-5 flex flex-col md:flex-row justify-between items-center gap-4">
                                    <div className="flex-1 w-full md:w-auto">
                                        <p className="font-black text-slate-900 uppercase text-base tracking-tight">{order.clientName}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`text-[8px] px-2 py-1 rounded font-black uppercase border ${order.status === 'CLOSED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                                {order.status === 'CLOSED' ? 'CERRADO' : 'ABIERTO'}
                                            </span>
                                            <span className="text-[8px] bg-slate-50 text-slate-400 px-2 py-1 rounded font-black uppercase border border-slate-100">
                                                {order.weighingMode}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-end">
                                        <div className="text-right">
                                            <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Total Neto</p>
                                            <p className="font-digital font-black text-slate-900 text-xl">{t.net.toFixed(2)} kg</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => setShowDetailOrder(isDetailOpen ? null : order.id)} 
                                                className={`p-3 rounded-xl transition-all shadow-sm ${isDetailOpen ? 'bg-blue-900 text-white' : 'bg-slate-100 text-slate-400 hover:text-blue-600'}`}
                                                title="Ver Pesas"
                                            >
                                                <Eye size={22} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                
                                {isDetailOpen && (
                                    <div className="bg-slate-50 p-6 border-t border-slate-100 animate-fade-in">
                                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                                                    <List size={18} />
                                                </div>
                                                <div>
                                                    <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Desglose Operativo</h5>
                                                    <p className="text-slate-400 text-[9px] font-bold uppercase mt-1">Registros agrupados (Vista Compacta)</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-2 w-full md:w-auto">
                                                <button onClick={() => generateTicketPDF(order, config)} className="flex-1 md:flex-none bg-white text-slate-900 border border-slate-200 px-4 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-50 shadow-sm transition-all">
                                                    <Printer size={16} /> Ticket Detallado
                                                </button>
                                                <button onClick={() => generateSummaryTicketPDF(order, config)} className="flex-1 md:flex-none bg-emerald-600 text-white px-4 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-700 shadow-md transition-all" title="Ticket de Resumen sin pesas">
                                                    <Receipt size={16} /> Ticket Resumen
                                                </button>
                                                <button onClick={() => generateA4ClientPDF(order, config)} className="flex-1 md:flex-none bg-blue-900 text-white px-4 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-800 shadow-lg transition-all">
                                                    <Download size={16} /> Reporte A4 PDF
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-6">
                                            {/* Brutos - Formato Compacto (Cuadros Pequeños) */}
                                            <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-inner flex flex-col">
                                                <div className="bg-blue-900 p-3 font-black text-[10px] text-center uppercase tracking-[0.15em] text-white">
                                                    Pesos Brutos (Llenas) - Detalle Compacto
                                                </div>
                                                <div className="p-4 flex flex-wrap gap-2 max-h-60 overflow-y-auto">
                                                    {order.records.filter(r => r.type === 'FULL').map((r, i) => (
                                                        <div key={r.id} className="min-w-[60px] bg-slate-50 border border-slate-100 rounded-lg p-2 text-center shadow-sm">
                                                            <p className="text-[7px] font-black text-slate-300 uppercase leading-none mb-1">#{order.records.filter(rt => rt.type === 'FULL').length - i}</p>
                                                            <p className="font-digital font-black text-slate-900 text-xs">{r.weight.toFixed(1)}</p>
                                                        </div>
                                                    ))}
                                                    {order.records.filter(r => r.type === 'FULL').length === 0 && (
                                                        <p className="w-full text-center py-10 text-slate-300 font-black uppercase text-[8px] tracking-widest">Sin registros</p>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {['EMPTY', 'MORTALITY'].map(type => (
                                                    <div key={type} className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden flex flex-col h-56 shadow-inner">
                                                        <div className={`p-3 font-black text-[10px] text-center uppercase tracking-[0.15em] text-white ${type === 'EMPTY' ? 'bg-slate-500' : 'bg-red-600'}`}>
                                                            {type === 'EMPTY' ? 'Taras (Vacías)' : 'Mermas (Merma)'}
                                                        </div>
                                                        <div className="flex-1 overflow-y-auto p-3 flex flex-wrap gap-1.5">
                                                            {order.records.filter(r => r.type === type).map((r, i) => (
                                                                <div key={r.id} className="bg-slate-50 border border-slate-100 rounded-lg px-2 py-1.5 min-w-[50px] text-center">
                                                                    <p className="font-digital font-black text-slate-800 text-[10px]">{r.weight.toFixed(1)}</p>
                                                                </div>
                                                            ))}
                                                            {order.records.filter(r => r.type === type).length === 0 && (
                                                                <p className="w-full text-center py-10 text-slate-200 font-black uppercase text-[8px] tracking-widest">Vacío</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
            )}
        </div>
      );
  }

  const directSalesStats = getStats(o => !o.batchId);

  return (
    <div className="space-y-8 animate-fade-in pb-10 text-left max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
            <h2 className="text-4xl font-black text-blue-950 uppercase tracking-tighter">Historial de Reportes</h2>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-2 flex items-center gap-2">
                <FileCheck size={14} className="text-blue-600"/> Registros Consolidados
            </p>
        </div>
        <div className="relative w-full md:w-80">
            <input 
                type="text" 
                placeholder="Buscar cliente..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:border-blue-500 shadow-sm transition-all"
            />
            <Search className="absolute left-4 top-4 text-slate-300" size={20} />
        </div>
      </div>
      
      <div>
        {directSalesStats.orderCount > 0 && (
            <ReportCard 
                id="direct-sales" 
                title="Ventas Directas" 
                subtitle="Sin lote asignado" 
                icon={<ShoppingCart size={32}/>}
                stats={directSalesStats}
            />
        )}

        {batches.map(batch => (
             <ReportCard 
                key={batch.id} 
                id={batch.id} 
                title={batch.name} 
                subtitle={`Iniciado el ${new Date(batch.createdAt).toLocaleDateString()}`}
                icon={<Package size={32}/>}
                stats={getStats(o => o.batchId === batch.id)}
             />
        ))}
      </div>
    </div>
  );
};

export default Reports;
