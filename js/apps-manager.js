// apps-manager.js
import { auth, db, showMessage } from './dashboard-init.js';
import { collection, addDoc, serverTimestamp, doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

async function createAnalysisJobNoStore() {
  const user = auth.currentUser;
  if (!user) throw new Error('No session');

  // Creamos el doc con status queued
  const ref = await addDoc(collection(db, 'analyses'), {
    type: 'video',
    uploaderUid: user.uid,
    institutionId: 'udl',
    status: 'queued',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return ref.id;
}

function setVideoResult(html, status = 'info') {
  const resultDiv = document.getElementById('videoAnalysisResult');
  if (!resultDiv) return;
  resultDiv.style.display = 'block';
  resultDiv.className = `analysis-result ${status}`;
  resultDiv.innerHTML = html;
}

function showLoadingState(message, details = '') {
  return `
    <div class="loading-container">
      <div class="spinner"></div>
      <p class="loading-message">${message}</p>
      ${details ? `<p class="loading-details">${details}</p>` : ''}
    </div>
  `;
}

// ============================
// Video Analyzer Modal Functions
// ============================

window.openVideoAnalyzer = function() {
  const modal = document.getElementById('videoAnalyzerModal');
  if (modal) {
    modal.style.display = 'flex';
    // Inicializar drag & drop cuando se abre el modal
    initVideoDragDrop();
  }
};

window.closeVideoAnalyzer = function() {
  const modal = document.getElementById('videoAnalyzerModal');
  if (modal) {
    modal.style.display = 'none';
    // Resetear el formulario
    resetVideoAnalyzer();
  }
};

function resetVideoAnalyzer() {
  const fileInput = document.getElementById('videoFileInput');
  const resultDiv = document.getElementById('videoAnalysisResult');
  const previewSection = document.getElementById('videoPreviewSection');
  const uploadZone = document.getElementById('videoUploadZone');
  const videoPreview = document.getElementById('videoPreview');

  if (fileInput) fileInput.value = '';
  if (resultDiv) {
    resultDiv.innerHTML = '';
    resultDiv.style.display = 'none';
  }
  if (previewSection) previewSection.style.display = 'none';
  if (uploadZone) uploadZone.style.display = 'block';
  if (videoPreview) {
    videoPreview.src = '';
    videoPreview.load();
  }

  // Limpiar el archivo temporal almacenado
  window.selectedVideoFile = null;
}

// ============================
// Drag & Drop Functionality
// ============================

let dragDropInitialized = false;

function initVideoDragDrop() {
  // Evitar inicializar múltiples veces
  if (dragDropInitialized) return;

  const uploadZone = document.getElementById('videoUploadZone');
  if (!uploadZone) return;

  // Prevenir comportamiento por defecto del navegador
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    uploadZone.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
  });

  // Resaltar zona de drop cuando se arrastra sobre ella
  ['dragenter', 'dragover'].forEach(eventName => {
    uploadZone.addEventListener(eventName, () => {
      uploadZone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    uploadZone.addEventListener(eventName, () => {
      uploadZone.classList.remove('dragover');
    }, false);
  });

  // Manejar el drop
  uploadZone.addEventListener('drop', handleVideoDrop, false);

  // Permitir click en la zona para abrir el selector de archivos
  uploadZone.addEventListener('click', () => {
    const fileInput = document.getElementById('videoFileInput');
    if (fileInput) fileInput.click();
  });

  dragDropInitialized = true;
}

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

function handleVideoDrop(e) {
  const dt = e.dataTransfer;
  const files = dt.files;

  if (files.length > 0) {
    // Simular el evento de cambio del input file
    const fileInput = document.getElementById('videoFileInput');
    if (fileInput) {
      // Crear un nuevo FileList (no se puede modificar directamente)
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(files[0]);
      fileInput.files = dataTransfer.files;

      // Disparar el evento de selección para mostrar el preview
      window.handleVideoSelection({ target: fileInput });
    }
  }
}

// ============================
// Carta Analyzer Modal Functions
// ============================

window.openCartaAnalyzer = function() {
  const modal = document.getElementById('cartaAnalyzerModal');
  if (modal) {
    modal.style.display = 'flex';
  }
};

window.closeCartaAnalyzer = function() {
  const modal = document.getElementById('cartaAnalyzerModal');
  if (modal) {
    modal.style.display = 'none';
  }
};

// ============================
// Video Preview Functions
// ============================

window.handleVideoSelection = async function(evt) {
  const file = evt.target.files?.[0];
  if (!file) return;

  // Validar el archivo
  const validation = await validateVideoFile(file);
  if (!validation.valid) {
    const errorMsg = validation.errors.join('\n');
    showMessage(errorMsg, 'error');
    return;
  }

  // Guardar el archivo para usar más tarde
  window.selectedVideoFile = file;

  // Mostrar el preview
  showVideoPreview(file);
};

function showVideoPreview(file) {
  const uploadZone = document.getElementById('videoUploadZone');
  const previewSection = document.getElementById('videoPreviewSection');
  const videoPreview = document.getElementById('videoPreview');
  const fileName = document.getElementById('videoFileName');
  const fileSize = document.getElementById('videoFileSize');
  const duration = document.getElementById('videoDuration');
  const resolution = document.getElementById('videoResolution');

  // Ocultar zona de upload y mostrar preview
  if (uploadZone) uploadZone.style.display = 'none';
  if (previewSection) previewSection.style.display = 'block';

  // Establecer el video
  if (videoPreview) {
    const url = URL.createObjectURL(file);
    videoPreview.src = url;
    videoPreview.load();

    // Obtener metadata del video
    videoPreview.addEventListener('loadedmetadata', function() {
      const durationMinutes = Math.floor(videoPreview.duration / 60);
      const durationSeconds = Math.floor(videoPreview.duration % 60);

      if (duration) {
        duration.textContent = `${durationMinutes}:${durationSeconds.toString().padStart(2, '0')}`;
      }
      if (resolution) {
        resolution.textContent = `${videoPreview.videoWidth} × ${videoPreview.videoHeight}`;
      }
    });
  }

  // Mostrar información del archivo
  if (fileName) fileName.textContent = file.name;
  if (fileSize) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    fileSize.textContent = `${sizeMB} MB`;
  }
  if (duration) duration.textContent = 'Cargando...';
  if (resolution) resolution.textContent = 'Cargando...';
}

window.cancelVideoPreview = function() {
  const uploadZone = document.getElementById('videoUploadZone');
  const previewSection = document.getElementById('videoPreviewSection');
  const videoPreview = document.getElementById('videoPreview');
  const fileInput = document.getElementById('videoFileInput');

  // Mostrar zona de upload y ocultar preview
  if (uploadZone) uploadZone.style.display = 'block';
  if (previewSection) previewSection.style.display = 'none';
  if (fileInput) fileInput.value = '';
  if (videoPreview) {
    videoPreview.src = '';
    videoPreview.load();
  }

  // Limpiar el archivo seleccionado
  window.selectedVideoFile = null;
};

window.startVideoAnalysis = function() {
  if (!window.selectedVideoFile) {
    showMessage('No hay video seleccionado', 'error');
    return;
  }

  // Ocultar el preview y mostrar el área de resultados
  const previewSection = document.getElementById('videoPreviewSection');
  if (previewSection) previewSection.style.display = 'none';

  // Iniciar el análisis usando el archivo guardado
  window.handleVideoUpload({ target: { files: [window.selectedVideoFile] } });
};

// ============================
// File Validation
// ============================

const VIDEO_CONFIG = {
  maxSizeMB: 500,
  maxSizeBytes: 500 * 1024 * 1024, // 500MB
  allowedFormats: ['video/mp4', 'video/avi', 'video/quicktime', 'video/x-matroska', 'video/x-msvideo'],
  allowedExtensions: ['.mp4', '.avi', '.mov', '.mkv']
};

async function validateVideoFile(file) {
  const errors = [];

  // Validar tipo de archivo
  const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  if (!VIDEO_CONFIG.allowedExtensions.includes(fileExtension)) {
    errors.push(`Formato no soportado. Use: ${VIDEO_CONFIG.allowedExtensions.join(', ')}`);
  }

  // Validar tamaño
  if (file.size > VIDEO_CONFIG.maxSizeBytes) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    errors.push(`El archivo es muy grande (${sizeMB} MB). Máximo: ${VIDEO_CONFIG.maxSizeMB} MB`);
  }

  // Validar que no esté vacío
  if (file.size === 0) {
    errors.push('El archivo está vacío');
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

// ============================
// Video Upload Handler
// ============================

window.handleVideoUpload = async function (evt) {
  const file = evt.target.files?.[0];
  if (!file) return;

  let unsub = null; // Para poder limpiar el listener en caso de error

  try {
    // Validar el archivo antes de procesarlo
    const validation = await validateVideoFile(file);
    if (!validation.valid) {
      const errorMsg = validation.errors.join('\n');
      showMessage(errorMsg, 'error');
      setVideoResult(`<p style="color: #dc2626;">❌ ${validation.errors.map(e => `<br>${e}`).join('')}</p>`);
      return;
    }

    const analysisId = await createAnalysisJobNoStore();

    // Mostrar estado de carga
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    setVideoResult(
      showLoadingState('Subiendo video...', `Archivo: ${file.name} (${fileSizeMB} MB)`),
      'loading'
    );

    const form = new FormData();
    form.append('file', file);
    form.append('analysisId', analysisId);

    // Timeout para la subida (10 minutos)
    const uploadTimeout = setTimeout(() => {
      throw new Error('Tiempo de espera agotado. El video es muy grande o la conexión es lenta.');
    }, 600000);

    // Llama a tu Cloud Function HTTP
    const res = await fetch('/analyzeVideo', { // usa tu URL de Functions/Render (proxy en dashboard.html)
      method: 'POST',
      body: form
    }).finally(() => {
      clearTimeout(uploadTimeout);
    });

    if (!res.ok) {
      const txt = await res.text();
      let errorMessage = `Error del servidor (${res.status})`;

      if (res.status === 404) {
        errorMessage = 'El servicio de análisis no está disponible. Contacta al administrador.';
      } else if (res.status === 413) {
        errorMessage = 'El archivo es demasiado grande para el servidor.';
      } else if (res.status === 500) {
        errorMessage = 'Error interno del servidor. Intenta nuevamente.';
      } else if (res.status === 503) {
        errorMessage = 'El servicio está temporalmente no disponible. Intenta más tarde.';
      }

      throw new Error(errorMessage + (txt ? `: ${txt}` : ''));
    }

    // Timeout para el análisis (15 minutos)
    const analysisTimeout = setTimeout(() => {
      if (unsub) unsub();
      setVideoResult(`
        <div class="result-header error">
          <div class="result-icon">⏱</div>
          <h3 class="result-title">Tiempo de Análisis Agotado</h3>
        </div>
        <p class="error-message">El análisis está tomando más tiempo del esperado.</p>
        <p class="error-hint">El video puede ser muy largo o complejo. Por favor, intenta con un video más corto o contacta al soporte.</p>
      `, 'error');
    }, 900000);

    // Escuchar el análisis
    unsub = onSnapshot(doc(db, 'analyses', analysisId), (snap) => {
      if (!snap.exists()) return;
      const a = snap.data();

      if (a.status === 'processing') {
        setVideoResult(
          showLoadingState('Procesando con IA...', 'Esto puede tomar unos minutos. Por favor, no cierres esta ventana.'),
          'loading'
        );
      } else if (a.status === 'done') {
        clearTimeout(analysisTimeout);
        const r = a.result || {};

        // Validar que tengamos datos
        if (!r.score && !r.summary && (!r.findings || r.findings.length === 0)) {
          setVideoResult(`
            <div class="result-header error">
              <div class="result-icon">⚠</div>
              <h3 class="result-title">Análisis Incompleto</h3>
            </div>
            <p class="error-message">El análisis se completó pero no se generaron resultados.</p>
            <p class="error-hint">Esto puede deberse a un problema con el video. Intenta con otro archivo.</p>
          `, 'error');
        } else {
          setVideoResult(`
            <div class="result-header success">
              <div class="result-icon">✓</div>
              <h3 class="result-title">Análisis Completado</h3>
            </div>
            <div class="result-content">
              <div class="result-score">
                <span class="score-label">Puntaje:</span>
                <span class="score-value">${r.score ?? 0}</span>
              </div>
              <div class="result-section">
                <h4>Resumen</h4>
                <p>${r.summary || '—'}</p>
              </div>
              ${(r.findings || []).length > 0 ? `
                <div class="result-section">
                  <h4>Hallazgos</h4>
                  <ul class="findings-list">
                    ${(r.findings || []).map(f => `
                      <li class="${f.ok ? 'finding-ok' : 'finding-error'}">
                        <span class="finding-icon">${f.ok ? '✅' : '❌'}</span>
                        <span class="finding-rule">${f.ruleId}:</span>
                        <span class="finding-status">${f.ok ? 'Cumple' : 'No cumple'}</span>
                        ${f.note ? `<span class="finding-note">— ${f.note}</span>` : ''}
                      </li>
                    `).join('')}
                  </ul>
                </div>
              ` : ''}
              ${r.suggestions?.length ? `
                <div class="result-section">
                  <h4>Sugerencias</h4>
                  <ul class="suggestions-list">
                    ${r.suggestions.map(s => `<li>💡 ${s}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}
            </div>
          `, 'success');
        }
        unsub();
      } else if (a.status === 'error') {
        clearTimeout(analysisTimeout);
        const errorDetails = a.error || 'Error desconocido';
        let userFriendlyMessage = errorDetails;

        // Traducir errores técnicos a mensajes amigables
        if (errorDetails.includes('timeout')) {
          userFriendlyMessage = 'El análisis tomó demasiado tiempo. Intenta con un video más corto.';
        } else if (errorDetails.includes('memory')) {
          userFriendlyMessage = 'El video requiere demasiada memoria para procesarse. Intenta con un video más corto o de menor resolución.';
        } else if (errorDetails.includes('format')) {
          userFriendlyMessage = 'El formato del video no es compatible. Intenta convertirlo a MP4.';
        }

        setVideoResult(`
          <div class="result-header error">
            <div class="result-icon">✕</div>
            <h3 class="result-title">Error en el Análisis</h3>
          </div>
          <p class="error-message">${userFriendlyMessage}</p>
          <p class="error-hint">Si el problema persiste, por favor contacta al soporte técnico.</p>
          ${errorDetails !== userFriendlyMessage ? `<details style="margin-top: 12px; font-size: 12px; color: #6b7280;"><summary style="cursor: pointer;">Detalles técnicos</summary><p style="margin-top: 8px;">${errorDetails}</p></details>` : ''}
        `, 'error');
        unsub();
      }
    }, (error) => {
      // Error en el listener de Firestore
      clearTimeout(analysisTimeout);
      console.error('Error en listener de Firestore:', error);
      setVideoResult(`
        <div class="result-header error">
          <div class="result-icon">✕</div>
          <h3 class="result-title">Error de Conexión</h3>
        </div>
        <p class="error-message">No se pudo conectar con el sistema de análisis.</p>
        <p class="error-hint">Verifica tu conexión a internet e intenta nuevamente.</p>
      `, 'error');
      showMessage('Error de conexión con Firestore', 'error');
    });
  } catch (e) {
    console.error('Error en handleVideoUpload:', e);

    let userMessage = e.message;
    if (e.message.includes('Failed to fetch')) {
      userMessage = 'No se pudo conectar con el servidor. Verifica tu conexión a internet.';
    } else if (e.message.includes('NetworkError')) {
      userMessage = 'Error de red. Verifica tu conexión e intenta nuevamente.';
    } else if (e.message.includes('No session')) {
      userMessage = 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.';
    }

    showMessage(userMessage, 'error');
    setVideoResult(`
      <div class="result-header error">
        <div class="result-icon">✕</div>
        <h3 class="result-title">Error</h3>
      </div>
      <p class="error-message">${userMessage}</p>
      <button class="btn-secondary" onclick="cancelVideoPreview()" style="margin-top: 12px;">
        Intentar nuevamente
      </button>
    `, 'error');
  }
};
