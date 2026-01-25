import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyB5VxMhbwmwInhXQfydtpbB3hViAzbGoA",
    authDomain: "brew-evaluator.firebaseapp.com",
    projectId: "brew-evaluator",
    storageBucket: "brew-evaluator.firebasestorage.app",
    messagingSenderId: "628238093444",
    appId: "1:628238093444:web:daa6d6281c027c88c446d1",
    measurementId: "G-F8B4H5BDZB"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
