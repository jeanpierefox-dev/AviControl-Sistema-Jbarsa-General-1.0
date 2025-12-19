
import React, { useState, useContext, useEffect, useRef } from 'react';
import { AppConfig, UserRole } from '../../types';
import { getConfig, saveConfig, resetApp, isFirebaseConfigured, validateConfig, uploadLocalToCloud } from '../../services/storage';
import { 
  Save, Check, AlertTriangle, Cloud, Settings, Building2, 
  Printer, Scale, ShieldAlert, Loader2, X, Wifi, Bluetooth, 
  RefreshCw, Database, Key, Search, Cpu, Smartphone, Link, 
  Upload, Image as ImageIcon, Activity, HardDrive, Info, CheckCircle,
  Globe, Code, Zap, Flame, Trash2, Layout, Settings2, ShieldCheck,
  ServerCrash
} from 'lucide-react';
import { AuthContext } from '../../App';

const Configuration: React.FC = () => {
  const [config, setConfig] = useState<AppConfig>(getConfig());
  const [saved, setSaved] = useState(false);
  const { user } = useContext(AuthContext);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [testError, setTestError] = useState('');
  const [isTested, setIsTested] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);
  
  const [browserSupport, setBrowserSupport] = useState({ serial: false, bluetooth: false });
  
  const [connectMode, setConnectMode] = useState<'SMART' | 'MANUAL'>('MANUAL');
  const [smartInput, setSmartInput] = useState('');
  const [manualForm, setManualForm] = useState({
      apiKey: '', 
      projectId: '', 
      authDomain: '', 
      databaseURL: '', 
      appId: '', 
      storageBucket: '', 
      messagingSenderId: ''
  });

  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      setIsConnected(isFirebaseConfigured());
      setBrowserSupport({
          serial: 'serial' in navigator,
          bluetooth: 'bluetooth' in navigator
      });

      if (config.firebaseConfig) {
          setManualForm({
              apiKey: config.firebaseConfig.apiKey || '',
              projectId: config.firebaseConfig.projectId || '',
              authDomain: config.firebaseConfig.authDomain || '',
              databaseURL: config.firebaseConfig.databaseURL || '',
              appId: config.firebaseConfig.appId || '',
              storageBucket: config.firebaseConfig.storageBucket || '',
              messagingSenderId: config.firebaseConfig.messagingSenderId || ''
          });
          setSmartInput(JSON.stringify(config.firebaseConfig, null, 2));
      }
  }, [config]);

  const handleSave = () => {
    saveConfig(config);
    setSaved(true);
    setIsConnected(isFirebaseConfigured());
    window.dispatchEvent(new Event('avi_data_config'));
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTestConnection = async () => {
      setTestError('');
      setTestSuccess(false);
      setIsTested(false);
      setIsConnecting(true);
      try {
          const firebaseConfig = connectMode === 'SMART' ? JSON.parse(smartInput) : manualForm;
          const res = await validateConfig(firebaseConfig);
          
          if (!res.valid) {
              setTestError(res.error || "Error de conexión: Verifica los parámetros.");
          } else {
              setTestSuccess(true);
              setIsTested(true);
          }
      } catch (e) {
          setTestError("Formato de datos inválido. Asegúrate de ingresar un JSON válido o completar los campos.");
      } finally {
          setIsConnecting(false);
      }
  };

  const handleLinkCloud = () => {
      if (!isTested) return;
      const firebaseConfig = connectMode === 'SMART' ? JSON.parse(smartInput) : manualForm;
      saveConfig({ ...config, firebaseConfig });
      setIsConnected(true);
      alert("✅ Servidor vinculado correctamente. El sistema ahora está sincronizado.");
      window.location.reload();
  };

  const handleUploadData = async () => {
      if (!isConnected) return;
      setIsUploading(true);
      try {
          await uploadLocalToCloud();
          alert("✅ Sincronización Exitosa. Todos los datos locales se han subido a la nube.");
      } catch (e: any) {
          alert("❌ Error de Subida: " + e.message);
      } finally {
          setIsUploading(false);
      }
  };

  const handleDisconnect = () => {
      if(confirm('¿Desvincular servidor cloud? Los datos permanecerán en local pero dejarán de sincronizarse.')) {
          saveConfig({...config, firebaseConfig: undefined});
          setIsConnected(false);
          window.location.reload();
      }
  };

  const startNativeConnect = async (type: 'PRINTER' | 'SCALE_BT') => {
      try {
          if (!browserSupport.bluetooth) throw new Error("Bluetooth no soportado por este navegador.");
          const device = await (navigator as any).bluetooth.requestDevice({
              acceptAllDevices: true,
              optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb'] 
          });
          if (device) {
              if (type === 'PRINTER') setConfig(prev => ({ ...prev, printerConnected: true }));
              else setConfig(prev => ({ ...prev, scaleConnected: true }));
              alert(`✅ ${type === 'PRINTER' ? 'Impresora' : 'Balanza'} vinculada con éxito.`);
          }
      } catch (error: any) {
          if (error.name === 'NotFoundError' || error.name === 'AbortError') return;
          alert(`Error de Conexión: ${error.message}`);
      }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setConfig({ ...config, logoUrl: reader.result as string });
          };
          reader.readAsDataURL(file);
      }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      {/* 1. IDENTIDAD Y NOMBRE GENERAL */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 text-left">
              <div className="flex-1 w-full space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="bg-blue-900 p-3 rounded-2xl text-white shadow-lg">
                        <Layout size={24} fill="currentColor" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Identidad del Sistema</h2>
                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Personalización Global</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-1">Nombre de la Empresa / Aplicación</label>
                        <input 
                            value={config.companyName} 
                            onChange={e => setConfig({...config, companyName: e.target.value})} 
                            className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-slate-900 outline-none focus:border-blue-500 transition-all shadow-inner" 
                            placeholder="Ej. AviControl Pro"
                        />
                      </div>
                      <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-start gap-3">
                          <Info size={16} className="text-blue-600 mt-1 shrink-0"/>
                          <p className="text-[10px] text-blue-800 font-bold uppercase leading-relaxed">
                              Este nombre aparecerá en tickets, reportes y el encabezado principal del software.
                          </p>
                      </div>
                      <button 
                        onClick={handleSave} 
                        className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center transition-all shadow-md active:scale-[0.98] ${saved ? 'bg-emerald-600 text-white' : 'bg-blue-950 text-white hover:bg-blue-900'}`}
                      >
                        {saved ? <Check size={18} className="mr-2 animate-bounce"/> : <Save size={18} className="mr-2" />}
                        {saved ? 'Configuración Guardada' : 'Actualizar Nombre y Logo'}
                      </button>
                  </div>
              </div>

              <div className="w-full md:w-64">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block text-center">Logotipo</label>
                  <div 
                    className="p-4 border-2 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center gap-3 bg-slate-50/50 hover:bg-slate-50 hover:border-blue-200 transition-all cursor-pointer aspect-square relative shadow-inner" 
                    onClick={() => logoInputRef.current?.click()}
                  >
                      {config.logoUrl ? (
                          <div className="relative group w-full h-full flex items-center justify-center">
                              <img src={config.logoUrl} className="max-h-full max-w-full object-contain rounded-xl transition-transform group-hover:scale-105" alt="Logo preview"/>
                              <button 
                                onClick={(e) => { e.stopPropagation(); setConfig({...config, logoUrl: ''}); }} 
                                className="absolute -top-2 -right-2 bg-red-500 text-white p-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                              >
                                  <X size={14}/>
                              </button>
                          </div>
                      ) : (
                          <div className="flex flex-col items-center text-slate-300">
                              <ImageIcon size={48} className="mb-2 opacity-40"/>
                              <span className="text-[10px] font-black uppercase text-blue-600">Click para Subir</span>
                          </div>
                      )}
                      <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={handleLogoChange} />
                  </div>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          
          {/* 2. CONFIGURACIÓN DE SERVIDOR CLOUD (REDISEÑADA) */}
          <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm text-left flex flex-col">
              <div className="flex items-center gap-3 mb-8">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                      <Settings2 size={22}/>
                  </div>
                  <div>
                      <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Parámetros de Servidor</h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Enlace a Base de Datos</p>
                  </div>
              </div>

              {!isConnected ? (
                  <div className="space-y-6">
                      <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                          <button onClick={() => { setConnectMode('MANUAL'); setIsTested(false); }} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${connectMode === 'MANUAL' ? 'bg-white text-blue-900 shadow-sm' : 'text-slate-400'}`}>Ingreso Manual</button>
                          <button onClick={() => { setConnectMode('SMART'); setIsTested(false); }} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${connectMode === 'SMART' ? 'bg-white text-blue-900 shadow-sm' : 'text-slate-400'}`}>Importar JSON</button>
                      </div>

                      {connectMode === 'MANUAL' ? (
                          <div className="grid grid-cols-1 gap-3">
                              <div className="relative">
                                <Database className="absolute left-4 top-4 text-slate-300" size={16}/>
                                <input value={manualForm.projectId} onChange={e => { setManualForm({...manualForm, projectId: e.target.value}); setIsTested(false); }} className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-[11px] focus:border-blue-500 outline-none transition-all shadow-inner" placeholder="Project ID" />
                              </div>
                              <div className="relative">
                                <Key className="absolute left-4 top-4 text-slate-300" size={16}/>
                                <input value={manualForm.apiKey} onChange={e => { setManualForm({...manualForm, apiKey: e.target.value}); setIsTested(false); }} className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-[11px] focus:border-blue-500 outline-none transition-all shadow-inner" placeholder="API Key" />
                              </div>
                              <div className="relative">
                                <Globe className="absolute left-4 top-4 text-slate-300" size={16}/>
                                <input value={manualForm.authDomain} onChange={e => { setManualForm({...manualForm, authDomain: e.target.value}); setIsTested(false); }} className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-[11px] focus:border-blue-500 outline-none transition-all shadow-inner" placeholder="Auth Domain" />
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                  <input value={manualForm.databaseURL} onChange={e => { setManualForm({...manualForm, databaseURL: e.target.value}); setIsTested(false); }} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-[10px] focus:border-blue-500 outline-none transition-all shadow-inner" placeholder="DB URL" />
                                  <input value={manualForm.appId} onChange={e => { setManualForm({...manualForm, appId: e.target.value}); setIsTested(false); }} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-[10px] focus:border-blue-500 outline-none transition-all shadow-inner" placeholder="App ID" />
                              </div>
                          </div>
                      ) : (
                          <div className="relative">
                            <Code className="absolute left-4 top-4 text-slate-300" size={20}/>
                            <textarea value={smartInput} onChange={e => { setSmartInput(e.target.value); setIsTested(false); }} placeholder="Pegar objeto firebaseConfig aquí..." className="w-full h-44 pl-12 pr-4 py-5 font-mono text-[10px] border-2 border-slate-100 bg-slate-50 rounded-3xl outline-none focus:border-blue-500 shadow-inner" />
                          </div>
                      )}
                      
                      <div className="min-h-[40px]">
                          {testError && <p className="text-[10px] text-red-600 font-black uppercase bg-red-50 p-4 rounded-2xl border border-red-100 flex items-center gap-3 animate-shake"><ServerCrash size={18}/> {testError}</p>}
                          {isTested && <p className="text-[10px] text-emerald-600 font-black uppercase bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex items-center gap-3 animate-fade-in"><ShieldCheck size={18}/> Verificación Exitosa: Los datos son válidos.</p>}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <button 
                            onClick={handleTestConnection} 
                            disabled={isConnecting} 
                            className={`py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-3 shadow-lg active:scale-95 ${isTested ? 'bg-slate-100 text-slate-400 border border-slate-200' : 'bg-blue-600 text-white hover:bg-blue-500'}`}
                        >
                            {isConnecting ? <Loader2 size={16} className="animate-spin"/> : <Search size={16}/>}
                            {isConnecting ? 'Probando...' : isTested ? 'Probado OK' : '1. Probar Conexión'}
                        </button>
                        <button 
                            onClick={handleLinkCloud} 
                            disabled={!isTested} 
                            className={`py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95 ${isTested ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}
                        >
                            <Link size={16}/>
                            2. Vincular Ahora
                        </button>
                      </div>
                  </div>
              ) : (
                  <div className="space-y-6">
                      <div className="p-8 bg-emerald-50 border-2 border-emerald-100 rounded-[2.5rem] flex flex-col items-center text-center gap-4 relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-3 bg-emerald-500 text-white rounded-bl-3xl">
                              <Wifi size={20} className="animate-pulse"/>
                          </div>
                          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-emerald-600 shadow-inner">
                              <Cloud size={32}/>
                          </div>
                          <div>
                              <p className="text-sm font-black text-slate-900 uppercase">Sistema Vinculado</p>
                              <p className="text-[10px] font-bold text-slate-400 mt-1">PROYECTO: {config.firebaseConfig?.projectId}</p>
                          </div>
                          <div className="w-full h-px bg-emerald-100 my-2"></div>
                          <button 
                             onClick={handleUploadData} 
                             disabled={isUploading}
                             className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-emerald-700 shadow-lg shadow-emerald-200 active:scale-95 transition-all"
                          >
                             {isUploading ? <Loader2 size={18} className="animate-spin"/> : <Upload size={18}/>}
                             Sincronizar Datos Ahora
                          </button>
                      </div>
                      <button onClick={handleDisconnect} className="w-full py-2 text-red-400 font-black text-[9px] uppercase hover:text-red-600 transition-colors">Desvincular Servidor Cloud</button>
                  </div>
              )}
          </div>

          <div className="space-y-6">
              {/* 4. PERIFÉRICOS */}
              <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm text-left">
                  <div className="flex items-center gap-3 mb-8">
                      <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                          <Cpu size={22}/>
                      </div>
                      <div>
                          <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Hardware Externo</h3>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Conectividad de Campo</p>
                      </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                      {/* Impresora */}
                      <button onClick={() => startNativeConnect('PRINTER')} className={`p-6 rounded-[2rem] border-2 flex flex-col items-center gap-3 transition-all active:scale-95 shadow-sm ${config.printerConnected ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-blue-100'}`}>
                          <Printer size={32} className={config.printerConnected ? 'animate-pulse' : ''}/>
                          <span className="text-[10px] font-black uppercase tracking-widest">{config.printerConnected ? 'Ticketera OK' : 'Vincul. Ticketera'}</span>
                      </button>

                      {/* Balanza */}
                      <button onClick={() => startNativeConnect('SCALE_BT')} className={`p-6 rounded-[2rem] border-2 flex flex-col items-center gap-3 transition-all active:scale-95 shadow-sm ${config.scaleConnected ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-emerald-100'}`}>
                          <Scale size={32} className={config.scaleConnected ? 'animate-pulse' : ''}/>
                          <span className="text-[10px] font-black uppercase tracking-widest">{config.scaleConnected ? 'Balanza OK' : 'Vincul. Balanza'}</span>
                      </button>
                  </div>
              </div>

              {/* 5. ZONA DE PELIGRO */}
              <div className="bg-red-50/20 rounded-[2.5rem] border-2 border-dashed border-red-200 p-8 shadow-sm overflow-hidden relative group text-left">
                  <div className="absolute -top-12 -right-12 w-32 h-32 bg-red-500/5 rounded-full blur-3xl group-hover:bg-red-500/10 transition-all"></div>
                  <div className="flex items-center gap-3 mb-6">
                      <div className="p-2.5 bg-red-100 text-red-600 rounded-xl">
                          <Flame size={20}/>
                      </div>
                      <h3 className="font-black text-red-600 uppercase tracking-tighter text-lg">Zona de Peligro</h3>
                  </div>
                  <div className="p-4 bg-white rounded-2xl border border-red-100 mb-6 shadow-sm">
                      <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider leading-relaxed">
                          La restauración de fábrica eliminará permanentemente todos los datos locales que no hayan sido sincronizados.
                      </p>
                  </div>
                  <button 
                    onClick={() => { if(confirm('⚠️ ¿ESTÁS ABSOLUTAMENTE SEGURO? Esta acción es irreversible.')) resetApp(); }} 
                    className="w-full py-5 bg-white text-red-600 border-2 border-red-200 rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-md hover:bg-red-600 hover:text-white hover:border-red-600 transition-all active:scale-95 flex items-center justify-center gap-3"
                  >
                      <Trash2 size={20}/>
                      Restablecer de Fábrica
                  </button>
              </div>
          </div>
      </div>
    </div>
  );
};

// Simplified icon component
const CloudOff: React.FC<{className?: string, size?: number}> = ({className, size}) => (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m2 2 20 20"/><path d="M5.782 5.782A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.307-.193"/><path d="M22.532 16.808A4.5 4.5 0 0 0 18.5 10h-1.26A8 8 0 0 0 8.626 4.626"/></svg>
);

export default Configuration;
