
import { User, UserRole, Batch, ClientOrder, AppConfig, WeighingType } from '../types';
import { initializeApp, getApps, deleteApp, FirebaseApp } from 'firebase/app';
import { 
    getFirestore, 
    collection, 
    doc, 
    setDoc, 
    deleteDoc, 
    onSnapshot, 
    enableIndexedDbPersistence, 
    initializeFirestore, 
    CACHE_SIZE_UNLIMITED,
    Firestore,
    terminate
} from 'firebase/firestore';

import firebaseAppletConfig from '../firebase-applet-config.json';

const KEYS = {
  USERS: 'avi_users',
  BATCHES: 'avi_batches',
  ORDERS: 'avi_orders',
  CONFIG: 'avi_config',
  SESSION: 'avi_session'
};

const safeParse = (key: string, fallback: any) => {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : fallback;
    } catch (e) {
        console.warn(`Data corruption detected in ${key}. Resetting to default.`);
        return fallback;
    }
};

export const getEffectiveFirebaseConfig = () => {
    if (firebaseAppletConfig && firebaseAppletConfig.apiKey && firebaseAppletConfig.projectId) {
        return firebaseAppletConfig;
    }
    const config = getConfig();
    if (config.firebaseConfig && config.firebaseConfig.apiKey && config.firebaseConfig.projectId) {
        return config.firebaseConfig;
    }
    return null;
};

export const getConfig = (): AppConfig => {
  return safeParse(KEYS.CONFIG, {
    companyName: 'AVI CONTROL',
    logoUrl: '',
    printerConnected: false,
    scaleConnected: false,
    defaultFullCrateBatch: 5,
    defaultEmptyCrateBatch: 10
  });
};

export const saveConfig = (config: AppConfig) => {
  localStorage.setItem(KEYS.CONFIG, JSON.stringify(config));
  window.dispatchEvent(new Event('avi_data_config'));
};

export const isFirebaseConfigured = (): boolean => {
    const effective = getEffectiveFirebaseConfig();
    return !!(effective && effective.apiKey && effective.projectId);
};

export const resetApp = () => {
    localStorage.clear();
    window.location.reload();
};

let db: Firestore | null = null;
let unsubscribers: Function[] = [];

export const validateConfig = async (firebaseConfig: any): Promise<{ valid: boolean; error?: string }> => {
    let app: FirebaseApp | null = null;
    let tempDb: Firestore | null = null;
    const validatorName = `validator_${Date.now()}`;

    try {
        if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.databaseURL) {
            return { valid: false, error: "⚠️ Campos incompletos: API Key, Project ID y Database URL son obligatorios." };
        }
        
        const apps = getApps();
        for (const existingApp of apps) {
            if (existingApp.name.startsWith('validator_')) {
                try { await deleteApp(existingApp); } catch(e) {}
            }
        }

        app = initializeApp(firebaseConfig, validatorName);
        
        try {
            tempDb = getFirestore(app);
        } catch (e: any) {
            console.error("Firestore Registry Error:", e);
            return { 
                valid: false, 
                error: "❌ Error de Registro del SDK: Se detectó una inconsistencia en los módulos de Firebase. Por favor, limpie la caché del navegador y recargue." 
            };
        }
        
        const testRef = doc(tempDb, 'system_test', 'connection_check');
        await setDoc(testRef, { 
            status: 'success', 
            timestamp: Date.now()
        }, { merge: true });
        
        return { valid: true };
    } catch (e: any) {
        console.error("Firebase Validation Error:", e);
        let msg = "Error de conexión.";
        
        if (e.message?.includes('not available') || e.message?.includes('not been registered')) {
            msg = "❌ Error crítico: El servicio Firestore no pudo registrarse. Esto suele ser por un conflicto de versiones en el navegador. Intente recargar la página.";
        } else if (e.code === 'permission-denied') {
            msg = "⛔ Permisos denegados: Verifique las Reglas de Seguridad en su consola de Firebase.";
        } else {
            msg = `❌ Error: ${e.message || 'Credenciales inválidas o falta de conexión'}`;
        }
        
        return { valid: false, error: msg };
    } finally {
        if (tempDb) { try { await terminate(tempDb); } catch (e) {} }
        if (app) { try { await deleteApp(app); } catch (e) {} }
    }
};

export const initCloudSync = async () => {
  const firebaseCfg = getEffectiveFirebaseConfig();
  unsubscribers.forEach(unsub => unsub());
  unsubscribers = [];

  if (firebaseCfg && firebaseCfg.apiKey && firebaseCfg.projectId) {
    try {
      let app: FirebaseApp;
      const apps = getApps();
      const defaultApp = apps.find(a => a.name === '[DEFAULT]');
      
      if (!defaultApp) {
          app = initializeApp(firebaseCfg as any);
          try {
            const dbId = (firebaseCfg as any).firestoreDatabaseId;
            db = dbId ? getFirestore(app, dbId) : getFirestore(app);
            try {
              await enableIndexedDbPersistence(db);
            } catch (pErr: any) {
              console.warn("Persistencia offline no disponible:", pErr.code);
            }
          } catch (err: any) {
            if (!db) db = getFirestore(app);
            console.warn("Firestore init warning:", err);
          }
      } else {
          app = defaultApp;
          const dbId = (firebaseCfg as any).firestoreDatabaseId;
          db = dbId ? getFirestore(app, dbId) : getFirestore(app);
      }
      startListeners();
    } catch (e) {
      console.error("Error al conectar con la nube:", e);
    }
  }
};

// Start cloud sync automatically if configured
if (typeof window !== 'undefined') {
  setTimeout(() => {
    initCloudSync();
  }, 100);
}

export const getUsers = (): User[] => {
    const users = safeParse(KEYS.USERS, []);
    if (users.length === 0) {
        const defaultAdmin: User = { 
            id: 'admin', 
            username: 'admin', 
            password: '123', 
            name: 'Administrador', 
            role: UserRole.ADMIN, 
            allowedModes: [WeighingType.BATCH, WeighingType.SOLO_POLLO, WeighingType.SOLO_JABAS] 
        };
        return [defaultAdmin];
    }
    return users;
};

export const saveUser = (user: User) => {
    const users = getUsers();
    const idx = users.findIndex(u => u.id === user.id);
    if (idx >= 0) users[idx] = user; else users.push(user);
    localStorage.setItem(KEYS.USERS, JSON.stringify(users));
    if (db) setDoc(doc(db, 'users', user.id), user, { merge: true });
};

export const deleteUser = (id: string) => {
    const users = getUsers().filter(u => u.id !== id);
    localStorage.setItem(KEYS.USERS, JSON.stringify(users));
    if (db) deleteDoc(doc(db, 'users', id));
};

export const login = (username: string, password: string): User | null => {
    const users = getUsers();
    return users.find(u => u.username === username && u.password === password) || null;
};

export const getBatches = (): Batch[] => safeParse(KEYS.BATCHES, []);

export const saveBatch = (batch: Batch) => {
    const batches = getBatches();
    const idx = batches.findIndex(b => b.id === batch.id);
    if (idx >= 0) batches[idx] = batch; else batches.push(batch);
    localStorage.setItem(KEYS.BATCHES, JSON.stringify(batches));
    if (db) setDoc(doc(db, 'batches', batch.id), batch, { merge: true });
};

export const deleteBatch = (id: string) => {
    const batches = getBatches().filter(b => b.id !== id);
    localStorage.setItem(KEYS.BATCHES, JSON.stringify(batches));
    if (db) deleteDoc(doc(db, 'batches', id));
};

export const getOrders = (): ClientOrder[] => safeParse(KEYS.ORDERS, []);

export const getOrdersByBatch = (batchId: string): ClientOrder[] => 
    getOrders().filter(o => o.batchId === batchId);

export const saveOrder = (order: ClientOrder) => {
    const orders = getOrders();
    const idx = orders.findIndex(o => o.id === order.id);
    if (idx >= 0) orders[idx] = order; else orders.push(order);
    localStorage.setItem(KEYS.ORDERS, JSON.stringify(orders));
    if (db) setDoc(doc(db, 'orders', order.id), order, { merge: true });
};

export const deleteOrder = (id: string) => {
    const orders = getOrders().filter(o => o.id !== id);
    localStorage.setItem(KEYS.ORDERS, JSON.stringify(orders));
    if (db) deleteDoc(doc(db, 'orders', id));
};

export const uploadLocalToCloud = async () => {
    if (!db) return;
    const upload = async (col: string, data: any[]) => {
        for (const item of data) {
            await setDoc(doc(db!, col, item.id), item, { merge: true });
        }
    };
    await upload('users', getUsers());
    await upload('batches', getBatches());
    await upload('orders', getOrders());
};

const startListeners = () => {
  if (!db) return;
  
  const syncCollection = (colName: string, storageKey: string, eventName: string) => {
    if (!db) return;
    try {
        const q = collection(db, colName);
        const unsub = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
          if (snapshot.empty && snapshot.metadata.fromCache) return;
          const cloudData = snapshot.docs.map(doc => doc.data());
          const currentLocalRaw = localStorage.getItem(storageKey);
          const currentLocal = currentLocalRaw ? JSON.parse(currentLocalRaw) : [];
          
          if (JSON.stringify(cloudData) !== JSON.stringify(currentLocal)) {
              localStorage.setItem(storageKey, JSON.stringify(cloudData));
              window.dispatchEvent(new Event(eventName));
          }
        }, (error) => {
            console.error(`Error en listener en tiempo real (${colName}):`, error);
        });
        unsubscribers.push(unsub);
    } catch(e) {
        console.error(`Fallo crítico al iniciar listener ${colName}:`, e);
    }
  };
  
  syncCollection('users', KEYS.USERS, 'avi_data_users');
  syncCollection('batches', KEYS.BATCHES, 'avi_data_batches');
  syncCollection('orders', KEYS.ORDERS, 'avi_data_orders');
};
