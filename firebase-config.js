// firebase-config.js
// Configuracao do Firebase para o app BikeSafe.
// IMPORTANTE: estas chaves de cliente sao publicas por natureza (visiveis no navegador).
// A protecao real dos dados vem das Regras de Seguranca do Firestore, nao de esconder estas chaves.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBf92j0e_WliTmSmSxooI3fVX3zYOib8b4",
  authDomain: "bikesafe-65b62.firebaseapp.com",
  projectId: "bikesafe-65b62",
  storageBucket: "bikesafe-65b62.firebasestorage.app",
  messagingSenderId: "897437274438",
  appId: "1:897437274438:web:3f09171e8f181555abd547",
  measurementId: "G-QZVRW17T3Q"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
