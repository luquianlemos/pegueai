// src/firebase.ts
import { initializeApp } from 'firebase/app';
import { getStorage } from 'firebase/storage';
import { getFirestore } from 'firebase/firestore';

// Configuração copiada do seu print
const firebaseConfig = {
  apiKey: 'AIzaSyCtVrzLupTfkzol9uMX3_YQbHO76GBQ0xY',
  authDomain: 'poplink-ab045.firebaseapp.com',
  projectId: 'poplink-ab045',
  storageBucket: 'poplink-ab045.firebasestorage.app',
  messagingSenderId: '965451692180',
  appId: '1:965451692180:web:eb937f73c101ffa42c5c81',
};

const app = initializeApp(firebaseConfig);
export const storage = getStorage(app);
export const db = getFirestore(app);
