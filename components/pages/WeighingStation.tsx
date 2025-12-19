
import React, { useState, useEffect, useRef, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { WeighingType, ClientOrder, WeighingRecord, UserRole } from '../../types';
import { getOrders, saveOrder, getConfig, deleteOrder } from '../../services/storage';
import { 
  ArrowLeft, Save, DollarSign, X, Eye, Package, PackageOpen, 
  RotateCcw, User, Edit2, Trash2, 
  Scale, Box, UserPlus, Bird, Printer, Receipt, CreditCard, Wallet,
  Clock
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AuthContext } from '../../App';

const WeighingStation: React.FC = () => {
  const { mode, batchId } = useParams<{ mode: string; batchId?: string }>();
  const navigate = useNavigate();
  const [config] = useState(getConfig());
  const { user } = useContext(AuthContext);

  const [activeOrder, setActiveOrder] = useState<ClientOrder | null>(null);
  const [orders, setOrders] = useState<ClientOrder[]>([]);
  
  // Modals
  const [showClientModal, setShowClientModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  
  // Client Form State
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [newClientName, setNewClientName] = useState('');
  const [targetCrates, setTargetCrates] = useState<string>(''); 

  // Weight Input State
  const [weightInput, setWeightInput] = useState('');
  const [qtyInput, setQtyInput] = useState('');
  const [activeTab, setActiveTab] = useState<'FULL' | 'EMPTY' | 'MORTALITY'>('FULL');
  const weightInputRef = useRef<HTMLInputElement>(null);

  // Payment State
  const [pricePerKg, setPricePerKg] = useState<number | string>('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CREDIT'>('CASH');

  useEffect(() => {
    loadOrders();
    const handleUpdate = () => loadOrders();
    window.addEventListener('avi_data_orders', handleUpdate);
    return () => window.removeEventListener('avi_data_orders', handleUpdate);
  }, [mode, batchId]);

  useEffect(() => {
    setDefaultQuantity();
    setTimeout(() => weightInputRef.current?.focus(), 100);
  }, [activeTab, activeOrder]);

  const loadOrders = () => {
    const all = getOrders();
    let filtered = mode === WeighingType.BATCH && batchId 
      ? all.filter(o => o.batchId === batchId) 
      : all.filter(o => !o.batchId && o.weighingMode === mode);
    
    if (user?.role !== UserRole.ADMIN) {
      filtered = filtered.filter(o => !o.createdBy || o.createdBy === user?.id);
    }
    
    filtered.sort((a, b) => (a.status === 'OPEN' ? -1 : 1));
    setOrders(filtered);
  };

  const setDefaultQuantity = () => {
    if (mode === WeighingType.SOLO_POLLO) {
        setQtyInput('10'); 
    } else if (mode === WeighingType.SOLO_JABAS) {
        setQtyInput('1'); 
    } else {
      if (activeTab === 'FULL') setQtyInput(config.defaultFullCrateBatch.toString());
      // REQUERIMIENTO: Predeterminado de jabas vacías estrictamente en 10
      if (activeTab === 'EMPTY') setQtyInput('10'); 
      if (activeTab === 'MORTALITY') setQtyInput('1');
    }
  };

  const handleOpenClientModal = (order?: ClientOrder) => {
    if (order) {
      setEditingOrderId(order.id);
      setNewClientName(order.clientName);
      setTargetCrates(order.targetCrates?.toString() || '');
    } else {
      setEditingOrderId(null);
      setNewClientName('');
      setTargetCrates('');
    }
    setShowClientModal(true);
  };

  const handleSaveClient = () => {
    if (!newClientName || !targetCrates) return;
    const target = parseInt(targetCrates);

    if (editingOrderId) {
      const existing = getOrders().find(o => o.id === editingOrderId);
      if (existing) {
        saveOrder({ ...existing, clientName: newClientName, targetCrates: target });
      }
    } else {
      const newOrder: ClientOrder = {
        id: Date.now().toString(),
        clientName: newClientName,
        targetCrates: target,
        pricePerKg: 0,
        status: 'OPEN',
        records: [],
        batchId,
        weighingMode: mode as WeighingType,
        paymentStatus: 'PENDING',
        payments: [],
        createdBy: user?.id
      };
      saveOrder(newOrder);
    }
    loadOrders();
    setShowClientModal(false);
  };

  const getTotals = (order: ClientOrder) => {
    const full = order.records.filter(r => r.type === 'FULL');
    const empty = order.records.filter(r => r.type === 'EMPTY');
    const mort = order.records.filter(r => r.type === 'MORTALITY');
    const wF = full.reduce((a, b) => a + b.weight, 0);
    const wE = empty.reduce((a, b) => a + b.weight, 0);
    const wM = mort.reduce((a, b) => a + b.weight, 0);
    const qF = full.reduce((a, b) => a + b.quantity, 0);
    const qE = empty.reduce((a, b) => a + b.quantity, 0);
    const qM = mort.reduce((a, b) => a + b.quantity, 0);
    const net = order.weighingMode === WeighingType.SOLO_POLLO ? wF : wF - wE - wM;
    const est = mode === WeighingType.SOLO_POLLO ? qF : qF * 9;
    return { wF, wE, wM, qF, qE, qM, net, est, avg: est > 0 ? net / est : 0 };
  };

  const addWeight = () => {
    if (!activeOrder || !weightInput || !qtyInput) return;
    const totals = getTotals(activeOrder);
    const target = activeOrder.targetCrates || Infinity;

    if (activeTab === 'FULL' && totals.qF >= target) {
      alert(`⚠️ Límite de jabas LLENAS (${target}) alcanzado.`);
      return;
    }
    if (activeTab === 'EMPTY' && totals.qE >= target) {
      alert(`⚠️ Límite de jabas VACÍAS (Tara: ${target}) alcanzado.`);
      return;
    }

    const record: WeighingRecord = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      weight: parseFloat(weightInput),
      quantity: parseInt(qtyInput),
      type: activeTab
    };
    
    const updated = { ...activeOrder, records: [record, ...activeOrder.records] };
    saveOrder(updated);
    setActiveOrder(updated);
    setWeightInput('');
    weightInputRef.current?.focus();
  };

  const deleteRecord = (id: string) => {
    if(!confirm('¿Eliminar registro de pesada?')) return;
    const updated = { ...activeOrder!, records: activeOrder!.records.filter(r => r.id !== id) };
    saveOrder(updated);
    setActiveOrder(updated);
  };

  const generateTicketPDF = (order: ClientOrder) => {
    const t = getTotals(order);
    const doc = new jsPDF({ unit: 'mm', format: [80, 200] });
    const price = order.pricePerKg || 0;
    const total = t.net * price;

    doc.setFont("helvetica", "bold").setFontSize(14);
    doc.text(config.companyName.toUpperCase(), 40, 10, { align: 'center' });
    
    doc.setFontSize(8).setFont("helvetica", "normal").setTextColor(100);
    doc.text("TICKET DE VENTA / CARGA", 40, 15, { align: 'center' });
    doc.text(`${new Date().toLocaleString()}`, 40, 19, { align: 'center' });

    doc.setDrawColor(0).setLineWidth(0.5);
    doc.line(5, 22, 75, 22);

    doc.setFontSize(10).setTextColor(0).setFont("helvetica", "bold");
    doc.text("CLIENTE:", 5, 28);
    doc.setFont("helvetica", "normal");
    doc.text(order.clientName.toUpperCase(), 5, 33);

    // CUADRO DE PESOS TOTALES
    doc.rect(5, 38, 70, 52); // Cuadro contenedor ampliado
    doc.setFont("helvetica", "bold");
    doc.text("RESUMEN DE OPERACIÓN", 40, 44, { align: 'center' });
    doc.line(5, 46, 75, 46);

    doc.setFontSize(9).setFont("helvetica", "normal");
    doc.text(`Peso Bruto Total:`, 7, 52);
    doc.text(`${t.wF.toFixed(2)} kg`, 73, 52, { align: 'right' });
    
    doc.text(`Peso Tara Total:`, 7, 57);
    doc.text(`- ${t.wE.toFixed(2)} kg`, 73, 57, { align: 'right' });
    
    doc.text(`Merma/Mort. Total:`, 7, 62);
    doc.text(`- ${t.wM.toFixed(2)} kg`, 73, 62, { align: 'right' });

    doc.line(10, 65, 70, 65);
    
    doc.setFontSize(11).setFont("helvetica", "bold");
    doc.text(`PESO NETO:`, 7, 72);
    doc.text(`${t.net.toFixed(2)} kg`, 73, 72, { align: 'right' });

    doc.setFontSize(9).setFont("helvetica", "normal");
    doc.text(`Precio x Kg:`, 7, 78);
    doc.text(`S/. ${price.toFixed(2)}`, 73, 78, { align: 'right' });

    doc.setFontSize(12).setFont("helvetica", "bold");
    doc.setTextColor(0, 100, 0); // Verde oscuro para el total
    doc.text(`TOTAL A PAGAR:`, 7, 85);
    doc.text(`S/. ${total.toFixed(2)}`, 73, 85, { align: 'right' });
    doc.setTextColor(0);

    doc.setFontSize(8).setFont("helvetica", "normal").setTextColor(100);
    doc.text(`Método de Pago: ${order.paymentMethod === 'CASH' ? 'CONTADO' : 'CRÉDITO'}`, 5, 95);
    
    doc.text("Gracias por su preferencia", 40, 110, { align: 'center' });

    doc.save(`Ticket_${order.clientName}_${Date.now()}.pdf`);
  };

  const generateReportPDF = () => {
    if (!activeOrder) return;
    const t = getTotals(activeOrder);
    const doc = new jsPDF();
    const company = config.companyName.toUpperCase();

    doc.setFont("helvetica", "bold").setFontSize(18);
    doc.text(company, 105, 20, { align: 'center' });
    
    doc.setFontSize(12).setFont("helvetica", "normal");
    doc.text("REPORTE DETALLADO DE CARGA", 105, 28, { align: 'center' });
    doc.text(`Cliente: ${activeOrder.clientName}`, 105, 35, { align: 'center' });
    doc.text(`Fecha: ${new Date().toLocaleString()}`, 105, 42, { align: 'center' });

    autoTable(doc, {
      startY: 50,
      head: [['Concepto', 'Cantidad', 'Peso Total (kg)']],
      body: [
        ['Bruto (Llenas)', t.qF, t.wF.toFixed(2)],
        ['Tara (Vacías)', t.qE, t.wE.toFixed(2)],
        ['Merma / Mort.', t.qM, t.wM.toFixed(2)],
        [{ content: 'PESO NETO LIQUIDABLE', styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, '', { content: t.net.toFixed(2), styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }]
      ],
      theme: 'grid',
      headStyles: { fillColor: [23, 37, 84] }
    });

    const fullRecs = activeOrder.records.filter(r => r.type === 'FULL');
    const emptyRecs = activeOrder.records.filter(r => r.type === 'EMPTY');
    const mortRecs = activeOrder.records.filter(r => r.type === 'MORTALITY');
    const maxLen = Math.max(fullRecs.length, emptyRecs.length, mortRecs.length);

    const rows = [];
    for (let i = 0; i < maxLen; i++) {
      rows.push([
        fullRecs[i] ? fullRecs[i].quantity : '',
        fullRecs[i] ? fullRecs[i].weight.toFixed(2) : '',
        emptyRecs[i] ? emptyRecs[i].quantity : '',
        emptyRecs[i] ? emptyRecs[i].weight.toFixed(2) : '',
        mortRecs[i] ? mortRecs[i].quantity : '',
        mortRecs[i] ? mortRecs[i].weight.toFixed(2) : ''
      ]);
    }

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 15,
      head: [
        [
          { content: 'PESADAS LLENAS', colSpan: 2, styles: { halign: 'center', fillColor: [30, 41, 59] } },
          { content: 'PESADAS VACÍAS', colSpan: 2, styles: { halign: 'center', fillColor: [71, 85, 105] } },
          { content: 'PESADAS MERMA', colSpan: 2, styles: { halign: 'center', fillColor: [153, 27, 27] } }
        ],
        ['Cant.', 'Peso', 'Cant.', 'Peso', 'Cant.', 'Peso']
      ],
      body: rows,
      theme: 'grid',
      headStyles: { fontSize: 8 },
      bodyStyles: { fontSize: 8, halign: 'center' }
    });

    doc.save(`Reporte_Completo_${activeOrder.clientName}_${Date.now()}.pdf`);
  };

  const handlePayment = () => {
    if(!activeOrder) return;
    const t = getTotals(activeOrder);
    const price = typeof pricePerKg === 'string' ? parseFloat(pricePerKg) : pricePerKg;
    const total = (activeOrder.weighingMode === WeighingType.SOLO_POLLO ? t.wF : t.net) * (price || 0);
    
    const updated: ClientOrder = { 
      ...activeOrder, 
      pricePerKg: price || 0, 
      status: 'CLOSED', 
      paymentStatus: paymentMethod === 'CASH' ? 'PAID' : 'PENDING',
      paymentMethod: paymentMethod,
      payments: paymentMethod === 'CASH' ? [{ id: Date.now().toString(), amount: total, timestamp: Date.now(), note: 'Liquidación Final Contado' }] : []
    };
    
    saveOrder(updated);
    generateTicketPDF(updated);
    
    setActiveOrder(null);
    loadOrders();
    setShowPaymentModal(false);
  };

  const handleDeleteClient = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('¿Eliminar este cliente y todos sus registros de pesaje?')) {
      deleteOrder(id);
      loadOrders();
    }
  };

  const ClientCard: React.FC<{ order: ClientOrder }> = ({ order }) => {
    const t = getTotals(order);
    const target = order.targetCrates || 10;
    const isOverLimit = t.qF >= target;
    const percent = Math.min((t.qF / target) * 100, 100);

    return (
      <div 
        onClick={() => setActiveOrder(order)} 
        className={`bg-white rounded-2xl shadow-lg border border-slate-200 hover:shadow-2xl hover:border-blue-400 transition-all duration-300 overflow-hidden flex flex-col h-full relative group cursor-pointer ${order.status === 'CLOSED' ? 'opacity-75' : ''}`}
      >
          <div className="bg-slate-900 p-4 flex justify-between items-start">
             <div className="flex items-center space-x-3 overflow-hidden">
                 <div className="bg-blue-600 p-1.5 rounded-lg text-white shadow-lg shrink-0">
                     <User size={14} />
                 </div>
                 <div className="overflow-hidden">
                     <h3 className="font-black text-white text-xs leading-tight uppercase truncate">{order.clientName}</h3>
                     <p className="text-slate-400 text-[8px] font-bold uppercase flex items-center mt-1">
                         <Clock size={8} className="mr-1"/> {order.status === 'CLOSED' ? 'Liquidado' : 'Abierto'}
                     </p>
                 </div>
             </div>
             <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={(e) => { e.stopPropagation(); handleOpenClientModal(order); }} className="bg-slate-800 p-1 rounded-lg text-slate-400 hover:text-white transition-colors"><Edit2 size={10} /></button>
                <button onClick={(e) => { e.stopPropagation(); handleDeleteClient(e, order.id); }} className="bg-slate-800 p-1 rounded-lg text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={10} /></button>
             </div>
          </div>

          <div className="p-4 flex-1 flex flex-col justify-between">
              <div>
                  <div className="mb-3">
                      <div className="flex justify-between text-[8px] font-bold uppercase tracking-wider mb-1">
                          <span className="text-slate-500">Avance Carga</span>
                          <span className={`${isOverLimit ? 'text-red-600' : 'text-blue-600'}`}>{t.qF} / {target} J.</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-500 ${isOverLimit ? 'bg-red-500' : 'bg-gradient-to-r from-blue-500 to-blue-400'}`} style={{ width: `${percent}%` }}></div>
                      </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1 text-center">
                      <div className="bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                          <p className="text-[7px] font-bold text-slate-400 uppercase">Bruto</p>
                          <p className="font-black text-slate-800 text-[11px] leading-none">{t.qF}</p>
                          <p className="text-[7px] text-slate-400 font-bold mt-1">{t.wF.toFixed(1)}kg</p>
                      </div>
                      <div className="bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                          <p className="text-[7px] font-bold text-slate-400 uppercase">Tara</p>
                          <p className="font-black text-slate-800 text-[11px] leading-none">{t.qE}</p>
                           <p className="text-[7px] text-slate-400 font-bold mt-1">{t.wE.toFixed(1)}kg</p>
                      </div>
                      <div className="bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                          <p className="text-[7px] font-bold text-red-400 uppercase">Merma</p>
                          <p className="font-black text-slate-800 text-[11px] leading-none">{t.qM}</p>
                           <p className="text-[7px] text-red-400 font-bold mt-1">{t.wM.toFixed(1)}kg</p>
                      </div>
                  </div>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-50 flex justify-between items-center">
                  <span className={`text-[7px] font-black uppercase tracking-widest ${order.paymentStatus === 'PAID' ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {order.paymentStatus === 'PAID' ? 'PAGADO' : 'PENDIENTE'}
                  </span>
                  <div className="text-blue-600 font-black text-[8px] uppercase flex items-center group-hover:translate-x-1 transition-transform">
                    OPERAR <ArrowLeft size={10} className="ml-1 rotate-180" />
                  </div>
              </div>
          </div>
      </div>
    );
  };

  const totals = getTotals(activeOrder || { records: [] } as any);

  if (!activeOrder) {
    return (
      <div className="p-2 md:p-4 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter text-left">Gestión de Pesaje</h2>
            <div className="flex items-center gap-2 mt-0.5">
                <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[8px] font-black uppercase">{mode}</span>
                <p className="text-slate-400 text-[10px] font-medium italic">Seleccione un cliente para iniciar el registro</p>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            {/* BOTÓN REGRESAR CORREGIDO PARA IR A /LOTES */}
            <button onClick={() => navigate('/lotes')} className="bg-white border-2 border-slate-100 p-2 rounded-xl hover:bg-slate-50 text-slate-400 shadow-sm transition-all">
                <ArrowLeft size={16}/>
            </button>
            <button onClick={() => handleOpenClientModal()} className="flex-1 sm:flex-none bg-blue-950 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-blue-900 transition-all flex items-center justify-center gap-2">
              <UserPlus size={16} /> Crear Cliente
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {orders.map(o => <ClientCard key={o.id} order={o} />)}
          {orders.length === 0 && (
             <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200">
                <User size={48} className="mx-auto text-slate-200 mb-4"/>
                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">No hay clientes registrados</p>
             </div>
          )}
        </div>

        {showClientModal && (
          <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm border border-gray-100 animate-fade-in">
              <h3 className="text-xl font-black mb-6 text-slate-900 uppercase tracking-tighter">{editingOrderId ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wide mb-1 px-1">Razón Social</label>
                  <input 
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-900 focus:border-blue-500 focus:bg-white outline-none transition-all"
                    value={newClientName}
                    onChange={e => setNewClientName(e.target.value)}
                    placeholder="Nombre del Cliente"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wide mb-1 px-1">Meta Jabas</label>
                  <input 
                    type="number"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-900 focus:border-blue-500 focus:bg-white outline-none transition-all"
                    value={targetCrates}
                    onChange={e => setTargetCrates(e.target.value)}
                    placeholder="Cant. aproximada"
                  />
                </div>
              </div>
              <div className="mt-8 flex justify-end space-x-3">
                <button onClick={() => setShowClientModal(false)} className="text-slate-500 font-bold text-[10px] uppercase hover:text-slate-800 px-4 py-2 transition-colors">Cerrar</button>
                <button onClick={handleSaveClient} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-blue-700 transition-colors">Guardar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const isLocked = activeOrder.status === 'CLOSED';

  return (
    <div className="flex flex-col h-full space-y-3 max-w-7xl mx-auto">
      {/* CABECERA COMPACTA */}
      <div className="bg-blue-950 p-3 rounded-2xl shadow-xl text-white border-b-4 border-blue-900">
        <div className="flex flex-col lg:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-3 w-full lg:w-auto">
            <button onClick={() => setActiveOrder(null)} className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-all active:scale-90"><ArrowLeft size={18}/></button>
            <div className="overflow-hidden text-left">
              <h2 className="text-lg font-black uppercase tracking-tighter leading-none truncate max-w-[180px] md:max-w-md">{activeOrder.clientName}</h2>
              <p className="text-blue-300 text-[8px] font-black uppercase tracking-widest mt-1">MODO: {mode} | Lote: {activeOrder.batchId || 'Sin Lote'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-1.5 flex-1 w-full text-center">
            <div className="bg-white/5 p-1.5 rounded-xl border border-white/10">
              <p className="text-[6px] font-black text-blue-300 uppercase">Bruto</p>
              <p className="text-base font-black font-digital">{totals.wF.toFixed(1)}</p>
            </div>
            <div className="bg-white/5 p-1.5 rounded-xl border border-white/10">
              <p className="text-[6px] font-black text-blue-300 uppercase">Tara</p>
              <p className="text-base font-black font-digital text-orange-400">{totals.wE.toFixed(1)}</p>
            </div>
            <div className="bg-white/5 p-1.5 rounded-xl border border-white/10">
              <p className="text-[6px] font-black text-blue-300 uppercase">Aprox.</p>
              <p className="text-base font-black font-digital text-blue-100">{totals.est}</p>
            </div>
            <div className="bg-white/5 p-1.5 rounded-xl border border-white/10">
              <p className="text-[6px] font-black text-blue-300 uppercase">Jabas</p>
              <p className="text-base font-black font-digital text-amber-400">{totals.qF}</p>
            </div>
            <div className="bg-white/5 p-1.5 rounded-xl border border-white/10">
              <p className="text-[6px] font-black text-red-400 uppercase">Merma</p>
              <p className="text-base font-black font-digital text-red-400">{totals.wM.toFixed(1)}</p>
            </div>
            <div className="bg-emerald-600 p-1.5 rounded-xl border border-emerald-500 shadow-inner">
              <p className="text-[6px] font-black text-emerald-100 uppercase">Neto</p>
              <p className="text-base font-black font-digital">{totals.net.toFixed(1)}</p>
            </div>
          </div>

          <div className="flex gap-2 w-full lg:w-auto">
            <button onClick={() => setShowDetailModal(true)} className="flex-1 lg:flex-none bg-white/10 p-2 rounded-xl border border-white/20 hover:bg-white/20 transition-all active:scale-95"><Eye size={16}/></button>
            {!isLocked && <button onClick={() => { setPricePerKg(activeOrder.pricePerKg || ''); setShowPaymentModal(true); }} className="flex-1 lg:flex-none bg-emerald-600 px-5 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg hover:bg-emerald-500 active:scale-95 transition-all">Liquidar</button>}
          </div>
        </div>
      </div>

      {!isLocked && (
        <div className="bg-white p-3 rounded-2xl shadow-xl border border-slate-100">
          <div className="flex flex-col md:flex-row gap-3 items-stretch justify-center">
            <div className="flex bg-slate-50 p-1 rounded-2xl gap-1.5 w-full md:w-auto border border-slate-100">
              <button onClick={() => setActiveTab('FULL')} className={`flex-1 md:w-16 h-14 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all ${activeTab === 'FULL' ? 'bg-blue-950 text-white shadow-lg' : 'text-slate-300'}`}>
                <Package size={14}/><span className="text-[7px] font-black uppercase">Llenas</span>
              </button>
              <button onClick={() => setActiveTab('EMPTY')} className={`flex-1 md:w-16 h-14 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all ${activeTab === 'EMPTY' ? 'bg-slate-400 text-white shadow-lg' : 'text-slate-300'}`}>
                <PackageOpen size={14}/><span className="text-[7px] font-black uppercase">Vacías</span>
              </button>
              <button onClick={() => setActiveTab('MORTALITY')} className={`flex-1 md:w-16 h-14 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all ${activeTab === 'MORTALITY' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-300'}`}>
                <Bird size={14}/><span className="text-[7px] font-black uppercase">Merma</span>
              </button>
            </div>
            
            <div className="flex gap-3 flex-1 max-w-2xl">
              <div className="w-20 bg-slate-50 border border-slate-200 rounded-xl flex flex-col items-center justify-center py-1">
                <span className="text-[7px] font-black text-slate-400 uppercase mb-0.5">U.</span>
                <input type="number" value={qtyInput} onChange={e => setQtyInput(e.target.value)} className="w-full text-center bg-transparent font-black text-xl outline-none text-slate-900" />
              </div>
              <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl flex flex-col items-center justify-center py-1 focus-within:border-blue-500 focus-within:bg-white transition-all relative shadow-inner">
                <span className="text-[7px] font-black text-slate-400 uppercase mb-0.5">Peso (Kg)</span>
                <input 
                  ref={weightInputRef} 
                  type="number" 
                  value={weightInput} 
                  onChange={e => setWeightInput(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && addWeight()} 
                  className="w-full text-center bg-transparent font-black text-3xl md:text-4xl outline-none text-slate-900" 
                  placeholder="0.0" 
                />
              </div>
              <button onClick={addWeight} className="w-16 md:w-24 bg-blue-950 hover:bg-blue-900 text-white rounded-xl shadow-xl transition-all active:scale-90 flex items-center justify-center border-b-4 border-blue-950/30">
                <Save size={20}/>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REGISTROS RECIENTES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1 overflow-hidden">
        {[
          { key: 'FULL', title: 'Registro Bruto', icon: <Package size={12}/>, color: 'blue' },
          { key: 'EMPTY', title: 'Registro Tara', icon: <PackageOpen size={12}/>, color: 'orange' },
          { key: 'MORTALITY', title: 'Registro Merma', icon: <Bird size={12}/>, color: 'red' }
        ].map(type => (
          <div key={type.key} className="bg-white rounded-2xl border border-slate-200 flex flex-col overflow-hidden shadow-sm">
            <div className={`p-2 font-black text-[7px] text-center uppercase tracking-widest text-white flex items-center justify-center gap-2 ${type.key === 'FULL' ? 'bg-blue-950' : type.key === 'EMPTY' ? 'bg-slate-500' : 'bg-red-600'}`}>
              {type.icon} {type.title}
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-slate-50/30">
              {activeOrder.records.filter(r => r.type === type.key).slice(0, 15).map(r => (
                <div key={r.id} className="flex justify-between items-center bg-white p-1.5 rounded-lg border border-slate-100 shadow-sm text-[11px] group/item">
                  <div className="flex flex-col text-left">
                    <span className="text-[6px] font-black text-slate-300 uppercase">{new Date(r.timestamp).toLocaleTimeString()}</span>
                    <span className="font-digital font-black text-slate-800 text-sm leading-none">{r.weight.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[8px] font-black text-slate-400 bg-slate-50 px-1 py-0.5 rounded">x{r.quantity}</span>
                    {!isLocked && <button onClick={() => deleteRecord(r.id)} className="p-1 text-slate-200 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover/item:opacity-100 transition-all"><Trash2 size={10}/></button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {showDetailModal && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden border-4 border-white animate-scale-up">
            <div className="p-4 bg-blue-950 text-white flex justify-between items-center">
              <div className="text-left">
                <h3 className="text-lg font-black uppercase tracking-tighter">Detalle Operativo de Carga</h3>
                <p className="text-blue-300 text-[8px] font-black uppercase tracking-widest mt-0.5">{activeOrder.clientName}</p>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="bg-white/10 p-2 rounded-xl hover:bg-white/20 transition-all"><X size={16}/></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 bg-slate-50/80">
               <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  <div className="bg-white p-3 rounded-2xl border border-slate-200 text-center shadow-sm">
                    <p className="text-[7px] font-black text-blue-400 uppercase tracking-widest mb-1">Bruto Total</p>
                    <p className="font-digital font-black text-xl text-slate-900">{totals.wF.toFixed(2)} <span className="text-[10px]">kg</span></p>
                    <p className="text-[7px] text-slate-400 font-bold uppercase mt-1">{totals.qF} Jabas</p>
                  </div>
                  <div className="bg-white p-3 rounded-2xl border border-slate-200 text-center shadow-sm">
                    <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Tara Total</p>
                    <p className="font-digital font-black text-xl text-slate-900">{totals.wE.toFixed(2)} <span className="text-[10px]">kg</span></p>
                    <p className="text-[7px] text-slate-400 font-bold uppercase mt-1">{totals.qE} Jabas</p>
                  </div>
                  <div className="bg-white p-3 rounded-2xl border border-slate-200 text-center shadow-sm">
                    <p className="text-[7px] font-black text-red-400 uppercase tracking-widest mb-1">Merma Técnica</p>
                    <p className="font-digital font-black text-xl text-slate-900">{totals.wM.toFixed(2)} <span className="text-[10px]">kg</span></p>
                    <p className="text-[7px] text-slate-400 font-bold uppercase mt-1">{totals.qM} Und</p>
                  </div>
                  <div className="bg-blue-900 p-3 rounded-2xl text-center shadow-xl border border-blue-800">
                    <p className="text-[7px] font-black text-blue-200 uppercase tracking-widest mb-1">Neto Final</p>
                    <p className="font-digital font-black text-xl text-white">{totals.net.toFixed(2)} <span className="text-[10px]">kg</span></p>
                    <p className="text-[7px] text-blue-300 font-bold uppercase mt-1">Liquidación</p>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                 {['FULL', 'EMPTY', 'MORTALITY'].map(type => {
                   const recs = activeOrder.records.filter(r => r.type === type).sort((a,b) => b.timestamp - a.timestamp);
                   return (
                     <div key={type} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col h-[40vh]">
                        <div className={`px-4 py-2 text-white font-black uppercase tracking-widest text-[8px] flex items-center gap-2 ${type === 'FULL' ? 'bg-blue-900' : type === 'EMPTY' ? 'bg-slate-600' : 'bg-red-800'}`}>
                           {type === 'FULL' ? <Package size={12}/> : type === 'EMPTY' ? <PackageOpen size={12}/> : <Bird size={12}/>} 
                           {type === 'FULL' ? 'DETALLE LLENAS' : type === 'EMPTY' ? 'DETALLE VACÍAS' : 'DETALLE MERMA'}
                        </div>
                        <div className="flex-1 overflow-y-auto">
                           <table className="w-full text-left text-[10px]">
                              <thead className="bg-slate-50 sticky top-0 border-b border-slate-100">
                                <tr className="text-[7px] font-black text-slate-400 uppercase tracking-widest">
                                  <th className="p-2">U.</th>
                                  <th className="p-2 text-right">Peso (kg)</th>
                                  <th className="p-2"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {recs.map(r => (
                                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-2 font-bold text-slate-500">{r.quantity}</td>
                                    <td className="p-2 text-right font-digital font-black text-sm text-slate-900">{r.weight.toFixed(2)}</td>
                                    <td className="p-2 text-right">
                                      {!isLocked && <button onClick={() => deleteRecord(r.id)} className="text-red-200 hover:text-red-600 transition-colors"><Trash2 size={10}/></button>}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                           </table>
                        </div>
                     </div>
                   );
                 })}
               </div>
            </div>

            <div className="p-5 bg-white border-t border-slate-100 flex justify-between items-center">
              <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Peso Neto: <span className="text-emerald-600 font-black">{totals.net.toFixed(2)} kg</span></div>
              <button onClick={generateReportPDF} className="bg-blue-950 text-white px-8 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-xl hover:bg-blue-900 transition-all flex items-center gap-2">
                <Printer size={14}/> Reporte PDF Detallado
              </button>
            </div>
          </div>
        </div>
      )}

      {showPaymentModal && (activeOrder) && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl flex items-center justify-center p-4 z-50 overflow-hidden">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border-4 border-white animate-scale-up scrollbar-hide">
            <div className="p-5 bg-emerald-600 text-white flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <Receipt size={22}/>
                    <h3 className="text-lg font-black uppercase tracking-tighter">Cierre de Liquidación</h3>
                </div>
                <button onClick={() => setShowPaymentModal(false)} className="bg-white/10 p-1.5 rounded-lg hover:bg-white/20 transition-all"><X size={18}/></button>
            </div>

            <div className="p-6 space-y-6 bg-slate-50/50">
                <div className="bg-white border-2 border-slate-100 rounded-3xl p-5 shadow-inner relative text-left">
                    <div className="border-b-2 border-dashed border-slate-100 pb-3 mb-3">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Cliente Receptor</p>
                        <p className="text-sm font-black text-slate-800 uppercase">{activeOrder.clientName}</p>
                    </div>
                    <div className="space-y-2 text-[11px] font-bold text-slate-600">
                        <div className="flex justify-between"><span>Bruto Total:</span><span className="font-digital text-slate-800">{totals.wF.toFixed(2)} kg</span></div>
                        <div className="flex justify-between"><span>Tara Total:</span><span className="font-digital text-slate-800">{totals.wE.toFixed(2)} kg</span></div>
                        <div className="flex justify-between pt-2 border-t border-slate-50 font-black text-slate-900">
                            <span className="text-emerald-600">TOTAL NETO:</span>
                            <span className="font-digital text-lg text-emerald-600">{totals.net.toFixed(2)} kg</span>
                        </div>
                    </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                    <button 
                        onClick={() => setPaymentMethod('CASH')}
                        className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all ${paymentMethod === 'CASH' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-100 bg-white text-slate-400'}`}
                    >
                        <Wallet size={20} className="mb-1"/>
                        <span className="text-[9px] font-black uppercase">Contado</span>
                    </button>
                    <button 
                        onClick={() => setPaymentMethod('CREDIT')}
                        className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all ${paymentMethod === 'CREDIT' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-100 bg-white text-slate-400'}`}
                    >
                        <CreditCard size={20} className="mb-1"/>
                        <span className="text-[9px] font-black uppercase">Crédito</span>
                    </button>
                </div>

                <div className="bg-white p-4 rounded-2xl border-2 border-slate-100 flex items-center justify-between text-left">
                    <div className="flex-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Precio x Kg (S/.)</label>
                        <input 
                            type="number" 
                            value={pricePerKg} 
                            onChange={e => setPricePerKg(e.target.value)} 
                            className="bg-transparent text-2xl font-digital font-black text-slate-900 outline-none w-full" 
                            autoFocus 
                            placeholder="0.00"
                        />
                    </div>
                    <div className="text-right border-l border-slate-100 pl-4">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Total {paymentMethod === 'CASH' ? 'Pagado' : 'Deuda'}</label>
                        <p className={`text-2xl font-digital font-black leading-none ${paymentMethod === 'CASH' ? 'text-emerald-600' : 'text-blue-600'}`}>
                            S/. {((mode === WeighingType.SOLO_POLLO ? totals.wF : totals.net) * (parseFloat(pricePerKg.toString()) || 0)).toFixed(2)}
                        </p>
                    </div>
                </div>

                <div className="flex flex-col gap-2 pt-2 pb-2">
                  <button 
                    onClick={handlePayment} 
                    className={`w-full text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all active:scale-95 border-b-4 ${paymentMethod === 'CASH' ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-800' : 'bg-blue-900 hover:bg-blue-800 border-blue-950'}`}
                  >
                    Confirmar e Imprimir Ticket ({paymentMethod === 'CASH' ? 'Contado' : 'Crédito'})
                  </button>
                  <button onClick={() => setShowPaymentModal(false)} className="w-full py-2 text-slate-400 font-black text-[9px] uppercase hover:text-slate-600 transition-colors">Volver</button>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeighingStation;
