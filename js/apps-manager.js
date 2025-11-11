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

function setVideoResult(html) {
  const resultDiv = document.getElementById('videoAnalysisResult');
  if (!resultDiv) return;
  resultDiv.style.display = 'block';
  resultDiv.innerHTML = html;
}

window.handleVideoUpload = async function (evt) {
  const file = evt.target.files?.[0];
  if (!file) return;

  try {
    const analysisId = await createAnalysisJobNoStore();

    setVideoResult(`<p>Subiendo y analizando…</p><p>Archivo: ${file.name}</p>`);

    const form = new FormData();
    form.append('file', file);
    form.append('analysisId', analysisId);

    // Llama a tu Cloud Function HTTP
    const res = await fetch('/analyzeVideo', { // usa tu URL de Functions/Render (proxy en dashboard.html)
      method: 'POST',
      body: form
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`HTTP ${res.status}: ${txt}`);
    }

    // Escuchar el análisis
    const unsub = onSnapshot(doc(db, 'analyses', analysisId), (snap) => {
      if (!snap.exists()) return;
      const a = snap.data();
      if (a.status === 'processing') {
        setVideoResult(`<p>Procesando con IA…</p>`);
      } else if (a.status === 'done') {
        const r = a.result || {};
        setVideoResult(`
          <div class="result-header"><h3 class="result-title">Reporte</h3></div>
          <p><strong>Puntaje:</strong> ${r.score ?? 0}</p>
          <p><strong>Resumen:</strong> ${r.summary || '—'}</p>
          <ul>
            ${(r.findings || []).map(f => `<li>${f.ruleId}: ${f.ok ? '✅ Cumple' : '❌ No cumple'} — ${f.note || ''}</li>`).join('')}
          </ul>
          ${r.suggestions?.length ? `<p><strong>Sugerencias:</strong></p><ul>${r.suggestions.map(s=>`<li>${s}</li>`).join('')}</ul>` : ''}
        `);
        unsub();
      } else if (a.status === 'error') {
        setVideoResult(`<p>❌ Error: ${a.error || 'desconocido'}</p>`);
        unsub();
      }
    });
  } catch (e) {
    console.error(e);
    showMessage(e.message, 'error');
  }
};
