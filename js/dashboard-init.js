// dashboard-init.js - Inicialización y configuración
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
    getAuth, 
    signOut,
    onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
    getFirestore,
    doc,
    getDoc,
    updateDoc,
    where,
    onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Exponer auth globalmente para que apps-manager.js pueda acceder
window.auth = auth;
window.db = db;

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
    const roleLabels = {
        'superAdmin': 'Super Admin',
        'director': 'Director',
        'mentor': 'Mentor',
        'admin': 'Admin',
        'user': 'Usuario'
    };

    const displayName = currentUserData.name || currentUserData.email?.split('@')[0] || 'Usuario';
    document.getElementById('userName').textContent = displayName;
    document.getElementById('userRole').textContent = roleLabels[currentUserData.role] || 'Usuario';

    // Mostrar foto de perfil si existe (usuarios de Google)
    if (currentUserData.photoURL) {
        const avatarImg = document.getElementById('userAvatar');
        avatarImg.src = currentUserData.photoURL;
        avatarImg.classList.remove('hidden');
    }

    // Mensajes personalizados según el rol
    const welcomeMessages = {
        'superAdmin': {
            title: `¡Bienvenido, ${displayName}!`,
            description: 'Tienes acceso completo al sistema. Puedes crear usuarios, gestionar permisos y acceder a todas las aplicaciones.'
        },
        'director': {
            title: `¡Bienvenido, Director ${displayName}!`,
            description: 'Tienes acceso a las aplicaciones de nivel 1 para gestión directiva.'
        },
        'mentor': {
            title: `¡Bienvenido, Mentor ${displayName}!`,
            description: 'Tienes acceso a las aplicaciones de nivel 1 para mentoría.'
        },
        'admin': {
            title: `¡Bienvenido, ${displayName}!`,
            description: 'Tienes acceso completo para gestionar usuarios e items.'
        }
    };

    const message = welcomeMessages[currentUserData.role] || {
        title: `¡Bienvenido, ${displayName}!`,
        description: 'Puedes acceder a las aplicaciones disponibles para ti.'
    };

    document.getElementById('welcomeTitle').textContent = message.title;
    document.getElementById('welcomeDescription').textContent = message.description;

    // Mostrar vista según el rol
    if (currentUserData.role === 'admin' || currentUserData.role === 'superAdmin') {
        document.getElementById('adminView').classList.remove('hidden');
        document.getElementById('userView').classList.add('hidden');

        // Mostrar paneles solo para superAdmin
        if (currentUserData.role === 'superAdmin') {
            document.getElementById('userCreationPanel')?.classList.remove('hidden');
            document.getElementById('plantelesPanel')?.classList.remove('hidden');
        }
    } else {
        document.getElementById('userView').classList.remove('hidden');
        document.getElementById('adminView').classList.add('hidden');
    }
}

function loadContent() {
    if (currentUserData.role === 'admin' || currentUserData.role === 'superAdmin') {
        window.loadPendingUsers();
        window.loadAllUsers();
        window.loadAllItems();

        // Setup y carga solo para superAdmin
        if (currentUserData.role === 'superAdmin') {
            setupUserCreationForm();
            setupPlantelForm();
            window.loadAllPlanteles();
        }
    } else {
        // Cargar aplicaciones según el rol del usuario
        loadAppsForRole(currentUserData.role);
    }
}

// Cargar aplicaciones según el rol
function loadAppsForRole(role) {
    const appsGrid = document.getElementById('appsGrid');
    if (!appsGrid) return;

    // Definir aplicaciones por nivel
    const apps = {
        // Nivel 1 - Directores y Mentores
        nivel1: [
            {
                name: 'Analizador de Videos',
                icon: `<svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>`,
                gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                onClick: 'openVideoAnalyzer()'
            },
            {
                name: 'Carta Descriptiva',
                icon: `<svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                </svg>`,
                gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                onClick: 'openCartaAnalyzer()'
            },
            {
                name: 'Buscador de Materias',
                icon: `<svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="M21 21l-4.35-4.35"></path>
                    <line x1="11" y1="8" x2="11" y2="14"></line>
                    <line x1="8" y1="11" x2="14" y2="11"></line>
                </svg>`,
                gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                onClick: 'openClaseFinder()'
            }
        ],
        // Nivel 2 - Otros roles (puedes agregar más apps aquí)
        nivel2: [
            {
                name: 'Buscador de Materias',
                icon: `<svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="M21 21l-4.35-4.35"></path>
                    <line x1="11" y1="8" x2="11" y2="14"></line>
                    <line x1="8" y1="11" x2="14" y2="11"></line>
                </svg>`,
                gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                onClick: 'openClaseFinder()'
            }
        ]
    };

    // Determinar qué aplicaciones mostrar según el rol
    let userApps = [];

    if (role === 'director' || role === 'mentor') {
        userApps = apps.nivel1;
    } else if (role === 'user') {
        userApps = apps.nivel2;
    } else {
        // Por defecto, nivel 2
        userApps = apps.nivel2;
    }

    // Renderizar las aplicaciones
    let html = '';
    userApps.forEach(app => {
        html += `
            <div class="app-card" onclick="${app.onClick}">
                <div class="app-icon" style="background: ${app.gradient};">
                    ${app.icon}
                </div>
                <h3 class="app-name">${app.name}</h3>
            </div>
        `;
    });

    appsGrid.innerHTML = html;
}

// Exportar para uso global
window.loadAppsForRole = loadAppsForRole;

/* ===========================
   GESTIÓN DE PLANTELES
   =========================== */

// Cargar planteles en el dropdown del formulario de usuario
window.loadPlantelesDropdown = async function() {
    try {
        console.log('📥 Cargando planteles para dropdown...');

        // Llamar al endpoint del servidor
        const response = await fetch(`${window.API_BASE || ''}/admin/getPlanteles`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${await currentUser.getIdToken()}`
            }
        });

        if (!response.ok) {
            throw new Error('Error al cargar planteles');
        }

        const result = await response.json();
        const planteles = result.planteles || [];
        console.log(`✅ Planteles para dropdown: ${planteles.length}`);

        const plantelSelect = document.getElementById('newUserPlantel');
        if (!plantelSelect) return;

        // Limpiar opciones existentes excepto la primera
        plantelSelect.innerHTML = '<option value="">Selecciona un plantel</option>';

        // Agregar cada plantel como opción
        planteles.forEach((plantel) => {
            const option = document.createElement('option');
            option.value = plantel.name;
            option.textContent = plantel.name;
            plantelSelect.appendChild(option);
        });

    } catch (error) {
        console.error('Error al cargar planteles:', error);
    }
};

// Cargar lista de planteles en el panel de gestión
window.loadAllPlanteles = async function() {
    try {
        console.log('📥 Cargando planteles desde el servidor...');

        // Llamar al endpoint del servidor
        const response = await fetch(`${window.API_BASE || ''}/admin/getPlanteles`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${await currentUser.getIdToken()}`
            }
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Error desconocido' }));
            throw new Error(error.error || 'Error al cargar planteles');
        }

        const result = await response.json();
        const planteles = result.planteles || [];
        console.log(`✅ Planteles cargados: ${planteles.length}`);

        const container = document.getElementById('plantelesContainer');
        if (!container) return;

        if (planteles.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #9ca3af;">
                    <p>No hay planteles registrados aún.</p>
                    <p style="margin-top: 8px; font-size: 14px;">Haz clic en "Nuevo Plantel" para agregar el primero.</p>
                </div>
            `;
            return;
        }

        let html = '<div style="display: grid; gap: 12px;">';

        planteles.forEach((plantel) => {
            html += `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px;">
                    <div>
                        <strong style="font-size: 16px; color: #1f2937;">🏫 ${plantel.name}</strong>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button onclick="deletePlantel('${plantel.id}', '${plantel.name}')" class="btn-secondary" style="padding: 8px 16px; font-size: 14px;">
                            🗑️ Eliminar
                        </button>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;

    } catch (error) {
        console.error('Error al cargar planteles:', error);
        showMessage(error.message || 'Error al cargar planteles.', 'error');
    }
};

// Crear nuevo plantel
window.createPlantel = async function(event) {
    event.preventDefault();

    try {
        const name = document.getElementById('plantelName')?.value?.trim();

        if (!name) {
            showMessage('Por favor, ingresa el nombre del plantel.', 'error');
            return;
        }

        console.log('📤 Enviando solicitud para crear plantel:', { name });

        // Llamar al endpoint del servidor para crear el plantel
        const response = await fetch(`${window.API_BASE || ''}/admin/createPlantel`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${await currentUser.getIdToken()}`
            },
            body: JSON.stringify({ name })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Error desconocido' }));
            throw new Error(error.error || 'Error al crear plantel');
        }

        const result = await response.json();
        console.log('✅ Plantel creado:', result);

        showMessage('Plantel creado exitosamente.', 'success');
        window.closePlantelModal();
        window.loadAllPlanteles();
        window.loadPlantelesDropdown(); // Actualizar el dropdown también

    } catch (error) {
        console.error('Error al crear plantel:', error);
        showMessage(error.message || 'Error al crear plantel.', 'error');
    }
};

// Eliminar plantel
window.deletePlantel = async function(plantelId, plantelName) {
    if (!confirm(`¿Estás seguro de eliminar el plantel "${plantelName}"?`)) {
        return;
    }

    try {
        console.log('🗑️ Eliminando plantel:', plantelId);

        // Llamar al endpoint del servidor
        const response = await fetch(`${window.API_BASE || ''}/admin/deletePlantel/${plantelId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${await currentUser.getIdToken()}`
            }
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Error desconocido' }));
            throw new Error(error.error || 'Error al eliminar plantel');
        }

        console.log('✅ Plantel eliminado exitosamente');
        showMessage('Plantel eliminado exitosamente.', 'success');
        window.loadAllPlanteles();
        window.loadPlantelesDropdown(); // Actualizar el dropdown también

    } catch (error) {
        console.error('Error al eliminar plantel:', error);
        showMessage(error.message || 'Error al eliminar plantel.', 'error');
    }
};

// Configurar el formulario de planteles
function setupPlantelForm() {
    const form = document.getElementById('plantelForm');
    if (!form) return;

    form.addEventListener('submit', createPlantel);
}

// Configurar el formulario de creación de usuarios
function setupUserCreationForm() {
    const form = document.getElementById('createUserForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await createNewUser();
    });
}

// Crear nuevo usuario (solo superAdmin)
async function createNewUser() {
    try {
        const email = document.getElementById('userEmail')?.value?.trim() || '';
        const password = document.getElementById('userPassword')?.value?.trim() || '';
        const role = document.getElementById('newUserRole')?.value || '';

        console.log('🔍 Validando campos básicos:', { email, password, role });

        if (!email || !password || !role) {
            showMessage('Por favor, completa todos los campos obligatorios (email, contraseña, rol).', 'error');
            return;
        }

        const userData = {
            email,
            password,
            role,
            approved: true, // Los usuarios creados por admin están pre-aprobados
            createdAt: new Date().toISOString(),
            createdBy: currentUser.uid
        };

        // Si es director o mentor, agregar campos adicionales
        if (role === 'director' || role === 'mentor') {
            const name = document.getElementById('newUserName')?.value?.trim() || '';
            const lastName = document.getElementById('newUserLastName')?.value?.trim() || '';
            const plantel = document.getElementById('newUserPlantel')?.value?.trim() || '';
            const ciudad = document.getElementById('newUserCiudad')?.value?.trim() || '';
            const whatsapp = document.getElementById('newUserWhatsapp')?.value?.trim() || '';

            console.log('🔍 Validando campos adicionales:', { name, lastName, plantel, ciudad, whatsapp });

            if (!name || !lastName || !plantel || !ciudad || !whatsapp) {
                showMessage('Por favor, completa todos los campos requeridos: nombre, apellido, plantel, ciudad y whatsapp.', 'error');
                return;
            }

            userData.name = name;
            userData.lastName = lastName;
            userData.plantel = plantel;
            userData.ciudad = ciudad;
            userData.whatsapp = whatsapp;
            userData.displayName = `${name} ${lastName}`;
        } else {
            // Para superAdmin, usar el email como nombre
            userData.name = email.split('@')[0];
        }

        console.log('✅ Datos del usuario a enviar:', userData);

        // Llamar a función del servidor para crear el usuario
        // Nota: Esto requiere Cloud Functions porque Firebase Auth no permite
        // crear usuarios desde el cliente sin autenticarse como ese usuario
        const response = await fetch(`${window.API_BASE || ''}/admin/createUser`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${await currentUser.getIdToken()}`
            },
            body: JSON.stringify(userData)
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Error desconocido' }));
            throw new Error(error.error || 'Error al crear usuario');
        }

        showMessage('Usuario creado exitosamente.', 'success');
        window.resetUserForm();
        window.loadAllUsers();

    } catch (error) {
        console.error('Error al crear usuario:', error);
        showMessage(error.message || 'Error al crear usuario.', 'error');
    }
}

// Exportar función para uso global
window.createNewUser = createNewUser;

function showMessage(message, type) {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = message;
    messageDiv.className = 'message ' + type;
    messageDiv.style.display = 'block';
    
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 5000);
}

// Exponer showMessage globalmente
window.showMessage = showMessage;

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