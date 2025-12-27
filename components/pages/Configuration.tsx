
import React, { useState, useContext, useEffect, useRef } from 'react';
import { AppConfig } from '../../types';
import { getConfig, saveConfig, resetApp, isFirebaseConfigured, validateConfig, uploadLocalToCloud } from '../../services/storage';
import { 
  Save, Check, Cloud, X, Loader2, Database, Key, Search, Cpu, Smartphone, Link, 
  Upload, Image as ImageIcon, Globe, ServerCrash, ClipboardCheck, ExternalLink, 
  HelpCircle, MessageSquare, Box, Layout, Trash2, Flame, Printer, Scale, Bluetooth, BluetoothOff, AlertCircle, MapPin
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
  
  const [browserSupport, setBrowserSupport] = useState({ 
    serial: false, 
    bluetooth: false, 
    secure: window.isSecureContext 
  });
  
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
          bluetooth: 'bluetooth' in navigator,
          secure: window.isSecureContext
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
          if (!browserSupport.bluetooth) {
              alert("❌ Tu navegador o dispositivo no soporta Bluetooth Web.\n\nEn iOS (iPhone) usa navegadores como Bluefy o WebBLE.\nEn Android usa Chrome y activa la UBICACIÓN.");
              return;
          }

          if (!browserSupport.secure) {
              alert("❌ Bluetooth requiere una conexión segura (HTTPS).\nPor favor, accede mediante una URL segura.");
              return;
          }
          
          // Solicitar permiso de ubicación preventivamente (ayuda en algunos Android)
          if ('geolocation' in navigator) {
             try { await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 2000 })); } catch(e) { console.warn("Location check failed, continuing anyway"); }
          }

          // Intentar abrir el selector de dispositivos del sistema
          const device = await (navigator as any).bluetooth.requestDevice({
              acceptAllDevices: true,
              optionalServices: [
                  '000018f0-0000-1000-8000-00805f9b34fb', // Servicio Genérico de Impresoras Térmicas
                  '00001101-0000-1000-8000-00805f9b34fb', // Serial Port Profile (SPP)
                  'battery_service'
              ]
          });

          if (device) {
              if (type === 'PRINTER') {
                  const newConfig = { ...config, printerConnected: true };
                  setConfig(newConfig);
                  saveConfig(newConfig);
              } else {
                  const newConfig = { ...config, scaleConnected: true };
                  setConfig(newConfig);
                  saveConfig(newConfig);
              }
              alert(`✅ Vinculación con ${device.name || 'Dispositivo'} exitosa.`);
          }
      } catch (error: any) {
          if (error.name === 'NotFoundError') {
              // El usuario canceló o no se encontró nada
              return;
          }
          if (error.name === 'SecurityError') {
              alert("⚠️ Error de seguridad: El escaneo Bluetooth fue bloqueado por el navegador.");
          } else {
              alert(`Error al buscar: ${error.message}\n\nRecuerda tener el Bluetooth y la UBICACIÓN encendidos.`);
          }
      }
  };

  const disconnectDevice = (type: 'PRINTER' | 'SCALE_BT') => {
      if (type === 'PRINTER') {
          const newConfig = { ...config, printerConnected: false };
          setConfig(newConfig);
          saveConfig(newConfig);
      } else {
          const newConfig = { ...config, scaleConnected: false };
          setConfig(newConfig);
          saveConfig(newConfig);
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          
          {/* 2. HARDWARE Y PERIFÉRICOS */}
          <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm text-left">
              <div className="flex items-center gap-4 mb-8 border-b border-slate-100 pb-6">
                  <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-lg">
                      <Cpu size={24} />
                  </div>
                  <div>
                      <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Periféricos y Hardware</h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Conexiones Bluetooth</p>
                  </div>
              </div>

              <div className="space-y-4">
                  {/* Requisitos Móviles */}
                  <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 space-y-2">
                    <p className="text-[10px] font-black text-blue-800 uppercase tracking-widest flex items-center gap-2">
                        <AlertCircle size={14}/> Requisitos para Móviles
                    </p>
                    <ul className="text-[9px] text-blue-600 font-bold space-y-1 uppercase">
                        <li className="flex items-center gap-2"><div className="w-1 h-1 bg-blue-600 rounded-full"/> Activar Bluetooth en el dispositivo</li>
                        <li className="flex items-center gap-2"><div className="w-1 h-1 bg-blue-600 rounded-full"/> Activar GPS / UBICACIÓN (Obligatorio en Android)</li>
                        <li className="flex items-center gap-2"><div className="w-1 h-1 bg-blue-600 rounded-full"/> Usar Navegador Chrome o Edge</li>
                    </ul>
                  </div>

                  {/* Impresora */}
                  <div className={`p-5 rounded-3xl border-2 transition-all flex items-center justify-between ${config.printerConnected ? 'border-emerald-100 bg-emerald-50/30' : 'border-slate-100 bg-slate-50/30'}`}>
                      <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-xl ${config.printerConnected ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                              <Printer size={20} />
                          </div>
                          <div>
                              <p className="font-black text-xs text-slate-900 uppercase">Impresora Térmica</p>
                              <p className="text-[9px] font-bold text-slate-400 uppercase">{config.printerConnected ? 'Vinculada' : 'No detectada'}</p>
                          </div>
                      </div>
                      <button 
                        onClick={() => config.printerConnected ? disconnectDevice('PRINTER') : startNativeConnect('PRINTER')}
                        className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${config.printerConnected ? 'bg-red-50 text-red-600 border border-red-100 hover:bg-red-100' : 'bg-blue-900 text-white hover:bg-blue-800 shadow-md active:scale-95'}`}
                      >
                        {config.printerConnected ? 'Desconectar' : 'Buscar Impresora'}
                      </button>
                  </div>

                  {/* Balanza */}
                  <div className={`p-5 rounded-3xl border-2 transition-all flex items-center justify-between ${config.scaleConnected ? 'border-blue-100 bg-blue-50/30' : 'border-slate-100 bg-slate-50/30'}`}>
                      <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-xl ${config.scaleConnected ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                              <Scale size={20} />
                          </div>
                          <div>
                              <p className="font-black text-xs text-slate-900 uppercase">Balanza Electrónica</p>
                              <p className="text-[9px] font-bold text-slate-400 uppercase">{config.scaleConnected ? 'Vinculada' : 'Sin conexión'}</p>
                          </div>
                      </div>
                      <button 
                        onClick={() => config.scaleConnected ? disconnectDevice('SCALE_BT') : startNativeConnect('SCALE_BT')}
                        className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${config.scaleConnected ? 'bg-red-50 text-red-600 border border-red-100 hover:bg-red-100' : 'bg-blue-900 text-white hover:bg-blue-800 shadow-md active:scale-95'}`}
                      >
                        {config.scaleConnected ? 'Desconectar' : 'Buscar Balanza'}
                      </button>
                  </div>

                  {!browserSupport.bluetooth && (
                      <div className="p-4 bg-red-50 text-red-700 rounded-2xl border border-red-100 text-[9px] font-black flex items-center gap-3 uppercase">
                          <BluetoothOff size={16} className="shrink-0" />
                          Tu navegador no tiene acceso al Bluetooth. Intenta con Chrome.
                      </div>
                  )}
                  {!browserSupport.secure && (
                      <div className="p-4 bg-amber-50 text-amber-700 rounded-2xl border border-amber-100 text-[9px] font-black flex items-center gap-3 uppercase">
                          <AlertCircle size={16} className="shrink-0" />
                          Sitio no seguro (No HTTPS). El Bluetooth está bloqueado.
                      </div>
                  )}
              </div>
          </div>

          {/* 3. CONFIGURACIÓN CLOUD */}
          <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm text-left flex flex-col h-full">
              <div className="flex items-center justify-between mb-8 border-b border-slate-100 pb-6">
                  <div className="flex items-center gap-3">
                    <div className={`p-4 rounded-2xl transition-all ${isConnected ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                        <Cloud size={28}/>
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Sincronización en la Nube</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                           {isConnected ? <><div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"/> Estado: Conectado</> : <><div className="w-2 h-2 bg-amber-500 rounded-full"/> Estado: Modo Local</>}
                        </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {isConnected && (
                        <button onClick={handleDisconnect} className="p-3 text-red-600 bg-red-50 hover:bg-red-100 rounded-2xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                           <X size={14}/>
                        </button>
                    )}
                  </div>
              </div>

              {!isConnected ? (
                  <div className="space-y-6 animate-fade-in">
                      <div className="bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl flex items-center gap-4">
                          <HelpCircle size={20} className="text-blue-500 shrink-0"/>
                          <p className="text-[10px] text-slate-500 font-medium leading-tight">
                             Configure Firebase para habilitar respaldo en tiempo real y multi-dispositivo.
                          </p>
                      </div>

                      <div className="space-y-3">
                          <div className="relative">
                              <Database className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16}/>
                              <input value={manualForm.projectId} onChange={e => { setManualForm({...manualForm, projectId: e.target.value}); setIsTested(false); }} className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-xs outline-none focus:border-blue-500 transition-all" placeholder="Project ID *" />
                          </div>
                          <div className="relative">
                              <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16}/>
                              <input value={manualForm.apiKey} onChange={e => { setManualForm({...manualForm, apiKey: e.target.value}); setIsTested(false); }} className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-xs outline-none focus:border-blue-500 transition-all" placeholder="API Key *" />
                          </div>
                          <div className="relative">
                              <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16}/>
                              <input value={manualForm.databaseURL} onChange={e => { setManualForm({...manualForm, databaseURL: e.target.value}); setIsTested(false); }} className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-xs outline-none focus:border-blue-500 transition-all" placeholder="Database URL *" />
                          </div>
                      </div>
                      
                      {testError && (
                        <div className="text-[9px] text-red-600 font-bold bg-red-50 p-3 rounded-xl border border-red-100 flex gap-2">
                            <ServerCrash size={14} className="shrink-0"/> {testError}
                        </div>
                      )}

                      <div className="flex gap-3">
                        <button 
                            onClick={handleTestConnection} 
                            disabled={isConnecting} 
                            className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${isTested ? 'bg-slate-100 text-slate-400' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                        >
                            {isConnecting ? <Loader2 size={16} className="animate-spin"/> : <ClipboardCheck size={16}/>}
                            {isTested ? 'Verificado' : 'Probar'}
                        </button>
                        <button 
                            onClick={handleLinkCloud} 
                            disabled={!isTested} 
                            className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${isTested ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}
                        >
                            <Link size={16}/> Vincular
                        </button>
                      </div>
                  </div>
              ) : (
                  <div className="space-y-6 animate-fade-in py-2">
                      <div className="p-6 bg-emerald-50 border-2 border-emerald-100 rounded-3xl flex flex-col items-center text-center gap-4">
                          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-50"><Cloud size={32}/></div>
                          <div>
                              <p className="text-sm font-black text-slate-900 uppercase tracking-tighter">Sincronización Activa</p>
                              <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Proyecto: {config.firebaseConfig?.projectId}</p>
                          </div>
                          <button onClick={handleUploadData} disabled={isUploading} className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all">
                             {isUploading ? <Loader2 size={16} className="animate-spin"/> : <Upload size={18}/>}
                             Sincronizar Datos
                          </button>
                      </div>
                  </div>
              )}
          </div>
      </div>

      {/* 4. MANTENIMIENTO */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm text-left">
          <div className="flex items-center gap-4 mb-6">
            <div className="bg-red-500 p-3 rounded-2xl text-white shadow-lg">
                <Trash2 size={24} />
            </div>
            <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Zona de Peligro</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mantenimiento Crítico</p>
            </div>
          </div>
          <div className="bg-red-50 p-6 rounded-[2rem] border border-red-100 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="text-center md:text-left">
                  <p className="font-black text-red-800 text-sm uppercase tracking-tight">Restablecimiento de Fábrica</p>
                  <p className="text-[10px] text-red-600 font-medium leading-relaxed mt-1">
                      Esto eliminará todos los datos de pesaje, clientes, lotes y configuración local de este dispositivo de forma irreversible.
                  </p>
              </div>
              <button 
                onClick={() => { if(confirm('¿ESTÁ ABSOLUTAMENTE SEGURO? Esta acción no se puede deshacer y borrará toda la base de datos local.')) resetApp(); }} 
                className="bg-red-600 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-700 transition-all shadow-xl shadow-red-200 active:scale-95 flex items-center gap-2"
              >
                <Flame size={18} /> Borrar Todo
              </button>
          </div>
      </div>
    </div>
  );
};

export default Configuration;
