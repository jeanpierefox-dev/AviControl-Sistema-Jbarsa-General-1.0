
import React, { useState, useEffect, useRef, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { WeighingType, ClientOrder, WeighingRecord, UserRole } from '../../types';
import { getOrders, saveOrder, getConfig, deleteOrder } from '../../services/storage';
import { 
  ArrowLeft, Save, X, Eye, Package, PackageOpen, 
  User, Trash2, Box, UserPlus, Bird, Printer, Receipt, 
  Activity, Download, List, ChevronRight, Scale, FileText
} from 'lucide-react';
import { AuthContext } from '../../App';
import { generateTicketPDF, generateSummaryTicketPDF, generateA4ClientPDF, getOrderTotals } from '../../services/pdfHelper';

const WeighingStation: React.FC = () => {
  const { mode, batchId } = useParams<{ mode: string; batchId?: string }>();
  const navigate = useNavigate();
  const [config] = useState(getConfig());
  const { user } = useContext(AuthContext);

  const [activeOrder, setActiveOrder] = useState<ClientOrder | null>(null);
  const [orders, setOrders] = useState<ClientOrder[]>([]);
  const [showDetailModal, setShowDetailModal] = useState<ClientOrder | null>(null);
  
  const [showClientModal, setShowClientModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [newClientName, setNewClientName] = useState('');
  const [targetCrates, setTargetCrates] = useState<string>(''); 

  const [weightInput, setWeightInput] = useState('');
  const [qtyInput, setQtyInput] = useState('');
  const [activeTab, setActiveTab] = useState<'FULL' | 'EMPTY' | 'MORTALITY'>('FULL');
  const weightInputRef = useRef<HTMLInputElement>(null);

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
    const timeout = setTimeout(() => weightInputRef.current?.focus(), 200);
    return () => clearTimeout(timeout);
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

  const getTotals = (order: ClientOrder) => getOrderTotals(order);

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
    weightInputRef.current?.focus();
  };

  const deleteRecord = (id: string) => {
    if(!confirm('¿Eliminar registro?')) return;
    const updated = { ...activeOrder!, records: activeOrder!.records.filter(r => r.id !== id) };
    saveOrder(updated);
    setActiveOrder(updated);
  };

  const handlePayment = (ticketType: 'SUMMARY' | 'DETAILED' = 'SUMMARY') => {
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
    if (ticketType === 'SUMMARY') {
      generateSummaryTicketPDF(updatedOrder, config);
    } else {
      generateTicketPDF(updatedOrder, config);
    }
    setShowPaymentModal(false);
    loadOrders();
  };

  const totals = getTotals(activeOrder || { records: [] } as any);

  if (!activeOrder) {
    return (
      <div className="p-4 max-w-7xl mx-auto animate-fade-in text-left">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-slate-200 pb-6">
          <div>
            <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Estación de Pesaje</h2>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-1 flex items-center gap-2">
                <Activity size={12} className="text-blue-600"/> Modo: {mode}
            </p>
          </div>
          <button onClick={() => handleOpenClientModal()} className="bg-blue-950 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-blue-900 transition-all flex items-center gap-3 active:scale-95">
            <UserPlus size={18} /> Registrar Nuevo Cliente
          </button>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {orders.map(o => (
              <div key={o.id} className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-2xl hover:border-blue-400 transition-all group relative">
                  <div className="p-6 cursor-pointer" onClick={() => setActiveOrder(o)}>
                    <div className="flex justify-between items-start mb-6">
                        <div className="bg-blue-50 p-3 rounded-2xl text-blue-600 border border-blue-100 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-500">
                          <User size={24}/>
                        </div>
                        <span className={`text-[8px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest border ${o.status === 'CLOSED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                            {o.status === 'CLOSED' ? 'Cerrado' : 'Abierto'}
                        </span>
                    </div>
                    <h3 className="font-black text-slate-900 uppercase text-base truncate mb-1">{o.clientName}</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-6">ID: {o.id.slice(-6)}</p>
                    
                    <div className="pt-4 border-t border-slate-100 flex justify-between items-end">
                        <div>
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Carga Actual</p>
                          <p className="text-lg font-digital font-black text-slate-900">{getTotals(o).qF} Jabas</p>
                        </div>
                    </div>
                  </div>
                  
                  {/* Botón rápido para Ver Pesas */}
                  <div className="absolute bottom-6 right-6 flex gap-2">
                    <button 
                        onClick={(e) => { e.stopPropagation(); setShowDetailModal(o); }}
                        className="p-3 bg-slate-100 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all shadow-sm"
                        title="Ver Desglose de Pesas"
                    >
                        <Eye size={20} />
                    </button>
                    <div className="bg-blue-50 p-3 rounded-xl text-blue-600 group-hover:bg-blue-100 transition-colors">
                        <ChevronRight size={20} />
                    </div>
                  </div>
              </div>
          ))}
        </div>

        {/* Modal de Detalle Rápido (Compacto) */}
        {showDetailModal && (
            <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl flex items-center justify-center p-4 z-50 overflow-y-auto">
                <div className="bg-white rounded-[3rem] p-10 w-full max-w-4xl shadow-2xl border-8 border-white animate-scale-up my-auto">
                    <div className="flex justify-between items-start mb-8">
                        <div className="flex items-center gap-5">
                            <div className="bg-blue-900 p-4 rounded-2xl text-white shadow-lg">
                                <Eye size={28}/>
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Detalle Operativo</h3>
                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">{showDetailModal.clientName}</p>
                            </div>
                        </div>
                        <button onClick={() => setShowDetailModal(null)} className="p-3 bg-slate-100 text-slate-400 hover:text-slate-900 rounded-2xl transition-all">
                            <X size={24}/>
                        </button>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 mb-8">
                        <button onClick={() => generateSummaryTicketPDF(showDetailModal, config)} className="flex-1 bg-emerald-600 text-white px-5 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-700 shadow-xl transition-all" title="Ticket de Resumen sin pesas">
                            <Receipt size={18} /> Ticket Resumen (Sin Pesas)
                        </button>
                        <button onClick={() => generateTicketPDF(showDetailModal, config)} className="flex-1 bg-white text-slate-900 border-2 border-slate-100 px-5 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-50 transition-all">
                            <Printer size={18} /> Ticket Detallado
                        </button>
                        <button onClick={() => generateA4ClientPDF(showDetailModal, config)} className="flex-1 bg-blue-950 text-white px-5 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-900 shadow-xl transition-all">
                            <Download size={18} /> Reporte A4
                        </button>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-slate-50 rounded-[2rem] border border-slate-200 overflow-hidden flex flex-col shadow-inner">
                            <div className="p-3 font-black text-[10px] text-center uppercase tracking-widest text-white bg-blue-900">
                                Pesos Brutos Agrupados
                            </div>
                            <div className="p-6 flex flex-wrap gap-2 max-h-80 overflow-y-auto">
                                {showDetailModal.records.filter(r => r.type === 'FULL').map((r, i) => (
                                    <div key={r.id} className="min-w-[65px] bg-white border border-slate-100 rounded-xl p-2.5 text-center shadow-sm">
                                        <p className="text-[8px] font-black text-slate-300 mb-1 leading-none">#{showDetailModal.records.filter(rt => rt.type === 'FULL').length - i}</p>
                                        <p className="font-digital font-black text-slate-900 text-sm leading-none">{r.weight.toFixed(1)}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {['EMPTY', 'MORTALITY'].map(type => (
                                <div key={type} className="bg-slate-50 rounded-[2rem] border border-slate-200 overflow-hidden h-48 flex flex-col shadow-inner">
                                    <div className={`p-3 font-black text-[10px] text-center uppercase tracking-widest text-white ${type === 'EMPTY' ? 'bg-slate-600' : 'bg-red-600'}`}>
                                        {type === 'EMPTY' ? 'Taras' : 'Mermas'}
                                    </div>
                                    <div className="p-4 flex flex-wrap gap-1.5 overflow-y-auto">
                                        {showDetailModal.records.filter(r => r.type === type).map(r => (
                                            <div key={r.id} className="bg-white border border-slate-100 rounded-lg px-2 py-1 shadow-sm">
                                                <p className="font-digital font-black text-slate-700 text-xs">{r.weight.toFixed(1)}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {showClientModal && (
          <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-[3rem] p-10 w-full max-w-sm animate-scale-up border-8 border-white shadow-2xl">
              <div className="bg-blue-100 w-16 h-16 rounded-2xl flex items-center justify-center text-blue-600 mx-auto mb-6">
                <UserPlus size={28}/>
              </div>
              <h3 className="text-2xl font-black mb-8 text-slate-900 uppercase text-center tracking-tighter">Nuevo Registro</h3>
              <div className="space-y-5">
                <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold text-sm outline-none focus:border-blue-600 focus:bg-white transition-all" value={newClientName} onChange={e => setNewClientName(e.target.value)} placeholder="Nombre del Cliente" />
                <input type="number" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold text-sm outline-none focus:border-blue-600 focus:bg-white transition-all" value={targetCrates} onChange={e => setTargetCrates(e.target.value)} placeholder="Meta de Jabas" />
              </div>
              <div className="mt-10 flex flex-col gap-2">
                <button onClick={handleSaveClient} className="w-full bg-blue-900 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all">Iniciar Pesaje</button>
                <button onClick={() => setShowClientModal(false)} className="w-full py-4 text-slate-400 font-black text-[10px] uppercase hover:text-slate-600 transition-colors">Cancelar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const isLocked = activeOrder.status === 'CLOSED';

  return (
    <div className="flex flex-col h-full space-y-4 max-w-7xl mx-auto animate-fade-in text-left pb-10">
      {/* Header HUD - Rediseñado para mostrar Ojo y Liquidar debajo de totales */}
      <div className="bg-blue-950 p-6 rounded-[2.5rem] shadow-2xl text-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
            <Activity size={300} className="scale-150 transform -translate-x-1/4 -translate-y-1/4" />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-5 mb-6">
            <button onClick={() => setActiveOrder(null)} className="p-4 bg-white/10 rounded-[1.5rem] hover:bg-white/20 transition-all border border-white/10">
                <ArrowLeft size={24}/>
            </button>
            <div className="flex-1">
              <h2 className="text-3xl font-black uppercase leading-none truncate tracking-tighter">{activeOrder.clientName}</h2>
              <div className="flex items-center gap-2 mt-2">
                <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${isLocked ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
                <p className="text-blue-300 text-[11px] font-black uppercase tracking-[0.2em]">{isLocked ? 'CONTROL CERRADO' : 'SISTEMA DE PESAJE ACTIVO'}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="bg-white/5 p-4 rounded-3xl border border-white/10 backdrop-blur-sm">
              <p className="text-[9px] font-black text-blue-300 uppercase tracking-widest mb-1">Bruto (Llenas)</p>
              <p className="text-3xl font-black font-digital">{totals.wF.toFixed(1)}</p>
            </div>
            <div className="bg-white/5 p-4 rounded-3xl border border-white/10 backdrop-blur-sm">
              <p className="text-[9px] font-black text-blue-300 uppercase tracking-widest mb-1">Tara (Vacías)</p>
              <p className="text-3xl font-black font-digital text-orange-400">-{totals.wE.toFixed(1)}</p>
            </div>
            <div className="bg-white/5 p-4 rounded-3xl border border-white/10 backdrop-blur-sm">
              <p className="text-[9px] font-black text-blue-300 uppercase tracking-widest mb-1">Jabas Totales</p>
              <p className="text-3xl font-black font-digital text-amber-400">{totals.qF}</p>
            </div>
            <div className="bg-emerald-600 p-4 rounded-3xl shadow-xl shadow-emerald-950/20">
              <p className="text-[9px] font-black text-emerald-100 uppercase tracking-widest mb-1">Peso Neto</p>
              <p className="text-3xl font-black font-digital">{totals.net.toFixed(1)} <span className="text-xs">KG</span></p>
            </div>
          </div>

          {/* Botones de acción debajo de los totales */}
          <div className="flex flex-wrap gap-3 mt-6 w-full">
            <button 
                onClick={() => setShowDetailModal(activeOrder)}
                className="flex-1 min-w-[140px] bg-white/10 text-white p-4 rounded-2xl hover:bg-white/20 transition-all border border-white/10 flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest active:scale-95"
            >
                <Eye size={20}/> Ver Desglose
            </button>
            <button 
                onClick={() => generateSummaryTicketPDF(activeOrder, config)}
                className="flex-1 min-w-[160px] bg-emerald-500 text-white p-4 rounded-2xl hover:bg-emerald-400 transition-all font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg active:scale-95"
                title="Ticket Resumen de Carga (Sin Pesas)"
            >
                <Receipt size={20}/> Ticket Resumen
            </button>
            {!isLocked && (
                <button 
                  onClick={() => setShowPaymentModal(true)} 
                  className="flex-1 min-w-[160px] bg-white text-blue-950 p-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-blue-50 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                    <Printer size={20} /> Liquidar Operación
                </button>
            )}
            {isLocked && (
               <button 
                  onClick={() => generateTicketPDF(activeOrder, config)}
                  className="flex-1 min-w-[160px] bg-blue-900 text-white p-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-blue-800 active:scale-95 transition-all flex items-center justify-center gap-2"
               >
                  <Printer size={20} /> Ticket Detallado
               </button>
            )}
          </div>
        </div>
      </div>

      {!isLocked && (
        <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-100">
          <div className="flex flex-col md:flex-row gap-6 items-center">
            <div className="flex bg-slate-100 p-2 rounded-[2rem] gap-2 w-full md:w-auto border border-slate-200">
              <button onClick={() => setActiveTab('FULL')} className={`flex-1 md:w-28 h-20 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all ${activeTab === 'FULL' ? 'bg-blue-900 text-white shadow-xl' : 'text-slate-400'}`}>
                <Package size={24}/><span className="text-[9px] font-black uppercase">Llenas</span>
              </button>
              <button onClick={() => setActiveTab('EMPTY')} className={`flex-1 md:w-28 h-20 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all ${activeTab === 'EMPTY' ? 'bg-slate-600 text-white shadow-xl' : 'text-slate-400'}`}>
                <PackageOpen size={24}/><span className="text-[9px] font-black uppercase">Vacías</span>
              </button>
              <button onClick={() => setActiveTab('MORTALITY')} className={`flex-1 md:w-28 h-20 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all ${activeTab === 'MORTALITY' ? 'bg-red-600 text-white shadow-xl' : 'text-slate-400'}`}>
                <Bird size={24}/><span className="text-[9px] font-black uppercase">Merma</span>
              </button>
            </div>
            <div className="flex-1 flex gap-4 h-20 w-full">
              <div className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] flex flex-col items-center justify-center shadow-inner">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">PESO CAPTURADO (KG)</span>
                  <input 
                    ref={weightInputRef} 
                    type="number" 
                    value={weightInput} 
                    onChange={e => setWeightInput(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && addWeight()} 
                    className="w-full text-center bg-transparent font-black text-4xl outline-none" 
                    placeholder="0.00" 
                    step="0.01"
                  />
              </div>
              <button onClick={addWeight} className="w-24 md:w-40 bg-blue-950 text-white rounded-[1.5rem] shadow-xl hover:bg-blue-900 transition-all flex items-center justify-center border-b-4 border-blue-800 active:scale-95">
                  <Save size={32}/>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-[400px]">
        {['FULL', 'EMPTY', 'MORTALITY'].map(type => (
          <div key={type} className="bg-white rounded-[2.5rem] border border-slate-200 flex flex-col overflow-hidden shadow-sm">
            <div className={`p-4 font-black text-[10px] text-center uppercase tracking-[0.2em] text-white flex items-center justify-center gap-2 ${type === 'FULL' ? 'bg-blue-950' : type === 'EMPTY' ? 'bg-slate-600' : 'bg-red-600'}`}>
              {type === 'FULL' ? 'Lista Brutos' : type === 'EMPTY' ? 'Lista Tara' : 'Lista Merma'}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
              {activeOrder.records.filter(r => r.type === type).map((r, idx) => (
                <div key={r.id} className="flex justify-between items-center bg-white p-5 rounded-2xl border border-slate-100 shadow-sm transition-all group hover:border-blue-200">
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] font-black text-slate-300">#{activeOrder.records.filter(rt => rt.type === type).length - idx}</span>
                    <p className="font-digital font-black text-slate-800 text-xl">{r.weight.toFixed(2)}</p>
                  </div>
                  {!isLocked && <button onClick={() => deleteRecord(r.id)} className="p-2 text-slate-300 hover:text-red-600 transition-all"><Trash2 size={16}/></button>}
                </div>
              ))}
              {activeOrder.records.filter(r => r.type === type).length === 0 && (
                 <div className="py-10 text-center text-slate-200 font-black uppercase text-[8px] tracking-widest opacity-50">Sin registros</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {showPaymentModal && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[4rem] p-10 w-full max-w-md animate-scale-up shadow-2xl border-8 border-white">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                <Receipt size={36}/>
            </div>
            <h3 className="text-3xl font-black mb-2 text-slate-900 uppercase text-center tracking-tighter">Liquidar Carga</h3>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] text-center mb-10">Generación de Ticket Final</p>
            
            <div className="space-y-6">
                <div className="bg-slate-50 p-8 rounded-[3rem] border-2 border-slate-100 shadow-inner text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Monto Estimado</p>
                    <p className="text-4xl font-digital font-black text-slate-950">S/. {(totals.net * (parseFloat(pricePerKg.toString()) || 0)).toFixed(2)}</p>
                    <p className="text-[9px] text-emerald-600 font-bold uppercase mt-2">{totals.net.toFixed(2)} KG TOTALES</p>
                </div>
                <div>
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-2">Precio por Kilogramo (S/.)</label>
                    <input type="number" value={pricePerKg} onChange={e => setPricePerKg(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-5 font-black text-2xl outline-none focus:border-emerald-500 focus:bg-white transition-all text-center" placeholder="0.00" step="0.01" autoFocus />
                </div>
            </div>
            <div className="mt-8 flex flex-col gap-3">
              <button onClick={() => handlePayment('SUMMARY')} className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-200 hover:bg-emerald-500 active:scale-95 transition-all flex items-center justify-center gap-2">
                <Receipt size={18}/> Liquidar con Ticket Resumen
              </button>
              <button onClick={() => handlePayment('DETAILED')} className="w-full bg-blue-950 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-900 active:scale-95 transition-all flex items-center justify-center gap-2">
                <Printer size={18}/> Liquidar con Ticket Detallado
              </button>
              <button onClick={() => setShowPaymentModal(false)} className="w-full py-3 text-slate-400 font-black text-[11px] uppercase tracking-widest hover:text-slate-600 transition-colors">Volver</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeighingStation;
