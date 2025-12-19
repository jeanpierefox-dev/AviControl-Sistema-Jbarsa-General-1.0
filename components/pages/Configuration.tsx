
import React, { useState, useContext, useEffect, useRef } from 'react';
import { AppConfig, UserRole } from '../../types';
import { getConfig, saveConfig, resetApp, isFirebaseConfigured, validateConfig, uploadLocalToCloud } from '../../services/storage';
import { 
  Save, Check, AlertTriangle, Cloud, Settings, Building2, 
  Printer, Scale, ShieldAlert, Loader2, X, Wifi, Bluetooth, 
  RefreshCw, Database, Key, Search, Cpu, Smartphone, Link, 
  Upload, Image as ImageIcon, Activity, HardDrive, Info, CheckCircle,
  Globe, Code, Zap, Flame, Trash2, Layout
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
      }
  }, [config]);

  const handleSave = () => {
    saveConfig(config);
    setSaved(true);
    setIsConnected(isFirebaseConfigured());
    // Trigger a custom event to notify App.tsx header
    window.dispatchEvent(new Event('avi_data_config'));
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTestAndLink = async () => {
      setTestError('');
      setTestSuccess(false);
      setIsConnecting(true);
      try {
          const firebaseConfig = connectMode === 'SMART' ? JSON.parse(smartInput) : manualForm;
          const res = await validateConfig(firebaseConfig);
          
          if (!res.valid) {
              setTestError(res.error || "Error de conexión");
          } else {
              setTestSuccess(true);
              saveConfig({ ...config, firebaseConfig });
              setIsConnected(true);
              setTimeout(() => setTestSuccess(false), 3000);
          }
      } catch (e) {
          setTestError("Formato de datos inválido o error de red.");
      } finally {
          setIsConnecting(false);
      }
  };

  const handleUploadData = async () => {
      if (!isConnected) return;
      setIsUploading(true);
      try {
          await uploadLocalToCloud();
          alert("✅ Sincronización Exitosa.");
      } catch (e: any) {
          alert("❌ Error: " + e.message);
      } finally {
          setIsUploading(false);
      }
  };

  const startNativeConnect = async (type: 'PRINTER' | 'SCALE_BT') => {
      try {
          if (!browserSupport.bluetooth) throw new Error("Bluetooth no soportado.");
          const device = await (navigator as any).bluetooth.requestDevice({
              acceptAllDevices: true,
              optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb'] 
          });
          if (device) {
              if (type === 'PRINTER') setConfig(prev => ({ ...prev, printerConnected: true }));
              else setConfig(prev => ({ ...prev, scaleConnected: true }));
              alert(`✅ ${type === 'PRINTER' ? 'Impresora' : 'Balanza'} vinculada.`);
          }
      } catch (error: any) {
          if (error.name === 'NotFoundError' || error.name === 'AbortError') return;
          alert(`Error: ${error.message}`);
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
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      {/* 1. IDENTIDAD Y NOMBRE GENERAL (PRIMERA PLANA) */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
              <div className="flex-1 w-full space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="bg-blue-900 p-3 rounded-2xl text-white shadow-lg">
                        <Layout size={24} fill="currentColor" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Nombre General del Sistema</h2>
                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Afecta al encabezado y títulos globales</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-1">Título de la Aplicación</label>
                        <input 
                            value={config.companyName} 
                            onChange={e => setConfig({...config, companyName: e.target.value})} 
                            className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-slate-900 outline-none focus:border-blue-500 transition-all" 
                            placeholder="Ej. AviControl Pro"
                        />
                      </div>
                      <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-start gap-3">
                          <Info size={16} className="text-blue-600 mt-1 shrink-0"/>
                          <p className="text-[10px] text-blue-800 font-bold uppercase leading-relaxed">
                              Este nombre se mostrará en la barra superior de todas las pantallas y en los reportes generados.
                          </p>
                      </div>
                      <button 
                        onClick={handleSave} 
                        className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center transition-all shadow-md ${saved ? 'bg-emerald-600 text-white' : 'bg-blue-900 text-white hover:bg-blue-800'}`}
                      >
                        {saved ? <Check size={18} className="mr-2 animate-bounce"/> : <Save size={18} className="mr-2" />}
                        {saved ? 'Cambios Aplicados' : 'Guardar y Aplicar Nombre'}
                      </button>
                  </div>
              </div>

              <div className="w-full md:w-64">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block text-center">Logotipo Principal</label>
                  <div 
                    className="p-4 border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center gap-3 bg-slate-50/50 hover:bg-slate-50 hover:border-blue-200 transition-all cursor-pointer aspect-square relative" 
                    onClick={() => logoInputRef.current?.click()}
                  >
                      {config.logoUrl ? (
                          <div className="relative group w-full h-full flex items-center justify-center">
                              <img src={config.logoUrl} className="max-h-full max-w-full object-contain rounded-xl transition-transform group-hover:scale-105"/>
                              <button 
                                onClick={(e) => { e.stopPropagation(); setConfig({...config, logoUrl: ''}); }} 
                                className="absolute -top-2 -right-2 bg-red-500 text-white p-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all"
                              >
                                  <X size={12}/>
                              </button>
                          </div>
                      ) : (
                          <div className="flex flex-col items-center text-slate-300">
                              <ImageIcon size={40} className="mb-2"/>
                              <span className="text-[10px] font-black uppercase text-blue-600">Subir Logo</span>
                          </div>
                      )}
                      <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={handleLogoChange} />
                  </div>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 2. SINCRONIZACIÓN */}
          <div className={`bg-white rounded-[2rem] border p-6 shadow-sm flex flex-col ${isConnected ? 'border-emerald-100' : 'border-slate-200'}`}>
              <div className="flex items-center gap-3 mb-6">
                  <div className={`p-3 rounded-xl ${isConnected ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                      <Cloud size={20}/>
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 uppercase tracking-tighter">Sincronización Cloud</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Respaldo Automático</p>
                  </div>
              </div>

              {isConnected ? (
                  <div className="space-y-3">
                      <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Wifi className="text-emerald-500" size={18}/>
                            <span className="text-[10px] font-black text-emerald-800 uppercase">Conexión Activa</span>
                          </div>
                          <button onClick={handleUploadData} disabled={isUploading} className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase flex items-center gap-2 hover:bg-emerald-700">
                              {isUploading ? <Loader2 size={12} className="animate-spin"/> : <Upload size={12}/>}
                              Sincronizar
                          </button>
                      </div>
                      <button onClick={() => { if(confirm('¿Desvincular?')) saveConfig({...config, firebaseConfig: undefined}); window.location.reload(); }} className="w-full py-2 text-red-400 font-black text-[9px] uppercase hover:bg-red-50 rounded-xl transition-all">Desvincular de la Nube</button>
                  </div>
              ) : (
                  <div className="space-y-4">
                      <div className="flex bg-slate-100 p-1 rounded-xl">
                          <button onClick={() => setConnectMode('MANUAL')} className={`flex-1 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${connectMode === 'MANUAL' ? 'bg-white text-blue-900 shadow-sm' : 'text-slate-400'}`}>Manual</button>
                          <button onClick={() => setConnectMode('SMART')} className={`flex-1 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${connectMode === 'SMART' ? 'bg-white text-blue-900 shadow-sm' : 'text-slate-400'}`}>JSON</button>
                      </div>

                      {connectMode === 'MANUAL' ? (
                          <div className="grid grid-cols-1 gap-2">
                              <input value={manualForm.projectId} onChange={e => setManualForm({...manualForm, projectId: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold focus:border-blue-500 outline-none" placeholder="Project ID" />
                              <input value={manualForm.apiKey} onChange={e => setManualForm({...manualForm, apiKey: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold focus:border-blue-500 outline-none" placeholder="API Key" />
                              <input value={manualForm.authDomain} onChange={e => setManualForm({...manualForm, authDomain: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold focus:border-blue-500 outline-none" placeholder="Auth Domain" />
                              <input value={manualForm.databaseURL} onChange={e => setManualForm({...manualForm, databaseURL: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold focus:border-blue-500 outline-none" placeholder="Database URL" />
                              <input value={manualForm.appId} onChange={e => setManualForm({...manualForm, appId: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold focus:border-blue-500 outline-none" placeholder="App ID" />
                          </div>
                      ) : (
                          <textarea value={smartInput} onChange={e => setSmartInput(e.target.value)} placeholder="Pegar objeto firebaseConfig aquí..." className="w-full h-24 p-3 text-[10px] font-mono border border-slate-200 bg-slate-50 rounded-xl outline-none focus:border-blue-500" />
                      )}
                      
                      {testError && <p className="text-[9px] text-red-600 font-bold bg-red-50 p-2 rounded-lg border border-red-100 flex items-center gap-2"><AlertTriangle size={12}/> {testError}</p>}
                      {testSuccess && <p className="text-[9px] text-emerald-600 font-bold bg-emerald-50 p-2 rounded-lg border border-emerald-100 flex items-center gap-2"><CheckCircle size={12}/> ¡Conexión exitosa y vinculada!</p>}

                      <button 
                        onClick={handleTestAndLink} 
                        disabled={isConnecting} 
                        className={`w-full py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.1em] transition-all flex items-center justify-center gap-3 shadow-lg ${testSuccess ? 'bg-emerald-600 text-white' : 'bg-blue-900 text-white hover:bg-blue-800 disabled:opacity-50'}`}
                      >
                          {isConnecting ? <Loader2 size={16} className="animate-spin"/> : testSuccess ? <Check size={16}/> : <Search size={16}/>}
                          {isConnecting ? 'Validando...' : testSuccess ? 'Éxito' : 'PROBAR Y VINCULAR CLOUD'}
                      </button>
                  </div>
              )}
          </div>

          {/* 3. PERIFÉRICOS Y ZONA DE PELIGRO */}
          <div className="space-y-6">
              <div className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-6">
                      <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                          <Cpu size={20}/>
                      </div>
                      <div>
                          <h3 className="font-black text-slate-800 uppercase tracking-tighter">Periféricos</h3>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">Hardware Externo</p>
                      </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                      {/* Impresora */}
                      <button onClick={() => startNativeConnect('PRINTER')} className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${config.printerConnected ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                          <Printer size={24}/>
                          <span className="text-[9px] font-black uppercase tracking-tight">{config.printerConnected ? 'Impresora OK' : 'Vincular Ticketera'}</span>
                      </button>

                      {/* Balanza */}
                      <button onClick={() => startNativeConnect('SCALE_BT')} className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${config.scaleConnected ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                          <Scale size={24}/>
                          <span className="text-[9px] font-black uppercase tracking-tight">{config.scaleConnected ? 'Balanza OK' : 'Vincular Balanza'}</span>
                      </button>
                  </div>
              </div>

              {/* ZONA DE PELIGRO */}
              <div className="bg-red-50/30 rounded-[2rem] border-2 border-dashed border-red-200 p-6 shadow-sm overflow-hidden relative group">
                  <div className="absolute -top-10 -right-10 w-32 h-32 bg-red-500/5 rounded-full blur-2xl group-hover:bg-red-500/10 transition-all"></div>
                  
                  <div className="flex items-center gap-3 mb-4">
                      <div className="p-2.5 bg-red-100 text-red-600 rounded-xl">
                          <Flame size={18}/>
                      </div>
                      <h3 className="font-black text-red-600 uppercase tracking-tighter text-sm">Zona de Peligro</h3>
                  </div>

                  <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-5 leading-relaxed">
                      Esta acción borrará todas las pesadas, lotes y usuarios almacenados en este dispositivo.
                  </p>

                  <button 
                    onClick={() => { if(confirm('⚠️ ¿ESTÁS ABSOLUTAMENTE SEGURO? Esta acción es irreversible y borrará todos los datos locales del sistema.')) resetApp(); }} 
                    className="w-full py-4 bg-white text-red-600 border-2 border-red-200 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-sm hover:bg-red-600 hover:text-white hover:border-red-600 transition-all active:scale-95 flex items-center justify-center gap-3"
                  >
                      <Trash2 size={16}/>
                      REINICIAR BASE DE DATOS LOCAL
                  </button>
              </div>
          </div>
      </div>
    </div>
  );
};

export default Configuration;
