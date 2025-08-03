// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyBlrQOpX-BWgJ6fb5zQks9MfmTke1Ls3ys",
    authDomain: "hexaboard-a9ea8.firebaseapp.com",
    projectId: "hexaboard-a9ea8",
    storageBucket: "hexaboard-a9ea8.firebasestorage.app",
    messagingSenderId: "86808097323",
    appId: "1:86808097323:web:6f17bdc779424f9c0b706e"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };