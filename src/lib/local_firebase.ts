// Fully Localized Firebase Mock for Offline PC Application
// Stores tasks, auth status, and syncs automatically with standard browser storage.

import { User as FirebaseUser } from 'firebase/auth';

class MockTimestamp {
  seconds: number;
  nanoseconds: number;

  constructor(seconds: number, nanoseconds: number) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }

  static now() {
    return new MockTimestamp(Math.floor(Date.now() / 1000), 0);
  }

  static fromDate(date: Date) {
    return new MockTimestamp(Math.floor(date.getTime() / 1000), 0);
  }

  toDate() {
    return new Date(this.seconds * 1000);
  }
}

export const Timestamp = MockTimestamp;

export function serverTimestamp() {
  return MockTimestamp.now();
}

// Global default PC User
export const MOCK_PC_USER = {
  uid: 'local_pc_user',
  displayName: 'Người dùng PC',
  email: 'taskflow.user@local.desktop',
  photoURL: null,
  emailVerified: true,
  isAnonymous: false,
  metadata: {},
  providerData: [],
  phoneNumber: null,
  tenantId: null,
  delete: async () => {},
  getIdToken: async () => 'mock-token',
  getIdTokenResult: async () => ({ token: 'mock-token', expirationTime: '', authTime: '', issuedAtTime: '', signInProvider: '', claims: {} }),
  reload: async () => {},
  toJSON: () => ({}),
} as unknown as FirebaseUser;

// Firebase App
export function initializeApp() {
  return { name: 'mock-local-app' };
}

// Database Mock Instance
export const db = { type: 'local_storage_db' };

// Firebase Auth Mock
class MockAuth {
  currentUser = MOCK_PC_USER;
}

export const auth = new MockAuth();

export function getAuth() {
  return auth;
}

export function onAuthStateChanged(authInstance: any, callback: (user: FirebaseUser | null) => void) {
  // Directly trigger with our local PC User after a micro-timeout
  setTimeout(() => {
    callback(MOCK_PC_USER);
  }, 10);
  return () => {};
}

export async function signInWithPopup() {
  return { user: MOCK_PC_USER };
}

export async function signOut() {
  // Does nothing for local PC app to keep it persistent
  return Promise.resolve();
}

export class GoogleAuthProvider {
  static PROVIDER_ID = 'google.com';
}

// Firestore operations
export function initializeFirestore() {
  return db;
}

// Tasks loading helper
function getLocalTasks(): any[] {
  try {
    const raw = localStorage.getItem('taskflow_local_tasks');
    if (!raw) return [];
    
    // Parse objects, convert date structures if any to mock Timestamps
    const list = JSON.parse(raw);
    return list.map((item: any) => {
      // Re-hydrate any timestamp structures
      if (item.createdAt && typeof item.createdAt === 'object' && 'seconds' in item.createdAt) {
        item.createdAt = new MockTimestamp(item.createdAt.seconds, item.createdAt.nanoseconds || 0);
      }
      return item;
    });
  } catch (e) {
    console.error("Failed to load local tasks:", e);
    return [];
  }
}

function saveLocalTasks(tasks: any[]) {
  try {
    // Stringify and save
    localStorage.setItem('taskflow_local_tasks', JSON.stringify(tasks));
    // Dispatch local sync events so views update instantly
    window.dispatchEvent(new CustomEvent('local-db-tasks-updated'));
    // Also dispatch original storage event
    window.dispatchEvent(new Event('storage'));
  } catch (e) {
    console.error("Failed to save local tasks:", e);
  }
}

export function collection(dbInstance: any, path: string) {
  return { type: 'collection', path };
}

export function doc(dbOrCol: any, ...args: string[]) {
  let colPath = '';
  let docId = '';
  
  if (dbOrCol.type === 'collection') {
    colPath = dbOrCol.path;
    docId = args[0] || '';
  } else {
    colPath = args[0] || '';
    docId = args[1] || '';
  }

  // If no ID is generated, make a random one
  if (!docId) {
    docId = 'task_' + Math.random().toString(36).substring(2, 11);
  }

  return { type: 'doc', colPath, id: docId };
}

export async function addDoc(colRef: any, data: any) {
  const list = getLocalTasks();
  const id = 'task_' + Math.random().toString(36).substring(2, 11);
  const newItem = {
    ...data,
    id,
    createdAt: data.createdAt || MockTimestamp.now()
  };
  list.push(newItem);
  saveLocalTasks(list);
  return { id, path: `${colRef.path}/${id}` };
}

export async function deleteDoc(docRef: any) {
  const list = getLocalTasks();
  const filtered = list.filter(item => item.id !== docRef.id);
  saveLocalTasks(filtered);
}

export async function updateDoc(docRef: any, updateData: any) {
  const list = getLocalTasks();
  const index = list.findIndex(item => item.id === docRef.id);
  if (index !== -1) {
    list[index] = {
      ...list[index],
      ...updateData
    };
    saveLocalTasks(list);
  }
}

export function query(colRef: any, ...conditions: any[]) {
  return { type: 'query', colRef, conditions };
}

export function where(field: string, op: string, value: any) {
  return { type: 'where', field, op, value };
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
  return { type: 'orderBy', field, direction };
}

export async function getDocs(queryRef: any) {
  let list = getLocalTasks();
  
  // Filter list with query filters
  if (queryRef && queryRef.conditions) {
    queryRef.conditions.forEach((cond: any) => {
      if (cond.type === 'where') {
        const { field, op, value } = cond;
        list = list.filter(item => {
          const itemVal = item[field];
          if (op === '==') return itemVal === value;
          if (op === '!=') return itemVal !== value;
          if (op === '>') return itemVal > value;
          if (op === '<') return itemVal < value;
          return true;
        });
      }
    });
  }

  const docs = list.map(item => ({
    id: item.id,
    data: () => item
  }));

  return {
    empty: docs.length === 0,
    docs
  };
}

export function onSnapshot(queryRefOrColRef: any, callback: (snapshot: any) => void) {
  const fetchAndTrigger = () => {
    let list = getLocalTasks();
    const isQueryObj = queryRefOrColRef && queryRefOrColRef.type === 'query';
    const conditions = isQueryObj ? queryRefOrColRef.conditions : [];

    // Filter with "where" conditions if any
    conditions.forEach((cond: any) => {
      if (cond && cond.type === 'where') {
        const { field, op, value } = cond;
        list = list.filter(item => {
          const itemVal = item[field];
          if (op === '==') return itemVal === value;
          if (op === '!=') return itemVal !== value;
          if (op === '>') return itemVal > value;
          if (op === '<') return itemVal < value;
          return true;
        });
      }
    });

    // Apply basic sorting if details contain "orderBy"
    conditions.forEach((cond: any) => {
      if (cond && cond.type === 'orderBy') {
        const { field, direction } = cond;
        list.sort((a, b) => {
          const aVal = a[field] || '';
          const bVal = b[field] || '';
          if (aVal === bVal) return 0;
          const comp = aVal > bVal ? 1 : -1;
          return direction === 'asc' ? comp : -comp;
        });
      }
    });

    const docs = list.map(item => ({
      id: item.id,
      data: () => item
    }));
    
    callback({
      empty: docs.length === 0,
      docs
    });
  };

  // Run once immediately
  fetchAndTrigger();

  // Listen for local updates
  const handler = () => {
    fetchAndTrigger();
  };

  window.addEventListener('local-db-tasks-updated', handler);
  window.addEventListener('storage', handler);

  return () => {
    window.removeEventListener('local-db-tasks-updated', handler);
    window.removeEventListener('storage', handler);
  };
}

export function writeBatch(dbInstance: any) {
  let scheduledOps: Array<() => void> = [];
  let currentTasks = getLocalTasks();

  return {
    delete(docRef: any) {
      scheduledOps.push(() => {
        currentTasks = currentTasks.filter(item => item.id !== docRef.id);
      });
    },
    set(docRef: any, data: any) {
      scheduledOps.push(() => {
        const idx = currentTasks.findIndex(item => item.id === docRef.id);
        const newItem = { ...data, id: docRef.id };
        if (idx !== -1) {
          currentTasks[idx] = newItem;
        } else {
          currentTasks.push(newItem);
        }
      });
    },
    update(docRef: any, updateData: any) {
      scheduledOps.push(() => {
        const idx = currentTasks.findIndex(item => item.id === docRef.id);
        if (idx !== -1) {
          currentTasks[idx] = { ...currentTasks[idx], ...updateData };
        }
      });
    },
    async commit() {
      scheduledOps.forEach(op => op());
      saveLocalTasks(currentTasks);
      return Promise.resolve();
    }
  };
}
