// dashboard-init.js - Inicialización y configuración
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
    getAuth, 
    signOut,
    onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
    getFirestore, 
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export let currentUser = null;
export let currentUserData = null;
export let editingItemId = null;

// Verificar autenticación
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        await loadUserData();
    } else {
        window.location.href = 'index.html';
    }
});

async function loadUserData() {
    try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
            currentUserData = { id: userDoc.id, ...userDoc.data() };
            
            if (!currentUserData.approved && currentUserData.role !== 'admin') {
                showMessage('Tu cuenta aún no ha sido aprobada.', 'error');
                setTimeout(() => {
                    window.logout();
                }, 2000);
                return;
            }

            updateUI();
            loadContent();
        }
    } catch (error) {
        console.error('Error al cargar datos del usuario:', error);
        showMessage('Error al cargar datos del usuario.', 'error');
    }
}

function updateUI() {
    document.getElementById('userName').textContent = currentUserData.name;
    document.getElementById('userRole').textContent = currentUserData.role === 'admin' ? 'Admin' : 'Usuario';
    
    // Mostrar foto de perfil si existe (usuarios de Google)
    if (currentUserData.photoURL) {
        const avatarImg = document.getElementById('userAvatar');
        avatarImg.src = currentUserData.photoURL;
        avatarImg.classList.remove('hidden');
    }
    
    document.getElementById('welcomeTitle').textContent = 
        `¡Bienvenido, ${currentUserData.name}!`;
    document.getElementById('welcomeDescription').textContent = 
        currentUserData.role === 'admin' 
            ? 'Tienes acceso completo para gestionar usuarios e items.'
            : 'Puedes gestionar tus items personales.';

    if (currentUserData.role === 'admin') {
        document.getElementById('adminView').classList.remove('hidden');
        document.getElementById('userView').classList.add('hidden');
    } else {
        document.getElementById('userView').classList.remove('hidden');
        document.getElementById('adminView').classList.add('hidden');
    }
}

function loadContent() {
    if (currentUserData.role === 'admin') {
        window.loadPendingUsers();
        window.loadAllUsers();
        window.loadAllItems();
    }
    // Los usuarios normales solo ven el escritorio de apps
}

function showMessage(message, type) {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = message;
    messageDiv.className = 'message ' + type;
    messageDiv.style.display = 'block';
    
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 5000);
}

window.logout = async function() {
    try {
        await signOut(auth);
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
    }
};

// Exportar funciones necesarias
export { loadUserData, updateUI, loadContent, showMessage, currentUser as getCurrentUser, currentUserData as getCurrentUserData };