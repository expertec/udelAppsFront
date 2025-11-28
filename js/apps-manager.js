// apps-manager.js (versión corregida - flujo server-owned)
console.log('🟢🟢🟢 apps-manager.js INICIO DE CARGA');

import { auth, db, showMessage } from './dashboard-init.js';
import {
    doc,
    getDoc,
    onSnapshot,
    collection,
    query,
    where,
    orderBy,
    getDocs,
    updateDoc,
    deleteDoc,
    addDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

console.log('🟢🟢🟢 apps-manager.js IMPORTS COMPLETADOS');
console.log('🔍 Verificando imports:');
console.log('  - auth:', typeof auth, auth ? '✅' : '❌');
console.log('  - db:', typeof db, db ? '✅' : '❌');
console.log('  - showMessage:', typeof showMessage);
console.log('  - window.db:', typeof window.db, window.db ? '✅' : '❌');
console.log('  - window.auth:', typeof window.auth, window.auth ? '✅' : '❌');

/* ==========
   Estado local
   ========== */
let selectedVideoFile = null;
let currentAnalysisId = null;

/* ==========
   Helpers UI
   ========== */
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
const $ = (s) => document.querySelector(s);

/* ==========
   Modales Video
   ========== */
window.openVideoAnalyzer = function () {
  const modal = document.getElementById('videoAnalyzerModal');
  if (!modal) return;
  modal.style.display = 'flex';
  initVideoDragDrop();
};
window.closeVideoAnalyzer = function () {
  const modal = document.getElementById('videoAnalyzerModal');
  if (!modal) return;
  modal.style.display = 'none';
  resetVideoAnalyzer();
};

function resetVideoAnalyzer() {
  const fileInput = document.getElementById('videoFileInput');
  const resultDiv = document.getElementById('videoAnalysisResult');
  const previewSection = document.getElementById('videoPreviewSection');
  const uploadZone = document.getElementById('videoUploadZone');
  const videoPreview = document.getElementById('videoPreview');

  if (fileInput) fileInput.value = '';
  if (resultDiv) { resultDiv.innerHTML = ''; resultDiv.style.display = 'none'; }
  if (previewSection) previewSection.style.display = 'none';
  if (uploadZone) uploadZone.style.display = 'block';
  if (videoPreview) { videoPreview.src = ''; videoPreview.load(); }

  selectedVideoFile = null;
}

/* ==========
   Drag & Drop
   ========== */
let dragDropInitialized = false;
function initVideoDragDrop() {
  if (dragDropInitialized) return;
  const uploadZone = $('#videoUploadZone');
  if (!uploadZone) return;

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev => {
    uploadZone.addEventListener(ev, preventDefaults, false);
    document.body.addEventListener(ev, preventDefaults, false);
  });
  ['dragenter', 'dragover'].forEach(ev => {
    uploadZone.addEventListener(ev, () => uploadZone.classList.add('dragover'), false);
  });
  ['dragleave', 'drop'].forEach(ev => {
    uploadZone.addEventListener(ev, () => uploadZone.classList.remove('dragover'), false);
  });
  uploadZone.addEventListener('drop', handleVideoDrop, false);
  uploadZone.addEventListener('click', () => $('#videoFileInput')?.click());

  dragDropInitialized = true;
}
function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }
function handleVideoDrop(e) {
  const dt = e.dataTransfer;
  const files = dt.files;
  if (!files?.length) return;
  const fileInput = $('#videoFileInput');
  if (!fileInput) return;
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(files[0]);
  fileInput.files = dataTransfer.files;
  window.handleVideoSelection({ target: fileInput });
}

/* ==========
   Preview de video
   ========== */
window.handleVideoSelection = async function (evt) {
  const file = evt?.target?.files?.[0];
  if (!file) return;

  const validation = await validateVideoFile(file);
  if (!validation.valid) {
    const errorMsg = validation.errors.join('\n');
    if (window.showMessage) window.showMessage(errorMsg, 'error');
    return;
  }

  selectedVideoFile = file;
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

  if (uploadZone) uploadZone.style.display = 'none';
  if (previewSection) previewSection.style.display = 'block';

  if (videoPreview) {
    const url = URL.createObjectURL(file);
    videoPreview.src = url;
    videoPreview.load();

    videoPreview.addEventListener('loadedmetadata', function () {
      const mm = Math.floor(videoPreview.duration / 60);
      const ss = Math.floor(videoPreview.duration % 60);
      if (duration) duration.textContent = `${mm}:${String(ss).padStart(2, '0')}`;
      if (resolution) resolution.textContent = `${videoPreview.videoWidth} × ${videoPreview.videoHeight}`;
    }, { once: true });
  }

  if (fileName) fileName.textContent = file.name;
  if (fileSize) fileSize.textContent = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;
  if (duration) duration.textContent = 'Cargando...';
  if (resolution) resolution.textContent = 'Cargando...';
}

window.cancelVideoPreview = function () {
  const uploadZone = document.getElementById('videoUploadZone');
  const previewSection = document.getElementById('videoPreviewSection');
  const videoPreview = document.getElementById('videoPreview');
  const fileInput = document.getElementById('videoFileInput');

  if (uploadZone) uploadZone.style.display = 'block';
  if (previewSection) previewSection.style.display = 'none';
  if (fileInput) fileInput.value = '';
  if (videoPreview) { videoPreview.src = ''; videoPreview.load(); }

  selectedVideoFile = null;
};

/* ==========
   Validaciones
   ========== */
const VIDEO_CONFIG = {
  maxSizeMB: 500,
  maxSizeBytes: 500 * 1024 * 1024,
  allowedExtensions: ['.mp4', '.avi', '.mov', '.mkv']
};
async function validateVideoFile(file) {
  const errors = [];
  const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  if (!VIDEO_CONFIG.allowedExtensions.includes(ext)) {
    errors.push(`Formato no soportado. Usa: ${VIDEO_CONFIG.allowedExtensions.join(', ')}`);
  }
  if (file.size > VIDEO_CONFIG.maxSizeBytes) {
    errors.push(`El archivo es muy grande (${(file.size / (1024 * 1024)).toFixed(2)} MB). Máximo: ${VIDEO_CONFIG.maxSizeMB} MB`);
  }
  if (file.size === 0) errors.push('El archivo está vacío');
  return { valid: errors.length === 0, errors };
}

/* ==========
   Flujo de análisis (server-owned)
   ========== */
function genAnalysisId() {
  return 'an_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}
async function postAnalyzeVideo(analysisId, file) {
  const form = new FormData();
  form.append('file', file);
  form.append('analysisId', analysisId);
  const res = await fetch(`${window.API_BASE}/analyzeVideo`, { method: 'POST', body: form });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Error del servidor (${res.status})${txt ? `: ${txt}` : ''}`);
  }
  return res.json();
}
function renderWaiting(analysisId, file) {
  const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
  setVideoResult(
    showLoadingState('Analizando video...', `ID: ${analysisId} · ${file.name} (${fileSizeMB} MB)`),
    'loading'
  );
}

/**
 * Listener de Firestore (solo lectura)
 * Requiere reglas: allow read: if request.auth != null; en /analyses/{id}
 */
function listenAnalysis(analysisId) {
  currentAnalysisId = analysisId;
  let unsub = null;
  unsub = onSnapshot(doc(db, 'analyses', analysisId), (snap) => {
    if (!snap.exists()) return;
    const a = snap.data();

    console.log('📡 Firestore snapshot recibido:', { status: a.status, score: a.result?.score, qualifies: a.qualifiesForVimeo });

    if (a.status === 'processing') {
      setVideoResult(showLoadingState('Procesando con IA...', 'Esto puede tardar unos minutos.'), 'loading');
    } else if (a.status === 'done') {
      const r = a.result || {};
      
      // ACTUALIZAR BOTÓN DE VIMEO EN EL HEADER
      updateVimeoHeaderButton(analysisId, a.qualifiesForVimeo, a.vimeoStatus, r.score, a.scoreThreshold, a.vimeoLink);
      
      if (!r.score && !r.summary && (!r.findings || r.findings.length === 0)) {
        setVideoResult(`
          <div class="result-header error">
            <div class="result-icon">⚠</div>
            <h3 class="result-title">Análisis Incompleto</h3>
          </div>
          <p class="error-message">No se generaron resultados. Intenta con otro video.</p>
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
            ${(r.findings || []).length ? `
              <div class="result-section">
                <h4>Hallazgos</h4>
                <ul class="findings-list">
                  ${r.findings.map(f => `
                    <li class="${f.ok ? 'finding-ok' : 'finding-error'}">
                      <span class="finding-icon">${f.ok ? '✅' : '❌'}</span>
                      <span class="finding-rule">${f.ruleId}:</span>
                      <span class="finding-status">${f.ok ? 'Cumple' : 'No cumple'}</span>
                      ${f.note ? `<span class="finding-note">— ${f.note}</span>` : ''}
                    </li>
                  `).join('')}
                </ul>
              </div>` : ''}
            ${Array.isArray(r.suggestions) && r.suggestions.length ? `
              <div class="result-section">
                <h4>Sugerencias</h4>
                <ul class="suggestions-list">
                  ${r.suggestions.map(s => `<li>💡 ${s}</li>`).join('')}
                </ul>
              </div>` : ''}
          </div>
        `, 'success');
      }
      unsub && unsub();
    } else if (a.status === 'error') {
      const errorDetails = a.error || 'Error desconocido';
      let userMsg = errorDetails;
      if (/timeout/i.test(errorDetails)) userMsg = 'El análisis tomó demasiado tiempo. Intenta con un video más corto.';
      if (/memory/i.test(errorDetails)) userMsg = 'El video requiere demasiada memoria. Prueba menor resolución.';
      if (/format/i.test(errorDetails)) userMsg = 'Formato no compatible. Convierte a MP4.';

      setVideoResult(`
        <div class="result-header error">
          <div class="result-icon">✕</div>
          <h3 class="result-title">Error en el Análisis</h3>
        </div>
        <p class="error-message">${userMsg}</p>
        ${userMsg !== errorDetails ? `<details style="margin-top:8px;font-size:12px;color:#6b7280;"><summary>Detalles técnicos</summary><pre>${errorDetails}</pre></details>` : ''}
      `, 'error');
      unsub && unsub();
    }
  }, (err) => {
    console.error('Error en listener de Firestore:', err);
    setVideoResult(`
      <div class="result-header error">
        <div class="result-icon">✕</div>
        <h3 class="result-title">Error de Conexión</h3>
      </div>
      <p class="error-message">No se pudo conectar con el sistema de análisis.</p>
    `, 'error');
  });
}

/* ==========
   Entradas públicas
   ========== */
window.startVideoAnalysis = async function () {
  try {
    if (!selectedVideoFile) { if (window.showMessage) window.showMessage('No hay video seleccionado', 'error'); return; }
    if (!window.auth?.currentUser) { if (window.showMessage) window.showMessage('Tu sesión ha expirado. Inicia sesión.', 'error'); return; }

    // Oculta preview y muestra área de resultados
    const previewSection = $('#videoPreviewSection');
    if (previewSection) previewSection.style.display = 'none';

    // Genera ID local y llama a tu servidor en Render
    const analysisId = genAnalysisId();

    // UI: estado inicial
    renderWaiting(analysisId, selectedVideoFile);

    // Deshabilita botón
    const btn = document.querySelector('.btn-analyze');
    btn?.setAttribute('disabled', 'disabled');
    btn?.classList.add('is-loading');

    // Llamada al backend (Render)
    await postAnalyzeVideo(analysisId, selectedVideoFile);

    // Escucha Firestore (solo lectura)
    listenAnalysis(analysisId);

  } catch (e) {
    console.error(e);
    const msg = e?.message || 'Ocurrió un error al iniciar el análisis.';
    if (window.showMessage) window.showMessage(msg, 'error');
    setVideoResult(`
      <div class="result-header error">
        <div class="result-icon">✕</div>
        <h3 class="result-title">Error</h3>
      </div>
      <p class="error-message">${msg}</p>
      <button class="btn-secondary" onclick="cancelVideoPreview()" style="margin-top:12px;">Intentar nuevamente</button>
    `, 'error');
  } finally {
    const btn = document.querySelector('.btn-analyze');
    btn?.removeAttribute('disabled');
    btn?.classList.remove('is-loading');
  }
};

/**
 * Compatibilidad: si algún lugar aún llama a handleVideoUpload,
 * redirigimos al mismo flujo directo (sin escritura del cliente).
 */
window.handleVideoUpload = async function (evt) {
  const file = evt?.target?.files?.[0] || selectedVideoFile;
  if (!file) { if (window.showMessage) window.showMessage('No hay video seleccionado', 'error'); return; }
  selectedVideoFile = file;
  await window.startVideoAnalysis();
};

/* ==========
   Carta Analyzer (UI modal simple)
   ========== */
window.openCartaAnalyzer = function () {
  const modal = document.getElementById('cartaAnalyzerModal');
  if (modal) modal.style.display = 'flex';
};
window.closeCartaAnalyzer = function () {
  const modal = document.getElementById('cartaAnalyzerModal');
  if (modal) modal.style.display = 'none';
  resetCartaAnalyzer();
};

function resetCartaAnalyzer() {
  const temaInput = document.getElementById('temaDescription');
  const resultDiv = document.getElementById('cartaAnalysisResult');
  const generatorSection = document.getElementById('cartaGeneratorSection');
  const uploadSection = document.getElementById('cartaUploadSection');

  if (temaInput) temaInput.value = '';
  if (resultDiv) { resultDiv.innerHTML = ''; resultDiv.style.display = 'none'; }
  if (generatorSection) generatorSection.style.display = 'block';
  if (uploadSection) uploadSection.style.display = 'none';
}

window.showCartaGenerator = function () {
  const generatorSection = document.getElementById('cartaGeneratorSection');
  const uploadSection = document.getElementById('cartaUploadSection');
  const resultDiv = document.getElementById('cartaAnalysisResult');

  if (generatorSection) generatorSection.style.display = 'block';
  if (uploadSection) uploadSection.style.display = 'none';
  if (resultDiv) resultDiv.style.display = 'none';
};

// Función global para generar carta descriptiva
window.generateCartaDescriptiva = async function (event) {
   console.log('🎯 generateCartaDescriptiva called');

   // Guardar referencia al botón
   const btn = event?.target;

   try {
     const temaDescription = document.getElementById('temaDescription')?.value?.trim();
     console.log('📝 Tema description:', temaDescription);

     if (!temaDescription) {
       console.log('❌ No tema description provided');
       if (window.showMessage) window.showMessage('Por favor, describe el tema de tu clase.', 'error');
       return;
     }

     if (!window.auth?.currentUser) {
       console.log('❌ No user authenticated');
       if (window.showMessage) window.showMessage('Tu sesión ha expirado. Inicia sesión.', 'error');
       return;
     }

     console.log('✅ Validation passed, starting generation');

     // Mostrar loading
     const resultDiv = document.getElementById('cartaAnalysisResult');
     if (resultDiv) {
       resultDiv.innerHTML = `
         <div class="loading-container">
           <div class="spinner"></div>
           <p class="loading-message">Generando carta descriptiva con 100% garantizado...</p>
           <p class="loading-details">Aplicando IA avanzada con las mejores prácticas pedagógicas para crear una carta perfecta.</p>
         </div>
       `;
       resultDiv.style.display = 'block';
     }

     // Deshabilitar botón
     if (btn) {
       btn.disabled = true;
       btn.innerHTML = '<div class="spinner"></div> Generando carta perfecta...';
     }

    console.log('🚀 Making API call to:', `${window.API_BASE}/generateCartaDescriptiva`);
    console.log('📊 API_BASE:', window.API_BASE);

    // Llamada al backend
    const response = await fetch(`${window.API_BASE}/generateCartaDescriptiva`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ temaDescription })
    });

    console.log('📡 Response status:', response.status);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Error desconocido' }));
      console.error('❌ API Error:', error);
      throw new Error(error.error || `Error ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ API Response:', data);

    // Mostrar resultado
    renderCartaResult(data);

  } catch (e) {
    console.error('❌ Error generando carta:', e);
    const resultDiv = document.getElementById('cartaAnalysisResult');
    if (resultDiv) {
      resultDiv.innerHTML = `
        <div class="result-header error">
          <div class="result-icon">✕</div>
          <h3 class="result-title">Error en la Generación</h3>
        </div>
        <p class="error-message">${e.message || 'Ocurrió un error al generar la carta descriptiva.'}</p>
      `;
      resultDiv.style.display = 'block';
    }
  } finally {
    // Restaurar botón
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
        </svg>
        Generar Carta Descriptiva (100% Garantizado)
      `;
    }
  }
};

function renderCartaResult(data) {
   const resultDiv = document.getElementById('cartaAnalysisResult');
   if (!resultDiv) return;

   const carta = data.carta || {};

   let html = `
     <div class="result-header success">
       <div class="result-icon">✓</div>
       <h3 class="result-title">Carta Descriptiva Generada con 100% Garantizado</h3>
       <p class="result-subtitle" style="color: #6b7280; font-size: 14px; margin: 8px 0 0 0;">
         Esta carta está optimizada para obtener la máxima puntuación en análisis pedagógico
       </p>
     </div>
     <div class="result-content">
   `;

   // Mostrar la carta generada
   if (carta.contenido) {
     // Guardar el contenido en una variable global temporal
     window.currentCartaContent = carta.contenido;

     // Formatear el contenido para mejor visualización
     const formattedContent = formatCartaContent(carta.contenido);

     html += `
       <div class="result-section">
         <h4>Carta Descriptiva Completa</h4>
         <div class="carta-content" style="background: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #22c55e; margin: 16px 0; font-size: 14px; line-height: 1.8; max-height: 600px; overflow-y: auto;">
           <div style="white-space: pre-wrap; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; color: #1f2937;">${formattedContent}</div>
         </div>
         <div style="margin-top: 16px; display: flex; gap: 12px; flex-wrap: wrap;">
           <button class="btn-primary" onclick="downloadCartaPDF()" style="display: inline-flex; align-items: center; gap: 8px;">
             Descargar como PDF
           </button>
           <button class="btn-secondary" onclick="copyCartaToClipboard()" style="display: inline-flex; align-items: center; gap: 8px;">
             Copiar al Portapapeles
           </button>
           <button class="btn-secondary" onclick="printCarta()" style="display: inline-flex; align-items: center; gap: 8px;">
             Imprimir
           </button>
         </div>
       </div>
     `;
   }

   html += `</div>`;

   resultDiv.innerHTML = html;
   resultDiv.style.display = 'block';
 }

 function formatCartaContent(content) {
   if (!content) return '';
   
   // Escapar caracteres HTML especiales
   let formatted = content
     .replace(/&/g, '&amp;')
     .replace(/</g, '&lt;')
     .replace(/>/g, '&gt;')
     .replace(/"/g, '&quot;')
     .replace(/'/g, '&#039;');
   
   return formatted;
 }

window.downloadCartaPDF = async function () {
   try {
     if (!window.currentCartaContent) {
       if (window.showMessage) window.showMessage('No hay carta disponible para descargar', 'error');
       return;
     }

     // Crear HTML para convertir a PDF
     const htmlContent = `
       <!DOCTYPE html>
       <html>
       <head>
         <meta charset="UTF-8">
         <title>Carta Descriptiva</title>
         <style>
           * { margin: 0; padding: 0; box-sizing: border-box; }
           body {
             font-family: 'Calibri', 'Arial', sans-serif;
             font-size: 11pt;
             line-height: 1.5;
             color: #333;
             padding: 20mm;
           }
           .header {
             text-align: center;
             margin-bottom: 20px;
             border-bottom: 3px solid #22c55e;
             padding-bottom: 15px;
           }
           .header h1 {
             font-size: 18pt;
             font-weight: bold;
             margin-bottom: 5px;
             color: #1f2937;
           }
           .header p {
             font-size: 10pt;
             color: #6b7280;
           }
           .content {
             white-space: pre-wrap;
             font-family: 'Calibri', 'Arial', sans-serif;
             font-size: 11pt;
             line-height: 1.6;
           }
           .section {
             margin-bottom: 15px;
             page-break-inside: avoid;
           }
           .section-title {
             font-weight: bold;
             font-size: 12pt;
             margin-top: 15px;
             margin-bottom: 8px;
             color: #1f2937;
             border-bottom: 1px solid #e5e7eb;
             padding-bottom: 5px;
           }
           table {
             width: 100%;
             border-collapse: collapse;
             margin: 10px 0;
           }
           th, td {
             border: 1px solid #d1d5db;
             padding: 8px;
             text-align: left;
             font-size: 10pt;
           }
           th {
             background-color: #f3f4f6;
             font-weight: bold;
             color: #1f2937;
           }
           tr:nth-child(even) {
             background-color: #f9fafb;
           }
           .footer {
             margin-top: 30px;
             padding-top: 15px;
             border-top: 1px solid #e5e7eb;
             font-size: 9pt;
             color: #9ca3af;
             text-align: center;
           }
           @media print {
             body { padding: 15mm; }
             .section { page-break-inside: avoid; }
           }
         </style>
       </head>
       <body>
         <div class="header">
           <h1>CARTA DESCRIPTIVA DE CLASE EN VIDEO</h1>
           <p>Guion de Produccion Pedagogico</p>
         </div>
         <div class="content">${window.currentCartaContent}</div>
         <div class="footer">
           <p>UDEL Tools - Sistema de Analisis Pedagogico</p>
         </div>
       </body>
       </html>
     `;

     // Usar html2pdf si está disponible
     if (window.html2pdf) {
       const element = document.createElement('div');
       element.innerHTML = htmlContent;
       
       const opt = {
         margin: 10,
         filename: 'carta-descriptiva.pdf',
         image: { type: 'jpeg', quality: 0.98 },
         html2canvas: { scale: 2 },
         jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
       };
       
       html2pdf().set(opt).from(element).save();
     } else {
       // Fallback: usar jsPDF directamente
       const { jsPDF } = window.jspdf;
       const doc = new jsPDF({
         orientation: 'portrait',
         unit: 'mm',
         format: 'a4'
       });

       doc.setFont('helvetica', 'normal');
       doc.setFontSize(16);
       doc.setFont('helvetica', 'bold');
       doc.text('CARTA DESCRIPTIVA DE CLASE EN VIDEO', 20, 20);

       doc.setFontSize(9);
       doc.setFont('helvetica', 'normal');
       doc.setTextColor(100, 100, 100);
       doc.text('Guion de Produccion Pedagogico', 20, 28);

       doc.setLineWidth(0.5);
       doc.setDrawColor(34, 197, 94);
       doc.line(20, 32, 190, 32);

       doc.setFontSize(10);
       doc.setTextColor(0, 0, 0);
       doc.setFont('helvetica', 'normal');
       
       const pageHeight = doc.internal.pageSize.height;
       const pageWidth = doc.internal.pageSize.width;
       const margin = 20;
       const maxWidth = pageWidth - (margin * 2);
       
       const splitContent = doc.splitTextToSize(window.currentCartaContent, maxWidth);
       
       let yPosition = 40;
       const lineHeight = 5;
       
       for (let i = 0; i < splitContent.length; i++) {
         if (yPosition > pageHeight - 20) {
           doc.addPage();
           yPosition = margin;
         }
         doc.text(splitContent[i], margin, yPosition);
         yPosition += lineHeight;
       }

       doc.setFontSize(8);
       doc.setTextColor(150, 150, 150);
       doc.text('UDEL Tools - Sistema de Analisis Pedagogico', margin, pageHeight - 10);

       doc.save('carta-descriptiva.pdf');
     }

     if (window.showMessage) window.showMessage('Carta descargada como PDF', 'success');
   } catch (e) {
     console.error('Error generando PDF:', e);
     if (window.showMessage) window.showMessage('Error al generar PDF. Intenta imprimir en su lugar.', 'error');
   }
 };

window.copyCartaToClipboard = async function () {
    try {
      if (!window.currentCartaContent) {
        if (window.showMessage) window.showMessage('No hay carta disponible para copiar', 'error');
        return;
      }

      await navigator.clipboard.writeText(window.currentCartaContent);
      if (window.showMessage) window.showMessage('Carta copiada al portapapeles', 'success');
    } catch (e) {
      console.error('Error copiando:', e);
      if (window.showMessage) window.showMessage('Error al copiar al portapapeles', 'error');
    }
  };

window.printCarta = function () {
     if (!window.currentCartaContent) {
       if (window.showMessage) window.showMessage('No hay carta disponible para imprimir', 'error');
       return;
     }

     const printWindow = window.open('', '_blank');
     printWindow.document.write(`
       <html>
         <head>
           <title>Carta Descriptiva de Clase en Video</title>
           <meta charset="UTF-8">
           <style>
             * { margin: 0; padding: 0; box-sizing: border-box; }
             body {
               font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
               margin: 0;
               padding: 20mm;
               line-height: 1.6;
               color: #1f2937;
               background: white;
             }
             .header {
               border-bottom: 3px solid #22c55e;
               padding-bottom: 16px;
               margin-bottom: 24px;
               text-align: center;
             }
             .header h1 {
               font-size: 24px;
               font-weight: bold;
               color: #1f2937;
               margin-bottom: 8px;
             }
             .header p {
               font-size: 12px;
               color: #6b7280;
               font-style: italic;
             }
             .content {
               white-space: pre-wrap;
               font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
               font-size: 11px;
               line-height: 1.7;
             }
             .footer {
               margin-top: 40px;
               padding-top: 16px;
               border-top: 1px solid #e5e7eb;
               font-size: 10px;
               color: #9ca3af;
               text-align: center;
             }
             @media print {
               body { margin: 0; padding: 20mm; }
               .header { page-break-after: avoid; }
             }
           </style>
         </head>
         <body>
           <div class="header">
             <h1>CARTA DESCRIPTIVA DE CLASE EN VIDEO</h1>
             <p>Generada automáticamente con estándares pedagógicos de calidad</p>
           </div>
           <div class="content">${window.currentCartaContent}</div>
           <div class="footer">
             <p>UDEL Tools - Sistema de Análisis Pedagógico</p>
           </div>
         </body>
       </html>
     `);
     printWindow.document.close();
     setTimeout(() => printWindow.print(), 250);
   };

window.handleCartaUpload = function (event) {
  // Función placeholder para subida manual de cartas
  if (window.showMessage) window.showMessage('Función de análisis manual no implementada aún. Usa el generador automático.', 'info');
};

/* ==========
   Botón de Vimeo en el Header
   ========== */
function updateVimeoHeaderButton(analysisId, qualifies, vimeoStatus, score, threshold, vimeoLink) {
  console.log('🔵 updateVimeoHeaderButton:', { analysisId, qualifies, vimeoStatus, score, threshold });

  const btn = document.getElementById('btnVimeoHeader');
  if (!btn) {
    console.error('❌ Botón btnVimeoHeader no encontrado');
    return;
  }

  console.log('✅ Botón encontrado, actualizando...');

  if (vimeoStatus === 'uploaded' && vimeoLink) {
    // Ya subido - mostrar link
    btn.style.display = 'inline-flex';
    btn.disabled = false;
    btn.style.background = 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)';
    btn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
      </svg>
      Ver en Vimeo
    `;
    btn.onclick = () => window.open(vimeoLink, '_blank');
  } else if (vimeoStatus === 'uploading') {
    // Subiendo
    btn.style.display = 'inline-flex';
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Subiendo...';
  } else if (qualifies) {
    // Califica - botón habilitado
    btn.style.display = 'inline-flex';
    btn.disabled = false;
    btn.style.background = 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)';
    btn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.977 6.416c-.105 2.338-1.739 5.543-4.894 9.609-3.268 4.247-6.026 6.37-8.29 6.37-1.409 0-2.578-1.294-3.553-3.881L5.322 11.4C4.603 8.816 3.834 7.522 3.01 7.522c-.179 0-.806.378-1.881 1.132L0 7.197a315.065 315.065 0 0 0 3.501-3.128C5.08 2.701 6.266 1.984 7.055 1.91c1.867-.18 3.016 1.1 3.447 3.838.465 2.953.789 4.789.971 5.507.537 2.45 1.131 3.674 1.776 3.674.502 0 1.256-.796 2.265-2.385 1.004-1.589 1.54-2.797 1.612-3.628.144-1.371-.395-2.061-1.614-2.061-.574 0-1.167.121-1.777.391 1.186-3.868 3.434-5.757 6.762-5.637 2.473.06 3.628 1.664 3.493 4.797l-.013.01z"/>
      </svg>
      Subir a Vimeo
    `;
    btn.onclick = () => uploadToVimeoFromHeader();
  } else {
    // No califica - botón deshabilitado
    btn.style.display = 'inline-flex';
    btn.disabled = true;
    btn.style.background = '#94a3b8';
    btn.style.opacity = '0.6';
    btn.title = `Necesitas ${threshold || 10}% (tienes ${(score || 0).toFixed(1)}%)`;
    btn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
      </svg>
      No califica (${(score || 0).toFixed(1)}%)
    `;
  }
}

async function uploadToVimeoFromHeader() {
  if (!currentAnalysisId) {
    if (window.showMessage) window.showMessage('No hay análisis activo', 'error');
    return;
  }

  if (!selectedVideoFile) {
    if (window.showMessage) window.showMessage('El archivo de video ya no está disponible', 'error');
    return;
  }

  const btn = document.getElementById('btnVimeoHeader');
  if (!btn) return;

  try {
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Subiendo...';

    const form = new FormData();
    form.append('file', selectedVideoFile);
    form.append('analysisId', currentAnalysisId);

    const res = await fetch(`${window.API_BASE}/uploadToVimeo`, {
      method: 'POST',
      body: form
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Error al subir a Vimeo');
    }

    console.log('✅ Video subido a Vimeo:', data.vimeoLink);
    
    // Actualizar la UI directamente, sin depender solo del listener de Firestore
    if (data.vimeoLink) {
      btn.disabled = false;
      btn.classList.remove('uploading');
      btn.style.background = 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)';
      btn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
        </svg>
        Ver en Vimeo
      `;
      btn.onclick = () => window.open(data.vimeoLink, '_blank');
      
      // Mostrar mensaje de éxito
      if (window.showMessage) window.showMessage('Video subido exitosamente a Vimeo', 'success');
    }

  } catch (err) {
    console.error('❌ Error al subir:', err);
    alert(err.message || 'Ocurrió un error al subir el video a Vimeo.');
    
    // Restaurar botón
    btn.disabled = false;
    btn.classList.remove('uploading');
    btn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.977 6.416c-.105 2.338-1.739 5.543-4.894 9.609-3.268 4.247-6.026 6.37-8.29 6.37-1.409 0-2.578-1.294-3.553-3.881L5.322 11.4C4.603 8.816 3.834 7.522 3.01 7.522c-.179 0-.806.378-1.881 1.132L0 7.197a315.065 315.065 0 0 0 3.501-3.128C5.08 2.701 6.266 1.984 7.055 1.91c1.867-.18 3.016 1.1 3.447 3.838.465 2.953.789 4.789.971 5.507.537 2.45 1.131 3.674 1.776 3.674.502 0 1.256-.796 2.265-2.385 1.004-1.589 1.54-2.797 1.612-3.628.144-1.371-.395-2.061-1.614-2.061-.574 0-1.167.121-1.777.391 1.186-3.868 3.434-5.757 6.762-5.637 2.473.06 3.628 1.664 3.493 4.797l-.013.01z"/>
      </svg>
      Subir a Vimeo
    `;
  }
}

window.uploadToVimeoFromHeader = uploadToVimeoFromHeader;

/* ==========
    Gestión de Usuarios (Admin)
    ========== */

window.loadPendingUsers = async function loadPendingUsers() {
    try {
        const container = document.getElementById('pendingUsersContainer');
        if (!container) return;

        const q = query(
            collection(db, 'users'),
            where('approved', '==', false),
            orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            container.innerHTML = '<p class="no-data">No hay usuarios pendientes de aprobación.</p>';
            return;
        }

        let html = '<div class="users-grid">';
        snapshot.forEach(doc => {
            const user = { id: doc.id, ...doc.data() };
            html += `
                <div class="user-card pending">
                    <div class="user-info">
                        <div class="user-avatar">
                            ${user.photoURL ? `<img src="${user.photoURL}" alt="Avatar">` : '👤'}
                        </div>
                        <div class="user-details">
                            <h4>${user.name || 'Sin nombre'}</h4>
                            <p class="user-email">${user.email || 'Sin email'}</p>
                            <p class="user-role">Rol: ${user.role || 'user'}</p>
                            <p class="user-date">Creado: ${new Date(user.createdAt).toLocaleDateString('es-ES')}</p>
                        </div>
                    </div>
                    <div class="user-actions">
                        <button class="btn-approve" onclick="approveUser('${user.id}')">
                            ✅ Aprobar
                        </button>
                        <button class="btn-reject" onclick="rejectUser('${user.id}')">
                            ❌ Rechazar
                        </button>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;

    } catch (error) {
        console.error('Error loading pending users:', error);
        if (window.showMessage) window.showMessage('Error al cargar usuarios pendientes.', 'error');
    }
};

window.loadAllUsers = async function loadAllUsers() {
    try {
        console.log('');
        console.log('═══════════════════════════════════════');
        console.log('🔄 LOADALL USERS EJECUTÁNDOSE');
        console.log('═══════════════════════════════════════');
        console.log('');

        // Obtener db desde window si no está disponible desde import
        const database = db || window.db;

        console.log('🔍 Verificando database:');
        console.log('  - db (import):', typeof db, db ? '✅' : '❌');
        console.log('  - window.db:', typeof window.db, window.db ? '✅' : '❌');
        console.log('  - database (seleccionado):', typeof database, database ? '✅' : '❌');

        if (!database) {
            console.error('❌ Firestore db no está disponible');
            console.error('db from import:', db);
            console.error('window.db:', window.db);
            return;
        }

        const tbody = document.getElementById('usersTableBody');
        const emptyState = document.getElementById('usersTableEmpty');

        if (!tbody) {
            console.error('❌ No se encontró usersTableBody');
            return;
        }

        console.log('📊 Consultando Firestore...');
        const q = query(collection(database, 'users'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);

        console.log(`✅ Se encontraron ${snapshot.size} usuarios`);

        if (snapshot.empty) {
            tbody.innerHTML = '';
            if (emptyState) emptyState.classList.remove('hidden');
            console.log('📭 No hay usuarios para mostrar');
            return;
        }

        if (emptyState) emptyState.classList.add('hidden');

        const roleLabels = {
            'superAdmin': 'Super Admin',
            'director': 'Director',
            'mentor': 'Mentor',
            'admin': 'Admin',
            'user': 'Usuario'
        };

        let html = '';
        snapshot.forEach(doc => {
            const user = { id: doc.id, ...doc.data() };
            const statusBadge = user.approved ?
                '<span style="background: #22c55e; color: white; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 600;">Aprobado</span>' :
                '<span style="background: #f59e0b; color: white; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 600;">Pendiente</span>';

            html += `
                <tr style="border-bottom: 1px solid #e5e7eb;">
                    <td style="padding: 12px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div style="width: 32px; height: 32px; border-radius: 50%; background: #e0e7ff; display: flex; align-items: center; justify-content: center; font-size: 14px;">
                                ${user.photoURL ? `<img src="${user.photoURL}" style="width: 32px; height: 32px; border-radius: 50%;" alt="Avatar">` : '👤'}
                            </div>
                            <span style="font-weight: 500; color: #111827;">${user.name || user.displayName || 'Sin nombre'}</span>
                        </div>
                    </td>
                    <td style="padding: 12px; color: #6b7280; font-size: 14px;">${user.email || 'Sin email'}</td>
                    <td style="padding: 12px;">
                        <span style="background: #dbeafe; color: #1e40af; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 600;">
                            ${roleLabels[user.role] || user.role || 'Usuario'}
                        </span>
                    </td>
                    <td style="padding: 12px;">${statusBadge}</td>
                    <td style="padding: 12px; text-align: center;">
                        <div style="display: flex; gap: 8px; justify-content: center;">
                            ${!user.approved ? `
                                <button onclick="approveUser('${user.id}')" style="background: #22c55e; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600;" title="Aprobar">
                                    ✅
                                </button>
                            ` : `
                                <button onclick="openEditUserModal('${user.id}')" style="background: #3b82f6; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600;" title="Editar">
                                    ✏️
                                </button>
                            `}
                            <button onclick="deleteUser('${user.id}')" style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600;" title="Eliminar">
                                🗑️
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
        console.log(`✅ Tabla actualizada con ${snapshot.size} usuarios`);

    } catch (error) {
        console.error('❌ Error loading all users:', error);
        if (window.showMessage) window.showMessage('Error al cargar todos los usuarios.', 'error');
    }
};

window.approveUser = async function approveUser(userId) {
    try {
        const database = db || window.db;
        const authentication = auth || window.auth;

        const userRef = doc(database, 'users', userId);
        await updateDoc(userRef, {
            approved: true,
            approvedAt: new Date().toISOString(),
            approvedBy: authentication.currentUser.uid
        });

        if (window.showMessage) window.showMessage('Usuario aprobado exitosamente.', 'success');
        // Recargar listas
        window.loadPendingUsers();
        window.loadAllUsers();

    } catch (error) {
        console.error('Error approving user:', error);
        if (window.showMessage) window.showMessage('Error al aprobar usuario.', 'error');
    }
};

window.deleteUser = async function deleteUser(userId) {
    if (!confirm('¿Estás seguro de que quieres eliminar este usuario? Esta acción no se puede deshacer.')) return;

    try {
        const database = db || window.db;
        await deleteDoc(doc(database, 'users', userId));
        if (window.showMessage) window.showMessage('Usuario eliminado exitosamente.', 'success');
        window.loadAllUsers();
        window.loadPendingUsers();

    } catch (error) {
        console.error('Error deleting user:', error);
        if (window.showMessage) window.showMessage('Error al eliminar usuario.', 'error');
    }
};

// Mantener compatibilidad con código antiguo
window.rejectUser = window.deleteUser;

/* ==========
    Gestión de Items (Admin)
    ========== */

window.loadAllItems = async function loadAllItems() {
    try {
        const container = document.getElementById('allItemsContainer');
        if (!container) return;

        const q = query(collection(db, 'items'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            container.innerHTML = '<p class="no-data">No hay items registrados.</p>';
            return;
        }

        let html = '<div class="items-grid">';
        snapshot.forEach(doc => {
            const item = { id: doc.id, ...doc.data() };
            html += `
                <div class="item-card">
                    <div class="item-info">
                        <h4>${item.title || 'Sin título'}</h4>
                        <p class="item-description">${item.description || 'Sin descripción'}</p>
                        <p class="item-date">Creado: ${new Date(item.createdAt).toLocaleDateString('es-ES')}</p>
                    </div>
                    <div class="item-actions">
                        <button class="btn-edit" onclick="editItem('${item.id}')">
                            ✏️ Editar
                        </button>
                        <button class="btn-delete" onclick="deleteItem('${item.id}')">
                            🗑️ Eliminar
                        </button>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;

    } catch (error) {
        console.error('Error loading items:', error);
        if (window.showMessage) window.showMessage('Error al cargar items.', 'error');
    }
};

window.deleteItem = async function deleteItem(itemId) {
    if (!confirm('¿Estás seguro de que quieres eliminar este item?')) return;

    try {
        await deleteDoc(doc(db, 'items', itemId));
        if (window.showMessage) window.showMessage('Item eliminado.', 'success');
        window.loadAllItems();

    } catch (error) {
        console.error('Error deleting item:', error);
        if (window.showMessage) window.showMessage('Error al eliminar item.', 'error');
    }
};

window.editItem = function editItem(itemId) {
    // TODO: Implementar edición de items
    alert('Función de edición no implementada aún.');
};

/* ==========
   Buscador de Clases
   ========== */

// Variables para el autocomplete
let autocompleteTimeout = null;
let selectedSuggestionIndex = -1;

window.openClaseFinder = function openClaseFinder() {
    const modal = document.getElementById('claseFinderModal');
    if (modal) modal.style.display = 'flex';

    // Limpiar búsqueda anterior
    const input = document.getElementById('claseSearchInput');
    const results = document.getElementById('claseSearchResults');
    const suggestions = document.getElementById('claseSearchSuggestions');

    if (input) input.value = '';
    if (results) {
        results.innerHTML = '';
        results.style.display = 'none';
    }
    if (suggestions) {
        suggestions.innerHTML = '';
        suggestions.style.display = 'none';
    }

    // Configurar autocomplete
    setupAutocomplete();

    // Focus en el input
    setTimeout(() => {
        if (input) input.focus();
    }, 100);
};

// Configurar eventos del autocomplete
function setupAutocomplete() {
    const input = document.getElementById('claseSearchInput');
    if (!input) return;

    // Remover listeners anteriores si existen
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);

    // Input event para búsqueda en tiempo real
    newInput.addEventListener('input', handleAutocompleteInput);

    // Keyboard navigation
    newInput.addEventListener('keydown', handleAutocompleteKeydown);

    // Cerrar sugerencias al hacer click fuera
    document.addEventListener('click', (e) => {
        const suggestions = document.getElementById('claseSearchSuggestions');
        const input = document.getElementById('claseSearchInput');
        if (suggestions && input && !suggestions.contains(e.target) && e.target !== input) {
            suggestions.style.display = 'none';
        }
    });
}

// Manejar input para autocomplete
async function handleAutocompleteInput(e) {
    const query = e.target.value.trim();
    const suggestionsDiv = document.getElementById('claseSearchSuggestions');

    if (!suggestionsDiv) return;

    // Limpiar timeout anterior
    if (autocompleteTimeout) {
        clearTimeout(autocompleteTimeout);
    }

    // Si hay menos de 2 caracteres, ocultar sugerencias
    if (query.length < 2) {
        suggestionsDiv.style.display = 'none';
        return;
    }

    // Mostrar loading
    suggestionsDiv.innerHTML = '<div class="autocomplete-loading">Buscando sugerencias...</div>';
    suggestionsDiv.style.display = 'block';

    // Debounce: esperar 300ms antes de hacer la petición
    autocompleteTimeout = setTimeout(async () => {
        try {
            const response = await fetch(`${window.API_BASE}/getSuggestions?query=${encodeURIComponent(query)}`);
            const data = await response.json();

            if (data.ok && data.suggestions.length > 0) {
                renderSuggestions(data.suggestions, query);
            } else {
                suggestionsDiv.innerHTML = '<div class="autocomplete-no-results">No se encontraron sugerencias</div>';
            }
        } catch (e) {
            console.error('Error obteniendo sugerencias:', e);
            suggestionsDiv.style.display = 'none';
        }
    }, 300);
}

// Renderizar sugerencias
function renderSuggestions(suggestions, query) {
    const suggestionsDiv = document.getElementById('claseSearchSuggestions');
    if (!suggestionsDiv) return;

    selectedSuggestionIndex = -1;

    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');

    let html = '';
    suggestions.forEach((suggestion, index) => {
        const highlighted = suggestion.replace(regex, '<mark>$1</mark>');
        html += `
            <div class="autocomplete-suggestion" data-index="${index}" data-value="${suggestion}">
                ${highlighted}
            </div>
        `;
    });

    suggestionsDiv.innerHTML = html;
    suggestionsDiv.style.display = 'block';

    // Agregar eventos click a las sugerencias
    suggestionsDiv.querySelectorAll('.autocomplete-suggestion').forEach(elem => {
        elem.addEventListener('click', () => {
            selectSuggestion(elem.getAttribute('data-value'));
        });
    });
}

// Seleccionar una sugerencia
function selectSuggestion(value) {
    const input = document.getElementById('claseSearchInput');
    const suggestionsDiv = document.getElementById('claseSearchSuggestions');

    if (input) {
        input.value = value;
        input.focus();
    }

    if (suggestionsDiv) {
        suggestionsDiv.style.display = 'none';
    }

    // Ejecutar búsqueda automáticamente
    searchClases();
}

// Manejar navegación con teclado
function handleAutocompleteKeydown(e) {
    const suggestionsDiv = document.getElementById('claseSearchSuggestions');
    if (!suggestionsDiv || suggestionsDiv.style.display === 'none') {
        if (e.key === 'Enter') {
            searchClases();
        }
        return;
    }

    const suggestions = suggestionsDiv.querySelectorAll('.autocomplete-suggestion');
    if (suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedSuggestionIndex = Math.min(selectedSuggestionIndex + 1, suggestions.length - 1);
        updateSelectedSuggestion(suggestions);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedSuggestionIndex = Math.max(selectedSuggestionIndex - 1, -1);
        updateSelectedSuggestion(suggestions);
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedSuggestionIndex >= 0 && selectedSuggestionIndex < suggestions.length) {
            const selected = suggestions[selectedSuggestionIndex];
            selectSuggestion(selected.getAttribute('data-value'));
        } else {
            searchClases();
        }
    } else if (e.key === 'Escape') {
        suggestionsDiv.style.display = 'none';
        selectedSuggestionIndex = -1;
    }
}

// Actualizar sugerencia seleccionada visualmente
function updateSelectedSuggestion(suggestions) {
    suggestions.forEach((elem, index) => {
        if (index === selectedSuggestionIndex) {
            elem.classList.add('selected');
            elem.scrollIntoView({ block: 'nearest' });
        } else {
            elem.classList.remove('selected');
        }
    });
}

window.closeClaseFinder = function closeClaseFinder() {
    const modal = document.getElementById('claseFinderModal');
    if (modal) modal.style.display = 'none';

    // Limpiar resultados
    const input = document.getElementById('claseSearchInput');
    const results = document.getElementById('claseSearchResults');
    const suggestions = document.getElementById('claseSearchSuggestions');

    if (input) input.value = '';
    if (results) {
        results.innerHTML = '';
        results.style.display = 'none';
    }
    if (suggestions) {
        suggestions.innerHTML = '';
        suggestions.style.display = 'none';
    }

    // Resetear variables
    selectedSuggestionIndex = -1;
    if (autocompleteTimeout) {
        clearTimeout(autocompleteTimeout);
        autocompleteTimeout = null;
    }
};

window.searchClases = async function searchClases() {
    const input = document.getElementById('claseSearchInput');
    const resultsDiv = document.getElementById('claseSearchResults');

    if (!input || !resultsDiv) return;

    const query = input.value.trim();

    if (query.length < 2) {
        if (window.showMessage) window.showMessage('Por favor, ingresa al menos 2 caracteres para buscar.', 'error');
        return;
    }

    try {
        // Mostrar loading
        resultsDiv.innerHTML = `
            <div class="loading-container">
                <div class="spinner"></div>
                <p class="loading-message">Buscando clases...</p>
            </div>
        `;
        resultsDiv.style.display = 'block';

        // Llamar al endpoint
        const response = await fetch(`${window.API_BASE}/searchClases?query=${encodeURIComponent(query)}`);

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Error desconocido' }));
            throw new Error(error.error || `Error ${response.status}`);
        }

        const data = await response.json();

        // Renderizar resultados
        renderClaseResults(data);

    } catch (e) {
        console.error('Error buscando clases:', e);
        resultsDiv.innerHTML = `
            <div class="result-header error">
                <div class="result-icon">✕</div>
                <h3 class="result-title">Error en la Búsqueda</h3>
            </div>
            <p class="error-message">${e.message || 'Ocurrió un error al buscar clases.'}</p>
        `;
        resultsDiv.style.display = 'block';
    }
};

function renderClaseResults(data) {
    const resultsDiv = document.getElementById('claseSearchResults');
    if (!resultsDiv) return;

    const { results, total, query } = data;

    if (total === 0) {
        resultsDiv.innerHTML = `
            <div class="result-header" style="background: #fef2f2; border-left: 4px solid #ef4444;">
                <div class="result-icon" style="color: #dc2626;">🔍</div>
                <h3 class="result-title" style="color: #991b1b;">No se encontraron resultados</h3>
            </div>
            <p style="color: #6b7280; margin-top: 12px;">
                No se encontraron clases que coincidan con "<strong>${query}</strong>".
                <br>Intenta con otro término de búsqueda.
            </p>
        `;
        resultsDiv.style.display = 'block';
        return;
    }

    let html = `
        <div class="result-header success">
            <div class="result-icon">✓</div>
            <h3 class="result-title">Resultados de Búsqueda</h3>
            <p class="result-subtitle" style="color: #6b7280; font-size: 14px; margin: 8px 0 0 0;">
                Se encontraron ${total} ${total === 1 ? 'clase' : 'clases'} que coinciden con "<strong>${query}</strong>"
            </p>
        </div>
        <div class="result-content">
    `;

    // Agrupar por cuatrimestre
    const byCuatrimestre = {};
    results.forEach(result => {
        const cuatri = result.cuatrimestre || 'Sin clasificar';
        if (!byCuatrimestre[cuatri]) {
            byCuatrimestre[cuatri] = [];
        }
        byCuatrimestre[cuatri].push(result);
    });

    // Ordenar cuatrimestres
    const sortedCuatrimestres = Object.keys(byCuatrimestre).sort((a, b) => {
        if (a === 'Sin clasificar') return 1;
        if (b === 'Sin clasificar') return -1;
        return parseInt(a) - parseInt(b);
    });

    sortedCuatrimestres.forEach(cuatri => {
        const clases = byCuatrimestre[cuatri];

        html += `
            <div style="margin-bottom: 24px;">
                <h4 style="color: #374151; font-size: 16px; font-weight: 600; margin-bottom: 12px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">
                    Cuatrimestre ${cuatri}
                </h4>
                <div style="display: grid; gap: 12px;">
        `;

        clases.forEach(clase => {
            const hasUrl = clase.hasUrl;
            const statusColor = hasUrl ? '#22c55e' : '#94a3b8';
            const statusIcon = hasUrl ? '✓' : '○';
            const statusText = hasUrl ? 'Disponible' : 'Sin enlace';

            html += `
                <div style="background: #f8fafc; border-left: 4px solid ${statusColor}; border-radius: 8px; padding: 16px;">
                    <div style="display: flex; justify-content: space-between; align-items: start; gap: 12px;">
                        <div style="flex: 1;">
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                                <span style="background: ${statusColor}; color: white; font-size: 12px; font-weight: 600; padding: 4px 8px; border-radius: 4px;">
                                    ${statusIcon} ${statusText}
                                </span>
                                ${clase.modulo ? `<span style="background: #e0e7ff; color: #4338ca; font-size: 12px; font-weight: 600; padding: 4px 8px; border-radius: 4px;">Módulo ${clase.modulo}</span>` : ''}
                            </div>
                            <h5 style="color: #1f2937; font-size: 16px; font-weight: 600; margin: 0 0 8px 0;">
                                ${clase.materia}
                            </h5>
                            ${clase.carrera ? `<p style="color: #6b7280; font-size: 14px; margin: 0;">${clase.carrera}</p>` : ''}
                        </div>
                        ${hasUrl ? `
                            <a href="${clase.url}" target="_blank"
                               class="btn-primary"
                               style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 16px; text-decoration: none; white-space: nowrap;">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3zM8 13h2.55v3h2.9v-3H16l-4-4z"/>
                                </svg>
                                Abrir en Dropbox
                            </a>
                        ` : `
                            <button class="btn-secondary" disabled style="opacity: 0.5; cursor: not-allowed; padding: 10px 16px; white-space: nowrap;">
                                No disponible
                            </button>
                        `}
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;
    });

    html += `</div>`;

    resultsDiv.innerHTML = html;
    resultsDiv.style.display = 'block';
}

window.openItemModal = function openItemModal() {
    // Crear modal dinámicamente si no existe
    let modal = document.getElementById('itemModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'itemModal';
        modal.className = 'app-modal';
        modal.innerHTML = `
            <div class="app-modal-content">
                <div class="app-modal-header">
                    <h3 class="app-modal-title">Nuevo Item</h3>
                    <button class="app-modal-close" onclick="closeItemModal()">×</button>
                </div>
                <div class="app-modal-body">
                    <form id="itemForm">
                        <div class="form-group">
                            <label for="itemTitle">Título</label>
                            <input type="text" id="itemTitle" required>
                        </div>
                        <div class="form-group">
                            <label for="itemDescription">Descripción</label>
                            <textarea id="itemDescription" rows="4"></textarea>
                        </div>
                        <div class="form-actions">
                            <button type="button" class="btn-cancel" onclick="closeItemModal()">Cancelar</button>
                            <button type="submit" class="btn-primary">Crear Item</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Event listener para el form
        document.getElementById('itemForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await createItem();
        });
    }
    modal.style.display = 'flex';
};

window.closeItemModal = function closeItemModal() {
    const modal = document.getElementById('itemModal');
    if (modal) modal.style.display = 'none';
};

async function createItem() {
    try {
        const title = document.getElementById('itemTitle').value.trim();
        const description = document.getElementById('itemDescription').value.trim();

        if (!title) {
            if (window.showMessage) window.showMessage('El título es obligatorio.', 'error');
            return;
        }

        const itemData = {
            title,
            description,
            createdAt: new Date().toISOString(),
            createdBy: window.auth?.currentUser?.uid
        };

        await addDoc(collection(db, 'items'), itemData);

        if (window.showMessage) window.showMessage('Item creado exitosamente.', 'success');
        closeItemModal();
        window.loadAllItems();

        // Limpiar form
        document.getElementById('itemTitle').value = '';
        document.getElementById('itemDescription').value = '';

    } catch (error) {
        console.error('Error creating item:', error);
        if (window.showMessage) window.showMessage('Error al crear item.', 'error');
    }
}

/* ==========
   Modal Unificado: Crear/Editar Usuarios
   ========== */

// Función auxiliar para cargar planteles en el formulario de usuario
async function loadPlantelesForUserForm() {
    try {
        console.log('📥 Cargando planteles para el formulario de usuario...');

        const authentication = auth || window.auth;

        if (!authentication?.currentUser) {
            console.error('No hay usuario autenticado');
            return;
        }

        const token = await authentication.currentUser.getIdToken();

        const response = await fetch(`${window.API_BASE || ''}/admin/getPlanteles`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Error al cargar planteles');
        }

        const result = await response.json();
        const planteles = result.planteles || [];

        const plantelSelect = document.getElementById('userFormPlantel');
        if (!plantelSelect) {
            console.warn('Elemento userFormPlantel no encontrado');
            return;
        }

        // Limpiar y agregar opciones
        plantelSelect.innerHTML = '<option value="">Selecciona un plantel</option>';
        planteles.forEach(plantel => {
            const option = document.createElement('option');
            option.value = plantel.name;
            option.textContent = plantel.name;
            plantelSelect.appendChild(option);
        });

        console.log(`✅ ${planteles.length} planteles cargados en el formulario`);

    } catch (error) {
        console.error('Error al cargar planteles:', error);
        if (window.showMessage) window.showMessage('Error al cargar planteles', 'error');
    }
}

// Función auxiliar para cargar planteles (se expone globalmente para uso en dashboard.html)
window.loadPlantelesForUserForm = loadPlantelesForUserForm;

// Esta función ahora delega a mostrarFormularioUsuario en dashboard.html
window.openUserFormModal = async function() {
    console.log('📝 openUserFormModal - delegando a mostrarFormularioUsuario');
    if (window.mostrarFormularioUsuario) {
        await window.mostrarFormularioUsuario('crear');
    } else {
        console.error('❌ mostrarFormularioUsuario no está disponible');
    }
};

// Función para cargar datos del usuario en el formulario (usada internamente)
async function cargarDatosUsuarioEnFormulario(userId) {
    const database = db || window.db;

    // Obtener datos del usuario
    const userRef = doc(database, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
        if (window.showMessage) window.showMessage('Usuario no encontrado.', 'error');
        throw new Error('Usuario no encontrado');
    }

    const userData = userDoc.data();

    // Guardar ID del usuario que se está editando
    document.getElementById('editUserId').value = userId;

    // Llenar formulario con datos actuales
    document.getElementById('userFormEmail').value = userData.email || '';
    document.getElementById('userFormRole').value = userData.role || '';

    // La contraseña no es requerida al editar
    document.getElementById('userFormPassword').required = false;
    document.getElementById('userFormPassword').value = '';

    // Cargar planteles en el dropdown
    await loadPlantelesForUserForm();

    // Campos adicionales si es director o mentor
    if (userData.role === 'director' || userData.role === 'mentor') {
        document.getElementById('userFormName').value = userData.name || '';
        document.getElementById('userFormLastName').value = userData.lastName || '';
        document.getElementById('userFormPlantel').value = userData.plantel || '';
        document.getElementById('userFormCiudad').value = userData.ciudad || '';
        document.getElementById('userFormWhatsapp').value = userData.whatsapp || '';
        document.getElementById('userFormAdditionalFields').classList.remove('hidden');
    } else {
        document.getElementById('userFormAdditionalFields').classList.add('hidden');
    }

    // Cargar permisos
    const permisos = userData.permisos || {};
    document.getElementById('userForm_perm_analizador_videos').checked = permisos.analizador_videos || false;
    document.getElementById('userForm_perm_carta_descriptiva').checked = permisos.carta_descriptiva || false;
    document.getElementById('userForm_perm_buscador_materias').checked = permisos.buscador_materias || false;
    document.getElementById('userForm_perm_solicitud_certificado').checked = permisos.solicitud_certificado || false;
}

// Exponer la función de carga de datos globalmente para usar en dashboard.html
window.openEditUserModalContent = cargarDatosUsuarioEnFormulario;

// Abrir modal para editar usuario (ahora delega a mostrarFormularioUsuario)
window.openEditUserModal = async function(userId) {
    try {
        console.log('✏️ openEditUserModal - delegando a mostrarFormularioUsuario');
        if (window.mostrarFormularioUsuario) {
            await window.mostrarFormularioUsuario('editar', userId);
        } else {
            console.error('❌ mostrarFormularioUsuario no está disponible');
        }
    } catch (error) {
        console.error('Error al abrir modal de edición:', error);
        if (window.showMessage) window.showMessage('Error al cargar datos del usuario.', 'error');
    }
};

// Cerrar modal (ahora simplemente vuelve a la lista)
window.closeUserFormModal = function() {
    if (window.volverAListaUsuarios) {
        window.volverAListaUsuarios();
    }
};

// Alternar campos adicionales según rol
window.toggleUserFormFields = function() {
    const role = document.getElementById('userFormRole').value;
    const additionalFields = document.getElementById('userFormAdditionalFields');

    if (role === 'director' || role === 'mentor') {
        additionalFields.classList.remove('hidden');
        // Hacer campos requeridos
        document.getElementById('userFormName').required = true;
        document.getElementById('userFormLastName').required = true;
        document.getElementById('userFormPlantel').required = true;
        document.getElementById('userFormCiudad').required = true;
        document.getElementById('userFormWhatsapp').required = true;
    } else {
        additionalFields.classList.add('hidden');
        // Hacer campos opcionales
        document.getElementById('userFormName').required = false;
        document.getElementById('userFormLastName').required = false;
        document.getElementById('userFormPlantel').required = false;
        document.getElementById('userFormCiudad').required = false;
        document.getElementById('userFormWhatsapp').required = false;
    }
};

// Guardar usuario (crear o editar)
window.saveUserData = async function(event) {
    event.preventDefault();

    const editUserId = document.getElementById('editUserId').value;
    const isEditing = !!editUserId;

    try {
        const email = document.getElementById('userFormEmail').value.trim();
        const password = document.getElementById('userFormPassword').value.trim();
        const role = document.getElementById('userFormRole').value;

        // Capturar permisos
        const permisos = {
            analizador_videos: document.getElementById('userForm_perm_analizador_videos').checked,
            carta_descriptiva: document.getElementById('userForm_perm_carta_descriptiva').checked,
            buscador_materias: document.getElementById('userForm_perm_buscador_materias').checked,
            solicitudes_certificados: document.getElementById('userForm_perm_solicitudes_certificados').checked,
            gestion_usuarios: role === 'superAdmin',
            gestion_planteles: role === 'superAdmin'
        };

        if (isEditing) {
            // EDITAR USUARIO EXISTENTE
            console.log('💾 Actualizando usuario:', editUserId);

            const database = db || window.db;
            const authentication = auth || window.auth;

            const updateData = {
                role,
                permisos,
                updatedAt: new Date().toISOString(),
                updatedBy: authentication?.currentUser?.uid || 'unknown'
            };

            // Campos adicionales para director/mentor
            if (role === 'director' || role === 'mentor') {
                const name = document.getElementById('userFormName').value.trim();
                const lastName = document.getElementById('userFormLastName').value.trim();

                if (!name || !lastName) {
                    if (window.showMessage) window.showMessage('Por favor completa nombre y apellido.', 'error');
                    return;
                }

                updateData.name = name;
                updateData.lastName = lastName;
                updateData.plantel = document.getElementById('userFormPlantel').value.trim();
                updateData.ciudad = document.getElementById('userFormCiudad').value.trim();
                updateData.whatsapp = document.getElementById('userFormWhatsapp').value.trim();
                updateData.displayName = `${name} ${lastName}`;
            }

            // Actualizar en Firestore
            await updateDoc(doc(database, 'users', editUserId), updateData);

            if (window.showMessage) window.showMessage('Usuario actualizado exitosamente.', 'success');

        } else {
            // CREAR NUEVO USUARIO
            console.log('➕ Creando nuevo usuario');

            if (!password) {
                if (window.showMessage) window.showMessage('La contraseña es requerida para nuevos usuarios.', 'error');
                return;
            }

            const userData = {
                email,
                password,
                role,
                permisos,
                approved: true,
                createdAt: new Date().toISOString(),
                createdBy: window.auth?.currentUser?.uid
            };

            // Campos adicionales para director/mentor
            if (role === 'director' || role === 'mentor') {
                const name = document.getElementById('userFormName').value.trim();
                const lastName = document.getElementById('userFormLastName').value.trim();

                if (!name || !lastName) {
                    if (window.showMessage) window.showMessage('Por favor completa todos los campos requeridos.', 'error');
                    return;
                }

                userData.name = name;
                userData.lastName = lastName;
                userData.plantel = document.getElementById('userFormPlantel').value.trim();
                userData.ciudad = document.getElementById('userFormCiudad').value.trim();
                userData.whatsapp = document.getElementById('userFormWhatsapp').value.trim();
                userData.displayName = `${name} ${lastName}`;
            } else {
                userData.name = email.split('@')[0];
            }

            // Llamar al endpoint del servidor para crear usuario
            const token = await window.auth?.currentUser?.getIdToken();
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
                throw new Error(error.error || `Error ${response.status}`);
            }

            if (window.showMessage) window.showMessage('Usuario creado exitosamente.', 'success');
        }

        // Cerrar modal y recargar tabla
        closeUserFormModal();
        window.loadAllUsers();

    } catch (error) {
        console.error('Error al guardar usuario:', error);
        if (window.showMessage) window.showMessage(error.message || 'Error al guardar usuario.', 'error');
    }
};

console.log('✅ Funciones de gestión de usuarios cargadas:', {
    openUserFormModal: typeof window.openUserFormModal,
    closeUserFormModal: typeof window.closeUserFormModal,
    saveUserData: typeof window.saveUserData,
    toggleUserFormFields: typeof window.toggleUserFormFields,
    openEditUserModal: typeof window.openEditUserModal,
    deleteUser: typeof window.deleteUser,
    approveUser: typeof window.approveUser,
    loadAllUsers: typeof window.loadAllUsers
});
