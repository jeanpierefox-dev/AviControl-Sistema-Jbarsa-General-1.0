
import React, { useState, useContext, useEffect, useRef } from 'react';
import { AppConfig } from '../../types';
import { getConfig, saveConfig, resetApp, isFirebaseConfigured, validateConfig, uploadLocalToCloud } from '../../services/storage';
import { 
  Save, Check, Cloud, X, Loader2, Database, Key, Search, Cpu, Smartphone, Link, 
  Upload, Image as ImageIcon, Globe, ServerCrash, ClipboardCheck, ExternalLink, 
  HelpCircle, MessageSquare, Box, Layout, Trash2, Flame, Printer, Scale
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
  
  const [browserSupport, setBrowserSupport] = useState({ serial: false, bluetooth: false });
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
    window.dispatchEvent(new Event('avi_data_config'));
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTestConnection = async () => {
      setTestError('');
      setIsTested(false);
      setIsConnecting(true);
      try {
          if (!manualForm.apiKey || !manualForm.projectId || !manualForm.databaseURL) {
              setTestError("⚠️ El API Key, Project ID y Database URL son campos obligatorios.");
              setIsConnecting(false);
              return;
          }
          const res = await validateConfig(manualForm);
          if (!res.valid) {
              setTestError(res.error || "Error de validación: Revise sus credenciales.");
          } else {
              setIsTested(true);
          }
      } catch (e) {
          setTestError("Error crítico de procesamiento de datos.");
      } finally {
          setIsConnecting(false);
      }
  };

  const handleLinkCloud = () => {
      if (!isTested) return;
      saveConfig({ ...config, firebaseConfig: manualForm });
      setIsConnected(true);
      alert("✅ Servidor vinculado correctamente.");
      window.location.reload();
  };

  const handleUploadData = async () => {
      if (!isConnected) return;
      setIsUploading(true);
      try {
          await uploadLocalToCloud();
          alert("✅ Sincronización Exitosa.");
      } catch (e: any) {
          alert("❌ Error de Subida: " + e.message);
      } finally {
          setIsUploading(false);
      }
  };

  const handleDisconnect = () => {
      if(confirm('¿Desvincular servidor cloud?')) {
          saveConfig({...config, firebaseConfig: undefined});
          setIsConnected(false);
          window.location.reload();
      }
  };

  const startNativeConnect = async (type: 'PRINTER' | 'SCALE_BT') => {
      try {
          if (!browserSupport.bluetooth) throw new Error("Bluetooth no soportado.");
          const device = await (navigator as any).bluetooth.requestDevice({
              acceptAllDevices: true
          });
          if (device) {
              if (type === 'PRINTER') setConfig(prev => ({ ...prev, printerConnected: true }));
              else setConfig(prev => ({ ...prev, scaleConnected: true }));
              alert(`✅ Vinculación exitosa.`);
          }
      } catch (error: any) {
          if (error.name !== 'NotFoundError' && error.name !== 'AbortError') {
              alert(`Error: ${error.message}`);
          }
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
      {/* 1. IDENTIDAD */}
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
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-1">Nombre de la Aplicación</label>
                        <input 
                            value={config.companyName} 
                            onChange={e => setConfig({...config, companyName: e.target.value})} 
                            className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-slate-900 outline-none focus:border-blue-500 transition-all shadow-inner" 
                        />
                      </div>
                      <button 
                        onClick={handleSave} 
                        className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center transition-all shadow-md active:scale-[0.98] ${saved ? 'bg-emerald-600 text-white' : 'bg-blue-950 text-white hover:bg-blue-900'}`}
                      >
                        {saved ? <Check size={18} className="mr-2 animate-bounce"/> : <Save size={18} className="mr-2" />}
                        {saved ? 'Guardado' : 'Guardar Cambios Identidad'}
                      </button>
                  </div>
              </div>

              <div className="w-full md:w-64">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block text-center">Logo Corporativo</label>
                  <div 
                    className="p-4 border-2 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center gap-3 bg-slate-50/50 hover:bg-slate-50 hover:border-blue-200 transition-all cursor-pointer aspect-square relative shadow-inner" 
                    onClick={() => logoInputRef.current?.click()}
                  >
                      {config.logoUrl ? (
                          <div className="relative group w-full h-full flex items-center justify-center">
                              <img src={config.logoUrl} className="max-h-full max-w-full object-contain rounded-xl" alt="Logo"/>
                              <button onClick={(e) => { e.stopPropagation(); setConfig({...config, logoUrl: ''}); }} className="absolute -top-2 -right-2 bg-red-500 text-white p-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all"><X size={14}/></button>
                          </div>
                      ) : (
                          <div className="flex flex-col items-center text-slate-300">
                              <ImageIcon size={48} className="mb-2 opacity-40"/>
                              <span className="text-[10px] font-black uppercase text-blue-600">Subir Logo</span>
                          </div>
                      )}
                      <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={handleLogoChange} />
                  </div>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 gap-6 items-start">
          
          {/* 2. CONFIGURACIÓN CLOUD */}
          <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm text-left flex flex-col">
              <div className="flex items-center justify-between mb-8 border-b border-slate-100 pb-6">
                  <div className="flex items-center gap-3">
                    <div className={`p-4 rounded-2xl transition-all ${isConnected ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                        <Cloud size={28}/>
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Sincronización en la Nube</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                           {isConnected ? <><div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"/> Estado: Conectado</> : <><div className="w-2 h-2 bg-amber-500 rounded-full"/> Estado: Modo Local</>}
                        </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="p-3 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-2xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                       Firebase Console <ExternalLink size={14}/>
                    </a>
                    {isConnected && (
                        <button onClick={handleDisconnect} className="p-3 text-red-600 bg-red-50 hover:bg-red-100 rounded-2xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                           Desconectar <X size={14}/>
                        </button>
                    )}
                  </div>
              </div>

              {!isConnected ? (
                  <div className="space-y-8 animate-fade-in">
                      <div className="bg-slate-50 border-2 border-slate-100 p-6 rounded-3xl flex flex-col md:flex-row gap-6 items-center">
                          <div className="p-5 bg-white rounded-3xl shadow-sm border border-slate-200 shrink-0">
                              <HelpCircle size={32} className="text-blue-500"/>
                          </div>
                          <div>
                              <p className="font-black text-slate-800 text-sm uppercase tracking-tight mb-1">Configuración Firebase</p>
                              <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                                 Ingrese los parámetros de su proyecto. El <b>Database URL</b> es obligatorio para establecer la conexión con Realtime/Firestore.
                              </p>
                          </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Project ID *</label>
                            <div className="relative">
                                <Database className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16}/>
                                <input value={manualForm.projectId} onChange={e => { setManualForm({...manualForm, projectId: e.target.value}); setIsTested(false); }} className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-xs outline-none focus:border-blue-500 transition-all" placeholder="my-project-id" />
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">API Key *</label>
                            <div className="relative">
                                <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16}/>
                                <input value={manualForm.apiKey} onChange={e => { setManualForm({...manualForm, apiKey: e.target.value}); setIsTested(false); }} className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-xs outline-none focus:border-blue-500 transition-all" placeholder="AIzaSyA..." />
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Database URL *</label>
                            <div className="relative">
                                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16}/>
                                <input value={manualForm.databaseURL} onChange={e => { setManualForm({...manualForm, databaseURL: e.target.value}); setIsTested(false); }} className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-xs outline-none focus:border-blue-500 transition-all" placeholder="https://mi-app.firebaseio.com" />
                            </div>
                          </div>
                      </div>
                      
                      <div className="min-h-[40px] flex items-center justify-center">
                          {testError && (
                            <div className="w-full text-[10px] text-red-600 font-bold bg-red-50 p-4 rounded-2xl border border-red-100 flex items-start gap-3 animate-shake">
                                <ServerCrash size={18} className="shrink-0 mt-0.5"/> 
                                <div>
                                    <p className="font-black uppercase tracking-widest mb-1">Fallo de Validación</p>
                                    <p className="leading-relaxed">{testError}</p>
                                </div>
                            </div>
                          )}
                          {isTested && (
                            <div className="w-full text-[11px] text-emerald-600 font-black uppercase bg-emerald-50 p-5 rounded-3xl border-2 border-emerald-100 flex items-center justify-center gap-4 animate-fade-in shadow-sm">
                                <div className="p-2 bg-emerald-500 text-white rounded-full"><Check size={18}/></div>
                                Credenciales verificadas exitosamente.
                            </div>
                          )}
                      </div>

                      <div className="flex flex-col sm:flex-row gap-4">
                        <button 
                            onClick={handleTestConnection} 
                            disabled={isConnecting} 
                            className={`flex-[1] py-5 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95 ${isTested ? 'bg-slate-100 text-slate-400 border border-slate-200' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                        >
                            {isConnecting ? <Loader2 size={18} className="animate-spin"/> : <ClipboardCheck size={18}/>}
                            {isConnecting ? 'Verificando...' : isTested ? 'Verificado' : 'Probar Conexión'}
                        </button>
                        <button 
                            onClick={handleLinkCloud} 
                            disabled={!isTested} 
                            className={`flex-[1] py-5 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all flex items-center justify-center gap-3 shadow-2xl active:scale-95 ${isTested ? 'bg-emerald-600 text-white hover:bg-emerald-500 scale-105' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}
                        >
                            <Link size={18}/>
                            Vincular Nube
                        </button>
                      </div>
                  </div>
              ) : (
                  <div className="space-y-8 animate-fade-in py-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="p-8 bg-emerald-50 border-2 border-emerald-100 rounded-[3rem] flex flex-col items-center text-center gap-6 relative shadow-lg">
                              <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-emerald-600 shadow-inner border border-emerald-100"><Cloud size={40}/></div>
                              <div>
                                  <p className="text-lg font-black text-slate-900 uppercase tracking-tighter">Sincronización Activa</p>
                                  <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Proyecto: {config.firebaseConfig?.projectId}</p>
                              </div>
                              <button onClick={handleUploadData} disabled={isUploading} className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-emerald-700 shadow-xl shadow-emerald-200 active:scale-95 transition-all">
                                 {isUploading ? <Loader2 size={18} className="animate-spin"/> : <Upload size={20}/>}
                                 {isUploading ? 'Sincronizando...' : 'Subir Datos Locales'}
                              </button>
                          </div>

                          <div className="bg-white p-8 rounded-[3rem] border border-slate-200 flex flex-col justify-center gap-6">
                              <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-50 pb-4">Detalles del Servidor</h4>
                              <div className="space-y-4">
                                  <div className="flex justify-between items-center text-xs">
                                      <span className="text-slate-400 font-bold uppercase">Tecnología</span>
                                      <span className="text-slate-800 font-black">Google Firestore</span>
                                  </div>
                                  <div className="flex justify-between items-center text-xs">
                                      <span className="text-slate-400 font-bold uppercase">Conectividad</span>
                                      <span className="text-emerald-600 font-black">Tiempo Real</span>
                                  </div>
                                  <div className="flex justify-between items-center text-xs">
                                      <span className="text-slate-400 font-bold uppercase">Versión SDK</span>
                                      <span className="text-blue-600 font-black">v11.1.0</span>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>
              )}
          </div>
      </div>
    </div>
  );
};

export default Configuration;
