// login.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
    getAuth, 
    signInWithPopup,
    GoogleAuthProvider,
    onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

import { firebaseConfig } from './firebase-config.js';

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Elementos del DOM
const messageDiv = document.getElementById('message');
const googleLoginBtn = document.getElementById('googleLoginBtn');

// Login con Google
async function signInWithGoogle() {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;

        // Verificar si el usuario ya existe en Firestore
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
            // Es un nuevo usuario, crear su documento
            await setDoc(userDocRef, {
                name: user.displayName || 'Usuario de Google',
                email: user.email,
                photoURL: user.photoURL || null,
                role: 'user',
                approved: false,
                createdAt: new Date().toISOString()
            });

            showMessage('¡Cuenta creada! Tu cuenta está pendiente de aprobación.', 'success');
            await auth.signOut();
            return;
        }

        // Usuario existente, verificar si está aprobado
        const userData = userDoc.data();
        if (userData.approved) {
            showMessage('¡Inicio de sesión exitoso!', 'success');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);
        } else {
            showMessage('Tu cuenta está pendiente de aprobación por un administrador.', 'warning');
            await auth.signOut();
        }
    } catch (error) {
        console.error('Error con Google Sign-In:', error);
        if (error.code === 'auth/popup-closed-by-user') {
            showMessage('Inicio de sesión cancelado.', 'error');
        } else if (error.code === 'auth/popup-blocked') {
            showMessage('Popup bloqueado. Permite popups para este sitio.', 'error');
        } else {
            showMessage('Error: ' + getErrorMessage(error.code), 'error');
        }
    }
}

// Event listener para botón de Google
googleLoginBtn.addEventListener('click', signInWithGoogle);

// Verificar estado de autenticación
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Usuario autenticado, verificar su rol y estado
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            
            if (userData.approved) {
                // Redirigir al dashboard
                window.location.href = 'dashboard.html';
            } else {
                showMessage('Tu cuenta está pendiente de aprobación por un administrador.', 'warning');
                await auth.signOut();
            }
        }
    }
});

// Funciones auxiliares
function showMessage(message, type) {
    messageDiv.textContent = message;
    messageDiv.className = 'message ' + type;
    messageDiv.style.display = 'block';
    
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 5000);
}

function getErrorMessage(errorCode) {
    const errorMessages = {
        'auth/email-already-in-use': 'Este correo ya está registrado.',
        'auth/invalid-email': 'Correo electrónico inválido.',
        'auth/operation-not-allowed': 'Operación no permitida.',
        'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
        'auth/user-disabled': 'Esta cuenta ha sido deshabilitada.',
        'auth/user-not-found': 'No existe una cuenta con este correo.',
        'auth/wrong-password': 'Contraseña incorrecta.',
        'auth/invalid-credential': 'Credenciales inválidas.'
    };
    return errorMessages[errorCode] || 'Ha ocurrido un error. Intenta nuevamente.';
}