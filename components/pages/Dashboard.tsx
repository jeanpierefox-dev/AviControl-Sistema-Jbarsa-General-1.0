
import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Calculator, Users, FileText, Settings, ArrowRight, Bird, Box } from 'lucide-react';
import { AuthContext } from '../../App';
import { UserRole, WeighingType } from '../../types';
import { getConfig } from '../../services/storage';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const config = getConfig();
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const handleDataUpdate = () => setRefreshKey(prev => prev + 1);
    window.addEventListener('avi_data_batches', handleDataUpdate);
    window.addEventListener('avi_data_orders', handleDataUpdate);
    window.addEventListener('avi_data_users', handleDataUpdate);
    return () => {
        window.removeEventListener('avi_data_batches', handleDataUpdate);
        window.removeEventListener('avi_data_orders', handleDataUpdate);
        window.removeEventListener('avi_data_users', handleDataUpdate);
    };
  }, []);

  const MenuCard = ({ title, desc, icon, onClick, color, roles, compact = false, mode }: any) => {
    // 1. Verificar rol general
    if (!roles.includes(user?.role)) return null;
    
    // 2. Verificar permisos específicos de pesaje
    // El administrador siempre ve todo. Otros roles dependen de allowedModes.
    if (mode && user?.role !== UserRole.ADMIN) {
        const allowed = user?.allowedModes || [];
        if (!allowed.includes(mode)) return null;
    }

    return (
      <button
        onClick={onClick}
        className={`relative overflow-hidden bg-white rounded-2xl shadow-sm border border-slate-200 hover:shadow-xl hover:border-blue-400 transition-all duration-300 text-left group ${compact ? 'p-4' : 'p-6'}`}
      >
        <div className={`absolute top-0 right-0 w-24 h-24 transform translate-x-8 -translate-y-8 rounded-full opacity-5 ${color}`}></div>
        <div className="relative z-10 flex items-start space-x-4">
          <div className={`p-4 rounded-xl flex items-center justify-center ${color} text-white shadow-lg group-hover:scale-110 transition-transform`}>
            {icon}
          </div>
          <div className="flex-1">
            <h3 className={`font-black text-slate-900 uppercase tracking-tighter ${compact ? 'text-sm' : 'text-lg'}`}>{title}</h3>
            {!compact && <p className="text-xs text-slate-500 mt-1 mb-3 leading-snug font-medium">{desc}</p>}
            <div className={`flex items-center font-black text-[10px] uppercase tracking-widest mt-2 ${color.replace('bg-', 'text-')} group-hover:translate-x-1 transition-transform`}>
              Acceder <ArrowRight size={14} className="ml-1" />
            </div>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-10 animate-fade-in">
      {/* Header */}
      <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center space-x-6">
            <div className="p-1 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
                {config.logoUrl ? (
                    <img src={config.logoUrl} alt="Logo" className="h-20 w-20 object-contain rounded-xl" />
                ) : (
                    <div className="h-20 w-20 bg-blue-900 rounded-xl flex items-center justify-center text-white font-black text-2xl">AV</div>
                )}
            </div>
            <div className="text-left">
                <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">Hola, {user?.name.split(' ')[0]}</h2>
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-2">Panel de Control Corporativo</p>
            </div>
        </div>
        <div className="text-right bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100 shadow-inner">
            <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em]">Fecha de Operación</p>
            <p className="font-digital font-black text-xl text-slate-800">{new Date().toLocaleDateString()}</p>
        </div>
      </div>

      {/* Operaciones Principales */}
      <div>
        <div className="flex items-center gap-3 mb-6">
            <div className="h-8 w-1.5 bg-blue-600 rounded-full"></div>
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.3em]">Módulos de Pesaje en Campo</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MenuCard
              title="Pesaje por Lote"
              desc="Control integral de campañas, clientes, tara y merma por lote específico."
              icon={<Package size={24} />}
              onClick={() => navigate('/lotes')}
              color="bg-blue-600"
              roles={[UserRole.ADMIN, UserRole.GENERAL, UserRole.OPERATOR]}
              mode={WeighingType.BATCH}
            />
            <MenuCard
              title="Venta Solo Pollo"
              desc="Módulo de pesaje rápido para ventas directas sin gestión de inventario de lote."
              icon={<Bird size={24} />}
              onClick={() => navigate(`/weigh/${WeighingType.SOLO_POLLO}`)}
              color="bg-amber-500"
              roles={[UserRole.ADMIN, UserRole.GENERAL, UserRole.OPERATOR]}
              mode={WeighingType.SOLO_POLLO}
            />
            <MenuCard
              title="Venta Solo Jabas"
              desc="Despacho por unidades de jaba con cálculo automático de peso estimado."
              icon={<Box size={24} />}
              onClick={() => navigate(`/weigh/${WeighingType.SOLO_JABAS}`)}
              color="bg-emerald-600"
              roles={[UserRole.ADMIN, UserRole.GENERAL, UserRole.OPERATOR]}
              mode={WeighingType.SOLO_JABAS}
            />
        </div>
      </div>

      {/* Administración */}
      <div>
        <div className="flex items-center gap-3 mb-6">
            <div className="h-8 w-1.5 bg-slate-400 rounded-full"></div>
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.3em]">Gestión y Administración</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MenuCard
              title="Cobranza"
              icon={<Calculator size={20} />}
              onClick={() => navigate('/cobranza')}
              color="bg-indigo-600"
              roles={[UserRole.ADMIN, UserRole.GENERAL]}
              compact
            />
            <MenuCard
              title="Reportes"
              icon={<FileText size={20} />}
              onClick={() => navigate('/reportes')}
              color="bg-purple-600"
              roles={[UserRole.ADMIN, UserRole.GENERAL]}
              compact
            />
            <MenuCard
              title="Usuarios"
              icon={<Users size={20} />}
              onClick={() => navigate('/usuarios')}
              color="bg-pink-600"
              roles={[UserRole.ADMIN, UserRole.GENERAL]}
              compact
            />
            <MenuCard
              title="Ajustes"
              icon={<Settings size={20} />}
              onClick={() => navigate('/config')}
              color="bg-slate-700"
              roles={[UserRole.ADMIN]}
              compact
            />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
