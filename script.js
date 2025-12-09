/* ==========================================================================

  VERB MATRIX — REORGANIZED FLOW (FINAL)
  - Preserves all original functions' logic (no deletion)
  - Re-groups and re-orders to implement:
      * Separate STUDY vs SRS flows
      * Tekrar -> SRS buttons first -> THEN alt-mod seçim (paralel/cloze/wordorder/quiz)
      * startQuizMode routes correctly
  - Author: Assistant (adapted for Burak)
  - Replace existing script.js with this content.

  ========================================================================== */

/* --------------------------------------------------------------------------
   BASE DATA & STATE
   -------------------------------------------------------------------------- */
window.data = {
  settings: { theme: 'light', conversionMode: 'tr-de', currentClass: 'A1' },
  content: {}, classes: [], groups: [], topics: {}, verbs: {}
};

window.state = {
  history: ['mainMenu'],
  deck: [], deckPos: 0, mode: 'study',
  autoPlayAudio: true, slowMode: false,
  currentCardKey: null, activeLearningPanel: null, tekrarStatus: null,
  currentVerbId: null, wordSelected: [], correctAnswer: '',
  deferredPrompt: null,
  parallel: { queue: [], index: 0, isPlaying: false, timer: null },
  speechSynthesisAvailable: ('speechSynthesis' in window)
};

/* --------------------------------------------------------------------------
   BOOT / DATA LOAD
   -------------------------------------------------------------------------- */
window.loadServerData = async function() {
  const jsonFileName = 'verbmatrix_data.json';
  const url = `./${jsonFileName}?v=${new Date().getTime()}`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const jsonData = await response.json();
    window.data = { ...window.data, ...jsonData };
    localStorage.setItem('verbmatrix_full_data', JSON.stringify(window.data));
    console.log("✅ Veri sunucudan alındı.");
  } catch (err) {
    console.warn("Sunucu verisi alınamadı:", err);
    const localBackup = localStorage.getItem('verbmatrix_full_data');
    if (localBackup) {
      window.data = { ...window.data, ...JSON.parse(localBackup) };
      console.log("📂 Yerel yedekten veri yüklendi.");
    } else {
      alert("HATA: Veri dosyası yüklenemedi ve yerel yedek yok.");
    }
  }
};

window.init = async function() {
    console.log("🚀 Uygulama (Güvenli Mod) Başlatılıyor...");
    const splash = document.getElementById('splashScreen');

    try {
        // --- A. AYARLARI YÜKLE ---
        const storedSettings = localStorage.getItem('verbmatrix_settings');
        if (storedSettings && storedSettings !== "undefined") {
            try { 
                window.data.settings = JSON.parse(storedSettings);
                // ÖNEMLİ: Her açılışta varsayılan olarak TR -> DE moduna zorla
                window.data.settings.conversionMode = 'tr-de';
            } catch(e) {}
        } else {
            // Varsayılan ayarlar
            window.data.settings = { theme: 'light', conversionMode: 'tr-de', currentClass: 'A1', showHints: true };
        }

        // --- B. DİĞER VERİLERİ YÜKLE ---
        try {
            window.srsData = JSON.parse(localStorage.getItem('verbmatrix_srs_data_v3') || '{}');
            window.contentOverride = JSON.parse(localStorage.getItem('verbmatrix_content_override') || '{}');
            window.starsData = JSON.parse(localStorage.getItem('verbmatrix_stars') || '{}');
        } catch (e) {
            console.error("Yerel veri hatası, sıfırlanıyor:", e);
            window.srsData = {};
        }

        // --- C. SUNUCU VERİSİNİ ÇEK ---
        await window.loadServerData();
        if(window.ensureDataIntegrity) window.ensureDataIntegrity();

        // --- D. ARAYÜZÜ GÜNCELLE ---
        if(window.updateSRSCounts) window.updateSRSCounts();
        if(window.updateTotalProgress) window.updateTotalProgress();
        if(window.renderClassSelection) window.renderClassSelection();
        if(window.updateClassButtonUI) window.updateClassButtonUI();
        
        // Dil butonlarını güncelle (TR-DE aktif olacak şekilde)
        if(window.updateLanguageToggleUI) window.updateLanguageToggleUI();

        // Gece modu
        if (window.data.settings.theme === 'dark') document.body.classList.add('dark-mode');

        // PWA
        if(window.checkPWAStatus) window.checkPWAStatus();

    } catch (error) {
        console.error("❌ Başlatma hatası:", error);
    } finally {
        if (splash) {
            splash.style.opacity = "0";
            setTimeout(() => { splash.style.display = 'none'; }, 500);
        }
    }
};
/* --------------------------------------------------------------------------
   HELPERS: UI + PWA + Storage
   -------------------------------------------------------------------------- */
window.handleImport = function(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const json = JSON.parse(e.target.result);
      if (json.verbs || json.content) window.data = { ...window.data, ...json };
      if (json.srs) window.srsData = json.srs;
      localStorage.setItem('verbmatrix_full_data', JSON.stringify(window.data));
      localStorage.setItem('verbmatrix_srs_data_v3', JSON.stringify(window.srsData));
      alert("✅ Veriler yüklendi! Sayfa yenileniyor...");
      location.reload();
    } catch (err) { alert("Hata: Dosya bozuk."); }
  };
  reader.readAsText(file);
};

window.exportData = function() {
  const exportObj = { srs: window.srsData, stars: window.starsData, settings: window.data.settings };
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj));
  const a = document.createElement('a'); a.href = dataStr; a.download = "verbmatrix_yedek.json";
  document.body.appendChild(a); a.click(); a.remove();
};

window.resetProgress = function() {
  if (confirm("TÜM İLERLEME SİLİNECEK!")) {
    localStorage.removeItem('verbmatrix_srs_data_v3'); location.reload();
  }
};

window.forceUpdateApp = function() {
  localStorage.removeItem('verbmatrix_full_data'); location.reload();
};

window.checkPWAStatus = function() {
  if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream && !navigator.standalone) {
    const el = document.getElementById('iosInstallInfo'); if (el) el.classList.remove('hidden');
  }
};

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); window.state.deferredPrompt = e;
  const btn = document.getElementById('installAppBtn'); if (btn) btn.classList.remove('hidden');
});

window.installPWA = async function() {
  if (window.state.deferredPrompt) { window.state.deferredPrompt.prompt(); window.state.deferredPrompt = null; }
};

/* --------------------------------------------------------------------------
   UI: Class / Language / Theme toggles
   -------------------------------------------------------------------------- */
window.renderClassSelection = function() {
  const grid = document.getElementById('classGrid'); if (!grid) return;
  grid.innerHTML = '';
  const classes = (window.data.classes && window.data.classes.length > 0) ? window.data.classes : [{ id: 'A1' }, { id: 'A2' }, { id: 'B1' }];
  classes.forEach(cls => {
    const btn = document.createElement('button'); btn.className = 'btn btn-secondary btn-lg';
    btn.innerText = cls.name || cls.id; btn.onclick = () => window.changeClass(cls.id);
    grid.appendChild(btn);
  });
  const mixBtn = document.createElement('button'); mixBtn.className = 'btn btn-info btn-lg';
  mixBtn.innerText = '🔀 MIXED'; mixBtn.onclick = () => window.openMixedSelection();
  grid.appendChild(mixBtn);
};

window.changeClass = function(className) {
  window.data.settings.currentClass = className;
  localStorage.setItem('verbmatrix_settings', JSON.stringify(window.data.settings));
  window.updateClassButtonUI();
  window.goBackInHistory();
};

window.updateClassButtonUI = function() {
  const cls = window.data.settings.currentClass || 'A1';
  const el1 = document.getElementById('classNavBtn'); if (el1) el1.textContent = cls;
  const el2 = document.getElementById('currentClassDisplay'); if (el2) el2.textContent = cls;
};





window.toggleTheme = function() {
  const body = document.body; body.classList.toggle('dark-mode');
  const isDark = body.classList.contains('dark-mode');
  window.data.settings.theme = isDark ? 'dark' : 'light';
  localStorage.setItem('verbmatrix_settings', JSON.stringify(window.data.settings));
  const btn = document.getElementById('themeToggleBtn'); if (btn) btn.innerText = isDark ? '☀️' : '🌙';
};

/* --------------------------------------------------------------------------
   NAVIGATION: views and history
   -------------------------------------------------------------------------- */
window.showView = function(viewId, pushToHistory = true) {
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  const target = document.getElementById(viewId);
  if (target) {
    target.classList.add('active');
    if (pushToHistory) {
      if (window.state.history.length === 0 || window.state.history[window.state.history.length - 1] !== viewId) {
        window.state.history.push(viewId);
      }
    }
  }
  if (viewId === 'settingsView') window.updateTotalProgress();
  window.scrollTo(0, 0);
};

window.goBackInHistory = function() {
  if (window.state.history.length > 1) {
    window.state.history.pop();
    const prev = window.state.history[window.state.history.length - 1];
    // Re-render certain pages on back for freshness
    if (prev === 'sectionMenu' && window.state.currentVerbId) window.renderSections(window.state.currentVerbId);
    if (prev === 'tekrarMenu') window.updateSRSCounts();
    if (prev === 'settingsView') window.updateTotalProgress();
    if (window.state.activeLearningPanel) window.toggleLearningPanel(null);
    window.showView(prev, false);
  } else {
    window.showView('mainMenu', false);
  }
};

/* --------------------------------------------------------------------------
   SRS COUNTS & PROGRESS
   -------------------------------------------------------------------------- */
window.updateSRSCounts = function() {
  const c = { zor: 0, normal: 0, ogridim: 0 }; // note: some code used ogrendim (Turkish)
  c.zor = c.normal = c.ogridim = 0;
  Object.values(window.srsData || {}).forEach(i => {
    if (i.status === 'zor') c.zor++;
    if (i.status === 'normal') c.normal++;
    if (i.status === 'ogrendim' || i.status === 'ogrendim') c.ogridim++;
  });
  const map = { zor: 'tekrarCountZor', normal: 'tekrarCountNormal', ogridim: 'tekrarCountOgrendim' };
  Object.keys(map).forEach(k => {
    const el = document.getElementById(map[k]);
    if (el) {
      if (k === 'ogridim') el.innerText = c.ogridim;
      else el.innerText = c[k];
    }
  });
};

window.updateTotalProgress = function() {
  let learned = 0; Object.values(window.srsData || {}).forEach(i => { if (i.status === 'ogrendim') learned++; });
  let total = 0; if (window.data.content) Object.values(window.data.content).forEach(arr => total += arr.length);
  if (total === 0) total = 1;
  const percent = Math.round((learned / total) * 100);
  const bar = document.getElementById('totalProgressBar'); if (bar) bar.style.width = percent + "%";
  const txt = document.getElementById('totalProgressText'); if (txt) txt.textContent = `${learned} / ${total} (%${percent})`;
};

/* --------------------------------------------------------------------------
   GROUP / VERBS / SECTIONS (STUDY flow)
   -------------------------------------------------------------------------- */


window.renderVerbs = function(groupId) {
  const list = document.getElementById('verbList'); if (!list) return; list.innerHTML = '';
  const verbs = (window.data.verbs && window.data.verbs[groupId]) ? window.data.verbs[groupId] : [];
  verbs.forEach(v => {
    const btn = document.createElement('button'); btn.className = 'btn btn-secondary btn-block';
    btn.style.marginBottom = '10px'; btn.style.textAlign = 'left';
    btn.innerHTML = `<b>${v.verbTR}</b> <small>(${v.verbDE})</small>`;
    btn.onclick = () => { window.state.verbData = v; if (window.state.mode === 'parallel') window.prepareParallelMenu(v); else window.renderSections(v.id); };
    list.appendChild(btn);
  });
  window.showView('verbMenu');
};



window.startStudy = function(sentences, vId, tId) {
  if (!sentences) { alert("Bu bölüm için içerik bulunamadı."); return; }
  const allCards = sentences.map((s, i) => { const id = `${vId}_s${tId}_${i}`; const ovr = window.contentOverride[id] || {}; return { ...s, ...ovr, id: id }; });
  const newCards = allCards.filter(card => !window.srsData[card.id]);
  if (newCards.length === 0) { alert("🎉 Bu konudaki tüm cümleler tamamlandı."); return; }
  window.state.deck = newCards; window.state.deckPos = 0; window.state.mode = 'study'; window.state.tekrarStatus = null;
  window.showView('learningView'); window.renderSentence();
};

/* --------------------------------------------------------------------------
   SPEECH / AUDIO UTIL
   -------------------------------------------------------------------------- */
window.speakText = function(text, lang, cb) {
  if (!window.state.speechSynthesisAvailable) { if (cb) cb(); return; }
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = (lang === 'de') ? 'de-DE' : 'tr-TR';
    u.rate = window.state.slowMode ? 0.7 : 0.9;
    u.onend = cb; u.onerror = cb;
    window.speechSynthesis.speak(u);
  } catch (e) {
    console.error("Speech error:", e); if (cb) cb();
  }
};

window.playCurrentSentence = function(lang) {
  if (!window.state.currentCardData) return;
  const text = (lang === 'de' ? window.state.currentCardData.de : window.state.currentCardData.tr);
  window.speakText(text, lang);
};

/* --------------------------------------------------------------------------
   LEARNING UI: renderSentence (STUDY mode) + Edit Panel + helper panels
   -------------------------------------------------------------------------- */
window.updateHeaderStatus = function() {
  let statusBar = document.getElementById('dynamicStatusBar');
  const container = document.getElementById('learningContent');
  if (!container) return;
  if (!statusBar) {
    statusBar = document.createElement('div');
    statusBar.id = 'dynamicStatusBar';
    statusBar.style.cssText = "background:#f0f4c3; padding:8px; margin-bottom:15px; border-left:4px solid #afb42b; font-size:0.9rem; color:#333;";
    container.insertBefore(statusBar, container.firstChild);
  }
  let infoText = "Genel Çalışma";
  if (window.state.currentVerbId) {
    let groupName = "Bilinmeyen Grup"; let verbName = "Fiil";
    const groups = window.data.groups || [];
    for (let g of groups) {
      const verbs = window.data.verbs[g.id] || [];
      const foundVerb = verbs.find(v => v.id === window.state.currentVerbId);
      if (foundVerb) { groupName = g.name; verbName = foundVerb.verbTR; break; }
    }
    let topicName = "";
    if (window.state.currentCardKey) {
      const parts = window.state.currentCardKey.split('_');
      const topicPart = parts.find(p => p.startsWith('s'));
      if (topicPart) {
        const tId = parseInt(topicPart.replace('s', ''));
        const topicPool = window.data.topicPool || window.data.topics[window.data.settings.currentClass];
        if (topicPool && topicPool[tId]) topicName = typeof topicPool[tId] === 'object' ? topicPool[tId].name : topicPool[tId];
      }
    }
    infoText = `📂 <b>${groupName}</b> &nbsp;👉&nbsp; ✏️ <b>${verbName}</b> &nbsp;👉&nbsp; 📑 <b>${topicName}</b>`;
  } else if (window.state.tekrarStatus) {
    infoText = `🔄 <b>TEKRAR MODU:</b> ${window.state.tekrarStatus.toUpperCase()}`;
  }
  statusBar.innerHTML = infoText;
};

window.toggleLearningPanel = function(panelId) {
    // Tüm panelleri kapat
    const panels = ['panelHint', 'panelListen', 'panelEdit'];
    
    // Eğer null gönderildiyse hepsini kapat ve çık (Reset durumu)
    if (!panelId) {
        panels.forEach(p => {
            const el = document.getElementById(p);
            if(el) el.classList.add('hidden');
        });
        // Kart içindeki ipucunu da gizle
        const hintBox = document.getElementById('hintContainer');
        if(hintBox) hintBox.style.display = 'none';
        return;
    }

    // Seçilen panel zaten açık mı?
    const targetPanel = document.getElementById(panelId);
    const isCurrentlyOpen = targetPanel && !targetPanel.classList.contains('hidden');

    // Hepsini kapat
    panels.forEach(p => {
        document.getElementById(p).classList.add('hidden');
    });

    // Eğer zaten açık değildiyse, seçileni aç
    if (!isCurrentlyOpen && targetPanel) {
        targetPanel.classList.remove('hidden');
    }
    
    // --- ÖZEL DURUM: İPUCU BUTONU ---
    // Eğer tıklanan 'panelHint' ise, KARTIN İÇİNDEKİ sarı kutuyu da yönet
    if (panelId === 'panelHint') {
        const hintBox = document.getElementById('hintContainer');
        if (hintBox) {
            // Panel açıldıysa kutuyu göster, kapandıysa gizle
            hintBox.style.display = !isCurrentlyOpen ? 'block' : 'none';
        }
    }
};

window.openEditPanel = function() {
  const card = window.state.currentCardData; if (!card) return;
  window.toggleLearningPanel('panelEdit');
  const panel = document.getElementById('panelEdit'); if (!panel) return;
  panel.innerHTML = `
    <h3 style="margin-top:0; color:#333;">Kartı Düzenle</h3>
    <label>🇩🇪 Almanca:</label>
    <input id="editInputDE" class="input-field" value="${card.de || ''}">
    <label>🇹🇷 Türkçe:</label>
    <input id="editInputTR" class="input-field" value="${card.tr || ''}">
    <label>💡 İpucu:</label>
    <input id="editInputHint" class="input-field" value="${card.hint || ''}" placeholder="İpucu ekle...">
    <div style="margin-top:20px; display:flex; gap:10px;">
      <button class="btn btn-success" style="flex:1" onclick="window.saveCurrentCardEdit()">💾 Kaydet</button>
      <button class="btn btn-secondary" style="flex:1" onclick="window.toggleLearningPanel(null)">❌ İptal</button>
    </div>
  `;
};

window.saveCurrentCardEdit = function() {
  const newDE = (document.getElementById('editInputDE') || {}).value || '';
  const newTR = (document.getElementById('editInputTR') || {}).value || '';
  const newHint = (document.getElementById('editInputHint') || {}).value || '';
  const cardId = window.state.currentCardKey;
  if (!cardId) return;
  if (!window.contentOverride) window.contentOverride = {};
  window.contentOverride[cardId] = { de: newDE, tr: newTR, hint: newHint };
  localStorage.setItem('verbmatrix_content_override', JSON.stringify(window.contentOverride));
  window.state.currentCardData.de = newDE; window.state.currentCardData.tr = newTR; window.state.currentCardData.hint = newHint;
  alert("✅ Kart ve İpucu Güncellendi!");
  window.toggleLearningPanel(null);
  if (window.state.mode === 'quiz') window.renderQuizCard();
  else if (window.state.mode === 'cloze') window.renderClozeCard();
  else window.renderSentence();
};


window.renderSentence = function() {
    // 1. Deste Bitti mi Kontrolü
    if (!window.state.deck || window.state.deckPos >= window.state.deck.length) { 
        window.showCompletion(); 
        return; 
    }
    
    const card = window.state.deck[window.state.deckPos]; 
    window.state.currentCardData = card; 
    window.state.currentCardKey = card.id; // Örn: v1_s1_0
    
    const content = document.getElementById('learningContent'); 
    if (!content) return;
    
    // 2. Temizlik
    content.innerHTML = ''; 
    content.classList.remove('hidden'); 
    content.style.textAlign = 'center';
    
    if (window.updateHeaderStatus) window.updateHeaderStatus();
    
    // 3. Soru/Cevap Hazırlığı
    const isTrDe = window.data.settings.conversionMode === 'tr-de';
    const question = isTrDe ? card.tr : card.de; 
    const answer = isTrDe ? card.de : card.tr; 
    
    // --- KRİTİK DÜZELTME: İPUCU VERİSİNİ JSON'DAN ÇEKME ---
    let hintText = "Bu cümle için ipucu yok.";

    // A. Önce 'hints.sentences' içinde bu ID var mı bak (Senin JSON yapın)
    if (window.data.hints && window.data.hints.sentences && window.data.hints.sentences[card.id]) {
        hintText = window.data.hints.sentences[card.id];
    } 
    // B. Yoksa kartın kendi içindeki 'hint' alanına bak (Yedek)
    else if (card.hint) {
        hintText = card.hint;
    }

    // C. Satır başlarını (<n>) HTML (<br>) formatına çevir
    hintText = hintText.replace(/\n/g, '<br>');
    // -------------------------------------------------------
    
    // 4. HTML ÇIKTISI (Sarı Kutu Kartın İçinde)
    const html = `
        <div class="sentence" style="margin-bottom:15px; min-height:80px; display:flex; flex-direction:column; justify-content:center;">
            <span style="color:var(--text-muted); font-size:0.9em; margin-bottom:5px;">Soru:</span>
            <strong style="font-size:1.4em; color:var(--text-main);">${question}</strong>
        </div>
        
        <div id="hintContainer" style="display:none; margin:10px auto; padding:15px; background:#fff9c4; color:#5f5a08; border-radius:8px; width:95%; border:1px solid #fff59d; text-align:left; font-size:0.95rem; line-height:1.5;">
            💡 ${hintText}
        </div>
        
        <div id="answerArea" class="sentence hidden" style="margin-top:20px; border-top:1px dashed var(--border); padding-top:20px;">
            <span style="color:var(--text-muted); font-size:0.9em; margin-bottom:5px;">Cevap:</span><br>
            <strong style="font-size:1.5em; color:var(--primary);">${answer}</strong>
        </div>
    `;
    content.innerHTML += html;
    
    // 5. AŞAĞIDAKİ PANELİN GÜNCELLENMESİ (Ekstra Butonlar Burada)
    const hintPanel = document.getElementById('panelHint');
    if (hintPanel) {
        if (window.state.mode === 'study') {
            hintPanel.innerHTML = `
                <div style="background:var(--bg-body); padding:15px; border-radius:8px; border:1px solid var(--border);">
                    <p style="margin-bottom:10px; font-size:0.85rem; color:var(--text-muted); font-weight:bold;">Ekstra Kaynaklar:</p>
                    <div class="button-grid" style="grid-template-columns: 1fr 1fr; gap:10px;">
                        <button class="btn btn-sm btn-info" onclick="window.openContextHint('verb')">
                            ⚡ Fiil Notu
                        </button>
                        <button class="btn btn-sm btn-warning" onclick="window.openContextHint('topic')">
                            📘 Konu Özeti
                        </button>
                    </div>
                </div>
            `;
        } else {
            hintPanel.innerHTML = '<div style="padding:10px; color:#999; font-size:0.8rem;">Bu modda ekstra kaynak yok.</div>';
        }
    }

    // 6. BUTONLAR VE AKSİYONLAR
    const actionBtn = document.getElementById('actionBtn'); 
    const srsControls = document.getElementById('srsControls');
    
    if (actionBtn) { 
        actionBtn.style.display = 'block'; 
        actionBtn.textContent = 'GÖSTER'; 
        actionBtn.onclick = function() {
            document.getElementById('answerArea').classList.remove('hidden');
            
            // Cevabı açtığında ipucu kutusunu da otomatik açmak istersen:
            // document.getElementById('hintContainer').style.display = 'block'; 

            if (isTrDe) window.playCurrentSentence('de');
            
            if (!window.state.tekrarStatus) {
                actionBtn.style.display = 'none';
                if (srsControls) srsControls.style.display = 'grid'; 
            } else {
                window.state.deckPos++; setTimeout(window.renderSentence, 1500);
            }
        }; 
    }
    
    // Progress
    const progressText = document.getElementById('learnProgressText'); 
    if (progressText) progressText.textContent = `${window.state.deckPos + 1} / ${window.state.deck.length}`;
    const progressBar = document.getElementById('progressFill'); 
    if (progressBar) progressBar.style.width = ((window.state.deckPos + 1) / window.state.deck.length * 100) + '%';
    
    // AutoPlay
    if (window.state.autoPlayAudio && window.data.settings.conversionMode !== 'tr-de') setTimeout(() => window.playCurrentSentence('de'), 300);
    
    // Panelleri Başlangıçta Kapat
    window.toggleLearningPanel(null); 
    if(window.injectDelayControls) window.injectDelayControls('panelListen');
};
/* ==========================================================================
   PARALEL OYNATICI FINAL SÜRÜMÜ (SYNC, KONTROLLER, BİP, ZAMANLAMA)
   - Önceki tüm paralel oynatıcı fonksiyonlarını silip bunu yapıştırın.
   ========================================================================== */

// --- YARDIMCI FONKSİYON: SOFT BİP SESİ (GÜVENLİ GAIN İLE) ---
window.playSoftBeep = function() {
    if (typeof AudioContext === 'undefined') return;

    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    
    oscillator.connect(gain);
    gain.connect(context.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, context.currentTime); // Yüksek frekans
    gain.gain.setValueAtTime(0.3, context.currentTime); // Güvenli ve duyulabilir ses seviyesi
    
    oscillator.start();
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.3); 
    oscillator.stop(context.currentTime + 0.3);
};


/* --------------------------------------------------------------------------
   SRS (Tekrar) FLOW: startTekrar => tekrarModeMenu => startQuizMode
   -------------------------------------------------------------------------- */
window.startTekrar = function(status) {
  // Prepare deck from srsData (but DO NOT start any mode automatically)
  window.state.tekrarStatus = status;
  const srsKeys = Object.keys(window.srsData || {}).filter(key => window.srsData[key].status === status);
  if (srsKeys.length === 0) { alert(`'${status.toUpperCase()}' havuzunda cümle yok.`); return; }

  // Build deck from data.content by matching ids
  const deck = [];
  Object.keys(window.data.content || {}).forEach(k => {
    window.data.content[k].forEach((s, i) => {
      const id = `${k}_${i}`; // consistent id format used elsewhere
      if (srsKeys.includes(id)) deck.push({ ...s, id: id });
    });
  });

  if (deck.length === 0) { alert("Havuzda ID var ama içerik bulunamadı."); return; }
  window.state.deck = deck; window.state.deckPos = 0; window.state.mode = 'study';
  // Now route to tekrarModeMenu, where user will select which application mode they want
  window.renderTekrarModeMenu(); // show the 4-alt-mode selection UI
};

/* helper: render the tekrarModeMenu content (4 buttons) */
window.renderTekrarModeMenu = function() {
  const container = document.getElementById('tekrarModeMenu');
  if (!container) {
    // If no dedicated container, fallback to alert and start quiz mode in 'quiz'
    alert("Tekrar modu menüsü yapılandırılmamış (tekrarModeMenu id eksik). Quiz başlatılıyor.");
    window.startQuizMode('quiz'); return;
  }
  container.innerHTML = `
    <h2 class="large-centered-title">🔁 Tekrar - Uygulama Seç</h2>
    <div class="button-grid" style="margin-top:18px;">
      <button class="btn btn-info" onclick="window.startQuizMode('parallel')">🎧 Paralel Dinleme</button>
      <button class="btn btn-warning" onclick="window.startQuizMode('cloze')">✏️ Boşluk Doldurma</button>
      <button class="btn btn-primary" onclick="window.startQuizMode('wordorder')">🧩 Kelime Sıralama</button>
      <button class="btn btn-danger" onclick="window.startQuizMode('quiz')">📝 Quiz (Yazma)</button>
    </div>
  `;
  window.showView('tekrarModeMenu');
};

/* --------------------------------------------------------------------------
   startQuizMode: central router for application modes (works for both SRS and Study)
   -------------------------------------------------------------------------- */
window.startQuizMode = function(mode) {
  // Mode param is one of: 'parallel', 'quiz', 'cloze', 'wordorder', 'study' (study rarely used)
  window.state.mode = mode;

  // If deck is empty, cannot start (deck should be prepared by either startStudy or startTekrar)
  if (!window.state.deck || window.state.deck.length === 0) {
    alert("Çalışılacak kart bulunamadı."); return;
  }

  // PARALLEL: special flow - queue + play loop
  if (mode === 'parallel') {
    // If parallel was selected from repetition flow and deck already contains entries, convert to queue
    const queue = window.state.deck.map(c => ({ ...c, title: `${window.state.tekrarStatus ? window.state.tekrarStatus.toUpperCase() : 'Çalışma'} Listesi` }));
    window.state.parallel.queue = queue; window.state.parallel.index = 0; window.state.parallel.isPlaying = true;
    window.showView('parallelPlayerView'); window.playParallelLoop(); return;
  }

  // Other modes: direct learning view and render specific card type
  window.showView('learningView');
  // UI resets
  const learningContent = document.getElementById('learningContent'); if (learningContent) learningContent.classList.remove('hidden');
  const wordOrderArea = document.getElementById('wordOrderArea'); if (wordOrderArea) wordOrderArea.classList.add('hidden');
  const actionBtn = document.getElementById('actionBtn'); if (actionBtn) { actionBtn.classList.remove('hidden'); actionBtn.style.display = 'block'; }
  const quizResultArea = document.getElementById('quizResultArea'); if (quizResultArea) quizResultArea.classList.add('hidden');
  const clozeResultArea = document.getElementById('clozeResultArea'); if (clozeResultArea) clozeResultArea.classList.add('hidden');
  const learningControlsArea = document.getElementById('learningControlsArea'); if (learningControlsArea) learningControlsArea.classList.remove('hidden');
  const editBtn = document.getElementById('btnEditCard'); if (editBtn) editBtn.style.display = 'none'; // hide edit in SRS mode by default

  // Set deckPos if not set
  if (typeof window.state.deckPos !== 'number') window.state.deckPos = 0;

  // Render according to mode
  if (mode === 'wordorder') {
    document.getElementById('learningContent').classList.add('hidden');
    const woArea = document.getElementById('wordOrderArea'); if (woArea) woArea.classList.remove('hidden');
    document.getElementById('actionBtn').style.display = 'none';
    window.renderWordOrderCard();
  } else if (mode === 'quiz') {
    window.renderQuizCard();
  } else if (mode === 'cloze') {
    window.renderClozeCard();
  } else {
    // fallback to study renderSentence
    window.renderSentence();
  }
};

/* --------------------------------------------------------------------------
   PARALLEL PLAYER (playParallelLoop + control)
   -------------------------------------------------------------------------- */
window.playParallelLoop = function() {
  if (!window.state.parallel.isPlaying) return;
  const q = window.state.parallel.queue || [];
  if (!q || q.length === 0) { alert("Paralel sırada içerik yok."); window.stopParallelAndExit(); return; }
  if (window.state.parallel.index >= q.length) window.state.parallel.index = 0;
  const item = q[window.state.parallel.index];
  const isTrDe = window.data.settings.conversionMode === 'tr-de';
  const displayArea = document.getElementById('parallelPlayerView');
  if (!displayArea) return;
  displayArea.innerHTML = `
    <div class="card" style="text-align:center; padding:30px;">
      <h3 style="color:var(--primary);">🎧 Paralel Dinleme</h3>
      <p style="color:#718096; font-size:0.9rem; margin-bottom:20px;">${item.title || '...'}</p>
      <div style="font-size:1.3rem; font-weight:bold; margin-bottom:15px; min-height:60px;">${isTrDe ? item.tr : item.de}</div>
      <div style="font-size:1.1rem; color:var(--primary); font-weight:500; min-height:40px;"><span id="pp_lang2">...</span></div>
      <div class="progress-bar-wrapper" style="margin:20px 0;"><div class="progress-fill" style="width:${((window.state.parallel.index+1)/q.length)*100}%"></div></div>
      <div style="display:flex; gap:10px; justify-content:center;">
        <button class="btn btn-secondary" onclick="window.controlParallel('prev')">⏮️</button>
        <button class="btn btn-warning" onclick="window.controlParallel('toggle')">${window.state.parallel.isPlaying ? '⏸️ Duraklat' : '▶️ Devam Et'}</button>
        <button class="btn btn-secondary" onclick="window.controlParallel('next')">⏭️</button>
      </div>
      <button class="btn btn-danger btn-block" style="margin-top:15px;" onclick="window.stopParallelAndExit()">Çıkış</button>
    </div>
  `;

  // TTS: first language, then second
  window.speakText(isTrDe ? item.tr : item.de, isTrDe ? 'tr' : 'de', () => {
    if (!window.state.parallel.isPlaying) return;
    setTimeout(() => {
      const pp2 = document.getElementById('pp_lang2'); if (pp2) pp2.innerText = isTrDe ? item.de : item.tr;
      window.speakText(isTrDe ? item.de : item.tr, isTrDe ? 'de' : 'tr', () => {
        if (!window.state.parallel.isPlaying) return;
        setTimeout(() => { window.state.parallel.index++; window.playParallelLoop(); }, 1200);
      });
    }, 700);
  });
};

window.controlParallel = function(action) {
  if (action === 'toggle') {
    window.state.parallel.isPlaying = !window.state.parallel.isPlaying;
    if (window.state.parallel.isPlaying) window.playParallelLoop(); else window.speechSynthesis.cancel();
  }
  if (action === 'next') {
    window.speechSynthesis.cancel(); window.state.parallel.index++; window.state.parallel.isPlaying = true; window.playParallelLoop();
  }
  if (action === 'prev') {
    window.speechSynthesis.cancel(); if (window.state.parallel.index > 0) window.state.parallel.index--; window.state.parallel.isPlaying = true; window.playParallelLoop();
  }
};

window.stopParallelAndExit = function() {
  window.state.parallel.isPlaying = false; try { window.speechSynthesis.cancel(); } catch (e) {}
  window.goBackInHistory();
};

/* --------------------------------------------------------------------------
   QUIZ / CLOZE / WORDORDER - RENDER & CHECK
   -------------------------------------------------------------------------- */
window.setupCleanUI = function(title) {
  const content = document.getElementById('learningContent'); if (!content) return null;
  const wordOrderArea = document.getElementById('wordOrderArea'); if (wordOrderArea) wordOrderArea.innerHTML = '';
  content.innerHTML = ''; content.classList.remove('hidden'); content.style.textAlign = 'center';
  // hide result areas
  ['quizResultArea','clozeResultArea','wordOrderResult'].forEach(id => { const e = document.getElementById(id); if (e) e.classList.add('hidden'); });
  const actionBtn = document.getElementById('actionBtn'); if (actionBtn) { actionBtn.style.display = 'block'; actionBtn.classList.remove('hidden'); actionBtn.textContent = 'KONTROL ET'; actionBtn.onclick = null; actionBtn.style.margin = '20px auto'; }
  const h3 = document.createElement('h3'); h3.innerText = title; h3.style.color = '#333'; h3.style.borderBottom = '2px solid #ff9800'; h3.style.display = 'inline-block'; h3.style.paddingBottom = '5px'; h3.style.marginBottom = '20px';
  content.appendChild(h3);
  return content;
};

// QUIZ
window.renderQuizCard = function() {
  if (!window.state.deck || window.state.deckPos >= window.state.deck.length) { window.showCompletion(); return; }
  const card = window.state.deck[window.state.deckPos]; window.state.currentCardKey = card.id;
  const isTrDe = window.data.settings.conversionMode === 'tr-de';
  window.state.correctAnswer = isTrDe ? card.de : card.tr;
  const container = window.setupCleanUI("📝 Quiz (Yazma)"); if (!container) return;
  const qDiv = document.createElement('div'); qDiv.innerHTML = `<div style="font-size:1.2rem; margin-bottom:15px;">${isTrDe ? card.tr : card.de}</div>`; container.appendChild(qDiv);
  const input = document.createElement('input'); input.id = 'quizInput'; input.className = 'input-field'; input.placeholder = 'Cevabı buraya yaz...'; input.style.textAlign = 'center'; input.autocomplete = 'off';
  container.appendChild(input);
  input.onkeydown = (e) => { if (e.key === 'Enter') window.checkQuizAnswer(); };
  document.getElementById('actionBtn').onclick = window.checkQuizAnswer;
  setTimeout(() => { try { input.focus(); } catch (e) {} }, 100);
};

window.checkQuizAnswer = function() {
  const inputEl = document.getElementById('quizInput'); if (!inputEl) return;
  const input = (inputEl.value || '').trim();
  const cleanInput = input.toLowerCase().replace(/[.,!?;:()"]/g, '');
  const cleanCorrect = (window.state.correctAnswer || '').toLowerCase().replace(/[.,!?;:()"]/g, '');
  const container = document.getElementById('learningContent');
  const feedback = document.createElement('div'); feedback.style.marginTop = '15px'; feedback.style.fontWeight = 'bold';
  const btn = document.getElementById('actionBtn');
  if (cleanInput === cleanCorrect) {
    feedback.innerHTML = '✅ DOĞRU!'; feedback.style.color = 'green';
    if (window.state.autoPlayAudio) window.playCurrentSentence('de');
    btn.textContent = 'DEVAM ET >';
    btn.onclick = () => { window.rateCard('normal'); };
  } else {
    feedback.innerHTML = `❌ YANLIŞ!<br><span style="color:#555">Doğru: ${window.state.correctAnswer}</span>`; feedback.style.color = 'red';
    btn.textContent = 'DEVAM ET >'; btn.onclick = () => { window.state.deckPos++; window.renderQuizCard(); };
  }
  const oldF = container.querySelector('.feedback-msg'); if (oldF) oldF.remove();
  feedback.className = 'feedback-msg'; container.appendChild(feedback);
};

// CLOZE
window.renderClozeCard = function() {
  if (!window.state.deck || window.state.deckPos >= window.state.deck.length) { window.showCompletion(); return; }
  const card = window.state.deck[window.state.deckPos]; window.state.currentCardKey = card.id;
  const isTrDe = window.data.settings.conversionMode === 'tr-de';
  const targetText = isTrDe ? card.de : card.tr;
  const words = targetText.split(' ');
  let validIndices = [];
  words.forEach((w, i) => { if (w.replace(/[^\wçğıöşüÇĞİÖŞÜ'-]/g,'').length > 1) validIndices.push(i); });
  if (validIndices.length === 0) validIndices = [0];
  const randIndex = validIndices[Math.floor(Math.random() * validIndices.length)];
  window.state.correctAnswer = words[randIndex].replace(/[.,!?;:()"]/g,'');
  const clozeSentence = words.map((w, i) => i === randIndex ? '________' : w).join(' ');
  const container = window.setupCleanUI("✏️ Boşluk Doldurma"); if (!container) return;
  container.innerHTML += `
    <div style="font-size:1rem; color:#666; margin-bottom:10px;">${isTrDe ? card.tr : card.de}</div>
    <div style="font-size:1.4rem; font-weight:bold; margin-bottom:20px; color:#2c3e50;">${clozeSentence}</div>
    <input id="clozeInput" class="input-field" placeholder="Eksik kelime?" style="text-align:center;" autocomplete="off">
    <div id="clozeFeedback" class="hidden"></div>
  `;
  const input = document.getElementById('clozeInput'); if (input) input.onkeydown = (e) => { if (e.key === 'Enter') window.checkClozeAnswer(); };
  document.getElementById('actionBtn').onclick = window.checkClozeAnswer; setTimeout(() => { try { input.focus(); } catch (e) {} }, 100);
};

window.checkClozeAnswer = function() {
  const inputEl = document.getElementById('clozeInput'); if (!inputEl) return;
  const input = (inputEl.value || '').trim().toLowerCase();
  const correct = (window.state.correctAnswer || '').toLowerCase();
  const feedback = document.getElementById('clozeFeedback'); if (!feedback) return;
  feedback.classList.remove('hidden'); feedback.style.marginTop = "15px";
  const btn = document.getElementById('actionBtn');
  if (input === correct) {
    feedback.innerHTML = '✅ MÜKEMMEL!'; feedback.style.color = 'green'; if (window.state.autoPlayAudio) window.playCurrentSentence('de');
    btn.textContent = 'DEVAM ET >'; btn.onclick = () => { window.rateCard('normal'); };
  } else {
    feedback.innerHTML = `❌ OLMADI.<br>Doğru cevap: <b>${window.state.correctAnswer}</b>`; feedback.style.color = 'red';
    btn.textContent = 'DEVAM ET >'; btn.onclick = () => { window.state.deckPos++; window.renderClozeCard(); };
  }
};

// WORD ORDER
window.renderWordOrderCard = function() {
  if (!window.state.deck || window.state.deckPos >= window.state.deck.length) { window.showCompletion(); return; }
  const card = window.state.deck[window.state.deckPos]; window.state.currentCardKey = card.id;
  const isTrDe = window.data.settings.conversionMode === 'tr-de';
  const targetText = isTrDe ? card.de : card.tr; window.state.correctAnswer = targetText.trim();
  // split words but try to keep punctuation attached
  let pool = targetText.match(/[\wçğıöşüÇĞİÖŞÜ'-]+|[.,!?;:()]/g) || targetText.split(' ');
  pool = pool.filter(Boolean);
  pool.sort(() => Math.random() - 0.5);
  window.state.wordPool = pool.slice(); window.state.wordSelected = [];
  const container = window.setupCleanUI("🧩 Kelime Sıralama"); if (!container) return;
  const qText = document.createElement('div');
  qText.innerHTML = `<small>Bunu çevir:</small><br><b style="font-size:1.1em">${isTrDe ? card.tr : card.de}</b>`; qText.style.marginBottom = "20px";
  container.appendChild(qText);
  const selectedArea = document.createElement('div'); selectedArea.id = 'woSelected';
  selectedArea.style.minHeight = '50px'; selectedArea.style.borderBottom = '2px dashed #ccc'; selectedArea.style.marginBottom = '20px';
  selectedArea.style.display = 'flex'; selectedArea.style.flexWrap = 'wrap'; selectedArea.style.justifyContent = 'center'; selectedArea.style.gap = '8px'; selectedArea.style.padding = '10px';
  container.appendChild(selectedArea);
  const poolArea = document.createElement('div'); poolArea.id = 'woPool'; poolArea.style.display = 'flex'; poolArea.style.flexWrap = 'wrap'; poolArea.style.justifyContent = 'center'; poolArea.style.gap = '8px';
  container.appendChild(poolArea);
  const fb = document.createElement('div'); fb.id = 'woFeedback'; fb.style.marginTop = '15px'; fb.style.fontWeight = 'bold'; container.appendChild(fb);
  window.updateWordOrderUI();
  document.getElementById('actionBtn').onclick = window.checkWordOrder;
};

window.updateWordOrderUI = function() {
  const selDiv = document.getElementById('woSelected'); const poolDiv = document.getElementById('woPool');
  if (!selDiv || !poolDiv) return;
  selDiv.innerHTML = ''; poolDiv.innerHTML = '';
  (window.state.wordSelected || []).forEach((w, i) => {
    const btn = document.createElement('button'); btn.className = 'btn btn-info btn-sm'; btn.innerText = w;
    btn.onclick = () => { window.state.wordSelected.splice(i, 1); window.state.wordPool.push(w); window.updateWordOrderUI(); };
    selDiv.appendChild(btn);
  });
  (window.state.wordPool || []).forEach((w, i) => {
    const btn = document.createElement('button'); btn.className = 'btn btn-secondary btn-sm'; btn.innerText = w;
    btn.onclick = () => { window.state.wordPool.splice(i, 1); window.state.wordSelected.push(w); window.updateWordOrderUI(); };
    poolDiv.appendChild(btn);
  });
};

window.checkWordOrder = function() {
  const userAns = (window.state.wordSelected || []).join(' ').replace(/\s([.,!?;:])/g, '$1').trim().toLowerCase();
  const correct = (window.state.correctAnswer || '').trim().toLowerCase();
  const feedback = document.getElementById('woFeedback'); const btn = document.getElementById('actionBtn');
  if (userAns === correct) {
    feedback.innerHTML = '✅ DOĞRU!'; feedback.style.color = 'green'; if (window.state.autoPlayAudio) window.playCurrentSentence('de');
    btn.textContent = 'DEVAM ET >'; btn.onclick = () => { window.rateCard('normal'); };
  } else {
    feedback.innerHTML = '❌ YANLIŞ! Tekrar dene.'; feedback.style.color = 'red';
  }
};

/* --------------------------------------------------------------------------
   RATE (SRS) ROUTER - write/update srsData and advance to appropriate renderer
   -------------------------------------------------------------------------- */
window.rateCard = function(status) {
  if (!window.state.currentCardKey) return;
  window.srsData = window.srsData || {};
  window.srsData[window.state.currentCardKey] = { status: status, date: Date.now() };
  localStorage.setItem('verbmatrix_srs_data_v3', JSON.stringify(window.srsData));
  if (window.updateSRSCounts) window.updateSRSCounts();
  // advance
  window.state.deckPos++;
  // route to appropriate rendering based on current mode
  if (window.state.mode === 'quiz') window.renderQuizCard();
  else if (window.state.mode === 'cloze') window.renderClozeCard();
  else if (window.state.mode === 'wordorder') window.renderWordOrderCard();
  else if (window.state.mode === 'parallel') {
    // parallel uses its own queue; simply play next
    if (window.state.parallel && window.state.parallel.isPlaying) window.playParallelLoop();
    else window.showCompletion();
  } else {
    // default study
    window.renderSentence();
  }
};

/* --------------------------------------------------------------------------
   COMPLETION SCREEN (after deck exhausted)
   -------------------------------------------------------------------------- */
window.findFirstUnconsumedSentenceInGroup = function(currentGroupId) {
  if (!currentGroupId) return null;
  const verbsInGroup = window.data.verbs[currentGroupId] || [];
  const topics = window.data.topics[window.data.settings.currentClass] || window.data.topicPool || {};
  for (const verb of verbsInGroup) {
    for (const tIdKey in topics) {
      const tId = parseInt(tIdKey); const contentKey = `${verb.id}_s${tId}`; const sentences = window.data.content[contentKey];
      if (sentences && sentences.length > 0) {
        if (sentences.some((s, index) => !window.srsData[`${contentKey}_${index}`])) return { vId: verb.id, tId: tId };
      }
    }
  }
  return null;
};

window.showCompletion = function() {
  const area = document.getElementById('learningContent'); if (!area) return;
  document.getElementById('actionBtn').style.display = 'none';
  const srsControls = document.getElementById('srsControls'); if (srsControls) srsControls.style.display = 'none';

  if (window.state.tekrarStatus) {
    area.innerHTML = `<div style="text-align:center; padding:30px;"><h2>🏁 Tekrar Tamamlandı</h2><button class="btn btn-secondary" onclick="window.goBackInHistory()">Geri Dön</button></div>`;
    return;
  }

  let htmlButtons = "";
  var lastCardId = window.state.currentCardKey || "";
  var parts = lastCardId.split('_');
  var vId = parts[0]; var tId = parseInt(parts[1]?.replace('s', '') || 1);
  var currentGroupId = window.data.groups.find(g => window.data.verbs[g.id] && window.data.verbs[g.id].some(v => v.id === vId))?.id;
  var remainingInfo = window.findFirstUnconsumedSentenceInGroup(currentGroupId);

  if (remainingInfo) {
    var startKey = remainingInfo.vId + '_s' + remainingInfo.tId;
    var verbName = window.data.verbs[currentGroupId].find(v => v.id === remainingInfo.vId)?.verbTR || 'Grup İçi';
    htmlButtons += `
      <button class="btn btn-warning btn-block" style="margin-bottom:10px;" onclick="window.startStudy(window.data.content['${startKey}'], '${remainingInfo.vId}', '${remainingInfo.tId}')">
        ⬇️ Grubun Kalanını Tamamla: <b>${verbName}</b>
      </button>`;
  }

  var nextTId = tId + 1;
  var nextContentKey = vId + '_s' + nextTId;
  if (window.data.content && window.data.content[nextContentKey]) {
    var topicName = (window.data.topicPool && window.data.topicPool[nextTId]) ? window.data.topicPool[nextTId] : (nextTId + ". Bölüm");
    htmlButtons += `
      <button class="btn btn-info btn-block" style="margin-bottom:10px;" onclick="window.startStudy(window.data.content['${nextContentKey}'], '${vId}', '${nextTId}')">
        ⬇️ Sonraki Konu: <b>${topicName}</b>
      </button>`;
  }

  if (currentGroupId) {
    var verbs = window.data.verbs[currentGroupId];
    var vIdx = verbs.findIndex(v => v.id === vId);
    if (vIdx !== -1 && verbs[vIdx + 1]) {
      var nextV = verbs[vIdx + 1];
      var nextKey = nextV.id + '_s1';
      htmlButtons += `
        <button class="btn btn-warning btn-block" style="margin-bottom:10px;" onclick="window.state.verbData=window.data.verbs['${currentGroupId}'][${vIdx+1}]; window.startStudy(window.data.content['${nextKey}'] || [], '${nextV.id}', '1')">
          ⏩ Sonraki Fiil: <b>${nextV.verbTR}</b>
        </button>`;
    }
  }

  if (currentGroupId) {
    var groupIds = window.data.groups.map(g => g.id); var gIdx = groupIds.indexOf(currentGroupId);
    if (gIdx !== -1 && groupIds[gIdx + 1]) {
      var nextGroup = window.data.groups[gIdx + 1];
      htmlButtons += `
        <button class="btn btn-primary btn-block" style="margin-bottom:10px;" onclick="window.renderVerbs('${nextGroup.id}')">
          ⏭️ Sonraki Grup: <b>${nextGroup.name}</b>
        </button>`;
    }
  }

  area.innerHTML = `
    <div style="text-align:center; padding:20px;">
      <h2 style="color:var(--success); margin-bottom:20px;">🎉 BÖLÜM TAMAMLANDI!</h2>
      ${htmlButtons}
      <button class="btn btn-secondary btn-block" style="margin-top:10px;" onclick="window.goBackInHistory()">↩️ Listeye Dön</button>
    </div>
  `;
};

/* --------------------------------------------------------------------------
   MIXED TOPICS
   -------------------------------------------------------------------------- */
window.openMixedSelection = function() {
  const list = document.getElementById('mixedTopicList'); if (!list) return;
  list.innerHTML = ''; const pool = window.data.topicPool || {};
  Object.keys(pool).sort((a,b)=>parseInt(a)-parseInt(b)).forEach(tId => {
    const isSelected = window.starsData && window.starsData[tId] > 0;
    const btn = document.createElement('button'); btn.className = isSelected ? 'btn btn-success-light' : 'btn btn-secondary';
    btn.innerHTML = `<span>Topic ${tId}: ${pool[tId]}</span> <span>${isSelected?'⭐':'☆'}</span>`;
    btn.style.justifyContent='space-between';
    btn.onclick = () => { window.starsData[tId] = window.starsData[tId] > 0 ? 0 : 1; window.openMixedSelection(); };
    list.appendChild(btn);
  });
  window.showView('mixedTopicSelectionView');
};

window.saveMixedSelection = function() {
  localStorage.setItem('verbmatrix_stars', JSON.stringify(window.starsData));
  window.changeClass('MIXED');
};

/* --------------------------------------------------------------------------
   MISC: music, autoplay, slowmode
   -------------------------------------------------------------------------- */
window.toggleMusic = function() { const m = document.getElementById('bgMusic'); if (m) { if (m.paused) m.play(); else m.pause(); } };
window.toggleAutoPlay = function() { window.state.autoPlayAudio = !window.state.autoPlayAudio; const led = document.getElementById('autoPlayLed'); if (led) led.classList.toggle('active'); };
window.toggleSlowMode = function() { window.state.slowMode = !window.state.slowMode; const led = document.getElementById('slowModeLed'); if (led) led.classList.toggle('active'); };
/* ==========================================================================
   TAMİR PAKETİ: EKSİK FONKSİYONLAR VE LOGO KAPATMA
   ========================================================================== */

/* 1. EKSİK OLAN "ÇALIŞMAYA BAŞLA" FONKSİYONU */
window.selectStudyMode = function(mode) {
    console.log("Mod Seçildi:", mode);
    
    // Durumu ayarla
    window.state.mode = mode; 
    window.state.tekrarStatus = null; // Tekrar (SRS) modundaysak çık
    
    // Grup menüsüne yönlendir ve listeyi çiz
    window.showView('groupMenu'); 
    window.renderGroups(); 
};

/* 2. GÜNCELLENMİŞ INIT FONKSİYONU (LOGO KAPATMA GARANTİLİ) */
// Mevcut window.init fonksiyonunu ezer ve hatasız çalışmasını sağlar.
window.init = async function() {
    console.log("🚀 Uygulama Başlatılıyor...");

    const splash = document.getElementById('splashScreen');

    try {
        // --- A. AYARLARI VE VERİLERİ YÜKLE ---
        const storedSettings = localStorage.getItem('verbmatrix_settings');
        if (storedSettings) window.data.settings = JSON.parse(storedSettings);

        try {
            window.srsData = JSON.parse(localStorage.getItem('verbmatrix_srs_data_v3') || '{}');
            window.contentOverride = JSON.parse(localStorage.getItem('verbmatrix_content_override') || '{}');
            window.starsData = JSON.parse(localStorage.getItem('verbmatrix_stars') || '{}');
        } catch (e) {
            console.error("Yerel veri okuma hatası:", e);
        }

        // --- B. SUNUCUDAN VERİ ÇEK ---
        await window.loadServerData();

        // --- C. ARAYÜZÜ GÜNCELLE ---
        if(window.updateSRSCounts) window.updateSRSCounts();
        if(window.updateTotalProgress) window.updateTotalProgress();
        if(window.renderClassSelection) window.renderClassSelection();
        if(window.updateClassButtonUI) window.updateClassButtonUI();
        if(window.updateLanguageToggleUI) window.updateLanguageToggleUI();

        // Gece modu kontrolü
        if (window.data.settings.theme === 'dark') document.body.classList.add('dark-mode');

        // PWA Kontrolü
        if(window.checkPWAStatus) window.checkPWAStatus();

    } catch (error) {
        console.error("⚠️ Başlatma sırasında kritik olmayan bir hata oluştu:", error);
    } finally {
        // --- D. FİNAL: LOGOYU NE OLURSA OLSUN KALDIR ---
        // Try bloğunda hata olsa bile (finally) burası kesinlikle çalışır.
        if (splash) {
            console.log("✅ Splash ekranı kaldırılıyor...");
            splash.style.transition = "opacity 0.5s ease"; // Yumuşak geçiş
            splash.style.opacity = "0";
            
            // Geçiş bitince tamamen gizle
            setTimeout(() => { 
                splash.style.display = 'none'; 
            }, 500);
        }
    }
};

// Sayfa yüklendiğinde başlat (Eğer daha önce eklenmediyse)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.init);
} else {
    // Sayfa zaten yüklendiyse hemen başlat
    window.init();
}
/* ==========================================================================
   ACİL KURTARMA VE VERİ ONARIM PAKETİ (v9.0 FIX)
   ========================================================================== */

// 1. GÜVENLİ VERİ YÜKLEME (DATA INTEGRITY CHECK)
// Veri eksikse veya bozuksa, uygulamayı çökertmek yerine boş objelerle doldurur.
window.ensureDataIntegrity = function() {
    console.log("🛡️ Veri bütünlüğü kontrol ediliyor...");
    
    if (!window.data) window.data = {};
    if (!window.data.settings) window.data.settings = { theme: 'light', conversionMode: 'tr-de', currentClass: 'A1' };
    
    // Kritik veri yapıları yoksa oluştur
    if (!window.data.topics) window.data.topics = {};
    if (!window.data.verbs) window.data.verbs = {};
    if (!window.data.groups) window.data.groups = [];
    if (!window.data.content) window.data.content = {};
    
    // Settings kontrolü (Eğer currentClass sayısal 1 olarak kaldıysa düzelt)
    if (typeof window.data.settings.currentClass === 'number') {
        window.data.settings.currentClass = 'A1';
    }
    
    console.log("✅ Veri yapısı doğrulandı.");
};

// 2. YENİLENMİŞ INIT FONKSİYONU (HATA KORUMALI)
window.init = async function() {
    console.log("🚀 Uygulama (Güvenli Mod) Başlatılıyor...");
    const splash = document.getElementById('splashScreen');

    try {
        // --- A. AYARLARI YÜKLE ---
        const storedSettings = localStorage.getItem('verbmatrix_settings');
        if (storedSettings && storedSettings !== "undefined") {
            try { window.data.settings = JSON.parse(storedSettings); } catch(e) {}
        }

        // --- B. BOZUK VERİYİ TEMİZLE VE YÜKLE ---
        try {
            const srsRaw = localStorage.getItem('verbmatrix_srs_data_v3');
            // Eğer veri "undefined" metni ise veya bozuksa sıfırla
            if (srsRaw === "undefined" || srsRaw === null) {
                console.warn("⚠️ Bozuk SRS verisi tespit edildi, sıfırlanıyor...");
                window.srsData = {};
                localStorage.removeItem('verbmatrix_srs_data_v3');
            } else {
                window.srsData = JSON.parse(srsRaw);
            }

            window.contentOverride = JSON.parse(localStorage.getItem('verbmatrix_content_override') || '{}');
            window.starsData = JSON.parse(localStorage.getItem('verbmatrix_stars') || '{}');
        } catch (e) {
            console.error("⚠️ Yerel veri okuma hatası (Sıfırlanıyor):", e);
            window.srsData = {};
        }

        // --- C. SUNUCU VERİSİNİ ÇEK ---
        await window.loadServerData();
        
        // --- D. VERİ BÜTÜNLÜĞÜNÜ SAĞLA (KRİTİK ADIM) ---
        window.ensureDataIntegrity();

        // --- E. ARAYÜZÜ GÜNCELLE ---
        if(window.updateSRSCounts) window.updateSRSCounts();
        if(window.updateTotalProgress) window.updateTotalProgress();
        if(window.renderClassSelection) window.renderClassSelection();
        if(window.updateClassButtonUI) window.updateClassButtonUI();
        if(window.updateLanguageToggleUI) window.updateLanguageToggleUI();

        // Gece modu
        if (window.data.settings.theme === 'dark') document.body.classList.add('dark-mode');

        // PWA
        if(window.checkPWAStatus) window.checkPWAStatus();

    } catch (error) {
        console.error("❌ Başlatma hatası:", error);
        alert("Veri yüklenirken bir sorun oluştu. Ayarlar > Verileri Sıfırla yapmanız gerekebilir.");
    } finally {
        // Logoyu kaldır
        if (splash) {
            splash.style.opacity = "0";
            setTimeout(() => { splash.style.display = 'none'; }, 500);
        }
    }
};

// 3. RENDER SECTIONS DÜZELTMESİ (HATA KAYNAĞI BURASIYDI)
// `reading '1'` hatasını önlemek için güvenli erişim ekledik.
window.renderSections = function(verbId) {
    const list = document.getElementById('sectionList'); if (!list) return; list.innerHTML = '';
    window.state.currentVerbId = verbId;
    
    // Güvenli Sınıf Seçimi
    const currentClass = window.data.settings.currentClass || 'A1';
    
    // HATA ÖNLEYİCİ: window.data.topics veya topics[currentClass] yoksa boş obje kullan
    let topicSource = {};
    if (window.data.topics && window.data.topics[currentClass]) {
        topicSource = window.data.topics[currentClass];
    } else if (currentClass === 'MIXED' && window.data.topicPool) {
        topicSource = window.data.topicPool;
    }

    // Eğer topicSource hala boşsa uyarı ver ve çık (Çökme engellendi)
    if (!topicSource || Object.keys(topicSource).length === 0) {
        console.warn(`⚠️ '${currentClass}' sınıfı için konu bulunamadı.`);
        list.innerHTML = '<div style="text-align:center; padding:20px;">Bu seviyede konu bulunamadı.</div>';
        return;
    }

    Object.keys(topicSource).sort((a, b) => parseInt(a) - parseInt(b)).forEach(tId => {
        const tName = typeof topicSource[tId] === 'object' ? topicSource[tId].name : topicSource[tId];
        if (currentClass === 'MIXED' && (!window.starsData[tId] || window.starsData[tId] === 0)) return;
        const key = `${verbId}_s${tId}`; 
        const sentences = window.data.content ? window.data.content[key] : null;
        
        if (sentences && sentences.length > 0) {
            let completedCount = 0; 
            sentences.forEach((s, idx) => { if (window.srsData[`${key}_${idx}`]) completedCount++; });
            const total = sentences.length; 
            const isFinished = completedCount === total;
            let btnClass = isFinished ? 'btn-success' : (completedCount > 0 ? 'btn-info' : 'btn-secondary');
            const row = document.createElement('button'); row.className = `btn ${btnClass} btn-block`;
            row.style.justifyContent = 'space-between'; row.style.textAlign = 'left';
            row.innerHTML = `<div><div style="font-size:0.8rem; opacity:0.8">Konu ${tId}</div><div style="font-size:1.1rem; font-weight:bold;">${tName}</div></div><div style="font-size:0.85rem; font-weight:700; min-width:80px; text-align:right;">${isFinished ? '✅ TAMAM' : `⏳ ${completedCount} / ${total}`}</div>`;
            row.onclick = () => window.startStudy(sentences, verbId, tId);
            list.appendChild(row);
        }
    });
    window.showView('sectionMenu');
};

// 4. MÜZİK HATASI DÜZELTMESİ
// Dosya yoksa hatayı yutar, konsolu kirletmez.
window.toggleMusic = function() {
    const m = document.getElementById('bgMusic');
    if (m) {
        // Eğer src yoksa veya hata verdiyse çalmaya çalışma
        if (!m.currentSrc || m.error) {
            console.warn("🎵 Müzik dosyası (telifsiz-klasik.mp3) bulunamadı.");
            return;
        }
        if (m.paused) m.play().catch(e => console.log("Müzik çalma hatası:", e));
        else m.pause();
    }
};

// 5. MANUEL SIFIRLAMA BUTONU (Konsoldan çalıştırmak için)
window.hardReset = function() {
    if(confirm("Tüm veriler silinecek ve uygulama fabrika ayarlarına dönecek. Onaylıyor musunuz?")) {
        localStorage.clear();
        location.reload();
    }
};

// Kodu hemen başlat
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.init);
} else {
    window.init();
}
/* ==========================================================================
   EKSİK FONKSİYONLAR YAMASI (HİKAYE + İPUCU + TESTLER)
   ========================================================================== */

/* --- 1. İPUCU SİSTEMİ TAMİRİ (showSpecificHint Hatası İçin) --- */
window.showSpecificHint = function(type) {
    // Panel yoksa oluştur
    let panel = document.getElementById('hintDisplayPanel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'hintDisplayPanel';
        panel.style.cssText = "background:#fff3cd; color:#856404; padding:15px; margin-top:10px; border-radius:8px; border:1px solid #ffeeba; font-size:0.95rem; display:none;";
        const container = document.getElementById('learningContent')?.parentNode;
        if(container) container.appendChild(panel);
    }

    const card = window.state.currentCardData;
    if (!card) return;

    let text = "İpucu bulunamadı.";
    const parts = card.id.split('_'); // v1_s1_0
    const vId = parts[0]; 
    const tId = parts[1]?.replace('s','');

    // Veriden İpucunu Bul
    if (type === 'sentence') {
        text = card.hint || (window.data.hints && window.data.hints.sentences ? window.data.hints.sentences[card.id] : null) || "Bu cümle için özel ipucu yok.";
    } else if (type === 'verb') {
        const verbInfo = window.data.verbs && window.data.verbs[window.state.currentVerbId || 'g1'] ? window.data.verbs[window.state.currentVerbId].find(v=>v.id===vId) : null;
        text = verbInfo ? `${verbInfo.verbTR} (${verbInfo.verbDE})` : "Fiil bilgisi bulunamadı.";
    } else if (type === 'topic') {
        const topicName = window.data.topics && window.data.topics[window.data.settings.currentClass] ? window.data.topics[window.data.settings.currentClass][tId] : "Konu";
        text = `Konu: ${topicName}`;
    }

    // Ekrana Yaz
    panel.innerHTML = `<strong>💡 İPUCU (${type.toUpperCase()}):</strong><br>${text}`;
    panel.style.display = 'block';
};


/* --- 2. HİKAYE MODU (Kitap İkonu ve Okuma Ekranı) --- */

// A. Grup Listesini Güncelle (Kitap İkonu Eklemek İçin)
window.renderGroups = function() {
    const list = document.getElementById('groupList'); 
    if(!list) return; 
    list.innerHTML = '';
    
    const groups = window.data.groups || [];
    groups.forEach(g => {
        const wrapper = document.createElement('div');
        wrapper.className = 'btn-group-wrapper'; // CSS class eklenebilir
        wrapper.style.display = 'flex'; 
        wrapper.style.gap = '10px'; 
        wrapper.style.marginBottom = '10px';

        // Grup Butonu
        const btn = document.createElement('button'); 
        btn.className = 'btn btn-secondary'; 
        btn.style.flexGrow = '1'; 
        btn.style.textAlign = 'left';
        btn.innerHTML = `<span><b>${g.name}</b><br><small>${g.nameDE || ''}</small></span> 👉`;
        btn.onclick = () => window.renderVerbs(g.id); 
        wrapper.appendChild(btn);

        // Hikaye Butonu (Varsa)
        // Kontrol: window.data.stories içinde bu grup ID'si (g1, g2) var mı?
        if (window.data.stories && window.data.stories[g.id]) {
            const storyBtn = document.createElement('button');
            storyBtn.className = 'btn btn-info';
            storyBtn.style.width = '60px';
            storyBtn.innerHTML = '📖';
            storyBtn.title = "Hikaye Oku";
            storyBtn.onclick = () => window.openStoryMode(g.id);
            wrapper.appendChild(storyBtn);
        }
        
        list.appendChild(wrapper);
    });
};

// B. Hikayeyi Açma Fonksiyonu
window.openStoryMode = function(groupId) {
    const story = window.data.stories[groupId];
    if (!story) return;

    window.state.currentStoryId = groupId;
    
    // HTML Elementlerini Bul
    const titleEl = document.getElementById('storyTitle');
    const contentEl = document.getElementById('storyContent');
    const view = document.getElementById('storyView');
    
    if (titleEl) titleEl.innerText = story.title || "Hikaye";
    if (contentEl) contentEl.innerHTML = story.text ? story.text.replace(/\n/g, '<br>') : "İçerik yok.";
    
    // Test Butonu Ekle (Hikaye altına)
    let testBtn = document.getElementById('btnStartStoryTest');
    if (!testBtn) {
        testBtn = document.createElement('button');
        testBtn.id = 'btnStartStoryTest';
        testBtn.className = 'btn btn-warning btn-block';
        testBtn.style.marginTop = '20px';
        testBtn.innerText = '📝 Hikaye Testini Çöz';
        testBtn.onclick = () => window.startStoryTest(groupId);
        if(contentEl) contentEl.parentNode.appendChild(testBtn);
    } else {
        testBtn.onclick = () => window.startStoryTest(groupId); // Update onclick
    }

    window.showView('storyView');
};

// C. Hikaye Sesi
window.playStoryAudio = function() {
    const groupId = window.state.currentStoryId;
    if (!groupId || !window.data.stories[groupId]) return;
    
    const text = window.data.stories[groupId].text;
    window.speakText(text, 'de');
};


/* --- 3. HİKAYE TESTLERİ --- */
window.startStoryTest = function(groupId) {
    const story = window.data.stories[groupId];
    if (!story || !story.questions) {
        alert("Bu hikaye için test bulunamadı.");
        return;
    }

    const container = document.getElementById('storyQuestionsContent');
    if (!container) {
        // Eğer container yoksa storyView içine ekle
        const newDiv = document.createElement('div');
        newDiv.id = 'storyQuestionsView';
        newDiv.className = 'view';
        newDiv.innerHTML = '<h3 style="text-align:center">Hikaye Testi</h3><div id="storyQuestionsContent"></div><button class="btn btn-secondary btn-block" style="margin-top:20px" onclick="window.showView(\'storyView\')">Geri Dön</button>';
        document.body.querySelector('.site-container').appendChild(newDiv);
    }
    
    const contentDiv = document.getElementById('storyQuestionsContent');
    contentDiv.innerHTML = ''; // Temizle

    // Soruları Listele
    story.questions.forEach((q, index) => {
        const qDiv = document.createElement('div');
        qDiv.className = 'content-box';
        qDiv.style.marginBottom = '15px';
        qDiv.innerHTML = `<p><strong>${index+1}. ${q.question}</strong></p>`;

        q.options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'btn btn-secondary btn-block';
            btn.style.textAlign = 'left';
            btn.style.marginBottom = '5px';
            btn.innerText = opt;
            btn.onclick = function() {
                // Cevap Kontrolü
                if (opt === q.answer) {
                    this.className = 'btn btn-success btn-block';
                    this.innerText += ' ✅';
                } else {
                    this.className = 'btn btn-danger btn-block';
                    this.innerText += ' ❌';
                }
            };
            qDiv.appendChild(btn);
        });
        contentDiv.appendChild(qDiv);
    });

    window.showView('storyQuestionsView');
};
/* ==========================================================================
   HİKAYE MODU GÜNCELLEMESİ (SES VE YAVAŞ MOD)
   ========================================================================== */

window.playStoryAudio = function(lang) {
    const groupId = window.state.currentStoryId;
    if (!groupId || !window.data.stories[groupId]) return;
    
    // Hangi metni okuyacağız?
    let textToRead = "";
    
    if (lang === 'de') {
        textToRead = window.data.stories[groupId].text; // Almanca metin
    } else if (lang === 'tr') {
        // Eğer JSON'da 'textTR' varsa onu oku, yoksa uyarı ver
        textToRead = window.data.stories[groupId].textTR || "Bu hikayenin Türkçe seslendirmesi henüz eklenmemiş.";
    }

    // Yavaş mod kontrolü
    // window.state.slowMode zaten toggleSlowMode() ile değişiyor.
    // Ancak story ekranındaki LED'i güncellemek için şunu yapabiliriz:
    const led = document.getElementById('storySlowLed');
    if(led) led.classList.toggle('active', window.state.slowMode);

    // Okumayı Başlat
    window.speakText(textToRead, lang);
};

// Yavaş Mod Butonu için mevcut fonksiyonu güncelleyelim ki Story ekranındaki LED de yansın
const originalToggleSlow = window.toggleSlowMode;
window.toggleSlowMode = function() {
    // Orijinal işlevi yap (State değiştir)
    if(originalToggleSlow) originalToggleSlow();
    else window.state.slowMode = !window.state.slowMode;

    // LED'leri güncelle (Hem ana ekran hem hikaye ekranı)
    const ledMain = document.getElementById('slowModeLed');
    const ledStory = document.getElementById('storySlowLed');
    
    if (ledMain) ledMain.classList.toggle('active', window.state.slowMode);
    if (ledStory) ledStory.classList.toggle('active', window.state.slowMode);
};
/* --- ALT MENÜ SINIF GÜNCELLEME --- */
// Mevcut updateClassButtonUI fonksiyonunu güncelliyoruz
window.originalUpdateClassUI = window.updateClassButtonUI;
window.updateClassButtonUI = function() {
    // Varsa eski fonksiyonu çalıştır
    if(window.originalUpdateClassUI) window.originalUpdateClassUI();

    const currentClass = window.data.settings.currentClass || 'A1';
    
    // Alt menüdeki badge'i güncelle
    const floatBadge = document.getElementById('floatClassBadge');
    if(floatBadge) floatBadge.innerText = currentClass;
    
    // Ana menüdeki varsa onu da güncelle (gerçi kaldırdık ama dursun)
    const mainBadge = document.getElementById('classNavBtn');
    if(mainBadge) mainBadge.innerText = currentClass;
};
/* ==========================================================================
   DİL SEÇİMİ LED TAMİRİ (KESİN ÇÖZÜM)
   ========================================================================== */

// 1. Dili Değiştiren Fonksiyon
window.toggleLanguageMode = function() {
    // Mevcut modu tersine çevir
    const current = window.data.settings.conversionMode;
    window.data.settings.conversionMode = (current === 'tr-de') ? 'de-tr' : 'tr-de';
    
    // Kaydet
    localStorage.setItem('verbmatrix_settings', JSON.stringify(window.data.settings));
    
    // Işıkları Güncelle
    window.updateLanguageToggleUI();
};

// 2. Işıkları Yakan Fonksiyon (UI Update)
window.updateLanguageToggleUI = function() {
    const mode = window.data.settings.conversionMode; // 'tr-de' veya 'de-tr'
    
    // HTML'deki LED elementlerini bul
    const ledTR = document.getElementById('led_tr_de');
    const ledDE = document.getElementById('led_de_tr');

    // Elementler varsa işlem yap
    if (ledTR && ledDE) {
        // Önce hepsini söndür
        ledTR.classList.remove('active');
        ledDE.classList.remove('active');
        ledTR.style.background = "#ccc"; // Gri
        ledTR.style.boxShadow = "none";
        ledDE.style.background = "#ccc"; // Gri
        ledDE.style.boxShadow = "none";

        // Seçili olanı yak (Manuel Stil ile Garanti Altına Al)
        if (mode === 'tr-de') {
            ledTR.classList.add('active');
            ledTR.style.background = "#00e676"; // Parlak Neon Yeşil
            ledTR.style.boxShadow = "0 0 10px #00e676"; // Parlama Efekti
        } else {
            ledDE.classList.add('active');
            ledDE.style.background = "#00e676"; // Parlak Neon Yeşil
            ledDE.style.boxShadow = "0 0 10px #00e676"; // Parlama Efekti
        }
    }
};

// Sayfa açılışında durumu kontrol et (Gecikmeli çalıştır ki HTML yüklensin)
setTimeout(window.updateLanguageToggleUI, 500);
/* ==========================================================================
   FİNAL TAMİR PAKETİ: IŞIKLAR, HİKAYELER VE PARALEL DİNLEME
   ========================================================================== */

/* 1. DİL SEÇİMİ VE IŞIK DÜZELTMESİ (TR-DE Varsayılan) */
window.updateLanguageToggleUI = function() {
    // Hafızadan güncel modu oku
    let mode = window.data.settings.conversionMode;
    
    // EĞER mode tanımlı değilse veya bozuksa TR-DE yap
    if (!mode || mode === "undefined") {
        mode = 'tr-de';
        window.data.settings.conversionMode = 'tr-de';
    }

    const ledTR = document.getElementById('led_tr_de');
    const ledDE = document.getElementById('led_de_tr');

    if (ledTR && ledDE) {
        // Önce temizle
        ledTR.classList.remove('active'); ledTR.style.background = "#ccc"; ledTR.style.boxShadow = "none";
        ledDE.classList.remove('active'); ledDE.style.background = "#ccc"; ledDE.style.boxShadow = "none";

        // Mantığı düzelt (TR-DE ise Sol taraf yansın)
        if (mode === 'tr-de') {
            ledTR.classList.add('active');
            ledTR.style.background = "#00e676"; // Neon Yeşil
            ledTR.style.boxShadow = "0 0 10px #00e676";
        } else {
            ledDE.classList.add('active');
            ledDE.style.background = "#00e676";
            ledDE.style.boxShadow = "0 0 10px #00e676";
        }
    }
};

/* 2. GRUP LİSTESİNDE HİKAYE BUTONU GERİ GETİRME */
window.renderGroups = function() {
    const list = document.getElementById('groupList'); 
    if(!list) return; 
    list.innerHTML = '';
    
    const groups = window.data.groups || [];
    groups.forEach(g => {
        // Kapsayıcı Div (Yan Yana Dizilim İçin)
        const wrapper = document.createElement('div');
        wrapper.className = 'button-grid'; // CSS'deki grid yapısını kullan
        wrapper.style.gridTemplateColumns = '1fr auto'; // Sol geniş, sağ otomatik
        wrapper.style.gap = '10px';
        wrapper.style.marginBottom = '10px';

        // 1. Grup Butonu (Sola)
        const btn = document.createElement('button'); 
        btn.className = 'btn btn-secondary'; 
        btn.style.textAlign = 'left';
        btn.innerHTML = `<span><b>${g.name}</b><br><small>${g.nameDE || ''}</small></span>`;
        btn.onclick = () => window.renderVerbs(g.id); 
        wrapper.appendChild(btn);

        // 2. Hikaye Butonu (Sağa) - VARSA EKLENİR
        if (window.data.stories && window.data.stories[g.id]) {
            const storyBtn = document.createElement('button');
            storyBtn.className = 'btn btn-info';
            storyBtn.innerHTML = '📖 Oku';
            storyBtn.title = "Hikaye Modu";
            storyBtn.onclick = () => window.openStoryMode(g.id);
            wrapper.appendChild(storyBtn);
        }
        
        list.appendChild(wrapper);
    });
};



/* ==========================================================================
   DÜZELTME v3: DOĞRU AKIŞ (PARALEL & AYRIŞTIRMA)
   ========================================================================== */

/* 1. renderSections (Temiz Liste) */
window.renderSections = function(verbId) {
    const list = document.getElementById('sectionList'); 
    if (!list) return; 
    list.innerHTML = '';
    
    window.state.currentVerbId = verbId;
    const currentClass = window.data.settings.currentClass || 'A1';

    let topicSource = {};
    if (window.data.topics && window.data.topics[currentClass]) {
        topicSource = window.data.topics[currentClass];
    }

    if (!topicSource || Object.keys(topicSource).length === 0) {
        list.innerHTML = '<div style="text-align:center; padding:20px; color:#999;">Konu bulunamadı.</div>';
        return;
    }

    Object.keys(topicSource).sort((a, b) => parseInt(a) - parseInt(b)).forEach(tId => {
        const tName = (typeof topicSource[tId] === 'object') ? topicSource[tId].name : topicSource[tId];
        const key = `${verbId}_s${tId}`; 
        const sentences = window.data.content ? window.data.content[key] : null;
        
        if (sentences && sentences.length > 0) {
            let completedCount = 0; 
            sentences.forEach((s, idx) => { if (window.srsData[`${key}_${idx}`]) completedCount++; });
            const isFinished = completedCount === sentences.length;
            
            const btn = document.createElement('button'); 
            btn.className = isFinished ? 'btn btn-success btn-block' : 'btn btn-secondary btn-block';
            btn.style.textAlign = 'left'; 
            btn.style.justifyContent = 'space-between';
            btn.style.marginBottom = '10px';
            
            btn.innerHTML = `
                <div>
                    <small style="opacity:0.7">Konu ${tId}</small><br>
                    <b style="font-size:1rem;">${tName}</b>
                </div>
                <div style="font-weight:bold;">
                    ${isFinished ? '✅' : `${completedCount}/${sentences.length}`}
                </div>
            `;
            
            // Tıklayınca 2 Butonlu Menü Açılır
            btn.onclick = () => window.startStudy(sentences, verbId, tId);
            list.appendChild(btn);
        }
    });
    window.showView('sectionMenu');
};

/* 2. startStudy (Veriyi Hazırlar ve Menüyü Açar) */
window.startStudy = function(sentences, vId, tId) {
    if(!sentences || sentences.length === 0) return;

    // JSON'dan gelen veriyi geçici hafızaya alıyoruz
    window.tempDeck = sentences.map((s, i) => { 
        const id = `${vId}_s${tId}_${i}`; 
        const ovr = window.contentOverride[id] || {}; 
        return { ...s, ...ovr, id: id }; 
    });

    // Menüyü Aç
    window.openTopicActionModal(vId, tId);
};

/* 3. openTopicActionModal (SADECE 2 BUTON) */
window.openTopicActionModal = function(vId, tId) {
    let modal = document.getElementById('topicActionModal');
    if (modal) modal.remove();

    // Konu İsmi
    const currentClass = window.data.settings.currentClass || 'A1';
    let topicName = "Seçilen Konu";
    if(window.data.topics[currentClass] && window.data.topics[currentClass][tId]) {
        const t = window.data.topics[currentClass][tId];
        topicName = (typeof t === 'object') ? t.name : t;
    }

    modal = document.createElement('div');
    modal.id = 'topicActionModal';
    modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10000; display:flex; align-items:center; justify-content:center; animation:fadeIn 0.2s;";
    
    modal.innerHTML = `
        <div class="content-box" style="width:90%; max-width:320px; background:var(--bg-card); padding:25px; border-radius:16px; text-align:center; border:1px solid var(--primary);">
            
            <h3 style="color:var(--primary-dark); margin-bottom:10px;">${topicName}</h3>
            <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:25px;">Ne yapmak istersin?</p>
            
            <div style="display:flex; flex-direction:column; gap:15px;">
                
                <button onclick="window.confirmStudyMode('parallel')" class="btn btn-info btn-lg" style="justify-content:center; padding:15px;">
                    🎧 Paralel Dinle
                </button>

                <button onclick="window.confirmStudyMode('study')" class="btn btn-warning btn-lg" style="justify-content:center; padding:15px;">
                    🧩 Cümle Ayrıştır
                </button>

            </div>

            <button onclick="document.getElementById('topicActionModal').remove()" class="btn btn-secondary" style="margin-top:20px; width:100%;">
                İptal
            </button>
        </div>
    `;

    document.body.appendChild(modal);
};

/* 4. confirmStudyMode (Seçime Göre Başlat) */
window.confirmStudyMode = function(mode) {
    document.getElementById('topicActionModal').remove(); // Modalı kapat
    
    if (!window.tempDeck) return;
    
    // Veriyi Yükle
    window.state.deck = window.tempDeck;
    window.state.deckPos = 0;
    window.state.mode = mode; // 'parallel' veya 'study'

    if (mode === 'parallel') {
        // Paralel Dinleme Modu
        if(window.startParallelPlayer) window.startParallelPlayer();
        else {
             alert("Paralel Oynatıcı başlatılıyor...");
             // Buraya senin paralel oynatıcı fonksiyonun gelecek
        }
    } else {
        // 'study' modu seçildi (Cümle Ayrıştır)
        // Kartları gösterir, Zor/Kolay/Öğrendim butonları çıkar.
        window.showView('learningView');
        window.renderSentence();
    }
};
/* --- Uygulamayı Güncelleme / Önbellek Boşaltma --- */
window.forceUpdateApp = function() {
    if (confirm("UYARI: Uygulama önbelleği (sunucu verisi yedeği) silinecek ve uygulama yeniden başlayacaktır. Bu işlem, hatalı veri çekimlerini düzeltir. Emin misiniz?")) {
        
        // 1. Yerel Veri Önbelleğini Sil (Böylece init tekrar çekecek)
        localStorage.removeItem('verbmatrix_full_data');
        
        // 2. Service Worker Cache'ini İptal Et (Tarayıcıya zorla yenileme yapmasını söyle)
        // Bu, tarayıcıya sunucudan yeni dosyaları çekmesi için en iyi yoldur.
        window.location.reload(true); 
    }
};

// --- YARDIMCI FONKSİYON: SOFT BİP SESİ (GAIN DÜZELTİLDİ) ---
window.playSoftBeep = function() {
    if (typeof AudioContext === 'undefined') return;

    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    
    oscillator.connect(gain);
    gain.connect(context.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, context.currentTime); 
    gain.gain.setValueAtTime(0.3, context.currentTime); // Güvenli ve duyulabilir ses seviyesi
    
    oscillator.start();
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.3); 
    oscillator.stop(context.currentTime + 0.3);
};

// --- 1. GECİKME KONTROLLERİ (Açıklamasız UI) ---
window.injectDelayControls = function(targetId) {
    const target = document.getElementById(targetId);
    if (!target) return;
    
    // Yalnızca 3s, 5s, 10s, 15s butonları
    const delays = [3000, 5000, 10000, 15000]; 
    const currentDelay = window.data.settings.parallelDelay || 3000;

    let html = `
        <div class="button-grid" style="grid-template-columns: repeat(4, 1fr); gap:8px;">
    `;

    delays.forEach(ms => {
        const isActive = ms === currentDelay;
        const className = isActive ? 'btn-primary' : 'btn-secondary';
        
        html += `<button class="btn btn-sm ${className}" 
                         data-delay-ms="${ms}" 
                         onclick="window.setParallelDelay(${ms})">
                         ${ms / 1000}s
                 </button>`;
    });

    html += `</div>`;
    target.innerHTML = html; 
    window.updateDelayUI();
};

// --- 2. OYNATICIYI BAŞLATMA (startParallelPlayer) ---
window.startParallelPlayer = function() {
    if (!window.state.deck || window.state.deck.length === 0) {
        alert("Destede cümle bulunamadı.");
        window.showView('sectionMenu');
        return;
    }
    
    window.state.mode = 'parallel';
    window.state.parallelPlaying = true;
    window.state.parallelIndex = 0;
    
    // UI'ı hazırla ve çalmayı başlat
    window.renderParallelPlayerUI();
};



/* ==========================================================================
   TEKRAR MODU ENTEGRASYONU & AKILLI ÇIKIŞ
   - Tekrar modundaki paralel dinlemeyi yeni tasarıma yönlendirir.
   - Çıkış butonunun nereye döneceğini (Ders mi Tekrar mı) otomatik anlar.
   ========================================================================== */

/* 1. TEKRAR MODU YÖNLENDİRİCİSİ (startQuizMode) */
// Tekrar menüsünden bir şeye tıklandığında burası çalışır.
// Biz burada 'parallel' seçildiyse, hemen yeni oyuncuya yönlendiriyoruz.
window.startQuizMode = function(mode) {
    window.state.mode = mode;

    // Güvenlik: Deste boşsa uyarı ver
    if (!window.state.deck || window.state.deck.length === 0) {
        alert("Çalışılacak kart bulunamadı.");
        return;
    }

    // --- KRİTİK DEĞİŞİKLİK BURADA ---
    // Eğer mod 'parallel' ise, eski 'playParallelLoop' yerine
    // yeni, güzel tasarımlı 'startParallelPlayer' fonksiyonunu çağır.
    if (mode === 'parallel') {
        window.startParallelPlayer(); 
        return;
    }
    // --------------------------------

    // Diğer modlar (Quiz, Boşluk Doldurma vb.) standart devam eder...
    window.showView('learningView');
    const learningContent = document.getElementById('learningContent'); if (learningContent) learningContent.classList.remove('hidden');
    const wordOrderArea = document.getElementById('wordOrderArea'); if (wordOrderArea) wordOrderArea.classList.add('hidden');
    const actionBtn = document.getElementById('actionBtn'); if (actionBtn) { actionBtn.classList.remove('hidden'); actionBtn.style.display = 'block'; }
    
    // UI Temizliği
    ['quizResultArea','clozeResultArea'].forEach(id => { const e = document.getElementById(id); if (e) e.classList.add('hidden'); });
    const editBtn = document.getElementById('btnEditCard'); if (editBtn) editBtn.style.display = 'none';

    if (typeof window.state.deckPos !== 'number') window.state.deckPos = 0;

    // Diğer modları başlat
    if (mode === 'wordorder') {
        document.getElementById('learningContent').classList.add('hidden');
        const woArea = document.getElementById('wordOrderArea'); if (woArea) woArea.classList.remove('hidden');
        document.getElementById('actionBtn').style.display = 'none';
        window.renderWordOrderCard();
    } else if (mode === 'quiz') {
        window.renderQuizCard();
    } else if (mode === 'cloze') {
        window.renderClozeCard();
    } else {
        window.renderSentence();
    }
};

/* ==========================================================================
   PROFESYONEL PARALEL OYNATICI (V3.0)
   - State-Based Logic: Zamanlayıcı hatalarını engeller.
   - Solid UI: Butonlar asla titremez veya boyut değiştirmez.
   - Smart Resume: Duraklatıp devam edince cümleyi baştan alır (En temiz yöntem).
   ========================================================================== */

// --- 1. ARAYÜZ (KAYA GİBİ SABİT UI) ---

// --- 2. ÇEKİRDEK MANTIK (ASIL İŞİ YAPAN KISIM) ---
window.processCurrentCard = function() {
    // 1. Güvenlik Kontrolleri
    clearTimeout(window.state.parallelTimer);
    window.speechSynthesis.cancel();

    if (!window.state.parallelPlaying) return; // Duraklatılmışsa işlem yapma

    const deck = window.state.deck;
    const index = window.state.parallelIndex;

    // Bitiş Kontrolü
    if (index >= deck.length) {
        window.stopParallelPlayer(true); 
        return;
    }

    const card = deck[index];
    const display = document.getElementById('parallelTextDisplay');
    const status = document.getElementById('parallelStatus');

    // Ayarlar
    const delayMs = window.data.settings.parallelDelay || 3000;
    const isTrDe = window.data.settings.conversionMode === 'tr-de';
    const L1_Code = isTrDe ? 'tr' : 'de';
    const L2_Code = isTrDe ? 'de' : 'tr';
    const L1_Text = card[L1_Code];
    const L2_Text = card[L2_Code];

    // --- ADIM ZİNCİRİ (CHAIN) ---
    
    // ADIM 1: L1 Göster ve Oku
    status.innerText = (L1_Code === 'tr' ? "🇹🇷 TÜRKÇE" : "🇩🇪 ALMANCA");
    status.style.color = "var(--primary)";
    display.innerHTML = L1_Text;

    window.speakText(L1_Text, L1_Code, () => {
        // L1 Okuması Bitti -> Beklemeye Geç
        if(!window.state.parallelPlaying) return;

        // ADIM 2: Kullanıcı Gecikmesi (Bekle)
        // Bekleme sırasında bir statü göstermiyoruz, sadece bekliyoruz.
        window.state.parallelTimer = setTimeout(() => {
            if(!window.state.parallelPlaying) return;

            // ADIM 3: L2 Göster ve Oku
            status.innerText = (L2_Code === 'tr' ? "🇹🇷 TÜRKÇE" : "🇩🇪 ALMANCA");
            status.style.color = "var(--success)"; // Renk değişsin
            display.innerHTML = L2_Text;

            window.speakText(L2_Text, L2_Code, () => {
                if(!window.state.parallelPlaying) return;

                // ADIM 4: Kısa Bekleme + Bip
                window.state.parallelTimer = setTimeout(() => {
                    if(!window.state.parallelPlaying) return;
                    
                    status.innerText = "sıradaki...";
                    status.style.color = "var(--text-muted)";
                    window.playSoftBeep();

                    // ADIM 5: Bir Sonraki Karta Geç
                    window.state.parallelTimer = setTimeout(() => {
                         window.state.parallelIndex++;
                         window.processCurrentCard(); // Kendini tekrar çağır (Loop)
                    }, 1000); // Bip sonrası 1sn bekle

                }, 1000); // L2 sonrası 1sn bekle
            });

        }, delayMs); // Kullanıcı Gecikmesi
    });
};


window.skipParallelSentence = function() {
    // İleri basınca, oynasa da oynamasa da sıradakine geç ve OYNATMAYA BAŞLA
    window.state.parallelIndex++;
    window.state.parallelPlaying = true; 
    const btn = document.getElementById('parallelPlayPause');
    if(btn) btn.innerHTML = '⏸';
    window.processCurrentCard();
};

window.previousParallelSentence = function() {
    if(window.state.parallelIndex > 0) window.state.parallelIndex--;
    else window.state.parallelIndex = 0;
    
    window.state.parallelPlaying = true;
    const btn = document.getElementById('parallelPlayPause');
    if(btn) btn.innerHTML = '⏸';
    window.processCurrentCard();
};

window.startParallelPlayer = function() {
    if (!window.state.deck || window.state.deck.length === 0) {
        alert("Destede cümle yok."); return;
    }
    window.state.mode = 'parallel';
    window.state.parallelPlaying = true;
    window.state.parallelIndex = 0;
    window.renderParallelPlayerUI();
};

window.stopParallelPlayer = function(finished = false) {
    window.state.parallelPlaying = false;
    clearTimeout(window.state.parallelTimer);
    window.speechSynthesis.cancel();

    if (finished) {
        if (window.state.tekrarStatus) {
            alert("Tekrar listesi bitti!");
            window.renderTekrarModeMenu();
        } else {
            window.state.parallelIndex = 0;
            window.findNextLearningUnit();
        }
    } else {
        if (window.state.tekrarStatus) window.renderTekrarModeMenu();
        else window.showView('sectionMenu');
    }
};


/* ==========================================================================
   PARALEL OYNATICI V4.0 (FIXED LAYOUT)
   - Buton boyutları piksel piksel sabitlendi (!important).
   - Metin alanı esnek yapıldı, taşarsa kaydırma çubuğu çıkar ama butonları itmez.
   ========================================================================== */

window.renderParallelPlayerUI = function() {
    window.showView('learningView');
    
    // Eski elemanları temizle
    const content = document.getElementById('learningContent');
    const controlsAccordion = document.getElementById('learningControlsAccordion');
    if (document.getElementById('actionBtn')) document.getElementById('actionBtn').style.display = 'none';
    if (document.getElementById('srsControls')) document.getElementById('srsControls').style.display = 'none';
    if (controlsAccordion) controlsAccordion.classList.add('hidden'); 

    // YENİ HTML YAPISI (Dikey Flex: Üst Esnek, Alt Sabit)
    content.innerHTML = `
        <div style="display:flex; flex-direction:column; height: calc(100vh - 140px); max-height: 600px; max-width:400px; margin:0 auto;">
            
            <div style="flex-grow: 1; display:flex; flex-direction:column; justify-content:center; align-items:center; overflow:hidden; padding:10px;">
                
                <h3 style="color:var(--primary-dark); font-size:1rem; margin-bottom:10px; opacity:0.8; flex-shrink:0;">🎧 Paralel Dinleme</h3>
                
                <div class="content-box" style="
                    width: 100%;
                    height: 100%; 
                    max-height: 250px; /* Metin kutusu maksimum bu kadar büyür */
                    display:flex; 
                    flex-direction:column; 
                    justify-content:center; 
                    align-items:center; 
                    padding:20px;
                    border: 2px solid var(--border);
                    box-shadow: var(--shadow-sm);
                    overflow-y: auto; /* Metin uzunsa kaydır */
                ">
                    <div id="parallelStatus" style="font-size:0.8rem; text-transform:uppercase; letter-spacing:1px; color:var(--primary); font-weight:bold; margin-bottom:15px;">
                        HAZIRLANIYOR...
                    </div>
                    <div id="parallelTextDisplay" style="
                        font-size: 1.4rem; 
                        line-height: 1.5; 
                        font-weight: 600; 
                        color: var(--text-main);
                        word-break: break-word;
                        text-align: center;
                    ">
                        Sistem Başlatılıyor...
                    </div>
                </div>
            </div>

            <div style="height: 200px; flex-shrink: 0; padding:10px; display:flex; flex-direction:column; justify-content:flex-end;">
                
                <div id="parallelDelayControls" style="margin-bottom:15px;"></div>

                <div style="display:flex; justify-content:center; align-items:center; gap:20px; margin-bottom:20px;">
                    
                    <button class="btn btn-secondary" onclick="window.previousParallelSentence()" 
                        style="width:60px !important; min-width:60px !important; height:50px !important; font-size:1.8rem; padding:0; display:flex; align-items:center; justify-content:center; border-radius:12px;">
                        «
                    </button>
                    
                    <button id="parallelPlayPause" class="btn btn-primary" onclick="window.toggleParallelPlay()" 
                        style="width:70px !important; min-width:70px !important; height:70px !important; font-size:2.2rem; padding:0; display:flex; align-items:center; justify-content:center; border-radius:50%; box-shadow: 0 4px 15px rgba(59,130,246,0.4);">
                        ⏸
                    </button>
                    
                    <button class="btn btn-secondary" onclick="window.skipParallelSentence()" 
                        style="width:60px !important; min-width:60px !important; height:50px !important; font-size:1.8rem; padding:0; display:flex; align-items:center; justify-content:center; border-radius:12px;">
                        »
                    </button>
                </div>

                <div style="display:flex; justify-content:space-between;">
                    <button class="btn btn-sm btn-secondary" onclick="window.toggleSlowMode()" style="width:48%;">
                        <span id="slowModeLed" class="led-indicator"></span> 🐢 Yavaş
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="window.stopParallelPlayer()" style="width:48%;">
                        🔴 Çıkış
                    </button>
                </div>
            </div>
        </div>
    `;

    window.injectDelayControls('parallelDelayControls');
    
    // Oynatıcıyı Başlat
    window.state.parallelPlaying = true;
    window.processCurrentCard(); 
};

// --- BUTON İKONUNU DEĞİŞTİREN FONKSİYON (GÜNCELLEME) ---
window.toggleParallelPlay = function() {
    const btn = document.getElementById('parallelPlayPause');
    const status = document.getElementById('parallelStatus');
    
    window.state.parallelPlaying = !window.state.parallelPlaying;

    if (window.state.parallelPlaying) {
        if(btn) btn.innerHTML = '⏸'; // Duraklat ikonu
        window.processCurrentCard(); 
    } else {
        clearTimeout(window.state.parallelTimer);
        window.speechSynthesis.cancel();
        if(btn) btn.innerHTML = '▶'; // Oynat ikonu
        if(status) {
             status.innerText = "DURAKLATILDI";
             status.style.color = "var(--danger)";
        }
    }
};
/* ==========================================================================
   HİKAYE MODU (READER V2.0 - TOGGLE PLAY/STOP)
   ========================================================================== */

/* 1. GRUP LİSTESİNDE HİKAYE BUTONU */
window.renderGroups = function() {
    const list = document.getElementById('groupList'); 
    if(!list) return; 
    list.innerHTML = '';
    
    // Veri kontrolü
    const groups = window.data.groups || [];
    
    // Grupları (örneğin g18, g19...) bulmamız lazım. 
    // JSON yapın: [ {id:'g18', story:{...}}, ... ] şeklinde olduğu için direkt döngüye sokuyoruz.
    // NOT: Senin ana verin 'verbs' değil, direkt groups array'i içinde story objesi barındırıyor.
    
    groups.forEach(g => {
        // Kapsayıcı Div
        const wrapper = document.createElement('div');
        wrapper.className = 'button-grid'; 
        wrapper.style.gridTemplateColumns = '1fr auto';
        wrapper.style.gap = '10px';
        wrapper.style.marginBottom = '10px';

        // Grup Adı Butonu
        const btn = document.createElement('button'); 
        btn.className = 'btn btn-secondary'; 
        btn.style.textAlign = 'left';
        btn.innerHTML = `<span><b>${g.name}</b><br><small>${g.nameDE || ''}</small></span>`;
        
        // Eğer bu grubun fiilleri varsa fiil listesini aç, yoksa boş uyarısı ver
        btn.onclick = () => {
             if(window.data.verbs && window.data.verbs[g.id]) window.renderVerbs(g.id);
             else alert("Bu grup için fiil listesi hazırlanıyor...");
        };
        wrapper.appendChild(btn);

        // Hikaye Butonu (Varsa)
        if (g.story) {
            const storyBtn = document.createElement('button');
            storyBtn.className = 'btn btn-info';
            storyBtn.innerHTML = '📖 Oku';
            storyBtn.onclick = () => window.openStoryMode(g.id); // ID'yi gönderiyoruz (g18, g19)
            wrapper.appendChild(storyBtn);
        }
        
        list.appendChild(wrapper);
    });
};

/* 2. HİKAYE EKRANINI AÇMA */
window.openStoryMode = function(groupId) {
    // Grubu bul
    const group = window.data.groups.find(g => g.id === groupId);
    if (!group || !group.story) return;

    const story = group.story;
    window.state.currentStoryId = groupId;
    window.state.storyPlaying = false; // Oynatma durumu sıfırla

    // HTML Elemanlarını Doldur
    const titleEl = document.getElementById('storyTitle');
    const contentEl = document.getElementById('storyContent');
    
    if (titleEl) titleEl.innerText = story.title || "Hikaye";
    if (contentEl) contentEl.innerHTML = story.de ? story.de.replace(/\n/g, '<br>') : "İçerik yok.";

    // Butonların durumunu sıfırla
    resetStoryButtons();

    // Test Butonunu Güncelle
    const testBtn = document.getElementById('btnStartStoryTest');
    if(testBtn) {
        testBtn.onclick = () => window.startStoryTest(groupId);
        testBtn.style.display = 'block';
    }

    // Görünümü Değiştir
    window.showView('storyView');
};

/* 3. SES OYNATMA / DURDURMA (TOGGLE) */
window.toggleStoryAudio = function(lang) {
    const groupId = window.state.currentStoryId;
    const group = window.data.groups.find(g => g.id === groupId);
    if (!group || !group.story) return;

    // Butonları Bul
    const btnDE = document.getElementById('btnStoryDE');
    const btnTR = document.getElementById('btnStoryTR');

    // Durum Kontrolü: Şu an çalıyor mu?
    const isPlaying = window.state.storyPlaying;
    const currentLang = window.state.storyLang;

    // Hepsini durdur ve sıfırla
    window.speechSynthesis.cancel();
    window.state.storyPlaying = false;
    if(btnDE) btnDE.innerHTML = '🇩🇪 Oku';
    if(btnTR) btnTR.innerHTML = '🇹🇷 Oku';
    if(btnDE) btnDE.classList.remove('btn-danger'); // Kırmızıdan normale dön
    if(btnTR) btnTR.classList.remove('btn-danger');

    // Eğer aynı butona bastıysak ve çalıyorsa DURDURDUK (Yukarıda cancel yaptık zaten), çık.
    if (isPlaying && currentLang === lang) {
        return; 
    }

    // YENİ BAŞLATMA
    let textToRead = (lang === 'de') ? group.story.de : group.story.tr;
    if (!textToRead) return;

    // İlgili butonu "DUR" moduna al
    const targetBtn = (lang === 'de') ? btnDE : btnTR;
    if(targetBtn) {
        targetBtn.innerHTML = '⏹ Dur';
        targetBtn.classList.add('btn-danger'); // Kırmızı yap
    }

    window.state.storyPlaying = true;
    window.state.storyLang = lang;

    // Okuma Bittiğinde Butonu Düzelt
    window.speakText(textToRead, lang, () => {
        window.state.storyPlaying = false;
        if(targetBtn) {
            targetBtn.innerHTML = (lang === 'de') ? '🇩🇪 Oku' : '🇹🇷 Oku';
            targetBtn.classList.remove('btn-danger');
        }
    });
};

/* Yardımcı: Butonları Sıfırla */
function resetStoryButtons() {
    const btnDE = document.getElementById('btnStoryDE');
    const btnTR = document.getElementById('btnStoryTR');
    if(btnDE) { btnDE.innerHTML = '🇩🇪 Oku'; btnDE.classList.remove('btn-danger'); }
    if(btnTR) { btnTR.innerHTML = '🇹🇷 Oku'; btnTR.classList.remove('btn-danger'); }
}

/* 4. HİKAYE TESTİ */
window.startStoryTest = function(groupId) {
    const group = window.data.groups.find(g => g.id === groupId);
    if (!group || !group.story || !group.story.quiz) {
        alert("Bu hikaye için test bulunamadı.");
        return;
    }

    // Test Alanını Oluştur (Eğer yoksa)
    let container = document.getElementById('storyQuestionsContent');
    if (!container) {
        // Dinamik olarak view oluştur
        const viewDiv = document.createElement('section');
        viewDiv.id = 'storyQuestionsView';
        viewDiv.className = 'view';
        viewDiv.innerHTML = `
            <div class="content-box">
                <h3 style="text-align:center; margin-bottom:20px; color:var(--primary);">📝 Hikaye Testi</h3>
                <div id="storyQuestionsContent"></div>
                <button class="btn btn-secondary btn-block" style="margin-top:20px" onclick="window.showView('storyView')">Geri Dön</button>
            </div>
        `;
        document.querySelector('.site-container').appendChild(viewDiv);
        container = document.getElementById('storyQuestionsContent');
    }

    container.innerHTML = ''; // Temizle
    
    // Soruları Döngüyle Ekle
    group.story.quiz.forEach((q, index) => {
        const qBox = document.createElement('div');
        qBox.style.marginBottom = '20px';
        qBox.style.borderBottom = '1px dashed #ccc';
        qBox.style.paddingBottom = '15px';
        
        qBox.innerHTML = `<p style="font-weight:bold; margin-bottom:10px;">${index + 1}. ${q.q}</p>`;
        
        const optsDiv = document.createElement('div');
        optsDiv.className = 'button-grid';
        optsDiv.style.gridTemplateColumns = '1fr';

        q.options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'btn btn-secondary';
            btn.style.textAlign = 'left';
            btn.innerText = opt;
            btn.onclick = function() {
                // Şıkları kilitle
                const siblings = optsDiv.querySelectorAll('button');
                siblings.forEach(b => b.disabled = true);

                if (opt === q.a) {
                    this.className = 'btn btn-success';
                    this.innerText += ' ✅';
                } else {
                    this.className = 'btn btn-danger';
                    this.innerText += ' ❌';
                    // Doğruyu göster
                    siblings.forEach(b => { if(b.innerText === q.a) b.className = 'btn btn-success'; });
                }
            };
            optsDiv.appendChild(btn);
        });
        
        qBox.appendChild(optsDiv);
        container.appendChild(qBox);
    });

    window.showView('storyQuestionsView');
};
// --- İLERİ SARMA FONKSİYONU (GÜNCELLEME) ---
window.skipParallelSentence = function() {
    window.state.parallelIndex++;
    window.state.parallelPlaying = true; 
    
    // Buton ikonunu düzelt (Eğer duraklatılmışken basıldıysa play moduna geçsin)
    const btn = document.getElementById('parallelPlayPause');
    if(btn) btn.innerHTML = '⏸';
    
    window.processCurrentCard();
};

window.previousParallelSentence = function() {
    if (window.state.parallelIndex > 0) window.state.parallelIndex--;
    else window.state.parallelIndex = 0;
    window.speechSynthesis.cancel();
    window.nextParallelSentence(); 
};

window.stopParallelPlayer = function(finished = false) {
    window.state.parallelPlaying = false;
    clearTimeout(window.state.parallelTimer); 
    window.speechSynthesis.cancel(); 
    
    // UI'ı geri getir
    if (document.getElementById('learningControlsAccordion')) document.getElementById('learningControlsAccordion').classList.remove('hidden');

    if (finished) {
        window.state.parallelIndex = 0;
        window.findNextLearningUnit(); 
    } else {
        window.showView('sectionMenu'); 
    }
};

/* ==========================================================================
   GECİKME SİSTEMİ (DELAY SYSTEM)
   ========================================================================== */

// --- 1. Gecikme Ayarını Yap ve Kaydet ---
window.setParallelDelay = function(ms) {
    window.data.settings.parallelDelay = ms;
    localStorage.setItem('verbmatrix_settings', JSON.stringify(window.data.settings));
    window.updateDelayUI(); // UI'ı güncelle
};

// --- 2. Gecikme Butonlarını Görsel Olarak Güncelle ---
window.updateDelayUI = function() {
    const activeMs = window.data.settings.parallelDelay || 3000;
    
    document.querySelectorAll('[data-delay-ms]').forEach(btn => {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-secondary');
        
        // Aktif olanı pastel vurgu rengiyle işaretle
        if (parseInt(btn.dataset.delayMs) === activeMs) {
            btn.classList.remove('btn-secondary');
            btn.classList.add('btn-primary');
        }
    });
};


/* ==========================================================================
   HİKAYE MODU V3.0 (SPLIT SCREEN & SMART AUDIO)
   ========================================================================== */

/* 1. GRUP LİSTESİ (Hikaye Başlıklı Butonlar) */
window.renderGroups = function() {
    const list = document.getElementById('groupList'); 
    if(!list) return; 
    list.innerHTML = '';
    
    const groups = window.data.groups || [];
    
    groups.forEach(g => {
        const wrapper = document.createElement('div');
        wrapper.className = 'button-grid'; 
        // Sol taraf (Grup Adı) geniş, Sağ taraf (Hikaye) daha dar (3'te 1 oranına yakın)
        wrapper.style.gridTemplateColumns = '2fr 1fr';
        wrapper.style.gap = '10px';
        wrapper.style.marginBottom = '10px';

        // 1. Grup Butonu
        const btn = document.createElement('button'); 
        btn.className = 'btn btn-secondary'; 
        btn.style.textAlign = 'left';
        btn.innerHTML = `<span><b>${g.name}</b><br><small>${g.nameDE || ''}</small></span>`;
        btn.onclick = () => {
             if(window.data.verbs && window.data.verbs[g.id]) window.renderVerbs(g.id);
             else alert("Bu grup için fiil listesi hazırlanıyor...");
        };
        wrapper.appendChild(btn);

        // 2. Hikaye Butonu (Başlık ile)
        if (g.story) {
            const storyBtn = document.createElement('button');
            storyBtn.className = 'btn btn-info';
            storyBtn.style.fontSize = '0.85rem';
            storyBtn.style.padding = '5px';
            storyBtn.style.display = 'flex';
            storyBtn.style.flexDirection = 'column';
            storyBtn.style.alignItems = 'center';
            storyBtn.style.justifyContent = 'center';
            
            // Başlığı al, çok uzunsa kısalt
            let shortTitle = g.story.title || "Hikaye";
            if(shortTitle.length > 15) shortTitle = shortTitle.substring(0, 12) + "...";

            storyBtn.innerHTML = `<span style="font-size:1.2rem;">📖</span><span>${shortTitle}</span>`;
            storyBtn.title = g.story.title; // Üzerine gelince tam başlık
            storyBtn.onclick = () => window.openStoryMode(g.id);
            wrapper.appendChild(storyBtn);
        } else {
            // Hikaye yoksa boş div koy ki hizalama bozulmasın
            const emptyDiv = document.createElement('div');
            wrapper.appendChild(emptyDiv);
        }
        
        list.appendChild(wrapper);
    });
};

/* 2. HİKAYE EKRANINI AÇMA (Çift Dilli) */
window.openStoryMode = function(groupId) {
    const group = window.data.groups.find(g => g.id === groupId);
    if (!group || !group.story) return;

    const story = group.story;
    window.state.currentStoryId = groupId;
    
    // Ses durumunu sıfırla
    window.speechSynthesis.cancel();
    window.state.storyPlaying = false; 
    window.state.storyPaused = false;

    // HTML Elemanlarını Doldur
    const titleEl = document.getElementById('storyTitle');
    const deContent = document.getElementById('storyContentDE');
    const trContent = document.getElementById('storyContentTR');
    
    if (titleEl) titleEl.innerText = story.title || "Hikaye";
    
    // Almanca Metin
    if (deContent) deContent.innerHTML = story.de ? story.de.replace(/\n/g, '<br>') : "İçerik yok.";
    
    // Türkçe Metin (Varsa)
    if (trContent) trContent.innerHTML = story.tr ? story.tr.replace(/\n/g, '<br>') : "Çeviri yok.";

    // Butonları Sıfırla
    resetStoryButtons();

    // Test Butonunu Ayarla
    const testBtn = document.getElementById('btnStartStoryTest');
    if(testBtn) {
        testBtn.onclick = () => window.startStoryTest(groupId);
    }

    window.showView('storyView');
};

/* 3. AKILLI SES YÖNETİMİ (PAUSE / RESUME) */
window.toggleStoryAudio = function(lang) {
    const groupId = window.state.currentStoryId;
    const group = window.data.groups.find(g => g.id === groupId);
    if (!group || !group.story) return;

    const btn = document.getElementById(lang === 'de' ? 'btnStoryDE' : 'btnStoryTR');
    const otherBtn = document.getElementById(lang === 'de' ? 'btnStoryTR' : 'btnStoryDE');

    // Senaryo 1: Diğer dil çalıyorsa onu sustur ve bunu baştan başlat
    if (window.state.storyLang && window.state.storyLang !== lang && (window.state.storyPlaying || window.state.storyPaused)) {
        window.speechSynthesis.cancel();
        window.state.storyPlaying = false;
        window.state.storyPaused = false;
        resetStoryButtons();
    }

    // Senaryo 2: Çalıyor -> Duraklat (Pause)
    if (window.state.storyPlaying && !window.state.storyPaused) {
        window.speechSynthesis.pause();
        window.state.storyPaused = true;
        if(btn) {
            btn.innerHTML = '▶ Devam';
            btn.classList.remove('btn-danger');
            btn.classList.add('btn-warning'); // Sarı renk (Beklemede)
        }
        return;
    }

    // Senaryo 3: Duraklatıldı -> Devam Et (Resume)
    if (window.state.storyPlaying && window.state.storyPaused) {
        window.speechSynthesis.resume();
        window.state.storyPaused = false;
        if(btn) {
            btn.innerHTML = '⏸ Duraklat';
            btn.classList.remove('btn-warning');
            btn.classList.add('btn-danger');
        }
        return;
    }

    // Senaryo 4: Hiç çalmıyor -> Baştan Başlat (Start)
    const textToRead = (lang === 'de') ? group.story.de : group.story.tr;
    if (!textToRead) return;

    // Diğer butonu pasif yap
    if(otherBtn) otherBtn.disabled = true;

    window.state.storyLang = lang;
    window.state.storyPlaying = true;
    window.state.storyPaused = false;

    if(btn) {
        btn.innerHTML = '⏸ Duraklat';
        btn.classList.add('btn-danger');
    }

    // Utterance oluştur (onend event'i için önemli)
    const u = new SpeechSynthesisUtterance(textToRead);
    u.lang = (lang === 'de') ? 'de-DE' : 'tr-TR';
    u.rate = window.state.slowMode ? 0.7 : 0.9;
    
    u.onend = function() {
        window.state.storyPlaying = false;
        window.state.storyPaused = false;
        resetStoryButtons();
    };
    
    u.onerror = function() {
        window.state.storyPlaying = false;
        resetStoryButtons();
    };

    window.speechSynthesis.speak(u);
};

/* Yardımcı: Butonları İlk Haline Döndür */
function resetStoryButtons() {
    const btnDE = document.getElementById('btnStoryDE');
    const btnTR = document.getElementById('btnStoryTR');
    
    if(btnDE) { 
        btnDE.innerHTML = '🇩🇪 Dinle'; 
        btnDE.classList.remove('btn-danger', 'btn-warning'); 
        btnDE.classList.add('btn-primary');
        btnDE.disabled = false;
    }
    if(btnTR) { 
        btnTR.innerHTML = '🇹🇷 Dinle'; 
        btnTR.classList.remove('btn-danger', 'btn-warning'); 
        btnTR.classList.add('btn-info');
        btnTR.disabled = false;
    }
}


// --- YENİ YARDIMCI FONKSİYON: SOFT BİP SESİ (4) ---
window.playSoftBeep = function() {
    if (typeof AudioContext === 'undefined') return; // Tarayıcı desteği yoksa çık

    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    
    // Ayarlar (Düşük ses, yumuşak frekans)
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(440, context.currentTime); 
    gain.gain.setValueAtTime(4.10, context.currentTime); // Kısık ses (0.08)
    
    // Hızlı sönümleme
    oscillator.start();
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.3); 
    oscillator.stop(context.currentTime + 0.3);
};




/* ==========================================================================
   GELİŞMİŞ İPUCU VE KILAVUZ SİSTEMİ
   - Fiil İpuçlarını (verbs)
   - Konu Özetlerini (sections) HTML tablolarıyla beraber gösterir.
   ========================================================================== */

/* 1. İPUCU PENCERESİNİ AÇMA FONKSİYONU */
window.openContextHint = function(type) {
    // Veri Kontrolü
    if (!window.data.hints) {
        alert("İpucu verisi (hints) yüklenmemiş.");
        return;
    }

    // Şu anki durumu analiz et
    const cardKey = window.state.currentCardKey; // örn: v1_s1_0
    if (!cardKey) {
        alert("Aktif bir kart yok.");
        return;
    }

    const parts = cardKey.split('_');
    const vId = parts[0]; // v1
    const tPart = parts[1]; // s1 (veya B6, B7 gibi topic ID'si)
    const tId = tPart.replace('s', ''); // 1

    let title = "";
    let content = "";

    // A. FİİL İPUCU İSTEĞİ
    if (type === 'verb') {
        title = "Fiil İpucu & Özellikleri";
        // hints.verbs.v1 var mı?
        if (window.data.hints.verbs && window.data.hints.verbs[vId]) {
            content = window.data.hints.verbs[vId];
        } else {
            content = "Bu fiil için özel bir ipucu bulunamadı.";
        }
    }

    // B. KONU/BÖLÜM İPUCU İSTEĞİ
    else if (type === 'topic') {
        title = "Konu Özeti & Gramer";
        
        // JSON'daki 'sections' altında tId (örn: 1, 2) veya özel ID (B6, B7) var mı?
        // NOT: Senin verinde B6, B7 gibi ID'ler var. Eğer sistemdeki tId '6' ise ve json'da 'B6' ise eşleşmeyebilir.
        // Bu yüzden hem tId'yi hem de mapping'i kontrol ediyoruz.
        
        const hintsSec = window.data.hints.sections || {};
        
        if (hintsSec[tId]) {
            content = hintsSec[tId];
        } else if (hintsSec["B" + tId]) { // Eğer JSON'da B1, B2 diye kayıtlıysa
            content = hintsSec["B" + tId];
        } else {
            content = "Bu konu için gramer notu bulunamadı.";
        }
    }

    // PENCEREYİ GÖSTER
    window.showHintModal(title, content);
};

/* 2. MODAL GÖSTERME (TABLOLARI DESTEKLER) */
window.showHintModal = function(title, content) {
    // Varsa eskisini sil
    let modal = document.getElementById('hintModal');
    if (modal) modal.remove();

    // Yeni Modal Oluştur
    modal = document.createElement('div');
    modal.id = 'hintModal';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.85); z-index: 12000;
        display: flex; align-items: center; justify-content: center;
        animation: fadeIn 0.2s;
    `;

    // İçerik HTML'i (Satır atlamalarını <br> yapar ve Tabloları düzeltir)
    // Senin JSON'da zaten HTML tablolar var, o yüzden direkt basıyoruz.
    // Düz metinleri de HTML'e çevirelim (\n -> <br>)
    let formattedContent = content;
    if (!content.includes('<table') && !content.includes('<div')) {
         formattedContent = content.replace(/\n/g, '<br>');
    }

    modal.innerHTML = `
        <div class="content-box" style="
            width: 90%; max-width: 600px; max-height: 80vh;
            background: #fff; color: #333;
            border-radius: 12px; padding: 0; overflow: hidden;
            display: flex; flex-direction: column;
        ">
            <div style="background: var(--primary); color: #fff; padding: 15px; display:flex; justify-content:space-between; align-items:center;">
                <h3 style="margin:0; font-size:1.1rem;">💡 ${title}</h3>
                <button onclick="document.getElementById('hintModal').remove()" style="background:none; border:none; color:#fff; font-size:1.5rem; cursor:pointer;">&times;</button>
            </div>

            <div style="padding: 20px; overflow-y: auto; line-height: 1.6; font-size: 0.95rem;">
                ${formattedContent}
            </div>

            <div style="padding: 10px; border-top: 1px solid #eee; text-align: center; background: #f9f9f9;">
                <button class="btn btn-secondary btn-block" onclick="document.getElementById('hintModal').remove()">Kapat</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
};

// --- YENİ KRİTİK FONKSİYON: OTOMATİK İLERLEME MANTIĞI (2) ---
window.findNextLearningUnit = function() {
    // Mevcut pozisyonları al
    const currentGId = window.state.currentGroupId;
    const currentVId = window.state.currentVerbId;
    
    // Hata koruması: ID'ler yoksa ana menüye dön
    if (!currentGId || !currentVId) {
        window.showView('mainMenu');
        return;
    }
    
    // 1. Aynı fiilin bir sonraki konusunu bul
    const currentSections = window.data.topics[window.data.settings.currentClass] || {};
    const currentSectionKeys = Object.keys(currentSections).map(Number).sort((a,b)=>a-b);
    const currentTId = window.state.tempDeck[0]?.id.split('_s')[1]?.split('_')[0]; // Örn: '1'

    if (currentTId) {
        const currentIndex = currentSectionKeys.indexOf(parseInt(currentTId));
        const nextTId = currentSectionKeys[currentIndex + 1];

        if (nextTId) {
            // Sonraki Konuya Geç (Dersi başlat)
            window.state.currentCardKey = `${currentVId}_s${nextTId}`; // Yeni kart anahtarını set et
            alert(`✅ Otomatik İlerleme: Sonraki Konuya Geçiliyor (Konu ${nextTId})`);
            window.renderSections(currentVId); // Konu listesini yenile
            return;
        }
    }

    // 2. Fiildeki tüm konular bitti: Sonraki Fiile Geç
    const verbsInGroup = window.data.verbs[currentGId] || [];
    const currentVIndex = verbsInGroup.findIndex(v => v.id === currentVId);
    const nextVerb = verbsInGroup[currentVIndex + 1];
    
    if (nextVerb) {
        alert(`✅ Otomatik İlerleme: Sonraki Fiile Geçiliyor (${nextVerb.verbTR})`);
        window.renderVerbs(currentGId); // Fiil listesini yenile
        return;
    }

    // 3. Gruptaki tüm fiiller bitti: Ana Menüye Dön
    alert("🎉 Tebrikler! Bu bölümdeki tüm fiiller tamamlandı.");
    window.showView('mainMenu');
};


setTimeout(window.updateLanguageToggleUI, 100);
/* ========================================================================== */
/* End of reorganized script */
/* ========================================================================== */

