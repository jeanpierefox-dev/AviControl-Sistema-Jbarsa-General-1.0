
import { User, UserRole, Batch, ClientOrder, AppConfig } from '../types';
import { initializeApp, getApps, getApp, deleteApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, enableIndexedDbPersistence, initializeFirestore, CACHE_SIZE_UNLIMITED } from 'firebase/firestore';

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

let db: any = null;
let unsubscribers: Function[] = [];

export const validateConfig = async (firebaseConfig: any): Promise<{ valid: boolean; error?: string }> => {
    let app: any = null;
    try {
        if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
            return { valid: false, error: "Faltan campos obligatorios (API Key o Project ID)." };
        }
        const tempName = 'validator_' + Date.now() + Math.random().toString(36).substring(7);
        app = initializeApp(firebaseConfig, tempName);
        const db = getFirestore(app);
        await setDoc(doc(db, 'config', 'validation_test'), { check: true, ts: Date.now() }, { merge: true });
        return { valid: true };
    } catch (e: any) {
        let msg = e.message || "Error desconocido";
        if (e.code === 'permission-denied') msg = "⛔ PERMISOS DENEGADOS: Revisa las reglas de Firestore.";
        else if (e.code === 'unavailable') msg = "📡 SIN CONEXIÓN: Verifica tu internet.";
        return { valid: false, error: msg };
    } finally {
        if (app) {
            try { await deleteApp(app); } catch (e) {}
        }
    }
};

export const initCloudSync = async () => {
  const config = getConfig();
  unsubscribers.forEach(unsub => unsub());
  unsubscribers = [];

  if (config.firebaseConfig?.apiKey && config.firebaseConfig?.projectId) {
    try {
      let app;
      if (!getApps().length) {
          app = initializeApp(config.firebaseConfig);
          db = initializeFirestore(app, { cacheSizeBytes: CACHE_SIZE_UNLIMITED });
          try { await enableIndexedDbPersistence(db); } catch (err) {}
      } else {
          app = getApp(); 
          db = getFirestore(app);
      }
      startListeners();
    } catch (e) {
      console.error("Error al conectar con Firebase:", e);
    }
  }
};

const startListeners = () => {
  if (!db) return;
  const syncCollection = (colName: string, storageKey: string, eventName: string) => {
    try {
        const q = collection(db, colName);
        const unsub = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
          if (snapshot.empty && snapshot.metadata.fromCache) return;
          const currentLocalRaw = localStorage.getItem(storageKey);
          const currentLocal: any[] = currentLocalRaw ? JSON.parse(currentLocalRaw) : [];
          const dataMap = new Map<string, any>();
          currentLocal.forEach(item => dataMap.set(item.id, item));
          let hasChanges = false;
          snapshot.docChanges().forEach((change) => {
              const docData = change.doc.data();
              if (change.type === 'removed') {
                  if (dataMap.has(change.doc.id)) { dataMap.delete(change.doc.id); hasChanges = true; }
              } else {
                  const existing = dataMap.get(docData.id);
                  if (!existing || JSON.stringify(existing) !== JSON.stringify(docData)) {
                      dataMap.set(docData.id, docData);
                      hasChanges = true;
                  }
              }
          });
          if (hasChanges) {
              const mergedData = Array.from(dataMap.values());
              localStorage.setItem(storageKey, JSON.stringify(mergedData));
              window.dispatchEvent(new Event(eventName));
          }
        });
        unsubscribers.push(unsub);
    } catch(e) {}
  };
  syncCollection('users', KEYS.USERS, 'avi_data_users');
  syncCollection('batches', KEYS.BATCHES, 'avi_data_batches');
  syncCollection('orders', KEYS.ORDERS, 'avi_data_orders');
};

export const uploadLocalToCloud = async () => {
  if (!db) return;
  const upload = async (colName: string, data: any[]) => {
      const batchSize = 400; 
      for (let i = 0; i < data.length; i += batchSize) {
          const chunk = data.slice(i, i + batchSize);
          await Promise.all(chunk.map(item => {
              if(item && item.id) return setDoc(doc(db, colName, item.id), item, { merge: true });
              return Promise.resolve();
          }));
      }
  };
  await upload('users', getUsers());
  await upload('batches', getBatches());
  await upload('orders', getOrders());
};

const writeToCloud = async (collectionName: string, data: any) => {
  if (db && data.id) setDoc(doc(db, collectionName, data.id), data, { merge: true }).catch(() => {});
};

const deleteFromCloud = async (collectionName: string, id: string) => {
  if (db && id) deleteDoc(doc(db, collectionName, id)).catch(() => {});
};

const seedData = () => {
  if (localStorage.getItem(KEYS.USERS) === null) {
    const admin: User = { id: 'admin-1', username: 'admin', password: '123', name: 'Administrador Principal', role: UserRole.ADMIN };
    localStorage.setItem(KEYS.USERS, JSON.stringify([admin]));
  }
  if (localStorage.getItem(KEYS.CONFIG) === null) {
    // UPDATED: Default empty crate batch set to 10 as requested
    const config: AppConfig = { 
      companyName: 'AviControl Pro', 
      logoUrl: '', 
      printerConnected: false, 
      scaleConnected: false, 
      defaultFullCrateBatch: 5, 
      defaultEmptyCrateBatch: 10 
    };
    localStorage.setItem(KEYS.CONFIG, JSON.stringify(config));
  }
};

export const getUsers = (): User[] => safeParse(KEYS.USERS, []);
export const saveUser = (user: User) => {
  const users = getUsers();
  const idx = users.findIndex(u => u.id === user.id);
  if (idx >= 0) users[idx] = user; else users.push(user);
  localStorage.setItem(KEYS.USERS, JSON.stringify(users));
  writeToCloud('users', user);
  window.dispatchEvent(new Event('avi_data_users'));
};
export const deleteUser = (id: string) => {
  const users = getUsers().filter(u => u.id !== id);
  localStorage.setItem(KEYS.USERS, JSON.stringify(users));
  deleteFromCloud('users', id);
  window.dispatchEvent(new Event('avi_data_users'));
};
export const login = (u: string, p: string): User | null => {
  const users = getUsers();
  return users.find(user => user.username === u && user.password === p) || null;
};
export const getBatches = (): Batch[] => safeParse(KEYS.BATCHES, []);
export const saveBatch = (batch: Batch) => {
  const batches = getBatches();
  const idx = batches.findIndex(b => b.id === batch.id);
  if (idx >= 0) batches[idx] = batch; else batches.push(batch);
  localStorage.setItem(KEYS.BATCHES, JSON.stringify(batches));
  writeToCloud('batches', batch);
  window.dispatchEvent(new Event('avi_data_batches'));
};
export const deleteBatch = (id: string) => {
  const batches = getBatches().filter(b => b.id !== id);
  localStorage.setItem(KEYS.BATCHES, JSON.stringify(batches));
  deleteFromCloud('batches', id);
  window.dispatchEvent(new Event('avi_data_batches'));
};
export const getOrders = (): ClientOrder[] => safeParse(KEYS.ORDERS, []);
export const saveOrder = (order: ClientOrder) => {
  const orders = getOrders();
  const idx = orders.findIndex(o => o.id === order.id);
  if (idx >= 0) orders[idx] = order; else orders.push(order);
  localStorage.setItem(KEYS.ORDERS, JSON.stringify(orders));
  writeToCloud('orders', order);
  window.dispatchEvent(new Event('avi_data_orders'));
};

export const deleteOrder = (id: string) => {
  const orders = getOrders().filter(o => o.id !== id);
  localStorage.setItem(KEYS.ORDERS, JSON.stringify(orders));
  deleteFromCloud('orders', id);
  window.dispatchEvent(new Event('avi_data_orders'));
};

export const getOrdersByBatch = (batchId: string) => getOrders().filter(o => o.batchId === batchId);
export const getConfig = (): AppConfig => safeParse(KEYS.CONFIG, {});
export const saveConfig = (cfg: AppConfig) => {
  localStorage.setItem(KEYS.CONFIG, JSON.stringify(cfg));
  if (cfg.firebaseConfig?.apiKey) initCloudSync();
  window.dispatchEvent(new Event('avi_data_config'));
};
export const isFirebaseConfigured = (): boolean => {
  const c = getConfig();
  return !!(c.firebaseConfig?.apiKey && c.firebaseConfig?.projectId);
};
export const restoreBackup = (data: any) => {
    if (data.users) localStorage.setItem(KEYS.USERS, data.users);
    if (data.batches) localStorage.setItem(KEYS.BATCHES, data.batches);
    if (data.orders) localStorage.setItem(KEYS.ORDERS, data.orders);
    if (data.config) localStorage.setItem(KEYS.CONFIG, data.config);
    window.location.reload();
};
export const resetApp = () => {
  localStorage.clear();
  seedData();
  window.location.reload();
};
seedData();
initCloudSync();
