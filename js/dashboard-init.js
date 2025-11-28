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
    onSnapshot,
    collection,
    query,
    orderBy,
    getDocs,
    addDoc,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Importar el namespace de firebase para FieldValue
import * as firebase from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

import { firebaseConfig } from './firebase-config.js';

console.log('🔥 Inicializando Firebase...');
const app = initializeApp(firebaseConfig);
console.log('✅ Firebase App inicializada');

export const auth = getAuth(app);
console.log('✅ Firebase Auth obtenida');

export const db = getFirestore(app);
console.log('✅ Firestore obtenida');

// Exponer auth y db globalmente para compatibilidad
window.auth = auth;
window.db = db;
window.firebase = { firestore: { FieldValue: { serverTimestamp } } };

console.log('✅ Firebase expuesta globalmente:');
console.log('  - window.auth:', !!window.auth);
console.log('  - window.db:', !!window.db);

// Exponer funciones de Firestore globalmente para facilitar el uso
window.firestoreHelpers = {
    collection,
    query,
    where,
    orderBy,
    getDocs,
    addDoc,
    doc,
    getDoc,
    updateDoc,
    serverTimestamp
};

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
        // Verificar que currentUser exista y tenga un uid
        if (!currentUser || !currentUser.uid) {
            console.error('Usuario no disponible o sin UID');
            showMessage('Error de autenticación. Por favor, inicia sesión nuevamente.', 'error');
            setTimeout(() => {
                window.logout();
            }, 2000);
            return;
        }

        console.log('Cargando datos para usuario:', currentUser.uid);
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));

        if (userDoc.exists()) {
            currentUserData = { id: userDoc.id, ...userDoc.data() };
            console.log('Datos de usuario cargados:', currentUserData.role);

            // Cargar permisos individuales del usuario desde Firestore
            if (!currentUserData.permisos) {
                // Si no tiene permisos personalizados, usar los por defecto según su rol
                currentUserData.permisos = getDefaultPermisos(currentUserData.role);
                console.log('Usando permisos por defecto para rol:', currentUserData.role);
            } else {
                console.log('Usando permisos personalizados del usuario');
            }

            if (!currentUserData.approved && currentUserData.role !== 'admin' && currentUserData.role !== 'superAdmin') {
                showMessage('Tu cuenta aún no ha sido aprobada.', 'error');
                setTimeout(() => {
                    window.logout();
                }, 2000);
                return;
            }

            updateUI();
            loadContent();
        } else {
            console.error('No se encontró el documento del usuario en Firestore');
            showMessage('No se encontraron datos para tu usuario. Contacta al administrador.', 'error');
        }
    } catch (error) {
        console.error('Error al cargar datos del usuario:', error);
        showMessage('Error al cargar datos del usuario: ' + (error.message || 'Error desconocido'), 'error');
    }
}

function updateUI() {
    try {
        console.log('Actualizando UI para usuario:', currentUserData?.role);
        
        if (!currentUserData) {
            console.error('No hay datos de usuario disponibles para actualizar la UI');
            return;
        }
        
        const roleLabels = {
            'superAdmin': 'Super Admin',
            'director': 'Director',
            'mentor': 'Mentor',
            'admin': 'Admin',
            'user': 'Usuario'
        };

        // Obtener nombre para mostrar, con fallbacks
        const email = currentUserData.email || currentUser?.email || '';
        const displayName = currentUserData.name || (email ? email.split('@')[0] : 'Usuario');
        
        // Actualizar elementos de la UI con verificación de existencia
        const userNameEl = document.getElementById('userName');
        if (userNameEl) userNameEl.textContent = displayName;
        
        const userRoleEl = document.getElementById('userRole');
        if (userRoleEl) userRoleEl.textContent = roleLabels[currentUserData.role] || 'Usuario';

        // Mostrar foto de perfil si existe (usuarios de Google)
        if (currentUserData.photoURL) {
            const avatarImg = document.getElementById('userAvatar');
            if (avatarImg) {
                avatarImg.src = currentUserData.photoURL;
                avatarImg.classList.remove('hidden');
            }
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
                description: 'Tienes acceso a todas las aplicaciones: Análisis de Video, Carta Descriptiva y Buscador de Materias.'
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

        const welcomeTitleEl = document.getElementById('welcomeTitle');
        if (welcomeTitleEl) welcomeTitleEl.textContent = message.title;
        
        const welcomeDescEl = document.getElementById('welcomeDescription');
        if (welcomeDescEl) welcomeDescEl.textContent = message.description;

        // Mostrar vista unificada de iconos para TODOS los roles
        const userViewEl = document.getElementById('userView');

        // Todos usan la misma vista
        if (userViewEl) userViewEl.classList.remove('hidden');

        // Botón de mis solicitudes - solo para roles no-admin
        const btnMisSolicitudes = document.getElementById('btnMisSolicitudes');
        if (currentUserData.role === 'admin' || currentUserData.role === 'superAdmin') {
            if (btnMisSolicitudes) btnMisSolicitudes.classList.add('hidden');
        } else {
            if (btnMisSolicitudes) btnMisSolicitudes.classList.remove('hidden');
        }
        
        console.log('UI actualizada correctamente');
    } catch (error) {
        console.error('Error al actualizar la UI:', error);
    }
}

function loadContent() {
    try {
        console.log('Cargando contenido para rol:', currentUserData?.role);

        if (!currentUserData || !currentUserData.role) {
            console.error('No hay datos de usuario o rol definido para cargar contenido');
            return;
        }

        // TODOS los roles ahora cargan aplicaciones (iconos)
        loadAppsForRole(currentUserData.role);

        // Setup de formularios para superAdmin
        if (currentUserData.role === 'superAdmin') {
            setupUserCreationForm();
            setupPlantelForm();
        }

        // Cargar solicitudes del usuario si no es admin
        if (currentUserData.role !== 'admin' && currentUserData.role !== 'superAdmin') {
            loadMisSolicitudes();
        }

        console.log('Contenido cargado correctamente');
    } catch (error) {
        console.error('Error al cargar contenido:', error);
    }
}

// Cargar aplicaciones según el rol
function loadAppsForRole(role) {
    try {
        console.log('Cargando aplicaciones para rol:', role);

        if (!role) {
            console.error('No se especificó un rol para cargar aplicaciones');
            return;
        }

        const appsGrid = document.getElementById('appsGrid');
        if (!appsGrid) {
            console.warn('Elemento appsGrid no encontrado en el DOM');
            return;
        }

        // Usar permisos del usuario (personalizados o por defecto)
        let permisos = currentUserData?.permisos || getDefaultPermisos(role);
        console.log('Permisos del usuario:', permisos);

        // Definir todas las aplicaciones disponibles con sus claves de permiso
        const todasLasApps = {
            analizador_videos: {
                name: 'Analizador de Videos',
                icon: `<svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>`,
                gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                onClick: 'openVideoAnalyzer()'
            },
            carta_descriptiva: {
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
            buscador_materias: {
                name: 'Buscador de Materias',
                icon: `<svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="M21 21l-4.35-4.35"></path>
                    <line x1="11" y1="8" x2="11" y2="14"></line>
                    <line x1="8" y1="11" x2="14" y2="11"></line>
                </svg>`,
                gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                onClick: 'openClaseFinder()'
            },
            // Iconos administrativos (solo para superAdmin)
            gestion_usuarios: {
                name: 'Gestión de Usuarios',
                icon: `<svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>`,
                gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                onClick: 'openGestionUsuariosModal()'
            },
            gestion_planteles: {
                name: 'Gestionar Planteles',
                icon: `<svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                    <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>`,
                gradient: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
                onClick: 'openGestionPlantelesModal()'
            },
            solicitudes_certificados: {
                name: 'Solicitudes Certificados',
                icon: `<svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                </svg>`,
                gradient: 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)',
                onClick: 'openSolicitudesCertificadosModal()'
            }
        };

        // Filtrar aplicaciones según los permisos del usuario
        const userApps = [];
        for (const [key, app] of Object.entries(todasLasApps)) {
            if (permisos[key] === true) {
                userApps.push(app);
            }
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
        console.log(`Aplicaciones cargadas: ${userApps.length}`);
  } catch (error) {
    console.error('Error al cargar aplicaciones:', error);
  }
}

// Función para obtener permisos por defecto según el rol
function getDefaultPermisos(role) {
    const permisosDefault = {
        superAdmin: {
            // Herramientas regulares
            analizador_videos: true,
            carta_descriptiva: true,
            buscador_materias: true,
            // Herramientas administrativas
            gestion_usuarios: true,
            gestion_planteles: true,
            solicitudes_certificados: true
        },
        admin: {
            // Herramientas regulares
            analizador_videos: true,
            carta_descriptiva: true,
            buscador_materias: true,
            // Herramientas administrativas
            gestion_usuarios: true,
            gestion_planteles: true,
            solicitudes_certificados: true
        },
        director: {
            analizador_videos: true,
            carta_descriptiva: true,
            buscador_materias: true,
            solicitudes_certificados: true,  // Directores pueden crear y ver sus solicitudes
            // Sin acceso a herramientas administrativas
            gestion_usuarios: false,
            gestion_planteles: false
        },
        mentor: {
            analizador_videos: true,
            carta_descriptiva: true,
            buscador_materias: true,
            solicitudes_certificados: true,  // Mentores pueden crear y ver sus solicitudes
            // Sin acceso a herramientas administrativas
            gestion_usuarios: false,
            gestion_planteles: false
        },
        user: {
            analizador_videos: false,
            carta_descriptiva: false,
            buscador_materias: true,
            solicitudes_certificados: false,  // Usuarios normales no tienen acceso
            // Sin acceso a herramientas administrativas
            gestion_usuarios: false,
            gestion_planteles: false
        }
    };

    return permisosDefault[role] || permisosDefault.user;
}

// Exportar para uso global
window.loadAppsForRole = loadAppsForRole;

// Función para abrir la aplicación de Solicitud de Certificado
window.openSolicitudCertificado = function() {
    window.location.href = 'solicitud-certificado/index.html';
};

/* ===========================
   GESTIÓN DE PLANTELES
   =========================== */

// Cargar planteles en el dropdown del formulario de usuario
window.loadPlantelesDropdown = async function() {
    try {
        console.log('📥 Cargando planteles para dropdown...');

        if (!currentUser) {
            console.error('No hay usuario autenticado para obtener token');
            showMessage('Error de autenticación. Por favor, inicia sesión nuevamente.', 'error');
            return;
        }

        // Llamar al endpoint del servidor
        const token = await currentUser.getIdToken().catch(err => {
            console.error('Error al obtener token:', err);
            throw new Error('No se pudo obtener el token de autenticación');
        });

        const response = await fetch(`${window.API_BASE || ''}/admin/getPlanteles`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
            throw new Error(errorData.error || `Error al cargar planteles: ${response.status}`);
        }

        const result = await response.json();
        const planteles = result.planteles || [];
        console.log(`✅ Planteles para dropdown: ${planteles.length}`);

        const plantelSelect = document.getElementById('newUserPlantel');
        if (!plantelSelect) {
            console.warn('Elemento newUserPlantel no encontrado en el DOM');
            return;
        }

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
        showMessage(error.message || 'Error al cargar planteles', 'error');
    }
};

// Cargar lista de planteles en el panel de gestión
window.loadAllPlanteles = async function() {
    try {
        console.log('📥 Cargando planteles desde el servidor...');

        if (!currentUser) {
            console.error('No hay usuario autenticado para obtener token');
            showMessage('Error de autenticación. Por favor, inicia sesión nuevamente.', 'error');
            return;
        }

        // Llamar al endpoint del servidor
        const token = await currentUser.getIdToken().catch(err => {
            console.error('Error al obtener token:', err);
            throw new Error('No se pudo obtener el token de autenticación');
        });

        const response = await fetch(`${window.API_BASE || ''}/admin/getPlanteles`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Error desconocido' }));
            throw new Error(error.error || `Error al cargar planteles: ${response.status}`);
        }

        const result = await response.json();
        const planteles = result.planteles || [];
        console.log(`✅ Planteles cargados: ${planteles.length}`);

        const container = document.getElementById('plantelesContainer');
        if (!container) {
            console.warn('Elemento plantelesContainer no encontrado en el DOM');
            return;
        }

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
            // Sanitizar valores para evitar XSS
            const plantelName = plantel.name ? plantel.name.replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
            const plantelId = plantel.id ? plantel.id.replace(/'/g, '\\\'') : '';
            
            html += `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px;">
                    <div>
                        <strong style="font-size: 16px; color: #1f2937;">🏫 ${plantelName}</strong>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button onclick="deletePlantel('${plantelId}', '${plantelName}')" class="btn-secondary" style="padding: 8px 16px; font-size: 14px;">
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
    if (event) {
        event.preventDefault();
    }

    try {
        const nameInput = document.getElementById('plantelName');
        const name = nameInput?.value?.trim();

        if (!name) {
            showMessage('Por favor, ingresa el nombre del plantel.', 'error');
            return;
        }

        if (!currentUser) {
            console.error('No hay usuario autenticado para obtener token');
            showMessage('Error de autenticación. Por favor, inicia sesión nuevamente.', 'error');
            return;
        }

        console.log('📤 Enviando solicitud para crear plantel:', { name });

        // Obtener token con manejo de errores
        const token = await currentUser.getIdToken().catch(err => {
            console.error('Error al obtener token:', err);
            throw new Error('No se pudo obtener el token de autenticación');
        });

        // Llamar al endpoint del servidor para crear el plantel
        const response = await fetch(`${window.API_BASE || ''}/admin/createPlantel`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Error desconocido' }));
            throw new Error(error.error || `Error al crear plantel: ${response.status}`);
        }

        const result = await response.json();
        console.log('✅ Plantel creado:', result);

        showMessage('Plantel creado exitosamente.', 'success');
        
        // Verificar que las funciones existan antes de llamarlas
        if (typeof window.closePlantelModal === 'function') {
            window.closePlantelModal();
        } else {
            console.warn('Función closePlantelModal no disponible');
        }
        
        if (typeof window.loadAllPlanteles === 'function') {
            window.loadAllPlanteles();
        } else {
            console.warn('Función loadAllPlanteles no disponible');
        }
        
        if (typeof window.loadPlantelesDropdown === 'function') {
            window.loadPlantelesDropdown(); // Actualizar el dropdown también
        } else {
            console.warn('Función loadPlantelesDropdown no disponible');
        }

    } catch (error) {
        console.error('Error al crear plantel:', error);
        showMessage(error.message || 'Error al crear plantel.', 'error');
    }
};

// Eliminar plantel
window.deletePlantel = async function(plantelId, plantelName) {
    if (!plantelId) {
        console.error('ID de plantel no proporcionado');
        showMessage('Error: ID de plantel no válido', 'error');
        return;
    }
    
    if (!confirm(`¿Estás seguro de eliminar el plantel "${plantelName}"?`)) {
        return;
    }

    try {
        console.log('🗑️ Eliminando plantel:', plantelId);

        if (!currentUser) {
            console.error('No hay usuario autenticado para obtener token');
            showMessage('Error de autenticación. Por favor, inicia sesión nuevamente.', 'error');
            return;
        }

        // Obtener token con manejo de errores
        const token = await currentUser.getIdToken().catch(err => {
            console.error('Error al obtener token:', err);
            throw new Error('No se pudo obtener el token de autenticación');
        });

        // Llamar al endpoint del servidor
        const response = await fetch(`${window.API_BASE || ''}/admin/deletePlantel/${plantelId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Error desconocido' }));
            throw new Error(error.error || `Error al eliminar plantel: ${response.status}`);
        }

        console.log('✅ Plantel eliminado exitosamente');
        showMessage('Plantel eliminado exitosamente.', 'success');
        
        // Verificar que las funciones existan antes de llamarlas
        if (typeof window.loadAllPlanteles === 'function') {
            window.loadAllPlanteles();
        } else {
            console.warn('Función loadAllPlanteles no disponible');
        }
        
        if (typeof window.loadPlantelesDropdown === 'function') {
            window.loadPlantelesDropdown(); // Actualizar el dropdown también
        } else {
            console.warn('Función loadPlantelesDropdown no disponible');
        }

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

        if (!currentUser) {
            console.error('No hay usuario autenticado para obtener token');
            showMessage('Error de autenticación. Por favor, inicia sesión nuevamente.', 'error');
            return;
        }

        // Capturar permisos personalizados
        const permisos = {
            analizador_videos: document.getElementById('perm_analizador_videos')?.checked || false,
            carta_descriptiva: document.getElementById('perm_carta_descriptiva')?.checked || false,
            buscador_materias: document.getElementById('perm_buscador_materias')?.checked || false,
            solicitud_certificado: document.getElementById('perm_solicitud_certificado')?.checked || false,
            // Permisos administrativos (solo para superAdmin)
            gestion_usuarios: role === 'superAdmin',
            gestion_planteles: role === 'superAdmin',
            solicitudes_certificados: role === 'superAdmin',
            permisos_dashboard: role === 'superAdmin'
        };

        const userData = {
            email,
            password,
            role,
            permisos, // Añadir permisos personalizados
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

        console.log('✅ Permisos personalizados:', permisos);

        console.log('✅ Datos del usuario a enviar:', userData);

        // Obtener token con manejo de errores
        const token = await currentUser.getIdToken().catch(err => {
            console.error('Error al obtener token:', err);
            throw new Error('No se pudo obtener el token de autenticación');
        });

        // Llamar a función del servidor para crear el usuario
        // Nota: Esto requiere Cloud Functions porque Firebase Auth no permite
        // crear usuarios desde el cliente sin autenticarse como ese usuario
        const response = await fetch(`${window.API_BASE || ''}/admin/createUser`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(userData)
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Error desconocido' }));
            throw new Error(error.error || `Error al crear usuario: ${response.status}`);
        }

        showMessage('Usuario creado exitosamente.', 'success');
        
        // Verificar que las funciones existan antes de llamarlas
        if (typeof window.resetUserForm === 'function') {
            window.resetUserForm();
        } else {
            console.warn('Función resetUserForm no disponible');
            // Intentar limpiar el formulario manualmente
            const form = document.getElementById('createUserForm');
            if (form) form.reset();
        }
        
        if (typeof window.loadAllUsers === 'function') {
            window.loadAllUsers();
        } else {
            console.warn('Función loadAllUsers no disponible');
        }

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
        console.log('Cerrando sesión...');
        
        if (!auth) {
            console.error('Objeto de autenticación no disponible');
            // Redirigir de todos modos para evitar que el usuario quede atrapado
            window.location.href = 'index.html';
            return;
        }
        
        await signOut(auth);
        console.log('Sesión cerrada exitosamente');
        
        // Limpiar variables globales
        currentUser = null;
        currentUserData = null;
        
        // Redirigir a la página de inicio de sesión
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
        showMessage('Error al cerrar sesión. Intenta recargar la página.', 'error');
        
        // Intentar redirigir de todos modos después de un breve retraso
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
    }
};

/* ===========================
   GESTIÓN DE SOLICITUDES DE CERTIFICADOS
   =========================== */

// Cargar todas las solicitudes de certificados (directo con Firebase)
window.loadSolicitudesCertificados = async function() {
    try {
        console.log('📥 Cargando solicitudes de certificados desde Firebase...');

        if (!currentUser || !currentUserData) {
            console.error('No hay usuario autenticado');
            showMessage('Error de autenticación. Por favor, inicia sesión nuevamente.', 'error');
            return;
        }

        // Verificar que sea admin, superAdmin o director
        const allowedRoles = ['admin', 'superAdmin', 'director'];
        if (!allowedRoles.includes(currentUserData.role)) {
            console.error('No tienes permisos para ver todas las solicitudes');
            showMessage('No tienes permisos para acceder a esta sección.', 'error');
            return;
        }

        const container = document.getElementById('solicitudesCertificadosContainer');
        if (!container) {
            console.warn('Elemento solicitudesCertificadosContainer no encontrado');
            return;
        }

        // Mostrar loading
        container.innerHTML = '<div style="text-align: center; padding: 40px;"><div class="spinner"></div><p style="margin-top: 16px; color: #6b7280;">Cargando solicitudes...</p></div>';

        // Obtener todas las solicitudes directamente de Firebase usando v9 modular syntax
        const { collection, query, orderBy, getDocs } = window.firestoreHelpers;
        const solicitudesRef = collection(db, 'solicitudesCertificado');
        const q = query(solicitudesRef, orderBy('createdAt', 'desc'));
        const solicitudesSnapshot = await getDocs(q);

        const solicitudes = [];
        solicitudesSnapshot.forEach(docSnap => {
            const data = docSnap.data();
            console.log('📄 Solicitud encontrada:', {
                firestoreId: docSnap.id,
                localId: data.id,
                userId: data.userId,
                nombres: data.nombres
            });
            
            // Usar el ID de Firestore como ID principal
            solicitudes.push({
                ...data,
                id: docSnap.id, // ID de Firestore (el correcto)
                firestoreId: docSnap.id, // Mantener también como firestoreId
                localId: data.id, // El ID local generado en el formulario
                createdAt: data.createdAt?.toDate().toISOString(),
                updatedAt: data.updatedAt?.toDate().toISOString(),
                fechaCreacion: data.fechaCreacion || data.createdAt?.toDate().toISOString()
            });
        });

        console.log(`✅ Solicitudes cargadas: ${solicitudes.length}`);
        console.log('📋 IDs de solicitudes:', solicitudes.map(s => ({ firestore: s.id, local: s.localId })));

        if (solicitudes.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #9ca3af;">
                    <p>No hay solicitudes de certificados registradas aún.</p>
                </div>
            `;
            return;
        }

        renderSolicitudesCertificados(solicitudes);

    } catch (error) {
        console.error('Error al cargar solicitudes:', error);
        const container = document.getElementById('solicitudesCertificadosContainer');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #ef4444;">
                    <p>Error al cargar las solicitudes: ${error.message}</p>
                </div>
            `;
        }
        showMessage(error.message || 'Error al cargar solicitudes de certificados.', 'error');
    }
};

// Renderizar solicitudes
function renderSolicitudesCertificados(solicitudes) {
    const container = document.getElementById('solicitudesCertificadosContainer');
    if (!container) return;

    let html = '<div style="display: grid; gap: 16px;">';

    solicitudes.forEach((solicitud) => {
        console.log('🔖 Renderizando solicitud:', { id: solicitud.id, nombres: solicitud.nombres });
        
        const estatusColors = {
            pendiente: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
            en_proceso: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
            aprobado: { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
            rechazado: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' },
            completado: { bg: '#e0e7ff', border: '#818cf8', text: '#3730a3' }
        };

        const estatus = solicitud.estatus || 'pendiente';
        const color = estatusColors[estatus] || estatusColors.pendiente;
        
        // Escapar el ID para evitar problemas con caracteres especiales
        const escapedId = solicitud.id.replace(/'/g, "\\'");

        html += `
            <div style="border: 2px solid ${color.border}; background: ${color.bg}; border-radius: 8px; padding: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: start; gap: 16px; margin-bottom: 16px;">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                            <span style="background: ${color.border}; color: white; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600;">
                                ${estatus.replace('_', ' ').toUpperCase()}
                            </span>
                            <span style="color: #6b7280; font-size: 14px;">
                                ID: ${solicitud.id}
                            </span>
                        </div>
                        <h4 style="margin: 0 0 8px 0; color: #1f2937; font-size: 18px; font-weight: 600;">
                            ${solicitud.nombres} ${solicitud.apellidoPaterno} ${solicitud.apellidoMaterno}
                        </h4>
                        <div style="display: grid; gap: 6px; color: #4b5563; font-size: 14px;">
                            <div><strong>CURP:</strong> ${solicitud.curpTexto || 'N/A'}</div>
                            <div><strong>Email:</strong> ${solicitud.correoElectronico || 'N/A'}</div>
                            <div><strong>WhatsApp:</strong> ${solicitud.whatsapp || 'N/A'}</div>
                            <div><strong>Plantel:</strong> ${solicitud.plantel || 'N/A'}</div>
                            <div><strong>Promedio:</strong> ${solicitud.promedio || 'N/A'}</div>
                            <div><strong>Fecha de solicitud:</strong> ${solicitud.fechaCreacion ? new Date(solicitud.fechaCreacion).toLocaleString('es-ES') : 'N/A'}</div>
                        </div>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 8px; min-width: 200px;">
                        <label style="font-size: 12px; font-weight: 600; color: #374151;">Cambiar estatus:</label>
                        <select onchange="cambiarEstatusCertificado('${escapedId}', this.value)" style="padding: 8px; border-radius: 6px; border: 1px solid #d1d5db; font-size: 14px;">
                            <option value="pendiente" ${estatus === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                            <option value="en_proceso" ${estatus === 'en_proceso' ? 'selected' : ''}>En Proceso</option>
                            <option value="aprobado" ${estatus === 'aprobado' ? 'selected' : ''}>Aprobado</option>
                            <option value="rechazado" ${estatus === 'rechazado' ? 'selected' : ''}>Rechazado</option>
                            <option value="completado" ${estatus === 'completado' ? 'selected' : ''}>Completado</option>
                        </select>
                        <button onclick="verDetallesSolicitud('${escapedId}')" class="btn-secondary" style="padding: 8px 12px; font-size: 14px;">
                            Ver Detalles
                        </button>
                    </div>
                </div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
}

// Cambiar estatus de certificado (directo con Firebase)
window.cambiarEstatusCertificado = async function(solicitudId, nuevoEstatus) {
    try {
        console.log('🔄 Iniciando cambio de estatus...');
        console.log('📋 Parámetros recibidos:', { solicitudId, nuevoEstatus, tipo: typeof solicitudId });
        
        if (!currentUser) {
            showMessage('Error de autenticación. Por favor, inicia sesión nuevamente.', 'error');
            return;
        }

        // Verificar que el usuario sea admin o superAdmin
        if (!currentUserData || (currentUserData.role !== 'admin' && currentUserData.role !== 'superAdmin')) {
            showMessage('No tienes permisos para cambiar el estatus.', 'error');
            return;
        }

        // Validar estatus
        const estatusValidos = ['pendiente', 'en_proceso', 'aprobado', 'rechazado', 'completado'];
        if (!estatusValidos.includes(nuevoEstatus)) {
            showMessage('Estatus no válido.', 'error');
            return;
        }

        // Obtener referencia a la solicitud usando v9 modular syntax
        const { doc, getDoc, updateDoc, serverTimestamp } = window.firestoreHelpers;
        
        console.log('🔍 Buscando solicitud con ID:', solicitudId);
        console.log('🗄️ Base de datos:', db ? 'Disponible' : 'No disponible');
        
        const solicitudRef = doc(db, 'solicitudesCertificado', solicitudId);
        console.log('📍 Referencia creada:', solicitudRef.path);
        
        const solicitudDoc = await getDoc(solicitudRef);
        console.log('📄 Documento obtenido, existe:', solicitudDoc.exists());

        if (!solicitudDoc.exists()) {
            console.error('❌ Solicitud no encontrada en Firestore');
            console.error('ID buscado:', solicitudId);
            throw new Error('Solicitud no encontrada');
        }
        
        console.log('✅ Solicitud encontrada');

        const solicitudData = solicitudDoc.data();
        const estatusAnterior = solicitudData.estatus || 'pendiente';
        
        // Si el estatus no cambió, no hacer nada
        if (estatusAnterior === nuevoEstatus) {
            return;
        }

        const estatusHistorial = solicitudData.estatusHistorial || [];

        // Agregar entrada al historial
        const ahora = new Date().toISOString();
        estatusHistorial.push({
            estatus: nuevoEstatus,
            fecha: ahora,
            nota: `Cambio de estatus de "${estatusAnterior}" a "${nuevoEstatus}" por ${currentUserData.name || currentUserData.email}`,
            cambiadoPor: currentUser.uid,
            cambiadoPorEmail: currentUserData.email || currentUser.email,
            cambiadoPorNombre: currentUserData.name || currentUserData.email
        });

        // Actualizar documento
        await updateDoc(solicitudRef, {
            estatus: nuevoEstatus,
            estatusHistorial: estatusHistorial,
            updatedAt: serverTimestamp(),
            ultimaModificacionPor: currentUser.uid,
            ultimaModificacionFecha: ahora
        });

        console.log('✅ Estatus actualizado correctamente');
        showMessage('Estatus actualizado correctamente.', 'success');

        // Recargar lista de solicitudes
        if (typeof window.loadSolicitudesCertificados === 'function') {
            window.loadSolicitudesCertificados();
        }

        // Si el modal de detalles está abierto, actualizarlo también
        const modal = document.getElementById('detallesSolicitudModal');
        if (modal && modal.classList.contains('open')) {
            // Recargar los detalles de la solicitud
            const updatedDoc = await getDoc(solicitudRef);
            if (updatedDoc.exists()) {
                const updatedData = updatedDoc.data();
                const updatedSolicitud = {
                    id: updatedDoc.id,
                    ...updatedData,
                    createdAt: updatedData.createdAt?.toDate().toISOString(),
                    updatedAt: updatedData.updatedAt?.toDate().toISOString(),
                    fechaCreacion: updatedData.fechaCreacion || updatedData.createdAt?.toDate().toISOString()
                };
                renderDetallesSolicitudAdmin(updatedSolicitud);
            }
        }

    } catch (error) {
        console.error('Error al cambiar estatus:', error);
        showMessage(error.message || 'Error al cambiar el estatus.', 'error');

        // Recargar para revertir el cambio visual
        if (typeof window.loadSolicitudesCertificados === 'function') {
            window.loadSolicitudesCertificados();
        }
    }
};

// Ver detalles de solicitud (para admin/superAdmin/director)
window.verDetallesSolicitud = async function(solicitudId) {
    try {
        console.log('📄 Cargando detalles de solicitud desde Firebase:', solicitudId);

        if (!currentUser || !currentUserData) {
            showMessage('Error de autenticación. Por favor, inicia sesión nuevamente.', 'error');
            return;
        }

        // Verificar permisos
        const allowedRoles = ['admin', 'superAdmin', 'director'];
        if (!allowedRoles.includes(currentUserData.role)) {
            showMessage('No tienes permisos para ver los detalles de esta solicitud.', 'error');
            return;
        }

        // Obtener solicitud directamente de Firebase usando v9 modular syntax
        const { doc, getDoc } = window.firestoreHelpers;
        const solicitudRef = doc(db, 'solicitudesCertificado', solicitudId);
        const solicitudDoc = await getDoc(solicitudRef);

        if (!solicitudDoc.exists()) {
            throw new Error('Solicitud no encontrada');
        }

        const data = solicitudDoc.data();
        const solicitud = {
            id: solicitudDoc.id,
            ...data,
            createdAt: data.createdAt?.toDate().toISOString(),
            updatedAt: data.updatedAt?.toDate().toISOString(),
            fechaCreacion: data.fechaCreacion || data.createdAt?.toDate().toISOString()
        };

        // Abrir modal de detalles
        openDetallesSolicitudModal(solicitud);

    } catch (error) {
        console.error('Error al cargar detalles:', error);
        showMessage(error.message || 'Error al cargar los detalles de la solicitud.', 'error');
    }
};

// Abrir modal de detalles de solicitud (para admin/director)
async function openDetallesSolicitudModal(solicitud) {
    const modal = document.getElementById('detallesSolicitudModal');
    if (!modal) {
        console.error('Modal de detalles no encontrado');
        return;
    }

    // Guardar solicitud actual para comentarios
    solicitudActual = solicitud;

    // Renderizar detalles
    renderDetallesSolicitudAdmin(solicitud);

    // Cargar comentarios
    await loadComentariosAdmin(solicitud.id);

    // Abrir modal
    modal.classList.add('open');
}

// Cerrar modal de detalles
window.closeDetallesSolicitudModal = function() {
    // Cancelar listener de comentarios si existe
    if (typeof comentariosAdminUnsubscribe === 'function') {
        comentariosAdminUnsubscribe();
        comentariosAdminUnsubscribe = null;
    }

    const modal = document.getElementById('detallesSolicitudModal');
    if (modal) {
        modal.classList.remove('open');
    }

    // Limpiar solicitud actual
    solicitudActual = null;

    // Limpiar textarea de comentarios
    const textarea = document.getElementById('nuevoComentarioAdmin');
    if (textarea) textarea.value = '';
};

// Renderizar detalles de solicitud para admin/director
function renderDetallesSolicitudAdmin(solicitud) {
    const container = document.getElementById('detallesSolicitudContent');
    if (!container) return;

    const estatusColors = {
        pendiente: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
        en_proceso: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
        aprobado: { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
        rechazado: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' },
        completado: { bg: '#e0e7ff', border: '#818cf8', text: '#3730a3' }
    };

    const estatus = solicitud.estatus || 'pendiente';
    const color = estatusColors[estatus] || estatusColors.pendiente;

    // Determinar si el usuario puede cambiar el estatus
    const canChangeStatus = currentUserData && (currentUserData.role === 'admin' || currentUserData.role === 'superAdmin');

    let html = `
        <div style="border: 2px solid ${color.border}; background: ${color.bg}; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                <span style="background: ${color.border}; color: white; padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 600;">
                    ${estatus.replace('_', ' ').toUpperCase()}
                </span>
                <span style="color: #6b7280; font-size: 16px; font-weight: 500;">
                    Solicitud #${solicitud.numeroPedido || solicitud.id}
                </span>
            </div>

            <h3 style="margin: 0 0 20px 0; color: #1f2937; font-size: 22px;">
                ${solicitud.nombres} ${solicitud.apellidoPaterno} ${solicitud.apellidoMaterno}
            </h3>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px;">
                <div>
                    <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600;">CURP</p>
                    <p style="margin: 0; font-size: 14px; color: #1f2937;">${solicitud.curpTexto || 'N/A'}</p>
                </div>
                <div>
                    <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600;">Correo Electrónico</p>
                    <p style="margin: 0; font-size: 14px; color: #1f2937;">${solicitud.correoElectronico || 'N/A'}</p>
                </div>
                <div>
                    <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600;">WhatsApp</p>
                    <p style="margin: 0; font-size: 14px; color: #1f2937;">${solicitud.whatsapp || 'N/A'}</p>
                </div>
                <div>
                    <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600;">Plantel</p>
                    <p style="margin: 0; font-size: 14px; color: #1f2937;">${solicitud.plantel || 'N/A'}</p>
                </div>
                <div>
                    <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600;">Promedio</p>
                    <p style="margin: 0; font-size: 14px; color: #1f2937;">${solicitud.promedio || 'N/A'}</p>
                </div>
                <div>
                    <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600;">Fecha de Solicitud</p>
                    <p style="margin: 0; font-size: 14px; color: #1f2937;">${solicitud.fechaCreacion ? new Date(solicitud.fechaCreacion).toLocaleString('es-ES') : 'N/A'}</p>
                </div>
            </div>

            ${canChangeStatus ? `
                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <label style="display: block; font-size: 12px; font-weight: 600; color: #374151; margin-bottom: 8px;">Cambiar estatus:</label>
                    <select onchange="cambiarEstatusCertificado('${solicitud.id}', this.value)" style="padding: 8px; border-radius: 6px; border: 1px solid #d1d5db; font-size: 14px; width: 100%; max-width: 300px;">
                        <option value="pendiente" ${estatus === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                        <option value="en_proceso" ${estatus === 'en_proceso' ? 'selected' : ''}>En Proceso</option>
                        <option value="aprobado" ${estatus === 'aprobado' ? 'selected' : ''}>Aprobado</option>
                        <option value="rechazado" ${estatus === 'rechazado' ? 'selected' : ''}>Rechazado</option>
                        <option value="completado" ${estatus === 'completado' ? 'selected' : ''}>Completado</option>
                    </select>
                </div>
            ` : ''}
        </div>

        <!-- Historial de estatus -->
        ${solicitud.estatusHistorial && solicitud.estatusHistorial.length > 0 ? `
            <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                <h4 style="margin: 0 0 16px 0; color: #1f2937;">📜 Historial de Estatus</h4>
                <div style="display: grid; gap: 12px;">
                    ${solicitud.estatusHistorial.map(item => `
                        <div style="display: flex; gap: 12px; padding: 12px; background: white; border-radius: 6px; border-left: 4px solid ${estatusColors[item.estatus]?.border || '#94a3b8'};">
                            <div style="flex: 1;">
                                <p style="margin: 0 0 4px 0; font-weight: 600; color: #1f2937; text-transform: uppercase; font-size: 12px;">
                                    ${item.estatus.replace('_', ' ')}
                                </p>
                                <p style="margin: 0; font-size: 14px; color: #6b7280;">
                                    ${item.nota || 'Sin nota'}
                                </p>
                            </div>
                            <div style="text-align: right; color: #6b7280; font-size: 12px;">
                                ${item.fecha ? new Date(item.fecha).toLocaleString('es-ES') : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : ''}

        <!-- Documentos adjuntos -->
        <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <h4 style="margin: 0 0 16px 0; color: #1f2937;">📎 Documentos Adjuntos</h4>
            <div style="display: grid; gap: 8px;">
                ${solicitud.certificadoSecundaria ? `
                    <div style="padding: 8px; background: white; border-radius: 4px;">
                        <strong>Certificado de Secundaria:</strong> ${solicitud.certificadoSecundaria.fileName || 'Archivo adjunto'}
                    </div>
                ` : ''}
                ${solicitud.actaNacimiento ? `
                    <div style="padding: 8px; background: white; border-radius: 4px;">
                        <strong>Acta de Nacimiento:</strong> ${solicitud.actaNacimiento.fileName || 'Archivo adjunto'}
                    </div>
                ` : ''}
                ${solicitud.curpArchivo ? `
                    <div style="padding: 8px; background: white; border-radius: 4px;">
                        <strong>CURP:</strong> ${solicitud.curpArchivo.fileName || 'Archivo adjunto'}
                    </div>
                ` : ''}
                ${solicitud.comprobanteDomicilio ? `
                    <div style="padding: 8px; background: white; border-radius: 4px;">
                        <strong>Comprobante de Domicilio:</strong> ${solicitud.comprobanteDomicilio.fileName || 'Archivo adjunto'}
                    </div>
                ` : ''}
                ${solicitud.ine ? `
                    <div style="padding: 8px; background: white; border-radius: 4px;">
                        <strong>INE:</strong> ${solicitud.ine.fileName || 'Archivo adjunto'}
                    </div>
                ` : ''}
                ${solicitud.fotografiaAlumno ? `
                    <div style="padding: 8px; background: white; border-radius: 4px;">
                        <strong>Fotografía:</strong> ${solicitud.fotografiaAlumno.fileName || 'Archivo adjunto'}
                    </div>
                ` : ''}
            </div>
        </div>

        <!-- Sección de Comentarios -->
        <div style="margin-top: 32px; padding-top: 32px; border-top: 2px solid #e5e7eb;">
            <h4 style="margin-bottom: 16px; color: #1f2937;">💬 Comentarios y Seguimiento</h4>

            <!-- Formulario para agregar comentario -->
            <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
                <textarea
                    id="nuevoComentarioAdmin"
                    placeholder="Escribe un comentario o actualización sobre esta solicitud..."
                    style="width: 100%; min-height: 80px; padding: 12px; border: 1px solid #e5e7eb; border-radius: 6px; font-family: inherit; resize: vertical;"
                ></textarea>
                <button class="btn-primary" onclick="agregarComentarioAdmin()" style="margin-top: 12px;">
                    Agregar Comentario
                </button>
            </div>

            <!-- Lista de comentarios -->
            <div id="listaComentariosAdmin" style="display: grid; gap: 12px;">
                <!-- Los comentarios se cargarán aquí -->
            </div>
        </div>
    `;

    container.innerHTML = html;
}

// Filtrar solicitudes por estatus
window.filtrarSolicitudesCertificados = function() {
    const filtro = document.getElementById('filtroEstatusCertificados').value;
    // Por ahora, simplemente recargar todas
    // En una implementación futura, puedes filtrar en el lado del cliente
    window.loadSolicitudesCertificados();
};

/* ===========================
   GESTIÓN DE PERMISOS DEL DASHBOARD
   =========================== */

// Cargar permisos actuales
window.cargarPermisosActuales = async function() {
    try {
        console.log('📥 Cargando permisos actuales...');

        if (!currentUser) {
            showMessage('Error de autenticación. Por favor, inicia sesión nuevamente.', 'error');
            return;
        }

        const token = await currentUser.getIdToken();

        const response = await fetch(`${window.API_BASE || ''}/admin/getPermisosDashboard`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            // Si no existe configuración, usar valores por defecto
            console.log('No hay configuración guardada, usando valores por defecto');
            return;
        }

        const result = await response.json();
        const permisos = result.permisos || {};

        // Actualizar checkboxes con los permisos guardados
        document.querySelectorAll('.permiso-checkbox').forEach(checkbox => {
            const role = checkbox.getAttribute('data-role');
            const seccion = checkbox.getAttribute('data-seccion');

            if (permisos[role] && permisos[role][seccion] !== undefined) {
                checkbox.checked = permisos[role][seccion];
            }
        });

        console.log('✅ Permisos cargados correctamente');

    } catch (error) {
        console.error('Error al cargar permisos:', error);
        showMessage('Error al cargar permisos: ' + error.message, 'error');
    }
};

// Guardar permisos
window.guardarPermisos = async function() {
    try {
        if (!currentUser) {
            showMessage('Error de autenticación. Por favor, inicia sesión nuevamente.', 'error');
            return;
        }

        // Recopilar permisos de todos los checkboxes
        const permisos = {
            director: {},
            mentor: {},
            user: {}
        };

        document.querySelectorAll('.permiso-checkbox').forEach(checkbox => {
            const role = checkbox.getAttribute('data-role');
            const seccion = checkbox.getAttribute('data-seccion');
            permisos[role][seccion] = checkbox.checked;
        });

        console.log('💾 Guardando permisos:', permisos);

        const token = await currentUser.getIdToken();

        const response = await fetch(`${window.API_BASE || ''}/admin/guardarPermisosDashboard`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ permisos })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Error desconocido' }));
            throw new Error(error.error || `Error al guardar permisos: ${response.status}`);
        }

        console.log('✅ Permisos guardados correctamente');
        showMessage('Permisos guardados correctamente. Los usuarios verán los cambios en su próximo inicio de sesión.', 'success');

    } catch (error) {
        console.error('Error al guardar permisos:', error);
        showMessage(error.message || 'Error al guardar permisos.', 'error');
    }
};

/* ===========================
   GESTIÓN DE SOLICITUDES DEL USUARIO
   =========================== */

// Variable global para almacenar la solicitud actualmente visualizada
let solicitudActual = null;

// Cargar las solicitudes del usuario actual (directo con Firebase)
window.loadMisSolicitudes = async function() {
    try {
        console.log('📥 Cargando mis solicitudes de certificados desde Firebase...');

        if (!currentUser) {
            console.error('No hay usuario autenticado');
            return;
        }

        // Obtener solicitudes directamente de Firebase usando v9 modular syntax
        const { collection, query, where, orderBy, getDocs } = window.firestoreHelpers;
        const solicitudesRef = collection(db, 'solicitudesCertificado');
        const q = query(solicitudesRef, where('userId', '==', currentUser.uid), orderBy('createdAt', 'desc'));
        const solicitudesSnapshot = await getDocs(q);

        const solicitudes = [];
        solicitudesSnapshot.forEach(docSnap => {
            const data = docSnap.data();
            // Usar el ID de Firestore como ID principal
            solicitudes.push({
                ...data,
                id: docSnap.id, // ID de Firestore (el correcto)
                firestoreId: docSnap.id, // Mantener también como firestoreId
                localId: data.id, // El ID local generado en el formulario
                createdAt: data.createdAt?.toDate().toISOString(),
                updatedAt: data.updatedAt?.toDate().toISOString(),
                fechaCreacion: data.fechaCreacion || data.createdAt?.toDate().toISOString()
            });
        });

        console.log(`✅ Mis solicitudes cargadas: ${solicitudes.length}`);

        if (solicitudes.length > 0) {
            console.log('📋 Primera solicitud:', solicitudes[0]);
        }

        // Renderizar solicitudes
        renderMisSolicitudes(solicitudes);

    } catch (error) {
        console.error('Error al cargar mis solicitudes:', error);
        showMessage(error.message || 'Error al cargar tus solicitudes.', 'error');
    }
};

// Renderizar solicitudes del usuario
function renderMisSolicitudes(solicitudes) {
    const container = document.getElementById('misSolicitudesContainer');
    if (!container) return;

    // Si no hay solicitudes, mostrar mensaje
    if (!solicitudes || solicitudes.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; background: #f9fafb; border-radius: 12px; border: 2px dashed #e5e7eb;">
                <svg style="width: 64px; height: 64px; margin: 0 auto 16px; color: #9ca3af;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                <h3 style="margin: 0 0 8px 0; color: #374151; font-size: 18px;">No tienes solicitudes todavía</h3>
                <p style="margin: 0 0 20px 0; color: #6b7280;">Crea tu primera solicitud de certificado para comenzar.</p>
                <a href="solicitud-certificado/index.html" class="btn-primary" style="text-decoration: none; display: inline-block;">
                    Crear Nueva Solicitud
                </a>
            </div>
        `;
        return;
    }

    const estatusColors = {
        pendiente: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
        en_proceso: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
        aprobado: { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
        rechazado: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' },
        completado: { bg: '#e0e7ff', border: '#818cf8', text: '#3730a3' }
    };

    let html = '<div style="display: grid; gap: 16px;">';

    solicitudes.forEach((solicitud) => {
        const estatus = solicitud.estatus || 'pendiente';
        const color = estatusColors[estatus] || estatusColors.pendiente;

        html += `
            <div style="border: 2px solid ${color.border}; background: ${color.bg}; border-radius: 8px; padding: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: start; gap: 16px;">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                            <span style="background: ${color.border}; color: white; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600;">
                                ${estatus.replace('_', ' ').toUpperCase()}
                            </span>
                            <span style="color: #6b7280; font-size: 14px;">
                                Solicitud #${solicitud.numeroPedido || solicitud.id}
                            </span>
                        </div>
                        <h4 style="margin: 0 0 8px 0; color: #1f2937; font-size: 18px; font-weight: 600;">
                            ${solicitud.nombres} ${solicitud.apellidoPaterno} ${solicitud.apellidoMaterno}
                        </h4>
                        <div style="display: grid; gap: 6px; color: #4b5563; font-size: 14px;">
                            <div><strong>CURP:</strong> ${solicitud.curpTexto || 'N/A'}</div>
                            <div><strong>Plantel:</strong> ${solicitud.plantel || 'N/A'}</div>
                            <div><strong>Fecha de solicitud:</strong> ${solicitud.fechaCreacion ? new Date(solicitud.fechaCreacion).toLocaleString('es-ES') : 'N/A'}</div>
                        </div>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 8px; min-width: 150px;">
                        <button onclick="verMiSolicitudDetalle('${solicitud.id}')" class="btn-primary" style="padding: 8px 12px; font-size: 14px; white-space: nowrap;">
                            Ver Detalles
                        </button>
                    </div>
                </div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
}

// Ver detalles de una solicitud del usuario (directo con Firebase)
window.verMiSolicitudDetalle = async function(solicitudId) {
    try {
        console.log('📄 Cargando detalles de solicitud desde Firebase:', solicitudId);

        if (!currentUser) {
            showMessage('Error de autenticación. Por favor, inicia sesión nuevamente.', 'error');
            return;
        }

        // Obtener solicitud directamente de Firebase usando v9 modular syntax
        const { doc, getDoc } = window.firestoreHelpers;
        const solicitudRef = doc(db, 'solicitudesCertificado', solicitudId);
        
        let solicitudDoc;
        try {
            solicitudDoc = await getDoc(solicitudRef);
        } catch (permissionError) {
            console.error('Error de permisos al leer solicitud:', permissionError);
            showMessage('No tienes permisos para ver esta solicitud. Contacta al administrador.', 'error');
            return;
        }

        if (!solicitudDoc.exists()) {
            throw new Error('Solicitud no encontrada');
        }

        const data = solicitudDoc.data();
        
        // Verificar que el usuario tenga permiso para ver esta solicitud
        if (data.userId !== currentUser.uid &&
            currentUserData.role !== 'admin' &&
            currentUserData.role !== 'superAdmin') {
            showMessage('No tienes permisos para ver esta solicitud.', 'error');
            return;
        }

        const solicitud = {
            id: solicitudDoc.id,
            ...data,
            createdAt: data.createdAt?.toDate().toISOString(),
            updatedAt: data.updatedAt?.toDate().toISOString(),
            fechaCreacion: data.fechaCreacion || data.createdAt?.toDate().toISOString()
        };

        solicitudActual = solicitud;

        // Cambiar a vista de detalles
        document.getElementById('vistaListaSolicitudes').classList.add('hidden');
        document.getElementById('vistaDetalleSolicitud').classList.remove('hidden');
        document.getElementById('btnVolverLista').classList.remove('hidden');
        document.getElementById('modalSolicitudesTitle').textContent = 'Detalles de la Solicitud';

        // Renderizar detalles
        renderSolicitudDetalle(solicitud);

        // Cargar comentarios
        await loadComentarios(solicitudId);

    } catch (error) {
        console.error('Error al cargar detalles:', error);
        showMessage(error.message || 'Error al cargar los detalles de la solicitud.', 'error');
    }
};

// Renderizar detalles de la solicitud
function renderSolicitudDetalle(solicitud) {
    const container = document.getElementById('solicitudDetalleContent');
    if (!container) return;

    const estatusColors = {
        pendiente: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
        en_proceso: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
        aprobado: { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
        rechazado: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' },
        completado: { bg: '#e0e7ff', border: '#818cf8', text: '#3730a3' }
    };

    const estatus = solicitud.estatus || 'pendiente';
    const color = estatusColors[estatus] || estatusColors.pendiente;

    let html = `
        <div style="border: 2px solid ${color.border}; background: ${color.bg}; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                <span style="background: ${color.border}; color: white; padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 600;">
                    ${estatus.replace('_', ' ').toUpperCase()}
                </span>
                <span style="color: #6b7280; font-size: 16px; font-weight: 500;">
                    Solicitud #${solicitud.numeroPedido || solicitud.id}
                </span>
            </div>

            <h3 style="margin: 0 0 20px 0; color: #1f2937; font-size: 22px;">
                ${solicitud.nombres} ${solicitud.apellidoPaterno} ${solicitud.apellidoMaterno}
            </h3>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px;">
                <div>
                    <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600;">CURP</p>
                    <p style="margin: 0; font-size: 14px; color: #1f2937;">${solicitud.curpTexto || 'N/A'}</p>
                </div>
                <div>
                    <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600;">Correo Electrónico</p>
                    <p style="margin: 0; font-size: 14px; color: #1f2937;">${solicitud.correoElectronico || 'N/A'}</p>
                </div>
                <div>
                    <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600;">WhatsApp</p>
                    <p style="margin: 0; font-size: 14px; color: #1f2937;">${solicitud.whatsapp || 'N/A'}</p>
                </div>
                <div>
                    <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600;">Plantel</p>
                    <p style="margin: 0; font-size: 14px; color: #1f2937;">${solicitud.plantel || 'N/A'}</p>
                </div>
                <div>
                    <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600;">Promedio</p>
                    <p style="margin: 0; font-size: 14px; color: #1f2937;">${solicitud.promedio || 'N/A'}</p>
                </div>
                <div>
                    <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600;">Fecha de Solicitud</p>
                    <p style="margin: 0; font-size: 14px; color: #1f2937;">${solicitud.fechaCreacion ? new Date(solicitud.fechaCreacion).toLocaleString('es-ES') : 'N/A'}</p>
                </div>
            </div>
        </div>

        <!-- Historial de estatus -->
        ${solicitud.estatusHistorial && solicitud.estatusHistorial.length > 0 ? `
            <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                <h4 style="margin: 0 0 16px 0; color: #1f2937;">📜 Historial de Estatus</h4>
                <div style="display: grid; gap: 12px;">
                    ${solicitud.estatusHistorial.map(item => `
                        <div style="display: flex; gap: 12px; padding: 12px; background: white; border-radius: 6px; border-left: 4px solid ${estatusColors[item.estatus]?.border || '#94a3b8'};">
                            <div style="flex: 1;">
                                <p style="margin: 0 0 4px 0; font-weight: 600; color: #1f2937; text-transform: uppercase; font-size: 12px;">
                                    ${item.estatus.replace('_', ' ')}
                                </p>
                                <p style="margin: 0; font-size: 14px; color: #6b7280;">
                                    ${item.nota || 'Sin nota'}
                                </p>
                            </div>
                            <div style="text-align: right; color: #6b7280; font-size: 12px;">
                                ${item.fecha ? new Date(item.fecha).toLocaleString('es-ES') : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : ''}
    `;

    container.innerHTML = html;
}

// Variables para almacenar los listeners de comentarios
let comentariosUnsubscribe = null;
let comentariosAdminUnsubscribe = null;

// Cargar comentarios de una solicitud con listener en tiempo real
async function loadComentarios(solicitudId) {
    try {
        if (!currentUser) return;

        console.log('💬 Configurando listener de comentarios para solicitud:', solicitudId);

        // Cancelar listener anterior si existe
        if (comentariosUnsubscribe) {
            console.log('🔄 Cancelando listener anterior');
            comentariosUnsubscribe();
            comentariosUnsubscribe = null;
        }

        // SIEMPRE usar el ID de Firestore (solicitudId) para comentarios
        console.log(`🔍 Buscando comentarios en: solicitudesCertificado/${solicitudId}/comentarios`);
        
        const { collection, query, orderBy, getDocs } = window.firestoreHelpers;
        const comentariosRef = collection(db, 'solicitudesCertificado', solicitudId, 'comentarios');
        const q = query(comentariosRef, orderBy('createdAt', 'asc'));
        
        // Cargar comentarios iniciales
        const snapshot = await getDocs(q);
        const comentarios = [];
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            comentarios.push({
                id: docSnap.id,
                ...data,
                createdAt: data.createdAt?.toDate().toISOString()
            });
        });

        console.log(`✅ Total de comentarios encontrados: ${comentarios.length}`);

        // Renderizar comentarios
        renderComentarios(comentarios);

        // Configurar listener en tiempo real
        comentariosUnsubscribe = onSnapshot(q, (snapshot) => {
            const comentariosActualizados = [];
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                comentariosActualizados.push({
                    id: docSnap.id,
                    ...data,
                    createdAt: data.createdAt?.toDate().toISOString()
                });
            });

            console.log(`🔄 Comentarios actualizados en tiempo real: ${comentariosActualizados.length}`);
            renderComentarios(comentariosActualizados);
        }, (error) => {
            console.error('❌ Error en listener de comentarios:', error);
        });

    } catch (error) {
        console.error('Error al configurar listener de comentarios:', error);
    }
}

// Cargar comentarios para el modal de admin con listener en tiempo real
async function loadComentariosAdmin(solicitudId) {
    try {
        if (!currentUser) return;

        console.log('💬 Configurando listener de comentarios para admin en solicitud:', solicitudId);

        // Cancelar listener anterior si existe
        if (comentariosAdminUnsubscribe) {
            console.log('🔄 Cancelando listener anterior de admin');
            comentariosAdminUnsubscribe();
            comentariosAdminUnsubscribe = null;
        }

        // Usar el ID de Firestore para comentarios
        console.log(`🔍 Buscando comentarios en: solicitudesCertificado/${solicitudId}/comentarios`);
        
        const { collection, query, orderBy, getDocs } = window.firestoreHelpers;
        const comentariosRef = collection(db, 'solicitudesCertificado', solicitudId, 'comentarios');
        const q = query(comentariosRef, orderBy('createdAt', 'asc'));
        
        // Cargar comentarios iniciales
        const snapshot = await getDocs(q);
        const comentarios = [];
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            comentarios.push({
                id: docSnap.id,
                ...data,
                createdAt: data.createdAt?.toDate().toISOString()
            });
        });

        console.log(`✅ Total de comentarios encontrados para admin: ${comentarios.length}`);

        // Renderizar comentarios
        renderComentariosAdmin(comentarios);

        // Configurar listener en tiempo real
        comentariosAdminUnsubscribe = onSnapshot(q, (snapshot) => {
            const comentariosActualizados = [];
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                comentariosActualizados.push({
                    id: docSnap.id,
                    ...data,
                    createdAt: data.createdAt?.toDate().toISOString()
                });
            });

            console.log(`🔄 Comentarios de admin actualizados en tiempo real: ${comentariosActualizados.length}`);
            renderComentariosAdmin(comentariosActualizados);
        }, (error) => {
            console.error('❌ Error en listener de comentarios de admin:', error);
        });

    } catch (error) {
        console.error('Error al configurar listener de comentarios de admin:', error);
    }
}

// Renderizar comentarios en el modal de admin
function renderComentariosAdmin(comentarios) {
    const container = document.getElementById('listaComentariosAdmin');
    if (!container) return;

    if (comentarios.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #9ca3af;">
                <p>No hay comentarios aún. Sé el primero en comentar.</p>
            </div>
        `;
        return;
    }

    let html = '';

    comentarios.forEach(comentario => {
        const isAdmin = comentario.userRole === 'admin' || comentario.userRole === 'superAdmin';
        const bgColor = isAdmin ? '#eff6ff' : '#f9fafb';
        const borderColor = isAdmin ? '#3b82f6' : '#e5e7eb';
        const badge = isAdmin ? '<span style="background: #3b82f6; color: white; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; margin-left: 8px;">ADMINISTRADOR</span>' : '';

        html += `
            <div style="background: ${bgColor}; border-left: 4px solid ${borderColor}; border-radius: 8px; padding: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                    <div style="display: flex; align-items: center;">
                        <strong style="color: #1f2937; font-size: 14px;">${comentario.userName || 'Usuario'}</strong>
                        ${badge}
                    </div>
                    <span style="color: #6b7280; font-size: 12px;">
                        ${comentario.createdAt ? new Date(comentario.createdAt).toLocaleString('es-ES') : ''}
                    </span>
                </div>
                <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.5;">
                    ${comentario.texto}
                </p>
            </div>
        `;
    });

    container.innerHTML = html;
}

// Agregar comentario desde el modal de admin
window.agregarComentarioAdmin = async function() {
    try {
        const textarea = document.getElementById('nuevoComentarioAdmin');
        const texto = textarea?.value?.trim();

        if (!texto) {
            showMessage('Por favor, escribe un comentario antes de enviar.', 'error');
            return;
        }

        if (!solicitudActual || !solicitudActual.id) {
            console.error('❌ No hay solicitud seleccionada o falta el ID');
            showMessage('Error: No hay solicitud seleccionada.', 'error');
            return;
        }

        if (!currentUser || !currentUserData) {
            showMessage('Error de autenticación. Por favor, inicia sesión nuevamente.', 'error');
            return;
        }

        console.log('💬 Agregando comentario de admin a Firebase...');
        console.log('📋 Solicitud actual:', {
            id: solicitudActual.id,
            firestoreId: solicitudActual.firestoreId,
            localId: solicitudActual.localId
        });

        // Usar SOLO el ID de Firestore
        const solicitudFirestoreId = solicitudActual.id;
        console.log('📍 Guardando comentario en:', `solicitudesCertificado/${solicitudFirestoreId}/comentarios`);

        // Verificar que la solicitud existe
        const { doc, getDoc, collection, addDoc, serverTimestamp } = window.firestoreHelpers;
        const solicitudRef = doc(db, 'solicitudesCertificado', solicitudFirestoreId);
        const solicitudDoc = await getDoc(solicitudRef);

        if (!solicitudDoc.exists()) {
            console.error('❌ La solicitud no existe en Firestore:', solicitudFirestoreId);
            showMessage('Error: La solicitud no existe. Por favor, recarga la página.', 'error');
            return;
        }

        console.log('✅ Solicitud verificada, agregando comentario de admin...');

        // Agregar comentario a la subcolección
        const comentariosRef = collection(db, 'solicitudesCertificado', solicitudFirestoreId, 'comentarios');

        const nuevoComentario = {
            texto: texto,
            userId: currentUser.uid,
            userName: currentUserData.name || currentUserData.email || 'Administrador',
            userEmail: currentUserData.email || currentUser.email,
            userRole: currentUserData.role || 'admin',
            createdAt: serverTimestamp()
        };

        console.log('📝 Datos del comentario de admin:', nuevoComentario);

        const docRef = await addDoc(comentariosRef, nuevoComentario);

        console.log('✅ Comentario de admin agregado con ID:', docRef.id);
        showMessage('Comentario agregado exitosamente.', 'success');

        // Limpiar textarea
        textarea.value = '';

        // El listener en tiempo real actualizará los comentarios automáticamente

    } catch (error) {
        console.error('❌ Error al agregar comentario de admin:', error);
        console.error('Detalles del error:', {
            message: error.message,
            code: error.code,
            stack: error.stack
        });
        showMessage(error.message || 'Error al agregar el comentario.', 'error');
    }
};

// Renderizar comentarios
function renderComentarios(comentarios) {
    const container = document.getElementById('listaComentarios');
    if (!container) return;

    if (comentarios.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #9ca3af;">
                <p>No hay comentarios aún. Sé el primero en comentar.</p>
            </div>
        `;
        return;
    }

    let html = '';

    comentarios.forEach(comentario => {
        const isAdmin = comentario.userRole === 'admin' || comentario.userRole === 'superAdmin';
        const bgColor = isAdmin ? '#eff6ff' : '#f9fafb';
        const borderColor = isAdmin ? '#3b82f6' : '#e5e7eb';
        const badge = isAdmin ? '<span style="background: #3b82f6; color: white; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; margin-left: 8px;">ADMINISTRADOR</span>' : '';

        html += `
            <div style="background: ${bgColor}; border-left: 4px solid ${borderColor}; border-radius: 8px; padding: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                    <div style="display: flex; align-items: center;">
                        <strong style="color: #1f2937; font-size: 14px;">${comentario.userName || 'Usuario'}</strong>
                        ${badge}
                    </div>
                    <span style="color: #6b7280; font-size: 12px;">
                        ${comentario.createdAt ? new Date(comentario.createdAt).toLocaleString('es-ES') : ''}
                    </span>
                </div>
                <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.5;">
                    ${comentario.texto}
                </p>
            </div>
        `;
    });

    container.innerHTML = html;
}

// Agregar un nuevo comentario (directo con Firebase)
window.agregarComentario = async function() {
    try {
        const textarea = document.getElementById('nuevoComentario');
        const texto = textarea?.value?.trim();

        if (!texto) {
            showMessage('Por favor, escribe un comentario antes de enviar.', 'error');
            return;
        }

        if (!solicitudActual || !solicitudActual.id) {
            console.error('❌ No hay solicitud seleccionada o falta el ID');
            showMessage('Error: No hay solicitud seleccionada.', 'error');
            return;
        }

        if (!currentUser || !currentUserData) {
            showMessage('Error de autenticación. Por favor, inicia sesión nuevamente.', 'error');
            return;
        }

        console.log('💬 Agregando comentario a Firebase...');
        console.log('📋 Solicitud actual:', {
            id: solicitudActual.id,
            firestoreId: solicitudActual.firestoreId,
            localId: solicitudActual.localId
        });

        // CRÍTICO: Usar SOLO el ID de Firestore (solicitudActual.id)
        const solicitudFirestoreId = solicitudActual.id;
        console.log('📍 Guardando comentario en:', `solicitudesCertificado/${solicitudFirestoreId}/comentarios`);

        // Verificar que la solicitud existe antes de agregar el comentario
        const { doc, getDoc, collection, addDoc, serverTimestamp } = window.firestoreHelpers;
        const solicitudRef = doc(db, 'solicitudesCertificado', solicitudFirestoreId);
        const solicitudDoc = await getDoc(solicitudRef);

        if (!solicitudDoc.exists()) {
            console.error('❌ La solicitud no existe en Firestore:', solicitudFirestoreId);
            showMessage('Error: La solicitud no existe. Por favor, recarga la página.', 'error');
            return;
        }

        console.log('✅ Solicitud verificada, agregando comentario...');

        // Agregar comentario a la subcolección de la solicitud existente
        const comentariosRef = collection(db, 'solicitudesCertificado', solicitudFirestoreId, 'comentarios');

        const nuevoComentario = {
            texto: texto,
            userId: currentUser.uid,
            userName: currentUserData.name || currentUserData.email || 'Usuario',
            userEmail: currentUserData.email || currentUser.email,
            userRole: currentUserData.role || 'user',
            createdAt: serverTimestamp()
        };

        console.log('📝 Datos del comentario:', nuevoComentario);

        const docRef = await addDoc(comentariosRef, nuevoComentario);

        console.log('✅ Comentario agregado con ID:', docRef.id);
        showMessage('Comentario agregado exitosamente.', 'success');

        // Limpiar textarea
        textarea.value = '';

        // No es necesario recargar comentarios manualmente
        // El listener en tiempo real los actualizará automáticamente

    } catch (error) {
        console.error('❌ Error al agregar comentario:', error);
        console.error('Detalles del error:', {
            message: error.message,
            code: error.code,
            stack: error.stack
        });
        showMessage(error.message || 'Error al agregar el comentario.', 'error');
    }
};

// Abrir modal de lista de solicitudes (directo con Firebase)
window.openMisSolicitudesModal = async function() {
    console.log('🔓 Abriendo modal de mis solicitudes...');
    const modal = document.getElementById('misSolicitudesModal');
    const container = document.getElementById('misSolicitudesContainer');

    if (!modal || !container) {
        console.error('No se encontró el modal o el contenedor de solicitudes');
        return;
    }

    // Asegurar que estamos en la vista de lista
    document.getElementById('vistaListaSolicitudes').classList.remove('hidden');
    document.getElementById('vistaDetalleSolicitud').classList.add('hidden');
    document.getElementById('btnVolverLista').classList.add('hidden');
    document.getElementById('modalSolicitudesTitle').textContent = '📋 Mis Solicitudes de Certificados';

    // Abrir el modal
    modal.classList.add('open');

    // Mostrar estado de carga
    container.innerHTML = '<div style="text-align: center; padding: 40px;"><div class="spinner"></div><p>Cargando solicitudes...</p></div>';

    try {
        if (!currentUser) {
            container.innerHTML = '<div style="text-align: center; padding: 40px; color: #6b7280;">No hay usuario autenticado</div>';
            return;
        }

        // Cargar solicitudes directamente de Firebase usando v9 modular syntax
        const { collection, query, where, orderBy, getDocs } = window.firestoreHelpers;
        const solicitudesRef = collection(db, 'solicitudesCertificado');
        const q = query(solicitudesRef, where('userId', '==', currentUser.uid), orderBy('createdAt', 'desc'));
        const solicitudesSnapshot = await getDocs(q);

        const solicitudes = [];
        solicitudesSnapshot.forEach(docSnap => {
            const data = docSnap.data();
            // Usar el ID de Firestore como ID principal
            solicitudes.push({
                ...data,
                id: docSnap.id, // ID de Firestore (el correcto)
                firestoreId: docSnap.id, // Mantener también como firestoreId
                localId: data.id, // El ID local generado en el formulario
                createdAt: data.createdAt?.toDate().toISOString(),
                updatedAt: data.updatedAt?.toDate().toISOString(),
                fechaCreacion: data.fechaCreacion || data.createdAt?.toDate().toISOString()
            });
        });

        console.log('✅ Solicitudes cargadas:', solicitudes.length);

        // Renderizar las solicitudes en el modal
        renderMisSolicitudes(solicitudes);

    } catch (error) {
        console.error('Error al cargar solicitudes:', error);
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #ef4444;">Error al cargar las solicitudes. Intenta de nuevo.</div>';
    }
};

// Volver a la lista de solicitudes desde la vista de detalles
window.volverAListaSolicitudes = function() {
    // Cancelar listener de comentarios
    if (typeof comentariosUnsubscribe === 'function') {
        comentariosUnsubscribe();
        comentariosUnsubscribe = null;
    }

    // Cambiar a vista de lista
    document.getElementById('vistaDetalleSolicitud').classList.add('hidden');
    document.getElementById('vistaListaSolicitudes').classList.remove('hidden');
    document.getElementById('btnVolverLista').classList.add('hidden');
    document.getElementById('modalSolicitudesTitle').textContent = '📋 Mis Solicitudes de Certificados';

    // Limpiar el textarea de comentarios
    const textarea = document.getElementById('nuevoComentario');
    if (textarea) textarea.value = '';

    // Limpiar solicitud actual
    solicitudActual = null;
};

// Cerrar modal de solicitudes
window.closeMisSolicitudesModal = function() {
    // Cancelar listener de comentarios
    if (typeof comentariosUnsubscribe === 'function') {
        comentariosUnsubscribe();
        comentariosUnsubscribe = null;
    }

    document.getElementById('misSolicitudesModal').classList.remove('open');

    // Resetear a la vista de lista
    document.getElementById('vistaDetalleSolicitud').classList.add('hidden');
    document.getElementById('vistaListaSolicitudes').classList.remove('hidden');
    document.getElementById('btnVolverLista').classList.add('hidden');
    document.getElementById('modalSolicitudesTitle').textContent = '📋 Mis Solicitudes de Certificados';

    // Limpiar el textarea de comentarios
    const textarea = document.getElementById('nuevoComentario');
    if (textarea) textarea.value = '';

    // Limpiar solicitud actual
    solicitudActual = null;
};

// Exportar funciones necesarias
export { loadUserData, updateUI, loadContent, showMessage, currentUser as getCurrentUser, currentUserData as getCurrentUserData };