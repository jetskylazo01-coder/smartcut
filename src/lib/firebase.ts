import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDkh-fNS_ATWQEVXo2VPksr5m9WWWL7p9Q",
  authDomain: "smartcutbarber.firebaseapp.com",
  projectId: "smartcutbarber",
  storageBucket: "smartcutbarber.firebasestorage.app",
  messagingSenderId: "335844744691",
  appId: "1:335844744691:web:280b9ec443d5c6937c0686",
  measurementId: "G-S06EG6HCCT",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
