
import React, { useState, useEffect, useRef, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { WeighingType, ClientOrder, WeighingRecord, UserRole } from '../../types';
import { getOrders, saveOrder, getConfig, deleteOrder } from '../../services/storage';
import { 
  ArrowLeft, Save, DollarSign, X, Eye, Package, PackageOpen, 
  RotateCcw, User, Edit2, Trash2, 
  Scale, Box, UserPlus, Bird, Printer, Receipt, CreditCard, Wallet,
  Clock, FileText, ChevronRight, Apple
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
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

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
    if (!isSafari) setTimeout(() => weightInputRef.current?.focus(), 100);
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
    if (mode === WeighingType.SOLO_POLLO) setQtyInput('10'); 
    else if (mode === WeighingType.SOLO_JABAS) setQtyInput('1'); 
    else {
      if (activeTab === 'FULL') setQtyInput(config.defaultFullCrateBatch.toString());
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
      if (existing) saveOrder({ ...existing, clientName: newClientName, targetCrates: target });
    } else {
      const newOrder: ClientOrder = {
        id: Date.now().toString(), clientName: newClientName, targetCrates: target,
        pricePerKg: 0, status: 'OPEN', records: [], batchId, weighingMode: mode as WeighingType,
        paymentStatus: 'PENDING', payments: [], createdBy: user?.id
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
    return { wF, wE, wM, qF, qE, qM, net, est };
  };

  const addWeight = () => {
    if (!activeOrder || !weightInput || !qtyInput) return;
    const record: WeighingRecord = {
      id: Date.now().toString(), timestamp: Date.now(), weight: parseFloat(weightInput),
      quantity: parseInt(qtyInput), type: activeTab
    };
    const updated = { ...activeOrder, records: [record, ...activeOrder.records] };
    saveOrder(updated);
    setActiveOrder(updated);
    setWeightInput('');
    if (!isSafari) weightInputRef.current?.focus();
  };

  const deleteRecord = (id: string) => {
    if(!confirm('¿Eliminar?')) return;
    const updated = { ...activeOrder!, records: activeOrder!.records.filter(r => r.id !== id) };
    saveOrder(updated);
    setActiveOrder(updated);
  };

  const handlePDFOutput = (doc: jsPDF, filename: string) => {
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    // En Safari, navegar directamente al blob suele evitar el bloqueo de pop-ups
    if (isSafari) {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.click();
    } else {
      window.open(url, '_blank');
    }
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
    doc.text(`BRUTO: ${t.wF.toFixed(2)} kg`, 10, 42);
    doc.text(`TARA: -${t.wE.toFixed(2)} kg`, 10, 48);
    doc.text(`MERMA: -${t.wM.toFixed(2)} kg`, 10, 54);
    doc.setFontSize(12).setFont("helvetica", "bold").text(`NETO: ${t.net.toFixed(2)} kg`, 10, 63);
    doc.setFontSize(9).text(`TOTAL: S/. ${(t.net * order.pricePerKg).toFixed(2)}`, 5, 75);
    doc.text("Gracias por su preferencia", 40, 100, { align: 'center' });
    handlePDFOutput(doc, `Ticket_${order.id}.pdf`);
  };

  // Fix: Implemented handlePayment to resolve 'Cannot find name handlePayment'
  const handlePayment = () => {
    if (!activeOrder || !pricePerKg) return;
    const price = parseFloat(pricePerKg.toString());
    const updatedOrder: ClientOrder = {
      ...activeOrder,
      pricePerKg: price,
      status: 'CLOSED',
      paymentMethod: paymentMethod,
    };
    saveOrder(updatedOrder);
    setActiveOrder(updatedOrder);
    generateTicketPDF(updatedOrder);
    setShowPaymentModal(false);
    loadOrders();
  };

  const SafariNumpad = () => {
    const handleKey = (val: string) => {
        if (val === 'DEL') setWeightInput(prev => prev.slice(0, -1));
        else if (val === '.') { if (!weightInput.includes('.')) setWeightInput(prev => prev + '.'); }
        else setWeightInput(prev => prev + val);
    };
    return (
        <div className="grid grid-cols-3 gap-2 mt-4 bg-slate-100 p-3 rounded-3xl md:hidden">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0, 'DEL'].map(k => (
                <button 
                  key={k} 
                  onClick={() => handleKey(k.toString())}
                  className={`h-14 rounded-2xl font-black text-xl shadow-sm active:scale-95 transition-all ${k === 'DEL' ? 'bg-red-100 text-red-600' : 'bg-white text-slate-900'}`}
                >
                    {k}
                </button>
            ))}
        </div>
    );
  };

  const totals = getTotals(activeOrder || { records: [] } as any);

  if (!activeOrder) {
    return (
      <div className="p-2 md:p-4 max-w-7xl mx-auto animate-fade-in">
        <div className="flex justify-between items-center mb-6 border-b border-slate-200 pb-4">
          <div className="text-left">
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Estación de Pesaje</h2>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">{mode}</p>
          </div>
          <button onClick={() => handleOpenClientModal()} className="bg-blue-950 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg flex items-center gap-2">
            <UserPlus size={16} /> Nuevo Cliente
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {orders.map(o => (
              <div key={o.id} onClick={() => setActiveOrder(o)} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl transition-all cursor-pointer group text-left">
                  <div className="flex justify-between items-start mb-4">
                      <div className="bg-blue-600 p-2 rounded-xl text-white"><User size={20}/></div>
                      <span className={`text-[8px] font-black px-2 py-1 rounded-lg uppercase ${o.status === 'CLOSED' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                          {o.status === 'CLOSED' ? 'Cerrado' : 'Operando'}
                      </span>
                  </div>
                  <h3 className="font-black text-slate-900 uppercase text-sm truncate">{o.clientName}</h3>
                  <div className="mt-4 flex justify-between items-end">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Avance: <span className="text-slate-900">{getTotals(o).qF} J.</span></div>
                      <ChevronRight className="text-blue-600 group-hover:translate-x-1 transition-transform" />
                  </div>
              </div>
          ))}
        </div>

        {showClientModal && (
          <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm animate-scale-up">
              <h3 className="text-xl font-black mb-6 text-slate-900 uppercase">Registro Cliente</h3>
              <div className="space-y-4 text-left">
                <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-4 font-bold outline-none focus:border-blue-600" value={newClientName} onChange={e => setNewClientName(e.target.value)} placeholder="Nombre del Cliente" />
                <input type="number" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-4 font-bold outline-none focus:border-blue-600" value={targetCrates} onChange={e => setTargetCrates(e.target.value)} placeholder="Meta de Jabas" />
              </div>
              <div className="mt-8 flex justify-end gap-3">
                <button onClick={() => setShowClientModal(false)} className="text-slate-400 font-black text-xs uppercase">Cerrar</button>
                <button onClick={handleSaveClient} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase shadow-lg">Guardar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const isLocked = activeOrder.status === 'CLOSED';

  return (
    <div className="flex flex-col h-full space-y-3 max-w-7xl mx-auto animate-fade-in">
      <div className="bg-blue-950 p-4 rounded-3xl shadow-xl text-white">
        <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4 w-full lg:w-auto">
            <button onClick={() => setActiveOrder(null)} className="p-3 bg-white/10 rounded-2xl hover:bg-white/20"><ArrowLeft size={20}/></button>
            <div className="text-left">
              <h2 className="text-xl font-black uppercase leading-none truncate max-w-[200px]">{activeOrder.clientName}</h2>
              <p className="text-blue-300 text-[8px] font-black uppercase tracking-widest mt-1">
                  {isSafari && <><Apple size={8} className="inline mr-1"/> Modo Optimizado Safari</>}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 flex-1 w-full text-center">
            <div className="bg-white/5 p-2 rounded-2xl border border-white/10">
              <p className="text-[7px] font-black text-blue-300 uppercase">Bruto</p>
              <p className="text-lg font-black font-digital">{totals.wF.toFixed(1)}</p>
            </div>
            <div className="bg-white/5 p-2 rounded-2xl border border-white/10">
              <p className="text-[7px] font-black text-blue-300 uppercase">Tara</p>
              <p className="text-lg font-black font-digital text-orange-400">{totals.wE.toFixed(1)}</p>
            </div>
            <div className="bg-white/5 p-2 rounded-2xl border border-white/10">
              <p className="text-[7px] font-black text-blue-300 uppercase">Jabas</p>
              <p className="text-lg font-black font-digital text-amber-400">{totals.qF}</p>
            </div>
            <div className="bg-emerald-600 p-2 rounded-2xl shadow-inner">
              <p className="text-[7px] font-black text-emerald-100 uppercase">Neto</p>
              <p className="text-lg font-black font-digital">{totals.net.toFixed(1)}</p>
            </div>
          </div>
          <div className="flex gap-2 w-full lg:w-auto">
            {!isLocked && <button onClick={() => setShowPaymentModal(true)} className="flex-1 lg:flex-none bg-emerald-600 px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg">Liquidar</button>}
          </div>
        </div>
      </div>

      {!isLocked && (
        <div className="bg-white p-4 rounded-3xl shadow-xl border border-slate-100">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex bg-slate-100 p-1.5 rounded-3xl gap-2 w-full md:w-auto border border-slate-200">
              <button onClick={() => setActiveTab('FULL')} className={`flex-1 md:w-20 h-16 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all ${activeTab === 'FULL' ? 'bg-blue-950 text-white shadow-xl scale-105' : 'text-slate-400'}`}>
                <Package size={20}/><span className="text-[8px] font-black uppercase">Bruto</span>
              </button>
              <button onClick={() => setActiveTab('EMPTY')} className={`flex-1 md:w-20 h-16 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all ${activeTab === 'EMPTY' ? 'bg-slate-500 text-white shadow-xl scale-105' : 'text-slate-400'}`}>
                <PackageOpen size={20}/><span className="text-[8px] font-black uppercase">Tara</span>
              </button>
              <button onClick={() => setActiveTab('MORTALITY')} className={`flex-1 md:w-20 h-16 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all ${activeTab === 'MORTALITY' ? 'bg-red-600 text-white shadow-xl scale-105' : 'text-slate-400'}`}>
                <Bird size={20}/><span className="text-[8px] font-black uppercase">Merma</span>
              </button>
            </div>
            
            <div className="flex-1 flex flex-col">
              <div className="flex gap-3 h-16">
                <div className="w-24 bg-slate-50 border-2 border-slate-100 rounded-2xl flex flex-col items-center justify-center">
                    <span className="text-[7px] font-black text-slate-400 uppercase">Cant.</span>
                    <input type="number" value={qtyInput} onChange={e => setQtyInput(e.target.value)} className="w-full text-center bg-transparent font-black text-xl outline-none" />
                </div>
                <div className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-2xl flex flex-col items-center justify-center focus-within:border-blue-600 focus-within:bg-white transition-all shadow-inner">
                    <span className="text-[7px] font-black text-slate-400 uppercase">Ingresar Peso (kg)</span>
                    <input 
                      ref={weightInputRef} 
                      type="number" 
                      value={weightInput} 
                      onChange={e => setWeightInput(e.target.value)} 
                      onKeyDown={e => e.key === 'Enter' && addWeight()} 
                      readOnly={isSafari && window.innerWidth < 768}
                      className="w-full text-center bg-transparent font-black text-4xl outline-none" 
                      placeholder="0.0" 
                    />
                </div>
                <button onClick={addWeight} className="w-20 md:w-32 bg-blue-900 text-white rounded-2xl shadow-xl hover:bg-blue-800 active:scale-95 transition-all flex items-center justify-center">
                    <Save size={24}/>
                </button>
              </div>
              {isSafari && <SafariNumpad />}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 overflow-hidden">
        {['FULL', 'EMPTY', 'MORTALITY'].map(type => (
          <div key={type} className="bg-white rounded-3xl border border-slate-200 flex flex-col overflow-hidden shadow-sm">
            <div className={`p-3 font-black text-[9px] text-center uppercase tracking-[0.2em] text-white ${type === 'FULL' ? 'bg-blue-950' : type === 'EMPTY' ? 'bg-slate-500' : 'bg-red-600'}`}>
              Detalle {type === 'FULL' ? 'Llenas' : type === 'EMPTY' ? 'Vacías' : 'Merma'}
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50/50">
              {activeOrder.records.filter(r => r.type === type).map(r => (
                <div key={r.id} className="flex justify-between items-center bg-white p-3 rounded-2xl border border-slate-100 shadow-sm text-left">
                  <div>
                    <span className="text-[7px] font-black text-slate-300 uppercase block">{new Date(r.timestamp).toLocaleTimeString()}</span>
                    <span className="font-digital font-black text-slate-800 text-lg">{r.weight.toFixed(2)}</span>
                    <span className="ml-2 text-[9px] font-bold text-slate-400 uppercase">x{r.quantity}</span>
                  </div>
                  {!isLocked && <button onClick={() => deleteRecord(r.id)} className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl"><Trash2 size={14}/></button>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {showPaymentModal && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[3rem] p-8 w-full max-w-md animate-scale-up shadow-2xl">
            <h3 className="text-2xl font-black mb-8 text-slate-900 uppercase text-left">Cierre de Cuenta</h3>
            <div className="space-y-6 text-left">
                <div className="bg-slate-50 p-6 rounded-3xl border-2 border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total a Liquidar</p>
                    <p className="text-4xl font-digital font-black text-slate-900">S/. {(totals.net * (parseFloat(pricePerKg.toString()) || 0)).toFixed(2)}</p>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Precio pactado x Kg</label>
                        <input type="number" value={pricePerKg} onChange={e => setPricePerKg(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-black text-xl outline-none" placeholder="0.00" autoFocus />
                    </div>
                </div>
            </div>
            <div className="mt-10 flex flex-col gap-3">
              <button onClick={handlePayment} className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-emerald-500 active:scale-95 transition-all">Confirmar e Imprimir</button>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 font-black text-[10px] uppercase py-2">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeighingStation;
