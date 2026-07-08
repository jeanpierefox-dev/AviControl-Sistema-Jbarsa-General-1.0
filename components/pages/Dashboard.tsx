
import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Calculator, Users, FileText, Settings, ArrowRight, Bird, Box, TrendingUp, ShieldCheck, Activity } from 'lucide-react';
import { AuthContext } from '../../App';
import { UserRole, WeighingType } from '../../types';
import { getConfig, getOrders, getBatches } from '../../services/storage';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const config = getConfig();
  const [stats, setStats] = useState({ activeBatches: 0, totalOrders: 0, todayWeight: 0 });

  useEffect(() => {
    const calculateStats = () => {
        const batches = getBatches().filter(b => b.status === 'ACTIVE');
        const orders = getOrders();
        const today = new Date().toDateString();
        const todayWeight = orders.reduce((acc, order) => {
            const isToday = new Date(order.id ? parseInt(order.id) : Date.now()).toDateString() === today;
            if (!isToday) return acc;
            return acc + order.records.filter(r => r.type === 'FULL').reduce((sum, r) => sum + r.weight, 0);
        }, 0);

        setStats({
            activeBatches: batches.length,
            totalOrders: orders.length,
            todayWeight: todayWeight
        });
    };
    
    calculateStats();
    window.addEventListener('avi_data_batches', calculateStats);
    window.addEventListener('avi_data_orders', calculateStats);
    return () => {
        window.removeEventListener('avi_data_batches', calculateStats);
        window.removeEventListener('avi_data_orders', calculateStats);
    };
  }, []);

  const MenuCard = ({ title, desc, icon, onClick, color, roles, compact = false, mode }: any) => {
    if (!roles.includes(user?.role)) return null;
    if (mode && user?.role !== UserRole.ADMIN) {
        const allowed = user?.allowedModes || [];
        if (!allowed.includes(mode)) return null;
    }

    return (
      <button
        onClick={onClick}
        className={`relative overflow-hidden bg-white rounded-[2rem] shadow-sm border border-slate-200 hover:shadow-2xl hover:border-blue-400 transition-all duration-300 text-left group ${compact ? 'p-5' : 'p-7'}`}
      >
        <div className={`absolute top-0 right-0 w-32 h-32 transform translate-x-12 -translate-y-12 rounded-full opacity-[0.03] ${color}`}></div>
        <div className="relative z-10 flex items-start space-x-5">
          <div className={`p-4 rounded-2xl flex items-center justify-center ${color} text-white shadow-lg group-hover:scale-110 transition-transform duration-500`}>
            {icon}
          </div>
          <div className="flex-1">
            <h3 className={`font-black text-slate-900 uppercase tracking-tighter ${compact ? 'text-xs' : 'text-lg'}`}>{title}</h3>
            {!compact && <p className="text-xs text-slate-500 mt-2 mb-4 leading-relaxed font-medium line-clamp-2">{desc}</p>}
            <div className={`flex items-center font-black text-[9px] uppercase tracking-widest mt-1 ${color.replace('bg-', 'text-')} group-hover:translate-x-1 transition-transform`}>
              Iniciar Módulo <ArrowRight size={14} className="ml-1" />
            </div>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      {/* Header Premium */}
      <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-[0.02] pointer-events-none">
            <Activity size={200} />
        </div>
        
        <div className="flex items-center space-x-6 relative z-10">
            <div className="p-1.5 bg-gradient-to-br from-blue-900 to-indigo-900 rounded-[2rem] shadow-xl">
                {config.logoUrl ? (
                    <img src={config.logoUrl} alt="Logo" className="h-24 w-24 object-contain rounded-[1.8rem] bg-white p-2" />
                ) : (
                    <div className="h-24 w-24 rounded-[1.8rem] flex items-center justify-center text-white font-black text-3xl">AV</div>
                )}
            </div>
            <div className="text-left">
                <div className="flex items-center gap-2 mb-1">
                    <ShieldCheck size={16} className="text-blue-600"/>
                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Sesión Protegida</span>
                </div>
                <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter leading-none">Hola, {user?.name.split(' ')[0]}</h2>
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-2">Sistema de Gestión Barsa v1.2</p>
            </div>
        </div>

        <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
            <div className="bg-slate-50 px-6 py-4 rounded-3xl border border-slate-100 shadow-inner text-center">
                <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest mb-1">Peso Hoy</p>
                <p className="font-digital font-black text-2xl text-blue-900">{stats.todayWeight.toFixed(1)} <span className="text-xs">KG</span></p>
            </div>
            <div className="bg-slate-50 px-6 py-4 rounded-3xl border border-slate-100 shadow-inner text-center">
                <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest mb-1">Lotes Activos</p>
                <p className="font-digital font-black text-2xl text-slate-800">{stats.activeBatches}</p>
            </div>
        </div>
      </div>

      {/* Operaciones */}
      <div>
        <div className="flex items-center justify-between mb-6 px-2">
            <div className="flex items-center gap-3">
                <div className="h-6 w-1.5 bg-blue-600 rounded-full"></div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Operaciones de Pesaje</h3>
            </div>
            <div className="flex items-center gap-2 text-[9px] font-black text-emerald-600 uppercase">
                <TrendingUp size={14}/> Tiempo Real
            </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MenuCard
              title="Pesaje por Lote"
              desc="Control detallado de campañas con tara de jabas y mermas por mortalidad."
              icon={<Package size={26} />}
              onClick={() => navigate('/lotes')}
              color="bg-blue-900"
              roles={[UserRole.ADMIN, UserRole.GENERAL, UserRole.OPERATOR]}
              mode={WeighingType.BATCH}
            />
            <MenuCard
              title="Módulo Solo Pollo"
              desc="Interfaz rápida para ventas directas. Ideal para despachos menores sin lote."
              icon={<Bird size={26} />}
              onClick={() => navigate(`/weigh/${WeighingType.SOLO_POLLO}`)}
              color="bg-amber-500"
              roles={[UserRole.ADMIN, UserRole.GENERAL, UserRole.OPERATOR]}
              mode={WeighingType.SOLO_POLLO}
            />
            <MenuCard
              title="Control de Jabas"
              desc="Despacho por unidades. Calcula el peso estimado basado en promedios."
              icon={<Box size={26} />}
              onClick={() => navigate(`/weigh/${WeighingType.SOLO_JABAS}`)}
              color="bg-emerald-600"
              roles={[UserRole.ADMIN, UserRole.GENERAL, UserRole.OPERATOR]}
              mode={WeighingType.SOLO_JABAS}
            />
        </div>
      </div>

      {/* Administración */}
      <div>
        <div className="flex items-center gap-3 mb-6 px-2">
            <div className="h-6 w-1.5 bg-slate-400 rounded-full"></div>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Administración Central</h3>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            <MenuCard
              title="Cobranza"
              icon={<Calculator size={22} />}
              onClick={() => navigate('/cobranza')}
              color="bg-indigo-600"
              roles={[UserRole.ADMIN, UserRole.GENERAL, UserRole.OPERATOR]}
              compact
            />
            <MenuCard
              title="Reportes"
              icon={<FileText size={22} />}
              onClick={() => navigate('/reportes')}
              color="bg-violet-600"
              roles={[UserRole.ADMIN, UserRole.GENERAL, UserRole.OPERATOR]}
              compact
            />
            <MenuCard
              title="Usuarios"
              icon={<Users size={22} />}
              onClick={() => navigate('/usuarios')}
              color="bg-rose-500"
              roles={[UserRole.ADMIN, UserRole.GENERAL]}
              compact
            />
            <MenuCard
              title="Ajustes"
              icon={<Settings size={22} />}
              onClick={() => navigate('/config')}
              color="bg-slate-800"
              roles={[UserRole.ADMIN]}
              compact
            />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
