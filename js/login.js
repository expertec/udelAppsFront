// login.js — Email/Password con aprobación (misma lógica que tu Google Sign-In)
// Mantiene Firebase 10.7.1 para ser consistente con el dashboard.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  getFirestore,
  doc,
  getDoc,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

import { firebaseConfig } from './firebase-config.js';

// Inicializar Firebase (igual que antes)
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Elementos del DOM (IDs nuevos que pusimos en index.html)
const messageDiv  = document.getElementById('message');
const emailInput  = document.getElementById('email');
const passInput   = document.getElementById('password');
const btnLogin    = document.getElementById('btnLogin');
const btnReset    = document.getElementById('btnReset');

// Utilidades UI (mismo estilo de mensajes que ya usabas)
function showMessage(message, type) {
  if (!messageDiv) return;
  messageDiv.textContent = message;
  messageDiv.className = 'message ' + type;
  messageDiv.style.display = 'block';
  setTimeout(() => { messageDiv.style.display = 'none'; }, 5000);
}
function getErrorMessage(code) {
  const M = {
    'auth/email-already-in-use': 'Este correo ya está registrado.',
    'auth/invalid-email': 'Correo electrónico inválido.',
    'auth/operation-not-allowed': 'Operación no permitida.',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/user-disabled': 'Esta cuenta ha sido deshabilitada.',
    'auth/user-not-found': 'No existe una cuenta con este correo.',
    'auth/wrong-password': 'Contraseña incorrecta.',
    'auth/invalid-credential': 'Credenciales inválidas.',
    'auth/too-many-requests': 'Demasiados intentos. Intenta más tarde.'
  };
  return M[code] || 'Ha ocurrido un error. Intenta nuevamente.';
}
const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// ===== Login =====
// Igual que antes: si approved -> dashboard, si no -> mensaje y signOut
btnLogin?.addEventListener('click', async () => {
  try {
    const email = (emailInput?.value || '').trim();
    const pass  = (passInput?.value  || '').trim();

    if (!email || !pass) return showMessage('Completa email y contraseña.', 'error');

    const cred = await signInWithEmailAndPassword(auth, email, pass);
    const user = cred.user;

    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (!userDoc.exists()) {
      showMessage('Tu registro está incompleto. Contacta al administrador.', 'warning');
      await signOut(auth);
      return;
    }

    const data = userDoc.data();
    if (data.approved) {
      showMessage('¡Inicio de sesión exitoso!', 'success');
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 800);
    } else {
      showMessage('Tu cuenta está pendiente de aprobación por un administrador.', 'warning');
      await signOut(auth);
    }
  } catch (e) {
    console.error('Error en login:', e);
    showMessage(getErrorMessage(e.code), 'error');
  }
});

// ===== Reset de contraseña =====
btnReset?.addEventListener('click', async () => {
  try {
    const email = (emailInput?.value || '').trim();
    if (!email) return showMessage('Escribe tu correo para enviarte el enlace.', 'error');
    if (!isValidEmail(email)) return showMessage('Escribe un correo válido.', 'error');

    await sendPasswordResetEmail(auth, email);
    showMessage('Te enviamos un enlace para restablecer tu contraseña.', 'success');
  } catch (e) {
    console.error('Error en reset:', e);
    showMessage(getErrorMessage(e.code), 'error');
  }
});

// ===== Estado de auth (igual que antes) =====
onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (snap.exists()) {
      const data = snap.data();
      if (data.approved) {
        window.location.href = 'dashboard.html';
      } else {
        showMessage('Tu cuenta está pendiente de aprobación por un administrador.', 'warning');
        await signOut(auth);
      }
    }
  } catch (e) {
    console.error('onAuthStateChanged error:', e);
  }
});
