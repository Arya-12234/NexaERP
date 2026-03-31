import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";


const firebaseConfig = {
  apiKey: "AIzaSyA_WFR6df0JXzXPo9wJBJA8RoTdWvySybY",
  authDomain: "my-erp-e64c4.firebaseapp.com",
  projectId: "my-erp-e64c4",
  storageBucket: "my-erp-e64c4.firebasestorage.app",
  messagingSenderId: "233847475641",
  appId: "1:233847475641:web:1dcb7c50b315b2b2823a68"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);