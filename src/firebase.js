import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA1TRqHaNsytLwPZWevHgtf0H-MKYmo2VA",
  authDomain: "life-manager-f5fd8.firebaseapp.com",
  projectId: "life-manager-f5fd8",
  storageBucket: "life-manager-f5fd8.firebasestorage.app",
  messagingSenderId: "93366478624",
  appId: "1:93366478624:web:acce1cdf19327acc751945"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export const saveToFirebase = async (syncCode, data) => {
  const docRef = doc(db, "users", syncCode.toLowerCase());
  await setDoc(docRef, {
    ...data,
    lastUpdated: new Date().toISOString()
  });
};

export const loadFromFirebase = async (syncCode) => {
  const docRef = doc(db, "users", syncCode.toLowerCase());
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data();
  }
  return null;
};

export { db };
