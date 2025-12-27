
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
    secure: window.isSecureContext,
    isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
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
          secure: window.isSecureContext,
          isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
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
              setTestError("⚠️ Datos incompletos.");
              setIsConnecting(false);
              return;
          }
          const res = await validateConfig(manualForm);
          if (!res.valid) {
              setTestError(res.error || "Error de validación.");
          } else {
              setIsTested(true);
          }
      } catch (e) {
          setTestError("Error crítico.");
      } finally {
          setIsConnecting(false);
      }
  };

  const handleLinkCloud = () => {
      if (!isTested) return;
      saveConfig({ ...config, firebaseConfig: manualForm });
      setIsConnected(true);
      alert("✅ Servidor vinculado.");
      window.location.reload();
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
          if (!browserSupport.bluetooth) {
              alert("❌ Bluetooth no soportado en este navegador.\n\nSi estás en iPhone/iPad, usa el navegador 'Bluefy'.\nSi estás en Android, usa Chrome con la ubicación encendida.");
              return;
          }

          const device = await (navigator as any).bluetooth.requestDevice({
              acceptAllDevices: true,
              optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', 'battery_service']
          });

          if (device) {
              const newConfig = type === 'PRINTER' 
                ? { ...config, printerConnected: true }
                : { ...config, scaleConnected: true };
              setConfig(newConfig);
              saveConfig(newConfig);
              alert(`✅ Vinculado con ${device.name}`);
          }
      } catch (error: any) {
          if (error.name !== 'NotFoundError') alert(`Error: ${error.message}`);
      }
  };

  const disconnectDevice = (type: 'PRINTER' | 'SCALE_BT') => {
      const newConfig = type === 'PRINTER' 
        ? { ...config, printerConnected: false }
        : { ...config, scaleConnected: false };
      setConfig(newConfig);
      saveConfig(newConfig);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 animate-fade-in">
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
                        <input value={config.companyName} onChange={e => setConfig({...config, companyName: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-slate-900 outline-none focus:border-blue-500 transition-all shadow-inner" />
                      </div>
                      <button onClick={handleSave} className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center transition-all shadow-md ${saved ? 'bg-emerald-600 text-white' : 'bg-blue-950 text-white hover:bg-blue-900'}`}>
                        {saved ? <Check size={18} className="mr-2"/> : <Save size={18} className="mr-2" />}
                        {saved ? 'Guardado' : 'Guardar Cambios'}
                      </button>
                  </div>
              </div>
              <div className="w-full md:w-64">
                  <div className="p-4 border-2 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center bg-slate-50/50 aspect-square relative shadow-inner cursor-pointer" onClick={() => logoInputRef.current?.click()}>
                      {config.logoUrl ? (
                          <img src={config.logoUrl} className="max-h-full max-w-full object-contain rounded-xl" alt="Logo"/>
                      ) : (
                          <div className="flex flex-col items-center text-slate-300">
                              <ImageIcon size={48} className="mb-2 opacity-40"/>
                              <span className="text-[10px] font-black uppercase text-blue-600">Subir Logo</span>
                          </div>
                      )}
                      <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                              const r = new FileReader();
                              r.onloadend = () => setConfig({ ...config, logoUrl: r.result as string });
                              r.readAsDataURL(file);
                          }
                      }} />
                  </div>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm text-left h-full">
              <div className="flex items-center gap-4 mb-8 border-b border-slate-100 pb-6">
                  <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-lg">
                      <Cpu size={24} />
                  </div>
                  <div>
                      <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Hardware y Periféricos</h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Conexiones Bluetooth</p>
                  </div>
              </div>

              <div className="space-y-4">
                  <div className={`p-5 rounded-3xl border-2 transition-all flex items-center justify-between ${config.printerConnected ? 'border-emerald-100 bg-emerald-50/30' : 'border-slate-100 bg-slate-50/30'}`}>
                      <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-xl ${config.printerConnected ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-400'}`}><Printer size={20} /></div>
                          <div>
                              <p className="font-black text-xs text-slate-900 uppercase">Impresora</p>
                              <p className="text-[9px] font-bold text-slate-400 uppercase">{config.printerConnected ? 'Conectada' : 'No Vinculada'}</p>
                          </div>
                      </div>
                      <button onClick={() => config.printerConnected ? disconnectDevice('PRINTER') : startNativeConnect('PRINTER')} className="bg-blue-900 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase">
                          {config.printerConnected ? 'Soltar' : 'Vincular'}
                      </button>
                  </div>

                  <div className={`p-5 rounded-3xl border-2 transition-all flex items-center justify-between ${config.scaleConnected ? 'border-blue-100 bg-blue-50/30' : 'border-slate-100 bg-slate-50/30'}`}>
                      <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-xl ${config.scaleConnected ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-400'}`}><Scale size={20} /></div>
                          <div>
                              <p className="font-black text-xs text-slate-900 uppercase">Balanza BT</p>
                              <p className="text-[9px] font-bold text-slate-400 uppercase">{config.scaleConnected ? 'Conectada' : 'No Vinculada'}</p>
                          </div>
                      </div>
                      <button onClick={() => config.scaleConnected ? disconnectDevice('SCALE_BT') : startNativeConnect('SCALE_BT')} className="bg-blue-900 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase">
                          {config.scaleConnected ? 'Soltar' : 'Vincular'}
                      </button>
                  </div>
              </div>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm text-left h-full">
              <div className="flex items-center justify-between mb-8 border-b border-slate-100 pb-6">
                  <div className="flex items-center gap-3">
                    <div className={`p-4 rounded-2xl ${isConnected ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}><Cloud size={28}/></div>
                    <div>
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Nube de Datos</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isConnected ? 'Sincronizado' : 'Modo Local'}</p>
                    </div>
                  </div>
              </div>

              {!isConnected ? (
                  <div className="space-y-4">
                      <input value={manualForm.projectId} onChange={e => setManualForm({...manualForm, projectId: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-xs" placeholder="Firebase Project ID *" />
                      <input value={manualForm.apiKey} onChange={e => setManualForm({...manualForm, apiKey: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-xs" placeholder="API Key *" />
                      <input value={manualForm.databaseURL} onChange={e => setManualForm({...manualForm, databaseURL: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-xs" placeholder="Database URL *" />
                      <div className="flex gap-2">
                        <button onClick={handleTestConnection} className="flex-1 bg-slate-900 text-white py-4 rounded-2xl font-black text-[10px] uppercase">Probar</button>
                        <button onClick={handleLinkCloud} disabled={!isTested} className="flex-1 bg-emerald-600 disabled:bg-slate-200 text-white py-4 rounded-2xl font-black text-[10px] uppercase">Vincular</button>
                      </div>
                  </div>
              ) : (
                  <div className="flex flex-col items-center gap-4 py-4">
                      <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600"><Cloud size={32}/></div>
                      <p className="text-xs font-black text-slate-900 uppercase">{config.firebaseConfig?.projectId}</p>
                      <button onClick={handleUploadData} disabled={isUploading} className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2">
                        {isUploading ? <Loader2 size={16} className="animate-spin"/> : <Upload size={16}/>} Subir Local a Nube
                      </button>
                  </div>
              )}
          </div>
      </div>
      
      <div className="p-8 bg-red-50 rounded-[2.5rem] border border-red-100 flex flex-col md:flex-row items-center justify-between gap-6 text-left">
          <div>
              <p className="font-black text-red-800 text-sm uppercase">Mantenimiento Crítico</p>
              <p className="text-[10px] text-red-600 font-bold uppercase mt-1">Elimina todos los datos locales de este dispositivo.</p>
          </div>
          <button onClick={() => { if(confirm('¿Borrar todo?')) resetApp(); }} className="bg-red-600 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 flex items-center gap-2">
            <Trash2 size={18} /> Restablecer Fábrica
          </button>
      </div>
    </div>
  );
};

export default Configuration;
