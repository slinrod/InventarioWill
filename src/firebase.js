import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC9AOt_1tJcGwOtEwwkuDx8v_zQpyC3wdc",
  authDomain: "inventario-will.firebaseapp.com",
  projectId: "inventario-will",
  storageBucket: "inventario-will.firebasestorage.app",
  messagingSenderId: "136224400897",
  appId: "1:136224400897:web:f98c8ab91b0fb4856dc200",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);