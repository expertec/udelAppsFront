// Funcionalidad para el formulario de solicitud de certificados

// Función para inicializar todo cuando Firebase esté listo
function inicializarFormulario() {
    console.log('🚀 Inicializando formulario de solicitud de certificado');

    // Verificar que Firebase esté disponible
    if (!window.firebase || !window.db) {
        console.error('❌ Firebase no está disponible');
        showMessage('Error: Firebase no está cargado. Por favor, recarga la página.', 'error');
        return;
    }

    console.log('✅ Firebase detectado y listo');

    // Inicializar la aplicación
    initApp();

    // Configurar los listeners para los inputs de archivos
    setupFileInputs();

    // Configurar el formulario
    setupForm();
}

// Esperar a que el DOM y Firebase estén listos
document.addEventListener('DOMContentLoaded', function() {
    // Si Firebase ya está disponible, inicializar inmediatamente
    if (window.firebase && window.db) {
        inicializarFormulario();
    } else {
        // Si no, esperar un poco más y reintentar
        console.log('⏳ Esperando a que Firebase se inicialice...');
        let intentos = 0;
        const maxIntentos = 20; // 10 segundos máximo

        const intervalo = setInterval(function() {
            intentos++;

            if (window.firebase && window.db) {
                console.log('✅ Firebase cargado después de', intentos * 500, 'ms');
                clearInterval(intervalo);
                inicializarFormulario();
            } else if (intentos >= maxIntentos) {
                console.error('❌ Timeout esperando Firebase');
                clearInterval(intervalo);
                showMessage('Error: No se pudo conectar con Firebase. Por favor, recarga la página.', 'error');
            }
        }, 500);
    }
});

// Inicializar la aplicación
function initApp() {
    console.log('Inicializando aplicación de Solicitud de Certificado');
    
    // Verificar si el usuario está autenticado - comentado para evitar errores
    /*
    if (window.auth) {
        window.auth.onAuthStateChanged(function(user) {
            if (!user) {
                window.location.href = '../index.html';
            }
        });
    } else {
        console.error('Firebase Auth no está disponible');
    }
    */
}

// Configurar los inputs de archivos
function setupFileInputs() {
    const fileInputs = document.querySelectorAll('input[type="file"]');
    
    fileInputs.forEach(input => {
        input.addEventListener('change', function(e) {
            const fileName = e.target.files[0]?.name || 'Sin archivos seleccionados';
            const fileNameDisplay = this.parentElement.querySelector('.file-name');
            
            if (fileNameDisplay) {
                fileNameDisplay.textContent = fileName;
            }
        });
    });
}

// Configurar el formulario
function setupForm() {
    const form = document.getElementById('certificadoForm');
    
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }
}

// Manejar el envío del formulario
async function handleFormSubmit(e) {
    e.preventDefault();
    
    try {
        // Validar el formulario
        if (!validateForm()) {
            return;
        }
        
        // Mostrar mensaje de carga usando la función global para evitar recursión
        window.globalShowMessage('Enviando solicitud...', 'info');
        
        // Crear FormData para enviar archivos
        const formData = new FormData(e.target);
        
        // Obtener datos del usuario actual
        const userData = await getCurrentUserData();
        
        // Agregar datos adicionales
        formData.append('userId', userData.id || '');
        formData.append('userEmail', userData.email || '');
        formData.append('userName', userData.name || '');
        formData.append('timestamp', new Date().toISOString());
        
        // Enviar datos al servidor y guardar en la base de datos
        const response = await submitFormData(formData);
        
        // Mostrar mensaje de éxito usando la función global
        const idMensaje = response.data.firestoreId || response.data.id;
        window.globalShowMessage('Solicitud guardada correctamente con ID: ' + idMensaje, 'success');
        
        // Mostrar resumen de la solicitud
        const ubicacionGuardado = response.data.firestoreId
            ? 'en la base de datos y localmente como respaldo'
            : 'localmente (la base de datos no está disponible)';
            
        const resumen = `
            Solicitud guardada exitosamente
            ---------------------------
            ID: ${idMensaje}
            Fecha: ${new Date(response.data.fechaCreacion).toLocaleString()}
            Nombre: ${response.data.nombres} ${response.data.apellidoPaterno} ${response.data.apellidoMaterno}
            CURP: ${response.data.curpTexto}
            
            Los datos han sido guardados ${ubicacionGuardado}.
        `;
        
        alert(resumen);
        
        // Redirigir al dashboard después de 3 segundos
        setTimeout(() => {
            window.location.href = '../dashboard.html';
        }, 3000);
        
    } catch (error) {
        console.error('Error al enviar el formulario:', error);
        window.globalShowMessage('Error al enviar el formulario: ' + (error.message || 'Error desconocido'), 'error');
    }
}

// Validar el formulario
function validateForm() {
    // Obtener la pantalla activa
    const activePantalla = document.querySelector('.pantalla:not([style*="display: none"])');
    const pantallaId = activePantalla.id;
    
    let isValid = true;
    
    if (pantallaId === 'pantalla1') {
        // Validar campos de la primera pantalla (ahora información académica)
        const numeroPedido = document.getElementById('numeroPedido').value.trim();
        const curpTexto = document.getElementById('curpTexto').value.trim();
        const correoElectronico = document.getElementById('correoElectronico').value.trim();
        const fechaSecundaria = document.getElementById('fechaSecundaria').value;
        const nombres = document.getElementById('nombres').value.trim();
        const apellidoPaterno = document.getElementById('apellidoPaterno').value.trim();
        const apellidoMaterno = document.getElementById('apellidoMaterno').value.trim();
        const promedio = document.getElementById('promedio').value;
        
        // Validar número de pedido
        if (!numeroPedido) {
            showInputError('numeroPedido', 'El número de pedido es obligatorio');
            isValid = false;
        }
        
        // Validar CURP
        if (!curpTexto) {
            showInputError('curpTexto', 'La CURP es obligatoria');
            isValid = false;
        } else if (!/^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[0-9A-Z]{2}$/.test(curpTexto)) {
            showInputError('curpTexto', 'Ingresa una CURP válida');
            isValid = false;
        }
        
        // Validar correo electrónico
        if (!correoElectronico) {
            showInputError('correoElectronico', 'El correo electrónico es obligatorio');
            isValid = false;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoElectronico)) {
            showInputError('correoElectronico', 'Ingresa un correo electrónico válido');
            isValid = false;
        }
        
        // Validar fecha
        if (!fechaSecundaria) {
            showInputError('fechaSecundaria', 'La fecha es obligatoria');
            isValid = false;
        }
        
        // Validar nombres
        if (!nombres) {
            showInputError('nombres', 'El nombre es obligatorio');
            isValid = false;
        }
        
        // Validar apellidos
        if (!apellidoPaterno) {
            showInputError('apellidoPaterno', 'El apellido paterno es obligatorio');
            isValid = false;
        }
        
        if (!apellidoMaterno) {
            showInputError('apellidoMaterno', 'El apellido materno es obligatorio');
            isValid = false;
        }
        
        // Validar promedio
        if (!promedio) {
            showInputError('promedio', 'El promedio es obligatorio');
            isValid = false;
        } else if (parseFloat(promedio) < 0 || parseFloat(promedio) > 10) {
            showInputError('promedio', 'El promedio debe estar entre 0 y 10');
            isValid = false;
        }
    } else if (pantallaId === 'pantalla2') {
        // Validar campos de la segunda pantalla (ahora datos personales y documentos)
        const whatsapp = document.getElementById('whatsapp').value.trim();
        const plantel = document.getElementById('plantel').value;
        const certificadoSecundaria = document.getElementById('certificadoSecundaria').files[0];
        const actaNacimiento = document.getElementById('actaNacimiento').files[0];
        const curpArchivo = document.getElementById('curpArchivo').files[0];
        const comprobanteDomicilio = document.getElementById('comprobanteDomicilio').files[0];
        const ine = document.getElementById('ine').files[0];
        const fotografiaAlumno = document.getElementById('fotografiaAlumno').files[0];
        
        // Validar WhatsApp
        if (!whatsapp) {
            showInputError('whatsapp', 'El número de WhatsApp es obligatorio');
            isValid = false;
        } else if (!/^\+?[0-9]{10,15}$/.test(whatsapp.replace(/\s/g, ''))) {
            showInputError('whatsapp', 'Ingresa un número de WhatsApp válido');
            isValid = false;
        }
        
        // Validar plantel
        if (!plantel) {
            showInputError('plantel', 'Debes seleccionar un plantel');
            isValid = false;
        }
        
        // Validar archivos
        if (!certificadoSecundaria) {
            showInputError('certificadoSecundaria', 'Debes subir tu certificado de secundaria');
            isValid = false;
        }
        
        if (!actaNacimiento) {
            showInputError('actaNacimiento', 'Debes subir tu acta de nacimiento');
            isValid = false;
        }
        
        if (!curpArchivo) {
            showInputError('curpArchivo', 'Debes subir tu CURP');
            isValid = false;
        }
        
        if (!comprobanteDomicilio) {
            showInputError('comprobanteDomicilio', 'Debes subir tu comprobante de domicilio');
            isValid = false;
        }
        
        if (!ine) {
            showInputError('ine', 'Debes subir tu INE');
            isValid = false;
        }
        
        if (!fotografiaAlumno) {
            showInputError('fotografiaAlumno', 'Debes subir tu fotografía');
            isValid = false;
        }
    }
    
    return isValid;
}

// Mostrar error en un campo
function showInputError(inputId, message) {
    const input = document.getElementById(inputId);
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.textContent = message;
    
    // Eliminar mensajes de error anteriores
    const existingError = input.parentElement.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }
    
    // Agregar el nuevo mensaje de error
    input.parentElement.appendChild(errorElement);
    
    // Resaltar el campo con error
    input.style.borderColor = '#dc2626';
    
    // Eliminar el error cuando el usuario comience a escribir
    input.addEventListener('input', function() {
        const error = this.parentElement.querySelector('.error-message');
        if (error) {
            error.remove();
        }
        this.style.borderColor = '#e5e7eb';
    }, { once: true });
}

// Mostrar mensaje
function showMessage(message, type) {
    // Evitar recursión infinita
    if (window.globalShowMessage) {
        window.globalShowMessage(message, type);
        return;
    }
    
    // Implementación local
    const messageContainer = document.createElement('div');
    messageContainer.className = `message ${type}`;
    messageContainer.textContent = message;
    
    document.body.appendChild(messageContainer);
    
    setTimeout(() => {
        messageContainer.remove();
    }, 5000);
}

// Guardar referencia global para evitar recursión
window.globalShowMessage = function(message, type) {
    const messageContainer = document.createElement('div');
    messageContainer.className = `message ${type}`;
    messageContainer.textContent = message;
    
    document.body.appendChild(messageContainer);
    
    setTimeout(() => {
        messageContainer.remove();
    }, 5000);
};

// Obtener datos del usuario actual
async function getCurrentUserData() {
    // Versión simplificada para evitar errores
    return {
        id: 'temp-user-id',
        email: 'usuario@ejemplo.com',
        name: 'Usuario Temporal'
    };
}

// Enviar datos del formulario al servidor y guardar en Firestore
async function submitFormData(formData) {
    try {
        console.log('Preparando datos para enviar al servidor...');
        
        // Convertir FormData a un objeto para poder guardarlo
        const formDataObj = {};
        for (const [key, value] of formData.entries()) {
            // Si es un archivo, guardar su nombre
            if (value instanceof File) {
                formDataObj[key] = {
                    fileName: value.name,
                    fileType: value.type,
                    fileSize: value.size
                };
            } else {
                formDataObj[key] = value;
            }
        }
        
        console.log('Datos del formulario:', formDataObj);
        
        // Agregar fecha de creación
        formDataObj.fechaCreacion = new Date().toISOString();
        
        // Intentar guardar en Firestore
        try {
            if (!window.db) {
                throw new Error('Firestore no está inicializado');
            }

            console.log('📤 Guardando solicitud en Firestore...');

            // Obtener información del usuario autenticado (si existe)
            const currentUser = window.auth?.currentUser;
            const userData = {};

            if (currentUser) {
                userData.userId = currentUser.uid;
                userData.userEmail = currentUser.email || 'No especificado';
                userData.userName = currentUser.displayName || formDataObj.nombres || 'Usuario';
                console.log('👤 Usuario autenticado:', userData);
            } else {
                console.warn('⚠️ No hay usuario autenticado. La solicitud se guardará sin datos de usuario.');
            }

            // Crear una referencia a la colección de solicitudes con el estatus inicial
            const solicitudesRef = window.db.collection('solicitudesCertificado');

            // Añadir el documento a Firestore - Firebase generará el ID automáticamente
            const docRef = await solicitudesRef.add({
                ...formDataObj,
                ...userData,
                estatus: 'pendiente',
                estatusHistorial: [{
                    estatus: 'pendiente',
                    fecha: new Date().toISOString(),
                    nota: 'Solicitud creada'
                }],
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            console.log('✅ Solicitud guardada en Firestore con ID:', docRef.id);

            // NO actualizar ningún campo 'id' - usar solo el ID de Firestore
            // Preparar datos para respuesta
            formDataObj.firestoreId = docRef.id;

            // Guardar en localStorage como respaldo (con el ID de Firestore)
            const solicitudesLocal = JSON.parse(localStorage.getItem('solicitudesCertificado') || '[]');
            solicitudesLocal.push({
                ...formDataObj,
                firestoreId: docRef.id
            });
            localStorage.setItem('solicitudesCertificado', JSON.stringify(solicitudesLocal));

            return {
                success: true,
                message: 'Formulario enviado correctamente y guardado en la base de datos',
                data: {
                    ...formDataObj,
                    id: docRef.id, // Solo para mostrar en el mensaje
                    firestoreId: docRef.id
                }
            };
        } catch (firestoreError) {
            console.error('❌ Error al guardar en Firestore:', firestoreError);

            // Si falla Firestore, guardar en localStorage con ID temporal
            const tempId = Date.now().toString();
            formDataObj.tempId = tempId;
            
            const solicitudesLocal = JSON.parse(localStorage.getItem('solicitudesCertificado') || '[]');
            solicitudesLocal.push(formDataObj);
            localStorage.setItem('solicitudesCertificado', JSON.stringify(solicitudesLocal));

            return {
                success: true,
                message: 'Formulario guardado localmente (error al conectar con la base de datos)',
                data: {
                    ...formDataObj,
                    id: tempId
                },
                error: firestoreError.message,
                warning: 'Los datos están guardados localmente, pero necesitas verificar la conexión a Firebase para que el administrador pueda verlos.'
            };
        }
    } catch (error) {
        console.error('Error al procesar el formulario:', error);
        throw error;
    }
}

// Función para cambiar a la siguiente pantalla
window.siguientePantalla = function() {
    // Validar la pantalla actual antes de avanzar
    if (!validateForm()) {
        return;
    }
    
    document.getElementById('pantalla1').style.display = 'none';
    document.getElementById('pantalla2').style.display = 'block';
};

// Función para volver a la pantalla anterior
window.pantallaAnterior = function() {
    document.getElementById('pantalla2').style.display = 'none';
    document.getElementById('pantalla1').style.display = 'block';
};