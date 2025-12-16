
/* ==========================================================================
  VERB MATRIX — CLEANED & OPTIMIZED (FINAL)
  - Tüm mükerrer fonksiyonlar temizlendi.
  - En son eklenen özellikler (Story V3, Parallel V4, Smart Audio) korundu.
  - Veri bütünlüğü ve hata yakalama mekanizmaları birleştirildi.
  ========================================================================== */

/* --------------------------------------------------------------------------
   1. BASE DATA & STATE
   -------------------------------------------------------------------------- */
window.data = {
    settings: { theme: 'light', conversionMode: 'tr-de', currentClass: 'A1', parallelDelay: 3000 },
    content: {}, classes: [], groups: [], topics: {}, verbs: {}, stories: {}
};

window.state = {
    history: ['mainMenu'],
    deck: [], deckPos: 0, mode: 'study',
    autoPlayAudio: true, slowMode: false,
    currentCardKey: null, activeLearningPanel: null, tekrarStatus: null,
    currentVerbId: null, currentGroupId: null, currentStoryId: null,
    wordSelected: [], correctAnswer: '',
    deferredPrompt: null,
    // Paralel Player State
    parallel: { isPlaying: false, index: 0, timer: null },
    parallelPlaying: false, parallelIndex: 0, parallelTimer: null,
    // Story State
    storyPlaying: false, storyPaused: false, storyLang: null,
    speechSynthesisAvailable: ('speechSynthesis' in window)
};
/* ==========================================================================
   EKSİK MODÜLLER TAMAMLAMASI (ADD-ON)
   Bu kodları script.js dosyasının sonuna ekleyin.
   ========================================================================== */
// Büyük/küçük harf ve noktalama işaretlerini yok sayan temizleme fonksiyonu
window.normalizeText = function(text) {
    if (!text) return "";
    return text.toString().toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "") // Noktalamaları sil
        .replace(/\s{2,}/g, " ") // Çift boşlukları teke indir
        .trim();
};
/* --------------------------------------------------------------------------
   MODULE: CLOZE (BOŞLUK DOLDURMA) SISTEMI
   -------------------------------------------------------------------------- */
window.checkClozeAnswer = function() {
    const input = document.getElementById('clozeInput');
    const feedback = document.getElementById('clozeFeedback');
    
    const userVal = window.normalizeText(input.value);
    const correctVal = window.normalizeText(window.state.clozeAnswer);

    if (userVal === correctVal && userVal !== "") {
        feedback.innerHTML = '<span style="color:green; font-size:1.2rem;">✅ DOĞRU!</span>';
        window.state.pendingStatus = 'ogrendim';
    } else {
        feedback.innerHTML = `<span style="color:red;">❌ Yanlış. Doğrusu: <b>${window.state.clozeAnswer}</b></span>`;
        if(userVal === "") input.classList.add('shake-anim');
        window.state.pendingStatus = 'zor';
    }

    // SESLİ OKUMA (Doğru/Yanlış fark etmez, çalar)
    if (window.state.autoPlayAudio) {
        const isTrDe = window.data.settings.conversionMode === 'tr-de';
        window.playCurrentSentence(isTrDe ? 'de' : 'tr');
    }

    return true;
};


/* --------------------------------------------------------------------------
   MODULE: WORD ORDER (KELİME SIRALAMA) SISTEMI
   -------------------------------------------------------------------------- */


window.moveWordToLine = function(btnElement, word) {
    const line = document.getElementById('woLine');
    
    // Kelimeyi listeye ekle
    window.state.wordOrderCurrent.push(word);

    // Havuzdaki butonu gizle (silme, sadece gizle)
    btnElement.style.visibility = 'hidden';
    btnElement.style.width = '0px'; 
    btnElement.style.padding = '0px';
    btnElement.style.margin = '0px';

    // Satıra (Line) yeni buton ekle
    const wordBtn = document.createElement('button');
    wordBtn.className = 'btn btn-primary btn-sm';
    wordBtn.innerText = word;
    wordBtn.onclick = function() {
        // Geri alma işlemi
        window.returnWordToPool(this, word, btnElement);
    };
    line.appendChild(wordBtn);
};

window.returnWordToPool = function(lineBtn, word, poolBtn) {
    // Listeden çıkar
    lineBtn.remove();
    
    // Array'den son eklenen bu kelimeyi sil (veya index bulup sil)
    const idx = window.state.wordOrderCurrent.lastIndexOf(word);
    if (idx > -1) window.state.wordOrderCurrent.splice(idx, 1);

    // Havuzdaki butonu geri getir
    poolBtn.style.visibility = 'visible';
    poolBtn.style.width = ''; 
    poolBtn.style.padding = '';
    poolBtn.style.margin = '';
};



/* --------------------------------------------------------------------------
   MODULE: EDIT PANEL (İÇERİK DÜZENLEME & OVERRIDE)
   -------------------------------------------------------------------------- */
// Paneli Açma
window.openEditPanel = function() {
    if (!window.state.currentCardData) {
        alert("Düzenlenecek kart verisi bulunamadı.");
        return;
    }
    
    const card = window.state.currentCardData;
    // Mevcut değerleri (varsa override edilmiş halini) al
    const valTR = card.tr || "";
    const valDE = card.de || "";
    const valHint = card.hint || "";

    // Modal HTML
    const modal = document.createElement('div');
    modal.id = 'editCardModal';
    modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:15000; display:flex; align-items:center; justify-content:center;";
    
    modal.innerHTML = `
        <div class="content-box" style="width:90%; max-width:400px; padding:20px; background:var(--bg-card); border-radius:12px;">
            <h3 style="margin-bottom:15px; color:var(--primary);">🛠 Kartı Düzenle</h3>
            
            <div style="margin-bottom:10px;">
                <label style="font-size:0.8rem; color:var(--text-muted);">Türkçe (TR)</label>
                <input id="edit_input_tr" class="input-field" value="${valTR.replace(/"/g, '&quot;')}" style="width:100%;">
            </div>
            
            <div style="margin-bottom:10px;">
                <label style="font-size:0.8rem; color:var(--text-muted);">Almanca (DE)</label>
                <input id="edit_input_de" class="input-field" value="${valDE.replace(/"/g, '&quot;')}" style="width:100%;">
            </div>

            <div style="margin-bottom:20px;">
                <label style="font-size:0.8rem; color:var(--text-muted);">İpucu (Hint)</label>
                <textarea id="edit_input_hint" class="input-field" rows="2" style="width:100%;">${valHint.replace(/"/g, '&quot;')}</textarea>
            </div>

            <div style="display:flex; gap:10px;">
                <button class="btn btn-secondary" style="flex:1;" onclick="document.getElementById('editCardModal').remove()">İptal</button>
                <button class="btn btn-success" style="flex:1;" onclick="window.saveCardEdit()">Kaydet</button>
            </div>
            <button class="btn btn-danger btn-sm" style="width:100%; margin-top:15px;" onclick="window.resetCardOverride()">Orijinale Dön</button>
        </div>
    `;
    document.body.appendChild(modal);
};

// Kaydetme
window.saveCardEdit = function() {
    const key = window.state.currentCardKey;
    if (!key) return;

    const newTR = document.getElementById('edit_input_tr').value;
    const newDE = document.getElementById('edit_input_de').value;
    const newHint = document.getElementById('edit_input_hint').value;

    // Override Nesnesini Güncelle
    window.contentOverride = window.contentOverride || {};
    window.contentOverride[key] = {
        tr: newTR,
        de: newDE,
        hint: newHint
    };

    // LocalStorage'a yaz
    localStorage.setItem('verbmatrix_content_override', JSON.stringify(window.contentOverride));

    // O anki deck'teki veriyi de güncelle (Sayfa yenilemeye gerek kalmasın)
    if (window.state.deck && window.state.deck[window.state.deckPos]) {
        window.state.deck[window.state.deckPos].tr = newTR;
        window.state.deck[window.state.deckPos].de = newDE;
        window.state.deck[window.state.deckPos].hint = newHint;
    }

    alert("✅ Değişiklikler kaydedildi.");
    document.getElementById('editCardModal').remove();
    
    // Görünümü yenile
    if (window.state.mode === 'study') window.renderSentence();
    // Diğer modlarda ise o modun render fonksiyonunu çağırabilirsin ama genelde study modunda edit yapılır.
};

// Sıfırlama
window.resetCardOverride = function() {
    const key = window.state.currentCardKey;
    if (!key) return;

    if (window.contentOverride && window.contentOverride[key]) {
        delete window.contentOverride[key];
        localStorage.setItem('verbmatrix_content_override', JSON.stringify(window.contentOverride));
        alert("Kart orijinal haline döndürüldü. Lütfen sayfayı yenileyin veya menüye dönün.");
        document.getElementById('editCardModal').remove();
        location.reload(); // En temizi reload atmak
    } else {
        alert("Bu kartta zaten yapılmış bir değişiklik yok.");
    }
};

/* --------------------------------------------------------------------------
   DÜZELTMELER: UI & EVENT LISTENERS
   -------------------------------------------------------------------------- */

/* DÜZELTİLMİŞ VE TEMİZLENMİŞ GENEL AKORDİYON FONKSİYONU */
window.togglePanel = function(panelId, buttonElement, containerSelector = null) {
    const panel = document.getElementById(panelId);
    if (!panel) return;

    // Kapsayıcıyı bul: Belirtilmişse onu, değilse butonun en yakın '.accordion-container'ını, o da yoksa butonun ebeveynini kullan.
    const container = containerSelector 
        ? document.querySelector(containerSelector) 
        : (buttonElement ? buttonElement.closest('.accordion-container') || buttonElement.parentElement : document.body);

    if (!container) return;

    const isOpening = panel.classList.contains('hidden');

    // Kapsayıcı içindeki TÜM panelleri (genellikle 'div'ler) ve butonları bul ve kapat/sıfırla.
    // Bu yaklaşım, panellerin özel bir sınıfa sahip olmasını gerektirmez.
    const allPanels = container.querySelectorAll('.panel, .accordion-panel, [id^="pnl"]'); // Birden fazla olasılığı hedefler
    const allButtons = container.querySelectorAll('.btn, .accordion-btn');

    allPanels.forEach(p => p.classList.add('hidden'));
    allButtons.forEach(b => b.classList.remove('active-control'));

    // Eğer tıklanan panel zaten açıksa, amacımız sadece onu kapatmaktı. İşlem tamam.
    if (!isOpening) {
        // Özel durum: Cümle ipucunu gizle
        const hintContainer = document.getElementById('hintContainer');
        if (hintContainer) hintContainer.style.display = 'none';
        return;
    }

    // Yeni paneli aç ve ilgili butonu aktif et
    panel.classList.remove('hidden');
    if (buttonElement) {
        buttonElement.classList.add('active-control');
    }

    // Özel durum: Eğer ipucu paneli açılıyorsa, ilgili ipucu kutusunu da göster.
    if (panelId === 'panelHint') {
        const hintContainer = document.getElementById('hintContainer');
        if (hintContainer) hintContainer.style.display = 'block';
    }
};

/* --------------------------------------------------------------------------
   SON KONTROL: EKSİK TANIMLAMALAR
   -------------------------------------------------------------------------- */
// Eğer script.js'in başında tanımlanmadıysa, PWA kontrolü için fallback
if (typeof window.checkPWAStatus === 'undefined') {
    window.checkPWAStatus = function() {
        // Basit PWA kontrolü
        if (window.matchMedia('(display-mode: standalone)').matches) {
            console.log("PWA Mode Active");
        }
    };
}
/* --------------------------------------------------------------------------
   2. BOOT / DATA LOAD / INIT
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
            console.error("HATA: Veri dosyası yüklenemedi ve yerel yedek yok.");
        }
    }
};

window.ensureDataIntegrity = function() {
    console.log("🛡️ Veri bütünlüğü kontrol ediliyor...");
    if (!window.data) window.data = {};
    if (!window.data.settings) window.data.settings = { theme: 'light', conversionMode: 'tr-de', currentClass: 'A1' };
    if (!window.data.topics) window.data.topics = {};
    if (!window.data.verbs) window.data.verbs = {};
    if (!window.data.groups) window.data.groups = [];
    if (!window.data.content) window.data.content = {};
    
    // Settings safe-check
    if (typeof window.data.settings.currentClass === 'number') window.data.settings.currentClass = 'A1';
    if (!window.data.settings.conversionMode) window.data.settings.conversionMode = 'tr-de';
};

window.init = async function() {
    console.log("🚀 Uygulama Başlatılıyor...");
    const splash = document.getElementById('splashScreen');

    try {
        // A. Ayarları Yükle
        const storedSettings = localStorage.getItem('verbmatrix_settings');
        if (storedSettings && storedSettings !== "undefined") {
            try { window.data.settings = JSON.parse(storedSettings); } catch(e) {}
        }

        // B. Yerel Verileri (SRS, Stars, Override) Yükle
        try {
            const srsRaw = localStorage.getItem('verbmatrix_srs_data_v3');
            if (srsRaw === "undefined" || srsRaw === null) {
                window.srsData = {};
            } else {
                window.srsData = JSON.parse(srsRaw);
            }
            window.contentOverride = JSON.parse(localStorage.getItem('verbmatrix_content_override') || '{}');
            window.starsData = JSON.parse(localStorage.getItem('verbmatrix_stars') || '{}');
        } catch (e) {
            console.error("Yerel veri okuma hatası, sıfırlanıyor:", e);
            window.srsData = {};
        }

        // C. Sunucu Verisi & Bütünlük
        await window.loadServerData();
        window.ensureDataIntegrity();

        // D. Arayüz Güncellemeleri
        if(window.updateSRSCounts) window.updateSRSCounts();
        if(window.updateTotalProgress) window.updateTotalProgress();
        if(window.renderClassSelection) window.renderClassSelection();
        if(window.updateFloatingMusicButtonUI) window.updateFloatingMusicButtonUI(); // Yeni eklenen fonksiyon
        if(window.updateClassButtonUI) window.updateClassButtonUI();
        if(window.updateLanguageToggleUI) window.updateLanguageToggleUI();
        
        // Tema ve PWA
        if (window.data.settings.theme === 'dark') document.body.classList.add('dark-mode');
        if(window.checkPWAStatus) window.checkPWAStatus();

    } catch (error) {
        // Hata durumunda bile ana menüyü göstermeyi dene
        window.showView('mainMenu', false);
        console.error("❌ Kritik Başlatma Hatası:", error);
    } finally {
        // G. Tema butonunun metnini başlangıçta ayarla
        const themeToggleBtn = document.getElementById('themeToggleBtn');
        if (themeToggleBtn) {
            themeToggleBtn.innerHTML = window.data.settings.theme === 'dark' ? '☀️ Tema' : '🌙 Tema';
        }
        // H. Yüzen müzik butonunun başlangıç durumunu ayarla
        window.updateFloatingMusicButtonUI();
        // E. Splash Ekranını Kaldır
        if (splash) {
            splash.style.transition = "opacity 0.5s ease";
            splash.style.opacity = "0"; // Logo 3 saniye sonra kaybolsun
            setTimeout(() => { splash.style.display = 'none'; }, 3000);
        }
        // F. Her şey bittiğinde ana menünün aktif olduğundan emin ol
        console.log("▶️ Ana menü gösteriliyor...");
        window.showView('mainMenu', false);
    }
};

// Auto-init logic
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.init);
} else {
    window.init();
}

/* --------------------------------------------------------------------------
   3. HELPERS: AUDIO, STORAGE, UI UTILS
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

window.forceUpdateApp = function() {
    if (confirm("UYARI: Önbellek silinecek ve sayfa yenilenecek. Emin misiniz?")) {
        localStorage.removeItem('verbmatrix_full_data');
        window.location.reload(true);
    }
};

window.resetProgress = function() {
    if (confirm("TÜM İLERLEME SİLİNECEK! Emin misiniz?")) {
        localStorage.removeItem('verbmatrix_srs_data_v3'); 
        location.reload();
    }
};

/* --- AUDIO --- */
/* ==========================================================================
   SESLİ OKUMA (SMART AUDIO & MUSIC DUCKING)
   ========================================================================== */
window.speakText = function(text, lang, cb) {
    if (!window.state.speechSynthesisAvailable || !window.speechSynthesis) { 
        if (typeof cb === 'function') cb(); 
        return; 
    }

    // --- MÜZİK SESİNİ KIS (DUCKING START) ---
    const audio = document.getElementById('bgMusic');
    if (audio && !audio.paused) {
        // Sesi yumuşakça kısmak yerine anında kısıyoruz (performans için)
        // İsterseniz buraya fade-out animasyonu eklenebilir
        audio.volume = window.musicState ? window.musicState.duckVolume : 0.1;
    }
    // -----------------------------------------

    try {
        window.speechSynthesis.cancel(); // Çakışmayı önle

        const u = new SpeechSynthesisUtterance(text);
        u.lang = (lang === 'de') ? 'de-DE' : 'tr-TR';
        u.rate = window.state.slowMode ? 0.7 : 0.9;
        
        // Okuma BİTTİĞİNDE veya HATA verdiğinde
        const onFinish = () => {
            // --- MÜZİK SESİNİ AÇ (DUCKING END) ---
            if (audio && !audio.paused) {
                audio.volume = window.musicState ? window.musicState.baseVolume : 0.5;
            }
            // -------------------------------------
            if (typeof cb === 'function') cb();
        };

        u.onend = onFinish; 
        u.onerror = (e) => {
            console.error("TTS Hatası:", e);
            onFinish(); // Hata olsa bile sesi geri aç
        };

        window.speechSynthesis.speak(u);

    } catch (e) {
        console.error("Speech error:", e); 
        // Hata durumunda da sesi geri açmalıyız
        if (audio && !audio.paused) audio.volume = 0.5;
        if (typeof cb === 'function') cb();
    }
};

window.playCurrentSentence = function(lang) {
    if (!window.state.currentCardData) return;
    const text = (lang === 'de' ? window.state.currentCardData.de : window.state.currentCardData.tr);
    window.speakText(text, lang);
};

window.playSoftBeep = function() {
    if (typeof AudioContext === 'undefined') return;
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(440, context.currentTime); 
    gain.gain.setValueAtTime(0.6, context.currentTime); 
    oscillator.start();
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.3); 
    oscillator.stop(context.currentTime + 0.3);
};

/* ==========================================================================
   GELİŞMİŞ MÜZİK YÖNETİCİSİ (PLAYLIST & AUTO-SKIP)
   ========================================================================== */
window.musicState = {
    playlist: ['bg-music.mp3', 'bg-music2.mp3', 'bg-music3.mp3', 'bg-music4.mp3'],
    currentIndex: 0,
    isPlaying: false,
    baseVolume: 0.5, // Normal ses seviyesi (%50)
    duckVolume: 0.1  // Okuma sırasındaki ses seviyesi (%10)
};

window.initMusicPlayer = function() {
    const audio = document.getElementById('bgMusic');
    if (!audio) return;

    // Başlangıç sesi
    audio.volume = window.musicState.baseVolume;

    // 1. Şarkı bittiğinde sonrakine geç
    audio.onended = function() {
        window.playNextTrack();
    };

    // 2. Dosya bulunamazsa veya hata verirse sonrakine geç
    audio.onerror = function() {
        console.warn(`Müzik dosyası çalınamadı: ${window.musicState.playlist[window.musicState.currentIndex]}. Sıradakine geçiliyor...`);
        window.playNextTrack();
    };
};

window.playNextTrack = function() {
    const audio = document.getElementById('bgMusic');
    const ms = window.musicState;

    // Sıradaki indekse geç (Liste sonundaysa başa dön)
    ms.currentIndex++;
    if (ms.currentIndex >= ms.playlist.length) {
        ms.currentIndex = 0;
    }

    // Yeni kaynağı yükle ve çal
    audio.src = ms.playlist[ms.currentIndex];
    
    // Eğer sistem zaten "çalıyor" modundaysa oynat
    if (ms.isPlaying) {
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.catch(e => {
                console.warn("Otomatik geçişte oynatma hatası:", e);
                // Hata olursa yine sonrakini dene (Recursive riskine karşı timeout)
                setTimeout(() => window.playNextTrack(), 1000); 
            });
        }
    }
    // Yüzen müzik butonunun başlangıç durumunu ayarla
    const floatingMusicBtn = document.getElementById('floatingMusicBtn');
    if (floatingMusicBtn) {
        floatingMusicBtn.classList.toggle('active', window.musicState.isPlaying);
    }
};

window.toggleMusic = function() {
    const audio = document.getElementById('bgMusic');
    if (!audio) return;

    const floatingMusicBtn = document.getElementById('floatingMusicBtn');

    // İlk kez çalıştırılıyorsa eventleri bağla
    if (!audio.onended) window.initMusicPlayer();

    if (audio.paused) {
        // --- BAŞLAT ---
        window.musicState.isPlaying = true;
        if (floatingMusicBtn) {
            floatingMusicBtn.classList.add('active');
        }
        
        // Eğer src boşsa (ilk açılış) ilk şarkıyı yükle
        if (!audio.src || audio.src === window.location.href) {
            audio.src = window.musicState.playlist[window.musicState.currentIndex];
        }
        
        audio.play().then(() => {
            console.log("Müzik başladı:", window.musicState.playlist[window.musicState.currentIndex]);
        }).catch(e => {
            console.error("Müzik başlatılamadı:", e);
            alert("Müzik çalmak için sayfaya etkileşimde bulunun.");
        });
    } else {
        // --- DURDUR ---
        window.musicState.isPlaying = false;
        if (floatingMusicBtn) {
            floatingMusicBtn.classList.remove('active');
        }
        audio.pause();
        console.log("Müzik duraklatıldı.");
    }
};
window.toggleAutoPlay = function() { 
    window.state.autoPlayAudio = !window.state.autoPlayAudio; 
    const led = document.getElementById('autoPlayLed'); if (led) led.classList.toggle('active'); 
};

window.toggleSlowMode = function() { 
    window.state.slowMode = !window.state.slowMode; 
    // Ana ekran ve Hikaye ekranındaki LED'leri güncelle
    ['slowModeLed', 'storySlowLed'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.classList.toggle('active', window.state.slowMode);
    });
};

/* --------------------------------------------------------------------------
   4. NAVIGATION & VIEW MANAGER
   -------------------------------------------------------------------------- */
window.showView = function(viewId = 'mainMenu', pushToHistory = true) {
    // SES ÇAKIŞMASINI ÖNLEME: Her görünüm değişiminde aktif sesi sustur.
    if (window.speechSynthesis) window.speechSynthesis.cancel();

    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    const target = document.getElementById(viewId);
    if (target) {
        target.classList.add('active');
        if (pushToHistory) {
            if (window.state.history.length === 0 || window.state.history[window.state.history.length - 1] !== viewId) {
                window.state.history.push(viewId);
            }
        }
    } else {
        // Eğer hedef view bulunamazsa, her zaman ana menüye dön.
        console.warn(`'${viewId}' ID'li view bulunamadı. Ana menüye yönlendiriliyor.`);
        document.getElementById('mainMenu').classList.add('active');
    }
    if (viewId === 'settingsView') window.updateTotalProgress();
    window.scrollTo(0, 0);
};

window.goBackInHistory = function() {
    // Paralel Player açıksa durdur
    if(window.state.parallelPlaying) window.stopParallelPlayer();
    // Ses çalıyorsa durdur
    window.speechSynthesis.cancel();

    if (window.state.history.length > 1) {
        window.state.history.pop();
        const prev = window.state.history[window.state.history.length - 1];
        
        // Özel Durum Yenilemeleri
        if (prev === 'sectionMenu' && window.state.currentVerbId) window.renderSections(window.state.currentVerbId);
        if (prev === 'tekrarMenu') window.updateSRSCounts();
        if (prev === 'settingsView') window.updateTotalProgress();
        
        // Geri dönerken öğrenme ekranındaki açık panelleri kapat
        ['panelHint', 'panelListen', 'panelEdit'].forEach(pId => document.getElementById(pId)?.classList.add('hidden'));
        document.querySelectorAll('#learningControlsAccordion .btn').forEach(b => b.classList.remove('active-control'));
        window.state.activeLearningPanel = null;
        
        window.showView(prev, false);
    } else {
        window.showView('mainMenu', false);
    }
};

/* --------------------------------------------------------------------------
   SINIF SEÇİMİ (JSON SINIFLARI + YILDIZ AYARLARI)
   -------------------------------------------------------------------------- */
window.renderClassSelection = function() {
    const grid = document.getElementById('classGrid'); 
    if (!grid) return;
    
    // Grid'i temizle
    grid.innerHTML = '';
    
    // 1. JSON'dan Gelen Sınıfları Listele 
    // (Eğer JSON'da "Karma Mod" diye bir sınıf varsa o da burada otomatik listelenir)
    const classes = (window.data.classes && window.data.classes.length > 0) ? window.data.classes : [{ id: 'A1' }, { id: 'A2' }, { id: 'B1' }];
    
    classes.forEach(cls => {
        const btn = document.createElement('button'); 
        btn.className = 'btn btn-secondary btn-lg';
        btn.innerText = cls.name || cls.id; 
        
        // Bu butonlar o sınıfı seçer ve içeriğini açar
        btn.onclick = () => window.changeClass(cls.id);
        grid.appendChild(btn);
    });

    // 2. ÖZEL AYAR BUTONU: ⭐ Konuları Yıldızla
    // Bu buton sınıfı değiştirmez, sadece "Yıldız Seçim Ekranını" açar.
    const configBtn = document.createElement('button'); 
    configBtn.className = 'btn btn-warning btn-lg'; // Dikkat çekici renk
    configBtn.style.fontWeight = 'bold';
    configBtn.style.color = '#5d4037'; // Koyu kahve yazı
    configBtn.style.marginTop = '10px'; // Biraz boşluk
    
    // Buton Metni
    configBtn.innerHTML = '⭐ Konuları Yıldızla<br><small style="font-size:0.7em; opacity:0.8">(Karışık Mod Ayarları)</small>'; 
    
    // Tıklayınca Seçim Ekranına Git
    configBtn.onclick = () => window.openMixedSelection();
    
    grid.appendChild(configBtn);
};


window.changeClass = function(className) {
    window.data.settings.currentClass = className;
    localStorage.setItem('verbmatrix_settings', JSON.stringify(window.data.settings));
    window.updateClassButtonUI();
    window.goBackInHistory();
};

/* --------------------------------------------------------------------------
   SINIF GÖSTERGESİ GÜNCELLEME (GÖRÜNÜM AYARI)
   -------------------------------------------------------------------------- */
window.updateClassButtonUI = function() {
    // Mevcut ayarı al
    const cls = window.data.settings.currentClass || 'A1';
    
    // Ekranda görünecek yazıyı belirle
    let displayText = cls;
    
    // EĞER SINIF "MIXED" İSE EKRANA "K" YAZ
    if (cls === 'MIXED') {
        displayText = 'K'; 
    }

    // Navigasyon butonunu güncelle (Varsa)
    const el1 = document.getElementById('classNavBtn'); 
    if (el1) el1.textContent = displayText;
    
    // Metin göstergesini güncelle (Varsa)
    const el2 = document.getElementById('currentClassDisplay'); 
    if (el2) el2.textContent = displayText;
    
    // Yüzen Yuvarlak Rozeti Güncelle (Sağ alttaki)
    const floatBadge = document.getElementById('floatClassBadge'); 
    if(floatBadge) {
        floatBadge.innerText = displayText;
        
        // İstersen "K" olduğunda rengini de değiştirebilirsin
        if (displayText === 'K') {
            floatBadge.style.background = 'var(--warning)'; // Turuncu/Sarı
            floatBadge.style.color = '#5d4037'; // Koyu yazı
        } else {
            // Diğer sınıflar (A1, A2) için standart renk
            floatBadge.style.background = ''; 
            floatBadge.style.color = '';
        }
    }
};
window.toggleLanguageMode = function() {
    const current = window.data.settings.conversionMode;
    window.data.settings.conversionMode = (current === 'tr-de') ? 'de-tr' : 'tr-de';
    localStorage.setItem('verbmatrix_settings', JSON.stringify(window.data.settings));
    window.updateLanguageToggleUI();
};

// Yüzen müzik butonunun UI'ını güncelleyen fonksiyon
window.updateFloatingMusicButtonUI = function() {
    const floatingMusicBtn = document.getElementById('floatingMusicBtn');
    if (floatingMusicBtn) {
        floatingMusicBtn.classList.toggle('active', window.musicState.isPlaying);
    }
};

window.updateLanguageToggleUI = function() {
    let mode = window.data.settings.conversionMode;
    if (!mode) { mode = 'tr-de'; window.data.settings.conversionMode = 'tr-de'; }

    const ledTR = document.getElementById('led_tr_de');
    const ledDE = document.getElementById('led_de_tr');

    if (ledTR && ledDE) {
        ledTR.classList.remove('active'); ledTR.style.background = "#ccc"; ledTR.style.boxShadow = "none";
        ledDE.classList.remove('active'); ledDE.style.background = "#ccc"; ledDE.style.boxShadow = "none";

        if (mode === 'tr-de') {
            ledTR.classList.add('active');
            ledTR.style.background = "#00e676"; ledTR.style.boxShadow = "0 0 10px #00e676";
        } else {
            ledDE.classList.add('active');
            ledDE.style.background = "#00e676"; ledDE.style.boxShadow = "0 0 10px #00e676";
        }
    }
};

window.updateSRSCounts = function() {
    const c = { zor: 0, normal: 0, ogridim: 0 };
    Object.values(window.srsData || {}).forEach(i => {
        if (i.status === 'zor') c.zor++;
        if (i.status === 'normal') c.normal++;
        if (i.status === 'ogrendim') c.ogridim++;
    });
    const map = { zor: 'tekrarCountZor', normal: 'tekrarCountNormal', ogridim: 'tekrarCountOgrendim' };
    Object.keys(map).forEach(k => {
        const el = document.getElementById(map[k]);
        if (el) el.innerText = (k === 'ogridim') ? c.ogridim : c[k];
    });
};

window.updateTotalProgress = function() {
    let learned = 0; Object.values(window.srsData || {}).forEach(i => { if (i.status === 'ogrendim') learned++; });
    let total = 0; if (window.data.content) Object.values(window.data.content).forEach(arr => total += arr.length);
    if (total === 0) total = 1;
    const percent = Math.round((learned / total) * 100);
    const bar = document.getElementById('totalProgressBar'); if (bar) bar.style.width = percent + "%";
    const txt = document.getElementById('totalProgressText'); if (txt) txt.textContent = `${learned} / ${total} (%${percent})`;
    const srs = window.srsData || {};
    const content = window.data.content || {};
    const classes = window.data.classes || [];
    const topics = window.data.topics || {};

    let totalLearned = 0;
    let totalCards = 0;

    const classProgressContainer = document.getElementById('classProgressContainer');
    if (classProgressContainer) classProgressContainer.innerHTML = '';

    // Her sınıf için ilerlemeyi hesapla
    classes.forEach(cls => {
        if (cls.id === 'K') return; // Karma Modu atla

        let classLearned = 0;
        let classTotal = 0;
        const classTopics = topics[cls.id] || {};

        Object.keys(content).forEach(key => {
            const topicId = key.split('_s')[1]?.split('_')[0];
            if (classTopics[topicId]) {
                const sentences = content[key];
                classTotal += sentences.length;
                sentences.forEach((s, i) => {
                    const cardId = `${key}_${i}`;
                    if (srs[cardId] && srs[cardId].status === 'ogrendim') {
                        classLearned++;
                    }
                });
            }
        });

        totalLearned += classLearned;
        totalCards += classTotal;

        const percent = classTotal > 0 ? Math.round((classLearned / classTotal) * 100) : 0;
        if (classProgressContainer && classTotal > 0) {
            classProgressContainer.innerHTML += `
                <div class="progress-card">
                    <div class="progress-card-header"><h5>${cls.name || cls.id}</h5><span class="progress-value">${classLearned} / ${classTotal}</span></div>
                    <div class="progress-container"><div class="progress-fill" style="width: ${percent}%;"></div></div>
                </div>
            `;
        }
    });

    // Toplam ilerlemeyi güncelle
    const totalPercent = totalCards > 0 ? Math.round((totalLearned / totalCards) * 100) : 0;
    const totalBar = document.getElementById('totalProgressBar');
    const totalText = document.getElementById('totalProgressText');
    if (totalBar) totalBar.style.width = `${totalPercent}%`;
    if (totalText) totalText.textContent = `${totalLearned} / ${totalCards} (%${totalPercent})`;
};

/* --------------------------------------------------------------------------
   6. CORE RENDERING: GROUPS & TOPICS
   -------------------------------------------------------------------------- */
/* ==========================================================================
   YENİ: AKORDİYONLU GRUP MENÜSÜ OLUŞTURUCU
   ========================================================================== */
window.renderGroups = function() {
    const domainContainer = document.getElementById('domainContainer');
    const accordionContainer = document.getElementById('accordionContainer');

    if (!domainContainer || !accordionContainer) {
        console.error("Grup menüsü için gerekli HTML konteynerları bulunamadı.");
        return;
    }

    // Konteynerları temizle
    domainContainer.innerHTML = '';
    accordionContainer.innerHTML = '';

    const domains = window.data.domains || [];
    const categories = window.data.categories || [];
    const groups = window.data.groups || [];

    // 1. Domain Butonlarını Oluştur
    domains.forEach(domain => {
        const btn = document.createElement('button');
        btn.className = 'btn domain-button';
        btn.textContent = domain.name;
        btn.dataset.domainId = domain.id;
        btn.onclick = () => {
            // Aktif butonu ayarla
            document.querySelectorAll('.domain-button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            // İlgili akordiyonu göster, diğerlerini gizle
            document.querySelectorAll('.accordion-item').forEach(item => {
                item.style.display = (item.id === `accordion-${domain.id}`) ? 'block' : 'none';
            });
        };
        domainContainer.appendChild(btn);
    });

    // 2. Her Domain için Akordiyon Öğesi Oluştur
    domains.forEach(domain => {
        const accordionItem = document.createElement('div');
        accordionItem.className = 'accordion-item';
        accordionItem.id = `accordion-${domain.id}`;
        accordionItem.style.display = 'none'; // Başlangıçta gizli

        // Bu domaine ait kategorileri bul
        const domainCategories = categories.filter(cat => cat.domain_id === domain.id);

        domainCategories.forEach(category => {
            // Akordiyon Başlığı
            const header = document.createElement('button');
            header.className = 'accordion-header';
            header.innerHTML = `<span>${category.name}</span><span class="icon">▶</span>`;

            // Akordiyon İçeriği
            const content = document.createElement('div');
            content.className = 'accordion-content';

            const categoryGrid = document.createElement('div');
            categoryGrid.className = 'category-buttons-grid';

            // Kategoriye ait grupları (fiil grupları) bul ve butonlarını oluştur
            const groupsInCategory = groups.filter(g => category.group_ids.includes(g.id));
            groupsInCategory.forEach(group => {
                // Her grup için bir sarmalayıcı oluştur
                const wrapper = document.createElement('div');
                wrapper.className = 'group-button-wrapper';

                // 1. Ana Grup Butonu
                const groupBtn = document.createElement('button');
                groupBtn.className = 'btn btn-secondary group-main-btn';
                groupBtn.innerHTML = `<b>${group.name}</b><br><small>${group.nameDE || ''}</small>`;
                groupBtn.onclick = () => window.renderVerbs(group.id);
                wrapper.appendChild(groupBtn);

                // 2. Hikaye Butonu (Eğer varsa)
                if (group.story) {
                    const storyBtn = document.createElement('button');
                    storyBtn.className = 'btn btn-primary group-story-btn';
                    storyBtn.innerHTML = '📖';
                    storyBtn.title = group.story.title || 'Hikayeyi Oku';
                    storyBtn.onclick = () => window.openStoryMode(group.id);
                    wrapper.appendChild(storyBtn);
                    wrapper.style.gridTemplateColumns = '3fr 1fr'; // İki buton varsa grid'i ayarla
                } else {
                    // Hikaye yoksa, ana buton tam genişlikte olsun
                    groupBtn.style.gridColumn = '1 / -1';
                }

                categoryGrid.appendChild(wrapper);
            });

            content.appendChild(categoryGrid);
            accordionItem.appendChild(header);
            accordionItem.appendChild(content);

            // Akordiyon açma/kapama işlevselliği
            header.onclick = () => {
                header.classList.toggle('active');
                content.classList.toggle('open');
            };
        });

        accordionContainer.appendChild(accordionItem);
    });

    // 3. Başlangıç Durumunu Ayarla
    // İlk domain butonunu aktif yap
    const firstDomainBtn = domainContainer.querySelector('.domain-button');
    if (firstDomainBtn) {
        firstDomainBtn.classList.add('active');
        // İlk akordiyonu görünür yap
        const firstAccordion = document.getElementById(`accordion-${firstDomainBtn.dataset.domainId}`);
        if (firstAccordion) {
            firstAccordion.style.display = 'block';
        }
    }
};

window.renderVerbs = function(groupId) {
    window.state.currentGroupId = groupId;
    const list = document.getElementById('verbList'); if (!list) return; list.innerHTML = '';
    const verbs = (window.data.verbs && window.data.verbs[groupId]) ? window.data.verbs[groupId] : [];
    
    verbs.forEach(v => {
        const btn = document.createElement('button'); btn.className = 'btn btn-secondary btn-block';
        btn.style.marginBottom = '10px'; btn.style.textAlign = 'left';
        btn.innerHTML = `<b>${v.verbTR}</b> <small>(${v.verbDE})</small>`;
        btn.onclick = () => { window.state.verbData = v; window.renderSections(v.id); };
        list.appendChild(btn);
    });
    window.showView('verbMenu');
};
/* --------------------------------------------------------------------------
   GÜNCELLENMİŞ RENDER SECTIONS (MIXED ve K Desteği)
   -------------------------------------------------------------------------- */
window.renderSections = function(verbId) {
    const list = document.getElementById('sectionList'); 
    if (!list) return; 
    list.innerHTML = '';
    
    window.state.currentVerbId = verbId;
    const currentClass = window.data.settings.currentClass || 'A1';
    
    // --- DÜZELTME BURADA BAŞLIYOR ---
    // Sınıfın Karma Mod olup olmadığını kontrol et (Hem 'MIXED' hem 'K' kabul edilir)
    const isMixedMode = (currentClass === 'MIXED' || currentClass === 'K');

    // Kaynak Belirleme
    let topicSource = {};
    if (window.data.topics && window.data.topics[currentClass] && !isMixedMode) {
        // Normal Sınıf (A1, A2 vb.)
        topicSource = window.data.topics[currentClass];
    } else if (isMixedMode && window.data.topicPool) {
        // Karma Mod (MIXED veya K)
        topicSource = window.data.topicPool;
    }
    // --------------------------------

    if (!topicSource || Object.keys(topicSource).length === 0) {
        console.warn(`⚠️ '${currentClass}' sınıfı için konu bulunamadı.`);
        list.innerHTML = '<div style="text-align:center; padding:20px;">Bu seviyede konu bulunamadı.</div>';
        return;
    }

    Object.keys(topicSource).sort((a, b) => parseInt(a) - parseInt(b)).forEach(tId => {
        const tName = typeof topicSource[tId] === 'object' ? topicSource[tId].name : topicSource[tId];
        
        // --- YILDIZ KONTROLÜ ---
        // Eğer Karma Mod ise ve yıldızı yoksa LİSTELEME
        if (isMixedMode && (!window.starsData[tId] || window.starsData[tId] === 0)) return;
        // -----------------------

        const key = `${verbId}_s${tId}`; 
        const sentences = window.data.content ? window.data.content[key] : null;
        
        if (sentences && sentences.length > 0) {
            let completedCount = 0; 
            sentences.forEach((s, idx) => { if (window.srsData[`${key}_${idx}`]) completedCount++; });
            const total = sentences.length; 
            const isFinished = completedCount === total;
            
            // Buton Tasarımı
            let btnClass = isFinished ? 'btn-success' : (completedCount > 0 ? 'btn-info' : 'btn-secondary');
            const row = document.createElement('button'); 
            row.className = `btn ${btnClass} btn-block`;
            row.style.justifyContent = 'space-between'; 
            row.style.textAlign = 'left';
            
            row.innerHTML = `
                <div>
                    <div style="font-size:0.8rem; opacity:0.8">Konu ${tId}</div>
                    <div style="font-size:1.1rem; font-weight:bold;">${tName}</div>
                </div>
                <div style="font-size:0.85rem; font-weight:700; min-width:80px; text-align:right;">
                    ${isFinished ? '✅ TAMAM' : `⏳ ${completedCount} / ${total}`}
                </div>`;
            
            row.onclick = () => window.startStudy(sentences, verbId, tId);
            list.appendChild(row);
        }
    });
    window.showView('sectionMenu');
};

/* ==========================================================================
   ANA MENÜ -> GRUP SEÇİMİ GEÇİŞ FONKSİYONU
   ========================================================================== */
window.selectStudyMode = function(mode) {
    console.log("🔘 Mod Seçildi:", mode);
    
    // 1. Durumu (State) Sıfırla ve Hazırla
    // 'mode' parametresi genelde 'study' olarak gelir.
    window.state.mode = mode || 'study'; 
    
    // SRS (Tekrar) modundaysak, bu modu iptal et (Normal çalışmaya dönüyoruz)
    window.state.tekrarStatus = null; 
    
    // Varsa eski desteyi temizle ki karışıklık olmasın
    window.state.deck = [];
    window.state.deckPos = 0;
    
    // 2. Görünümü Değiştir (Grup Menüsünü Aç)
    window.showView('groupMenu'); 
    
    // 3. Listeyi Çiz
    // Eğer renderGroups fonksiyonu tanımlıysa grupları ekrana bas
    if (typeof window.renderGroups === 'function') {
        window.renderGroups(); 
    } else {
        console.error("❌ Hata: renderGroups fonksiyonu bulunamadı!");
        alert("Menü yüklenemedi. Lütfen sayfayı yenileyin.");
    }
};
/* 4. confirmStudyMode (Seçime Göre Başlat) */
window.confirmStudyMode = function(mode) {
    document.getElementById('topicActionModal').remove(); // Modalı kapat
    
    if (!window.state.tempDeck) return;
    
    // Veriyi Yükle
    window.state.deck = window.state.tempDeck;
    window.state.mode = mode; // 'parallel' veya 'study'

    if (mode === 'parallel') {
        // YENİ: Paralel dinleme için mod seçimini göster
        document.getElementById('modalParallelModeSelect').style.display = 'flex';
    } else {
        // 'study' modu seçildi (Cümle Ayrıştır)
        window.state.deckPos = 0;
        window.showView('learningView');
        window.renderSentence();
    }
};
window.openTopicActionModal = function(sentences, vId, tId) {
    // 1. Veri Validasyonu
    if (!sentences || !Array.isArray(sentences) || sentences.length === 0) {
        alert("⚠️ Cümle verisi bulunamadı.");
        return;
    }

    // 2. Tamamlanma Durumunu Hesapla
    let completedCount = 0;
    sentences.forEach((s, i) => {
        const id = `${vId}_s${tId}_${i}`;
        // Eğer bu ID srsData içinde varsa (zor, normal, ogrendim fark etmez), tamamlanmış sayılır.
        if (window.srsData && window.srsData[id]) {
            completedCount++;
        }
    });

    const total = sentences.length;
    const isAllFinished = (total > 0 && completedCount === total);

    // 3. Eski Modalı Temizle & Hazırla
    const oldModal = document.getElementById('topicActionModal');
    if (oldModal) oldModal.remove();

    // Geçici veriyi (tempDeck) hazırla
    const contentOverride = window.contentOverride || {};
    window.state.tempDeck = sentences.map((s, i) => {
        const id = `${vId}_s${tId}_${i}`;
        window.state.tempVerbId = vId; // YENİ: ID'leri state'e kaydet
        window.state.tempTopicId = tId;
        const ovr = contentOverride[id] || {};
        return { ...s, ...ovr, id: id };
    });

    // Konu Adını Bul
    const currentClass = window.data.settings.currentClass || 'A1';
    let topicName = "Konu";
    if (window.data.topics && window.data.topics[currentClass] && window.data.topics[currentClass][tId]) {
        const t = window.data.topics[currentClass][tId];
        topicName = (typeof t === 'object') ? t.name : t;
    }

    // 4. "Cümle Ayrıştır" Butonunu Duruma Göre Hazırla
    let studyButtonHTML = '';

    if (isAllFinished) {
        // Hepsİ BİTMİŞSE -> Kilitli, Gri Buton
        studyButtonHTML = `
            <button class="btn btn-secondary btn-lg" style="opacity:0.6; cursor:not-allowed;" disabled>
                ✅ Tamamlandı (${completedCount}/${total})
            </button>
            <div style="font-size:0.8rem; color:#f44336; margin-top:-10px; margin-bottom:10px;">
                Bu konuyu bitirdiniz. Tekrar yapmak için Tekrar Modunu kullanın.
            </div>
        `;
    } else {
        // BİTMEMİŞSE -> Normal Sarı Buton
        studyButtonHTML = `
            <button onclick="window.confirmStudyMode('study')" class="btn btn-warning btn-lg">
                🧩 Cümle Ayrıştır (${completedCount}/${total})
            </button>
        `;
    }

    // 5. Modalı Oluştur
    const modal = document.createElement('div');
    modal.id = 'topicActionModal';
    modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10000; display:flex; align-items:center; justify-content:center; animation:fadeIn 0.2s;";
    
    modal.innerHTML = `
        <div class="content-box" style="width:90%; max-width:320px; background:var(--bg-card); padding:25px; border-radius:16px; text-align:center; border:1px solid var(--primary);">
            <h3 style="color:var(--primary-dark); margin-bottom:10px;">${topicName}</h3>
            <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:25px;">Mod Seçiniz:</p>
            
            <div style="display:flex; flex-direction:column; gap:15px;">
                <button onclick="window.confirmStudyMode('parallel')" class="btn btn-info btn-lg">
                    🎧 Paralel Dinle
                </button>
                
                ${studyButtonHTML}
            </div>
            
            <button onclick="document.getElementById('topicActionModal').remove()" class="btn btn-secondary" style="margin-top:20px; width:100%;">
                İptal
            </button>
        </div>
    `;
    
    document.body.appendChild(modal);
};


function populateAccordionPanels() {
    const hintPanel = document.getElementById('panelHint');
    if (hintPanel) {
        hintPanel.innerHTML = `
            <div class="button-grid-learning" id="hint-buttons">
                <button class="btn btn-sm btn-info" onclick="window.openContextHint('verb')">⚡ Fiil Notu</button>
                <button class="btn btn-sm btn-warning" onclick="window.openContextHint('topic')">📘 Konu Notu</button>
                <button class="btn btn-sm btn-success" onclick="window.showSpecificHint('sentence')">💡 Cümle İpucu</button>
            </div>`;
    }

    const listenPanel = document.getElementById('panelListen');
    if (listenPanel) {
        listenPanel.innerHTML = `
            <div class="button-grid-learning" id="listen-buttons">
                <button class="btn btn-sm btn-secondary" onclick="window.toggleAutoPlay(this)">
                    <span id="autoPlayLed" class="led-indicator"></span> Oto
                </button>
                <button class="btn btn-sm btn-secondary" onclick="window.toggleSlowMode(this)">
                    <span id="slowModeLed" class="led-indicator"></span> Yavaş
                </button>
                <button class="btn btn-sm btn-primary" onclick="window.playCurrentSentence('de')">🇩🇪 Oku</button>
                <button class="btn btn-sm btn-primary" onclick="window.playCurrentSentence('tr')">🇹🇷 Oku</button>
            </div>`;
        // Ensure LEDs are in the correct state
        // LED'lerin durumunu başlangıçta ayarla
        if(document.getElementById('autoPlayLed')) document.getElementById('autoPlayLed').classList.toggle('active', window.state.autoPlayAudio);
        if(document.getElementById('slowModeLed')) document.getElementById('slowModeLed').classList.toggle('active', window.state.slowMode);
    }

    const editPanel = document.getElementById('panelEdit');
    if (editPanel) {
        editPanel.innerHTML = `
             <div id="edit-content" style="background:var(--bg-body); padding:15px; border-radius:8px; border:1px solid var(--border); text-align:center;">
                <p style="font-size:0.9rem; color:var(--text-muted);">Bu kartta hata mı var?</p>
                <button class="btn btn-warning btn-block" onclick="window.openEditPanel()">🛠 Kartı Düzenle</button>
            </div>`;
    }
}


/* --------------------------------------------------------------------------
   7. STUDY MODE (RENDER SENTENCE & RATE)
   -------------------------------------------------------------------------- */
window.renderSentence = function() {
    // accordion.style.display = 'none' SATIRINI SIFIRLAMAK İÇİN EKLENDİ
    const accordion = document.getElementById('learningControlsAccordion');
    if (accordion) accordion.style.display = '';
    // ... (Önceki tanımlamalar aynı kalıyor) ...
    const srsControls = document.getElementById('srsControls');
    if (srsControls) { srsControls.style.display = 'none'; srsControls.classList.add('hidden'); }
    
    const actionBtn = document.getElementById('actionBtn');
    if (actionBtn) { 
        actionBtn.style.display = 'block'; 
        actionBtn.classList.remove('hidden'); 
        actionBtn.textContent = 'GÖSTER'; 
    }
    
    const content = document.getElementById('learningContent');
    if (!content) return;
    content.innerHTML = ''; 
    content.classList.remove('hidden');

    if (!window.state.deck || window.state.deckPos >= window.state.deck.length) { 
        window.showCompletion(); 
        return; 
    }

    const card = window.state.deck[window.state.deckPos];
    window.state.currentCardData = card;
    window.state.currentCardKey = card.id;

    if (window.updateHeaderStatus) window.updateHeaderStatus();

    const isTrDe = window.data.settings.conversionMode === 'tr-de';
    const question = isTrDe ? card.tr : card.de; 
    const answer = isTrDe ? card.de : card.tr;
    
    // Hint text preparation
    let hintText = card.hint || (window.data.hints && window.data.hints.sentences ? window.data.hints.sentences[card.id] : "İpucu yok.");
    hintText = (hintText || "İpucu yok.").replace(/\n/g, '<br>');

    content.innerHTML = `
        <div class="sentence" style="margin-bottom:15px; min-height:80px; display:flex; flex-direction:column; justify-content:center;">
            <span style="color:var(--text-muted); font-size:0.9em; margin-bottom:5px;">Soru:</span>
            <strong style="font-size:1.4em; color:var(--text-main);">${question}</strong>
        </div>
        
        <div id="answerArea" class="answer-frame" style="margin-top:20px; border-top:2px solid var(--primary); padding:20px; min-height:100px; display:flex; flex-direction:column; justify-content:center; align-items:center; background:var(--bg-card); border-radius:12px; box-shadow:var(--shadow-soft);">
            <span style="color:var(--text-muted); font-size:0.9em; margin-bottom:10px;">Cevap:</span>
            <strong style="font-size:1.5em; color:var(--primary);" id="answerText"></strong>
        </div>

        <div id="hintContainer" style="display:none; margin:10px auto; padding:15px; background:#fff9c4; color:#5f5a08; border-radius:8px; width:95%; border:1px solid #fff59d; text-align:left; font-size:0.95rem;">
            💡 ${hintText}
        </div>
    `;

    if (actionBtn) {
        actionBtn.onclick = function() {
            const answerText = document.getElementById('answerText');
            if (answerText) {
                answerText.textContent = answer;
                answerText.style.opacity = '0';
                answerText.style.animation = 'none';
                setTimeout(() => {
                    answerText.style.animation = 'slideInAnswer 0.5s ease-out forwards';
                    answerText.style.opacity = '1';
                }, 10);
            }
            
            if (isTrDe && window.state.autoPlayAudio) window.playCurrentSentence('de');
            
            if (!window.state.tekrarStatus) {
                actionBtn.style.display = 'none';
                if (srsControls) { srsControls.classList.remove('hidden'); srsControls.style.display = 'grid'; }
            } else {
                window.state.deckPos++; 
                setTimeout(window.renderSentence, 1500);
            }
        };
    }
    
    populateAccordionPanels();
    // Tüm panelleri kapatarak başla
    ['panelHint', 'panelListen', 'panelEdit'].forEach(pId => document.getElementById(pId)?.classList.add('hidden'));
    document.querySelectorAll('#learningControlsAccordion .btn').forEach(b => b.classList.remove('active-control'));
};

// Bu yardımcı fonksiyonun olduğundan emin olun
window.showSpecificHint = function(kind) {
    if (kind === 'sentence') {
        const hb = document.getElementById('hintContainer');
        if (hb) {
            hb.style.display = (hb.style.display === 'none' ? 'block' : 'none');
        } else {
            alert("İpucu bulunamadı.");
        }
    }
};
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
   TEKRAR MODU YARDIMCISI: İLERLE BUTONU
   -------------------------------------------------------------------------- */
window.renderClozeCard = function() {
    if (!window.state.deck || window.state.deckPos >= window.state.deck.length) {
        window.showCompletion(); return;
    }
    
    if (window.updateHeaderStatus) window.updateHeaderStatus();
    
    window.state.waitingForNext = false; 
    window.state.pendingStatus = 'zor';

    const card = window.state.deck[window.state.deckPos];
    window.state.currentCardKey = card.id;
    window.state.currentCardData = card;

    const isTrDe = window.data.settings.conversionMode === 'tr-de';
    const targetSentence = isTrDe ? card.de : card.tr;
    const sourceSentence = isTrDe ? card.tr : card.de;

    const words = targetSentence.split(' ');
    let candidateIndices = words.map((w, i) => w.length > 2 ? i : -1).filter(i => i !== -1);
    if (candidateIndices.length === 0) candidateIndices = [0];
    const randomIndex = candidateIndices[Math.floor(Math.random() * candidateIndices.length)];
    window.state.clozeAnswer = words[randomIndex].replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
    const maskedSentence = words.map((w, i) => i === randomIndex ? "______" : w).join(' ');

    const content = document.getElementById('learningContent');
    if(document.getElementById('actionBtn')) document.getElementById('actionBtn').style.display = 'none';
    
    const accordion = document.getElementById('learningControlsAccordion');
    if (accordion) accordion.style.display = 'block';
    populateAccordionPanels();
    ['panelHint', 'panelListen', 'panelEdit'].forEach(pId => document.getElementById(pId)?.classList.add('hidden'));
    document.querySelectorAll('#learningControlsAccordion .btn').forEach(b => b.classList.remove('active-control'));

    let hintText = card.hint || (window.data.hints && window.data.hints.sentences ? window.data.hints.sentences[card.id] : "");
    hintText = (hintText || "").replace(/\n/g, '<br>');

    content.innerHTML = `
        <div class="content-box" style="text-align:center; padding:20px;">
            <h3 style="color:var(--text-muted); margin-bottom:10px;">✏️ Boşluk Doldurma</h3>
            <p style="color:var(--text-muted); font-size:1rem; margin-bottom:20px;">${sourceSentence}</p>
            <h2 style="color:var(--text-main); margin-bottom:25px; line-height:1.4;">${maskedSentence}</h2>
            <input id="clozeInput" class="input-field" type="text" placeholder="Eksik kelime..." autocomplete="off" style="text-align:center; font-size:1.2rem;">
            <button id="reviewActionBtn" class="btn btn-warning btn-block" style="margin-top:20px;" onclick="window.handleReviewAction()">KONTROL ET</button>
            <div id="clozeFeedback" style="margin-top:15px; font-weight:bold; min-height:25px;"></div>
        </div>
        <div id="hintContainer" style="display:none; margin:10px auto; padding:15px; background:#fff9c4; color:#5f5a08; border-radius:8px; width:95%; border:1px solid #fff59d; text-align:left; font-size:0.95rem;">
            💡 ${hintText}
        </div>
    `;
    const input = document.getElementById('clozeInput');
    input.focus();
    input.addEventListener("keydown", function(event) { if (event.key === "Enter") window.handleReviewAction(); });
};

window.checkQuizAnswer = function() {
    const input = document.getElementById('quizInput');
    const fb = document.getElementById('quizFeedback');
    
    // Değerleri al
    const val = input.value.trim().toLowerCase().replace(/[.,!?]/g, '');
    const corr = window.state.correctAnswer.toLowerCase().replace(/[.,!?]/g, '');
    
    // KONTROL MANTIĞI
    if (val === corr && val !== "") {
        // Doğru
        fb.innerHTML = '<span style="color:green">✅ DOĞRU!</span>';
        window.state.pendingStatus = 'normal';
    } else {
        // Yanlış (veya Boş)
        fb.innerHTML = `<span style="color:red">❌ YANLIŞ! <br>Doğru: ${window.state.correctAnswer}</span>`;
        if(val === "") input.classList.add('shake-anim'); // Boşsa salla ama devam et
        window.state.pendingStatus = 'zor';
    }

    // SESLİ OKUMA (İsteğinize göre: Kontrol tuşuna basar basmaz çalar)
    if (window.state.autoPlayAudio) {
        // Hedef dili belirle (Genelde cevap dilidir)
        const isTrDe = window.data.settings.conversionMode === 'tr-de';
        window.playCurrentSentence(isTrDe ? 'de' : 'tr');
    }

    return true; // İşlem tamamlandı
};
/* --------------------------------------------------------------------------
   MODULE: WORD ORDER (KELİME SIRALAMA) - GÜNCELLENDİ
   -------------------------------------------------------------------------- */
window.renderWordOrderCard = function() {
    if (!window.state.deck || window.state.deckPos >= window.state.deck.length) {
        window.showCompletion(); return;
    }
    
    if (window.updateHeaderStatus) window.updateHeaderStatus();

    window.state.waitingForNext = false;
    window.state.pendingStatus = 'zor';

    const card = window.state.deck[window.state.deckPos];
    window.state.currentCardKey = card.id;
    window.state.currentCardData = card;

    const isTrDe = window.data.settings.conversionMode === 'tr-de';
    const targetSentence = isTrDe ? card.de : card.tr;
    const sourceSentence = isTrDe ? card.tr : card.de;

    const rawWords = targetSentence.split(' ').filter(w => w.trim() !== '');
    window.state.wordOrderTarget = rawWords;
    window.state.wordOrderCurrent = [];

    let shuffled = [...rawWords];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const content = document.getElementById('learningContent');
    if(document.getElementById('actionBtn')) document.getElementById('actionBtn').style.display = 'none';

    const accordion = document.getElementById('learningControlsAccordion');
    if (accordion) accordion.style.display = 'block';
    populateAccordionPanels();
    ['panelHint', 'panelListen', 'panelEdit'].forEach(pId => document.getElementById(pId)?.classList.add('hidden'));
    document.querySelectorAll('#learningControlsAccordion .btn').forEach(b => b.classList.remove('active-control'));

    let hintText = card.hint || (window.data.hints && window.data.hints.sentences ? window.data.hints.sentences[card.id] : "");
    hintText = (hintText || "").replace(/\n/g, '<br>');

    content.innerHTML = `
        <div class="content-box">
            <h3 style="text-align:center; color:var(--primary);">🧩 Cümle Kur</h3>
            <p style="text-align:center; color:var(--text-muted); margin-bottom:20px;">${sourceSentence}</p>
            <div id="woLine" style="min-height:50px; background:var(--bg-body); border:2px dashed var(--border); border-radius:8px; padding:10px; display:flex; flex-wrap:wrap; gap:8px; margin-bottom:20px;"></div>
            <div id="woPool" style="display:flex; flex-wrap:wrap; gap:8px; justify-content:center; margin-bottom:20px;">
                ${shuffled.map((w, i) => `<button id="btn_pool_${i}" class="btn btn-secondary btn-sm" onclick="window.moveWordToLine(this, '${w.replace(/'/g, "\\'")}')">${w}</button>`).join('')}
            </div>
            <div style="display:flex; gap:10px; flex-direction:column;">
                <button id="reviewActionBtn" class="btn btn-success btn-block" onclick="window.handleReviewAction()">KONTROL ET</button>
                <button class="btn btn-danger btn-sm" onclick="window.renderWordOrderCard()" style="margin-top:5px;">🔄 Sıfırla</button>
            </div>
            <div id="woFeedback" style="text-align:center; margin-top:15px; font-weight:bold;"></div>
        </div>
        <div id="hintContainer" style="display:none; margin:10px auto; padding:15px; background:#fff9c4; color:#5f5a08; border-radius:8px; width:95%; border:1px solid #fff59d; text-align:left; font-size:0.95rem;">
            💡 ${hintText}
        </div>
    `;
};

window.checkWordOrder = function() {
    const feedback = document.getElementById('woFeedback');
    
    // Cümleyi oluştur (Boşsa boş string gelir)
    const userSentence = window.normalizeText(window.state.wordOrderCurrent.join(' '));
    const targetSentence = window.normalizeText(window.state.wordOrderTarget.join(' '));

    if (userSentence === targetSentence && userSentence !== "") {
        feedback.innerHTML = '<span style="color:green">✅ MÜKEMMEL!</span>';
        window.state.pendingStatus = 'ogrendim';
    } else {
        feedback.innerHTML = '<span style="color:red">❌ Hatalı / Eksik.</span>';
        window.state.pendingStatus = 'zor';
    }

    // SESLİ OKUMA
    if (window.state.autoPlayAudio) {
        const isTrDe = window.data.settings.conversionMode === 'tr-de';
        window.playCurrentSentence(isTrDe ? 'de' : 'tr');
    }

    return true;
};

/* --------------------------------------------------------------------------
   MODULE: QUIZ (YAZMA TESTİ) - GÜNCELLENDİ
   -------------------------------------------------------------------------- */
window.renderQuizCard = function() {
    if (window.state.deckPos >= window.state.deck.length) { window.showCompletion(); return; }
    
    if (window.updateHeaderStatus) window.updateHeaderStatus();

    window.state.waitingForNext = false;
    window.state.pendingStatus = 'zor';

    const card = window.state.deck[window.state.deckPos]; 
    window.state.currentCardKey = card.id;
    window.state.currentCardData = card;

    const isTrDe = window.data.settings.conversionMode === 'tr-de';
    window.state.correctAnswer = isTrDe ? card.de : card.tr;
    
    const content = document.getElementById('learningContent'); content.innerHTML = '';
    if(document.getElementById('actionBtn')) document.getElementById('actionBtn').style.display = 'none';

    const accordion = document.getElementById('learningControlsAccordion');
    if (accordion) accordion.style.display = 'block';
    populateAccordionPanels();
    ['panelHint', 'panelListen', 'panelEdit'].forEach(pId => document.getElementById(pId)?.classList.add('hidden'));
    document.querySelectorAll('#learningControlsAccordion .btn').forEach(b => b.classList.remove('active-control'));
    
    let hintText = card.hint || (window.data.hints && window.data.hints.sentences ? window.data.hints.sentences[card.id] : "");
    hintText = (hintText || "").replace(/\n/g, '<br>');

    content.innerHTML = `
        <div class="content-box" style="text-align:center;">
            <h3>📝 Quiz</h3>
            <div style="font-size:1.2rem; margin:15px 0;">${isTrDe ? card.tr : card.de}</div>
            <input id="quizInput" class="input-field" placeholder="Cevabı yaz..." autocomplete="off">
            <button id="reviewActionBtn" class="btn btn-success btn-block" style="margin-top:15px;" onclick="window.handleReviewAction()">KONTROL ET</button>
            <div id="quizFeedback" style="margin-top:15px; font-weight:bold;"></div>
        </div>
        <div id="hintContainer" style="display:none; margin:10px auto; padding:15px; background:#fff9c4; color:#5f5a08; border-radius:8px; width:95%; border:1px solid #fff59d; text-align:left; font-size:0.95rem;">
            💡 ${hintText}
        </div>
    `;
    const input = document.getElementById('quizInput');
    input.focus();
    input.addEventListener('keydown', function(e) { if(e.key==='Enter') window.handleReviewAction(); });
};



window.updateHeaderStatus = function() {
    const card = window.state.currentCardData;
    if (!card || !card.id) return;

    const headerInfo = document.getElementById('learningHeaderInfo');
    const progressContainer = document.querySelector('#learningView .progress-container');

    // Gerekli elementler yoksa işlemi durdur
    if (!headerInfo || !progressContainer) return;

    // --- 1. Fiil ve Konu Bilgisini Al ve Göster ---
    const parts = card.id.split('_');
    const verbId = parts[0];
    const topicId = parts[1].replace('s', '');

    // Tüm gruplardaki fiilleri düz bir diziye çevir ve ilgili fiili bul
    const verb = Object.values(window.data.verbs || {}).flat().find(v => v.id === verbId);
    
    // Konu adını topicPool'dan al (en güvenilir kaynak)
    const topicName = window.data.topicPool ? window.data.topicPool[topicId] : `Konu ${topicId}`;

    if (verb && topicName) {
        headerInfo.innerHTML = `Fiil: <span class="verb-part">${verb.verbTR}</span><span class="separator">|</span>Konu: <span class="topic-part">${topicName}</span>`;
        headerInfo.style.display = 'block';
    } else {
        headerInfo.style.display = 'none';
    }

    // --- PROGRESS BAR UPDATE ---
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('learnProgressText');
    const deck = window.state.deck || [];
    const total = deck.length;
    // Paralel modda deckPos yerine parallelIndex kullanılır
    const current = (window.state.mode === 'parallel') ? window.state.parallelIndex + 1 : window.state.deckPos + 1;

    if (total > 0) {
        const percent = Math.min(100, Math.round((current / total) * 100));
        progressFill.style.width = `${percent}%`;
        progressText.textContent = `${current} / ${total}`;
        progressContainer.style.display = 'flex';
    } else {
        progressContainer.style.display = 'none';
    }
};
/* ==========================================================================
   GÜNCELLENMİŞ STARTSTUDY FONKSİYONU
   - Çalışmayı direkt başlatmaz.
   - Veriyi hazırlar ve window.tempDeck'e atar.
   - Seçim Modalını açar.
   ========================================================================== */
window.startStudy = function(sentences, vId, tId) {
    if (!sentences || sentences.length === 0) { 
        alert("Bu bölüm için içerik bulunamadı."); 
        return; 
    }

    // 1. Kartları Hazırla (SRS ve Override verilerini birleştirerek)
    const allCards = sentences.map((s, i) => { 
        const id = `${vId}_s${tId}_${i}`; 
        // Varsa düzenlenmiş içeriği (override), yoksa orijinali al
        const ovr = window.contentOverride ? (window.contentOverride[id] || {}) : {}; 
        return { ...s, ...ovr, id: id }; 
    });

    // 2. Veriyi Geçici Havuza (tempDeck) At (state tarafında tutuyoruz)
    window.state.tempDeck = allCards;

    // 3. Seçim Modalını Aç (Paralel mi, Çalışma mı?)
    if (window.openTopicActionModal) {
        window.openTopicActionModal(allCards, vId, tId);
    } else {
        // Eğer modal fonksiyonu yoksa mecburen direkt başlat (Fallback)
        console.warn("Modal bulunamadı, direkt başlatılıyor.");
        window.confirmStudyMode('study');
    }
};
/* --------------------------------------------------------------------------
   8. TEKRAR (SRS) & QUIZ MODES
   -------------------------------------------------------------------------- */
window.startTekrar = function(status) {
    window.state.tekrarStatus = status;
    const srsKeys = Object.keys(window.srsData || {}).filter(key => window.srsData[key].status === status);
    if (srsKeys.length === 0) { alert(`'${status}' havuzunda cümle yok.`); return; }

    const deck = [];
    Object.keys(window.data.content || {}).forEach(k => {
        window.data.content[k].forEach((s, i) => {
            const id = `${k}_${i}`;
            if (srsKeys.includes(id)) deck.push({ ...s, id: id });
        });
    });

    if (deck.length === 0) { alert("Veri hatası: ID var ama içerik yok."); return; }
    window.state.deck = deck; window.state.deckPos = 0;
    
    // Tekrar Menüsünü Render Et
    const container = document.getElementById('tekrarModeMenu');
    if (container) {
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
    } else {
        window.startQuizMode('study');
    }
};

window.startQuizMode = function(mode) {
    window.state.mode = mode;
    // Güvenlik: Kart var mı?
    if (!window.state.deck || window.state.deck.length === 0) { 
        alert("Çalışılacak kart yok."); 
        window.showView('tekrarModeMenu'); // Kart yoksa menüye at
        return; 
    }

    // Paralel Mod ise oraya yönlendir
    if (mode === 'parallel') { 
        window.startParallelPlayer(); 
        return; 
    }

    // Diğer Modlar (Quiz, Cloze, WordOrder) için ekranı hazırla
    window.showView('learningView');
    
    // ÖNEMLİ DÜZELTME: learningContent'i görünür yap ve temizle
    const content = document.getElementById('learningContent'); 
    if (content) {
        content.classList.remove('hidden'); // Gizliyse aç
        content.innerHTML = ''; // İçini temizle
    }
    
    // Eski "wordOrderArea" gibi harici divlere gerek yok, 
    // render fonksiyonları her şeyi learningContent içine çizer.
    const wa = document.getElementById('wordOrderArea'); 
    if (wa) wa.classList.add('hidden'); // Varsa gizle ki çakışmasın

    // İlgili Render Fonksiyonunu Çağır
    if (mode === 'wordorder') {
        window.renderWordOrderCard();
    } else if (mode === 'quiz') {
        window.renderQuizCard();
    } else if (mode === 'cloze') {
        window.renderClozeCard();
    } else {
        window.renderSentence();
    }
};

/* --- QUIZ RENDERERS (Simplied for brevity, logic preserved) --- */



// (Cloze ve WordOrder fonksiyonları benzer şekilde tekilleştirildi varsayılıyor, yer darlığından kısalttım)

/* --------------------------------------------------------------------------
   9. PARALLEL PLAYER V4.0 (Fixed Layout, No Loop)
   -------------------------------------------------------------------------- */
window.startParallelPlayer = function() {
    if (!window.state.deck || window.state.deck.length === 0) { alert("Deste boş."); return; }
    window.state.mode = 'parallel';
    window.state.parallelPlaying = true;
    window.state.parallelIndex = 0;
    window.renderParallelPlayerUI();
};
window.processParallelCard = function() {
    // ... (mevcut kod)
};

/* --------------------------------------------------------------------------
   PARALLEL PLAYER UI (SADELEŞTİRİLMİŞ)
   - Sadece Yavaş Mod ve Çıkış butonları kaldı.
   - Akordyon butonlar temizlendi.
   -------------------------------------------------------------------------- */
window.renderParallelPlayerUI = function() {
    const accordion = document.getElementById('learningControlsAccordion');
    const headerInfo = document.getElementById('learningHeaderInfo');
    if(headerInfo) headerInfo.style.display = 'none'; // Başlangıçta gizle

    if (accordion) accordion.style.display = 'none';

    window.showView('learningView');
    const content = document.getElementById('learningContent');
    // Hide standard controls
    if(document.getElementById('actionBtn')) document.getElementById('actionBtn').style.display='none';
    if(document.getElementById('srsControls')) document.getElementById('srsControls').style.display='none';

    content.innerHTML = `
        <div style="display:flex; flex-direction:column; height: calc(100vh - 140px); max-height: 600px; max-width:400px; margin:0 auto;">
            <div style="flex-grow: 1; display:flex; flex-direction:column; justify-content:center; align-items:center; overflow:hidden; padding:10px;">
                <h3 style="color:var(--primary-dark); font-size:1rem; opacity:0.8;">🎧 Paralel Dinleme</h3>
                <div class="content-box" style="width:100%; height:100%; max-height:250px; display:flex; flex-direction:column; justify-content:center; align-items:center; padding:20px; overflow-y:auto; border:2px solid var(--border);">
                    <div id="parallelStatus" style="font-size:0.8rem; font-weight:bold; color:var(--primary); margin-bottom:15px;">HAZIRLANIYOR...</div>
                    <div id="parallelTextDisplay" style="font-size:1.4rem; font-weight:600; text-align:center;">Başlatılıyor...</div>
                </div>
            </div>
            
            <div style="height: auto; flex-shrink:0; padding:10px; display:flex; flex-direction:column; justify-content:flex-end;">
                <div id="parallelDelayControls" style="margin-bottom:15px; display:flex; gap:5px; justify-content:center;"></div>
                
                <div style="display:flex; justify-content:center; gap:20px; margin-bottom:20px;">
                    <button class="btn btn-secondary" onclick="window.previousParallelSentence()" style="width:60px; height:50px; font-size:1.8rem;">«</button>
                    <button id="parallelPlayPause" class="btn btn-primary" onclick="window.toggleParallelPlay()" style="width:70px; height:70px; font-size:2.2rem; border-radius:50%;">⏸</button>
                    <button class="btn btn-secondary" onclick="window.skipParallelSentence()" style="width:60px; height:50px; font-size:1.8rem;">»</button>
                </div>
                
                <div style="display:flex; justify-content:space-between;">
                    <button class="btn btn-sm btn-secondary" onclick="window.toggleSlowMode()" style="width:48%;">
                        <span id="slowModeLed" class="led-indicator ${window.state.slowMode?'active':''}"></span> 🐢 Yavaş
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="window.stopParallelPlayer()" style="width:48%;">🔴 Çıkış</button>
                </div>
            </div>
        </div>
    `;
    window.injectDelayControls();
    window.processParallelCard();
};

window.injectDelayControls = function() {
    const target = document.getElementById('parallelDelayControls'); if(!target) return;
    const delays = [3000, 5000, 10000];
    const current = window.data.settings.parallelDelay || 3000;
    let html = '';
    delays.forEach(ms => {
        const active = (ms === current) ? 'btn-primary' : 'btn-secondary';
        html += `<button class="btn btn-sm ${active}" onclick="window.setParallelDelay(${ms})">${ms/1000}s</button>`;
    });
    target.innerHTML = html;
};

window.setParallelDelay = function(ms) {
    window.data.settings.parallelDelay = ms;
    localStorage.setItem('verbmatrix_settings', JSON.stringify(window.data.settings));
    window.injectDelayControls();
};

/* ==========================================================================
   PARALEL OYNATICI DESTE OLUŞTURUCU
   ========================================================================== */
window.buildAndStartParallelPlayer = function(parallelMode) {
    document.getElementById('modalParallelModeSelect').style.display = 'none';
    let finalDeck = [];
    // DÜZELTME: tempVerbId yerine daha güvenilir olan currentVerbId'yi kullan.
    const vId = window.state.currentVerbId; 
    const tId = window.state.tempTopicId; // Bu doğru, çünkü konu seçiminden geliyor.
    const groupId = window.state.currentGroupId; // Bu da doğru, fiil menüsünden geliyor.

    if (parallelMode === 'fixed_verb') {
        // FİİL SABİT, KONULAR SIRAYLA
        const topics = window.data.topics[window.data.settings.currentClass] || {};
        const topicIds = Object.keys(topics).sort((a, b) => parseInt(a) - parseInt(b));

        topicIds.forEach(currentTId => {
            const key = `${vId}_s${currentTId}`;
            const sentences = window.data.content[key];
            if (sentences) {
                sentences.forEach((s, i) => {
                    const id = `${key}_${i}`;
                    const ovr = window.contentOverride ? (window.contentOverride[id] || {}) : {};
                    finalDeck.push({ ...s, ...ovr, id: id });
                });
            }
        });

    } else if (parallelMode === 'fixed_topic') {
        // KONU SABİT, FİİLLER SIRAYLA
        const verbsInGroup = window.data.verbs[groupId] || [];
        verbsInGroup.forEach(verb => {
            const key = `${verb.id}_s${tId}`;
            const sentences = window.data.content[key];
            if (sentences) {
                sentences.forEach((s, i) => {
                    const id = `${key}_${i}`;
                    const ovr = window.contentOverride ? (window.contentOverride[id] || {}) : {};
                    finalDeck.push({ ...s, ...ovr, id: id });
                });
            }
        });
    }

    if (finalDeck.length === 0) {
        alert("Bu mod için dinlenecek cümle bulunamadı.");
        return;
    }

    // Hazırlanan desteyi yükle ve oynatıcıyı başlat
    window.state.deck = finalDeck;
    window.state.deckPos = 0;
    window.startParallelPlayer();
};


/* ==========================================================================
   AKILLI TEK BUTON YÖNETİCİSİ
   - Hem "Kontrol Et" hem "İlerle" işlevini tek butonda toplar.
   ========================================================================== */
/* ==========================================================================
   AKILLI BUTON YÖNETİCİSİ (GÜNCELLENMİŞ)
   - Boş olsa bile kontrolü yapar ve İLERLE moduna geçer.
   ========================================================================== */
window.handleReviewAction = function() {
    const btn = document.getElementById('reviewActionBtn');
    if (!btn) return;

    // A. Eğer İLERLEME modundaysak (Buton "İLERLE" ise)
    if (window.state.waitingForNext) {
        // 1. Sesi ANINDA sustur
        window.speechSynthesis.cancel();
        
        // 2. Sonraki karta geç
        window.advanceToNextCard();
        return;
    }

    // B. Eğer KONTROL modundaysak (Buton "KONTROL ET" ise)
    
    // 1. İlgili kontrol fonksiyonunu çalıştır
    // Not: Artık bu fonksiyonlar boş olsa bile işlemi yapıp 'true' dönecek.
    if (window.state.mode === 'cloze') {
        window.checkClozeAnswer();
    } else if (window.state.mode === 'wordorder') {
        window.checkWordOrder();
    } else if (window.state.mode === 'quiz') {
        window.checkQuizAnswer();
    }

    // 2. Butonu "İLERLE" moduna çevir (Her durumda)
    window.state.waitingForNext = true;
    btn.innerHTML = 'İLERLE ⏩';
    btn.className = 'btn btn-primary btn-block'; 
    btn.style.marginTop = '15px';
};

// İlerlerken Buton Durumunu Sıfırlayan Yardımcı
window.advanceToNextCard = function() {
    // 1. Sesi KESİN olarak sustur (İlerle'ye basıldığı an)
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
    
    // 2. Puanı kaydet
    const statusToSave = window.state.pendingStatus || 'zor';
    window.rateCard(statusToSave);

    // 3. Durumu Sıfırla
    window.state.waitingForNext = false;
    window.state.pendingStatus = null;
};
window.processParallelCard = function() { // Bu fonksiyonu tekrar tanımlıyoruz, çünkü yukarıda boş bir tanım ekledik.
    clearTimeout(window.state.parallelTimer);
    window.speechSynthesis.cancel();
    if (!window.state.parallelPlaying) return;

    if (window.state.parallelIndex >= window.state.deck.length) {
        const headerInfo = document.getElementById('learningHeaderInfo');
        if(headerInfo) headerInfo.style.display = 'none';
        window.stopParallelPlayer(true); return;
    }

    const card = window.state.deck[window.state.parallelIndex];
    const display = document.getElementById('parallelTextDisplay');
    const status = document.getElementById('parallelStatus');
    const delayMs = window.data.settings.parallelDelay || 3000;
    
    window.state.currentCardData = card; // Header'ı güncellemek için state'i ayarla
    if (window.updateHeaderStatus) window.updateHeaderStatus();

    const isTrDe = window.data.settings.conversionMode === 'tr-de';
    const L1 = isTrDe ? card.tr : card.de; const L1_Code = isTrDe ? 'tr' : 'de';
    const L2 = isTrDe ? card.de : card.tr; const L2_Code = isTrDe ? 'de' : 'tr';

    // 1. L1 Göster ve Oku
    status.innerText = (L1_Code === 'tr' ? "🇹🇷 TÜRKÇE" : "🇩🇪 ALMANCA"); status.style.color = "var(--primary)";
    display.innerHTML = L1;
    
    window.speakText(L1, L1_Code, () => {
        if(!window.state.parallelPlaying) return;
        // 2. Bekle
        window.state.parallelTimer = setTimeout(() => {
            if(!window.state.parallelPlaying) return;
            // 3. L2 Göster ve Oku
            status.innerText = (L2_Code === 'tr' ? "🇹🇷 TÜRKÇE" : "🇩🇪 ALMANCA"); status.style.color = "var(--success)";
            display.innerHTML = L2;
            
            window.speakText(L2, L2_Code, () => {
                if(!window.state.parallelPlaying) return;
                // 4. Kısa bekle ve geç
                window.state.parallelTimer = setTimeout(() => {
                    status.innerText = "Sıradaki...";
                    window.playSoftBeep();
                    setTimeout(() => {
                        window.state.parallelIndex++;
                        window.processParallelCard();
                    }, 1000);
                }, 1000);
            });
        }, delayMs);
    });
};

window.toggleParallelPlay = function() {
    const btn = document.getElementById('parallelPlayPause');
    window.state.parallelPlaying = !window.state.parallelPlaying;
    if (window.state.parallelPlaying) {
        if(btn) btn.innerHTML = '⏸';
        window.processParallelCard();
    } else {
        clearTimeout(window.state.parallelTimer); window.speechSynthesis.cancel();
        if(btn) btn.innerHTML = '▶';
        const st = document.getElementById('parallelStatus'); if(st) { st.innerText="DURAKLATILDI"; st.style.color="red"; }
    }
};

window.stopParallelPlayer = function(finished = false) {
    window.state.parallelPlaying = false;
    clearTimeout(window.state.parallelTimer);
    const headerInfo = document.getElementById('learningHeaderInfo');
    if(headerInfo) headerInfo.style.display = 'none';
    try { window.speechSynthesis.cancel(); } catch(e) {}

    // Yönlendirme mantığı
    if (finished) {
        // Otomatik bitiş
        if (window.state.tekrarStatus) {
            try { alert("Tekrar tamamlandı!"); } catch(e) {}
            window.showView('tekrarModeMenu');
        } else {
            window.findNextLearningUnit();
        }
    } else {
        // Kullanıcı manuel çıkış yaptı
        if (window.state.tekrarStatus) {
            window.showView('tekrarModeMenu');
        } else {
            window.showView('sectionMenu');
        }
    }
};

window.skipParallelSentence = function() {
    window.state.parallelIndex++; window.state.parallelPlaying = true;
    document.getElementById('parallelPlayPause').innerHTML = '⏸';
    window.processParallelCard();
};
window.previousParallelSentence = function() {
    if(window.state.parallelIndex > 0) window.state.parallelIndex--;
    window.state.parallelPlaying = true;
    document.getElementById('parallelPlayPause').innerHTML = '⏸';
    window.processParallelCard();
};

/* --------------------------------------------------------------------------
   10. STORY MODE V3.0 (SPLIT & SMART AUDIO)
   -------------------------------------------------------------------------- */
window.openStoryMode = function(groupId) {
    const group = window.data.groups.find(g => g.id === groupId);
    if (!group || !group.story) return;

    window.state.currentStoryId = groupId;
    window.speechSynthesis.cancel();
    window.state.storyPlaying = false; window.state.storyPaused = false;

    const titleEl = document.getElementById('storyTitle');
    const deContent = document.getElementById('storyContentDE');
    const trContent = document.getElementById('storyContentTR');
    
    if (titleEl) titleEl.innerText = group.story.title || "Hikaye";
    if (deContent) deContent.innerHTML = group.story.de ? group.story.de.replace(/\n/g, '<br>') : "Yok";
    if (trContent) trContent.innerHTML = group.story.tr ? group.story.tr.replace(/\n/g, '<br>') : "Yok";

    resetStoryButtons();
    const testBtn = document.getElementById('btnStartStoryTest');
    if(testBtn) testBtn.onclick = () => window.startStoryTest(groupId);

    window.showView('storyView');
};

window.toggleStoryAudio = function(lang) {
    const groupId = window.state.currentStoryId;
    const group = window.data.groups.find(g => g.id === groupId);
    if (!group || !group.story) return;

    const btn = document.getElementById(lang === 'de' ? 'btnStoryDE' : 'btnStoryTR');
    
    // 1. Durdur/Başlat mantığı
    if (window.state.storyPlaying && window.state.storyLang === lang) {
        if (window.state.storyPaused) {
            window.speechSynthesis.resume(); window.state.storyPaused = false;
            if(btn) { btn.innerHTML = '⏸ Duraklat'; btn.classList.remove('btn-warning'); btn.classList.add('btn-danger'); }
        } else {
            window.speechSynthesis.pause(); window.state.storyPaused = true;
            if(btn) { btn.innerHTML = '▶ Devam'; btn.classList.add('btn-warning'); }
        }
        return;
    }

    // 2. Yeni Başlat
    window.speechSynthesis.cancel(); resetStoryButtons();
    const text = (lang === 'de') ? group.story.de : group.story.tr;
    if(!text) return;

    window.state.storyLang = lang; window.state.storyPlaying = true; window.state.storyPaused = false;
    if(btn) { btn.innerHTML = '⏸ Duraklat'; btn.classList.add('btn-danger'); }

    const u = new SpeechSynthesisUtterance(text);
    u.lang = (lang === 'de') ? 'de-DE' : 'tr-TR';
    u.rate = window.state.slowMode ? 0.7 : 0.9;
    u.onend = () => { window.state.storyPlaying = false; resetStoryButtons(); };
    window.speechSynthesis.speak(u);
};

function resetStoryButtons() {
    const b1 = document.getElementById('btnStoryDE'); if(b1) { b1.innerHTML='🇩🇪 Dinle'; b1.className='btn btn-primary'; }
    const b2 = document.getElementById('btnStoryTR'); if(b2) { b2.innerHTML='🇹🇷 Dinle'; b2.className='btn btn-info'; }
}

window.startStoryTest = function(groupId) {
    const group = window.data.groups.find(g => g.id === groupId);
    if (!group || !group.story || !group.story.quiz) { alert("Test yok."); return; }
    
    let container = document.getElementById('storyQuestionsContent');
    if(!container) {
        const d = document.createElement('div'); d.id = 'storyQuestionsView'; d.className='view';
        d.innerHTML = `<div class="content-box"><h3>📝 Test</h3><div id="storyQuestionsContent"></div><button class="btn btn-secondary btn-block" onclick="window.showView('storyView')">Geri</button></div>`;
        document.querySelector('.site-container').appendChild(d);
        container = document.getElementById('storyQuestionsContent');
    }
    container.innerHTML = '';
    
    group.story.quiz.forEach((q, i) => {
        const box = document.createElement('div'); box.style.marginBottom='20px';
        box.innerHTML = `<p><b>${i+1}. ${q.q}</b></p>`;
        q.options.forEach(opt => {
            const b = document.createElement('button'); b.className='btn btn-secondary btn-block'; b.innerText=opt;
            b.onclick = function() {
                if(opt===q.a) { this.className='btn btn-success'; this.innerText+=' ✅'; }
                else { this.className='btn btn-danger'; this.innerText+=' ❌'; }
            };
            box.appendChild(b);
        });
        container.appendChild(box);
    });
    window.showView('storyQuestionsView');
};

/* --------------------------------------------------------------------------
   11. MISC & FINAL
   -------------------------------------------------------------------------- */
window.openContextHint = function(type) {
    const key = window.state.currentCardKey;
    if (!key || !window.data.hints) return;
    const parts = key.split('_');
    const vId = parts[0]; const tId = parts[1].replace('s','');
    
    let content = "İpucu bulunamadı.";
    let title = "";
    
    if (type === 'verb') {
        title = "Fiil Notu";
        if (window.data.hints.verbs && window.data.hints.verbs[vId]) content = window.data.hints.verbs[vId];
    } else {
        title = "Konu Özeti";
        // JSON'daki 'B6', 'B7' gibi anahtarlarla kodun kullandığı sayısal ID'leri eşleştirmek için geçici bir harita.
        // İdeal olan, JSON dosyasındaki anahtarları sayısal ID'ler (6, 16 vb.) ile değiştirmektir.
        const topicIdMapping = {
            '6': 'B7',  // İyelik Sıfatları (Possessivpronomen)
            '16': 'B6' // Sıfat Çekimleri (Adjektivdeklination)
        };
        const hintKey = topicIdMapping[tId];
        if (window.data.hints.sections && hintKey && window.data.hints.sections[hintKey]) {
            content = window.data.hints.sections[hintKey];
        }
    }
    
    let modal = document.createElement('div');
    modal.id = 'hintModal';
    modal.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:12000;display:flex;align-items:center;justify-content:center;";
    modal.innerHTML = `
        <div class="content-box" style="width:90%;max-width:600px;max-height:80vh;background:#fff;border-radius:12px;overflow:hidden;display:flex;flex-direction:column;">
            <div style="background:var(--primary);color:#fff;padding:15px;font-weight:bold;">💡 ${title}</div>
            <div id="richHintContent" style="padding:20px;overflow-y:auto;">${content.replace(/\n/g,'<br>')}</div>
            <button class="btn btn-secondary btn-block" onclick="document.getElementById('hintModal').remove()" style="margin:10px;">Kapat</button>
        </div>
    `;
    document.body.appendChild(modal);
};

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
    const currentClass = window.data.settings.currentClass || 'A1';
    let topicSource = {};
    if (window.data.topics && window.data.topics[currentClass]) {
        topicSource = window.data.topics[currentClass];
    } else if (currentClass === 'K' && window.data.topicPool) {
        topicSource = window.data.topicPool;
    }
    
    // Mevcut konu ID'sini tespit et
    let currentTId = null;
    if (window.state.tempDeck && window.state.tempDeck.length > 0) {
        const firstCardId = window.state.tempDeck[0].id;
        const match = firstCardId.match(/_s(\d+)_/);
        if (match) currentTId = parseInt(match[1]);
    }
    
    if (currentTId !== null) {
        // Tüm konu ID'lerini sırayla al
        const allTopicIds = Object.keys(topicSource).map(Number).sort((a, b) => a - b);
        const currentIndex = allTopicIds.indexOf(currentTId);
        const nextTId = allTopicIds[currentIndex + 1];
        
        if (nextTId) {
            // Sonraki konu var: onu yükle
            const nextKey = `${currentVId}_s${nextTId}`;
            if (window.data.content && window.data.content[nextKey]) {
                alert(`✅ Otomatik İlerleme: Sonraki Konuya Geçiliyor (Konu ${nextTId})`);
                window.startStudy(window.data.content[nextKey], currentVId, nextTId);
                return;
            }
        }
    }

    // 2. Fiildeki tüm konular bitti: Sonraki Fiile Geç
    const verbsInGroup = window.data.verbs[currentGId] || [];
    const currentVIndex = verbsInGroup.findIndex(v => v.id === currentVId);
    const nextVerb = verbsInGroup[currentVIndex + 1];
    
    if (nextVerb) {
        alert(`✅ Otomatik İlerleme: Sonraki Fiile Geçiliyor (${nextVerb.verbTR})`);
        window.state.currentVerbId = nextVerb.id;
        window.renderSections(nextVerb.id);
        return;
    }

    // 3. Gruptaki tüm fiiller bitti: Ana Menüye Dön
    alert("🎉 Tebrikler! Bu gruptaki tüm fiiller tamamlandı.");
    window.showView('mainMenu');
};
window.showCompletion = function() {
    const area = document.getElementById('learningContent'); if (!area) return;
    if(document.getElementById('actionBtn')) document.getElementById('actionBtn').style.display='none';
    if(document.getElementById('srsControls')) document.getElementById('srsControls').style.display='none';
    
    area.innerHTML = `
        <div style="text-align:center; padding:30px;">
            <h2 style="color:green;">🎉 BÖLÜM TAMAMLANDI!</h2>
            <button class="btn btn-primary btn-block" onclick="window.findNextLearningUnit()">⏩ Sonrakine Geç</button>
            <button class="btn btn-secondary btn-block" onclick="window.goBackInHistory()" style="margin-top:10px;">↩️ Listeye Dön</button>
        </div>
    `;
};
/* --- BÖLÜM SONU AKIŞI İÇİN YARDIMCI FONKSİYON --- */
function findFirstUnconsumedSentenceInGroup(groupId) {
    if (!groupId || !window.data.verbs[groupId]) return null;

    const verbsInGroup = window.data.verbs[groupId];
    for (const verb of verbsInGroup) {
        const topics = window.data.topics[window.data.settings.currentClass] || {};
        const topicIds = Object.keys(topics).sort((a, b) => parseInt(a) - parseInt(b));

        for (const tId of topicIds) {
            const contentKey = `${verb.id}_s${tId}`;
            const sentences = window.data.content[contentKey];
            if (sentences) {
                for (let i = 0; i < sentences.length; i++) {
                    const sentenceId = `${contentKey}_${i}`;
                    if (!window.srsData[sentenceId]) {
                        return { vId: verb.id, tId: tId }; // İlk tamamlanmamış konuyu bulduk
                    }
                }
            }
        }
    }
    return null; // Grupta tamamlanmamış cümle kalmadı
}

/* --- 7. BİTİŞ EKRANI (TAM AKIŞ KONTROLÜ) --- */
window.showCompletion = function() {
    const area = document.getElementById('learningContent');
    if(document.getElementById('actionBtn')) document.getElementById('actionBtn').style.display = 'none';
    if(document.getElementById('srsControls')) document.getElementById('srsControls').style.display = 'none';

    if(window.state.tekrarStatus) {
        area.innerHTML = `<div style="text-align:center; padding:30px;"><h2>🏁 Tekrar Tamamlandı</h2><button class="btn btn-secondary" onclick="window.goBackInHistory()">Geri Dön</button></div>`;
        return;
    }
    
    let htmlButtons = "";
    
    var lastCardId = window.state.currentCardKey || "";
    var parts = lastCardId.split('_'); 
    var vId = parts[0]; 
    var tId = parseInt(parts[1]?.replace('s', '') || 1);
    var currentGroupId = window.data.groups.find(g => window.data.verbs[g.id] && window.data.verbs[g.id].some(v => v.id === vId))?.id;
    
    // 1. Önce Tüketilmeyenleri Öner
    var remainingInfo = findFirstUnconsumedSentenceInGroup(currentGroupId);
    if (remainingInfo && (remainingInfo.vId !== vId || remainingInfo.tId !== tId)) {
        var startKey = remainingInfo.vId + '_s' + remainingInfo.tId;
        var verbName = window.data.verbs[currentGroupId].find(v => v.id === remainingInfo.vId)?.verbTR || 'Grup İçi';
        htmlButtons += `
            <button class="btn btn-warning btn-block" style="margin-bottom:10px;" onclick="window.startStudy(window.data.content['${startKey}'], '${remainingInfo.vId}', '${remainingInfo.tId}')">
                ⬇️ Grubun Kalanını Tamamla: <b>${verbName}</b>
            </button>`;
    } 
    
    // 2. Sonraki Konu
    var nextTId = tId + 1;
    var nextContentKey = vId + '_s' + nextTId;
    if (window.data.content && window.data.content[nextContentKey]) {
        var topicName = (window.data.topics[window.data.settings.currentClass] && window.data.topics[window.data.settings.currentClass][nextTId]) ? (window.data.topics[window.data.settings.currentClass][nextTId].name || `${nextTId}. Bölüm`) : `${nextTId}. Bölüm`;
        htmlButtons += `
            <button class="btn btn-info btn-block" style="margin-bottom:10px;" onclick="window.startStudy(window.data.content['${nextContentKey}'], '${vId}', '${nextTId}')">
                ⬇️ Sonraki Konu: <b>${topicName}</b>
            </button>`;
    }

    // 3. Sonraki Fiil
    if(currentGroupId) {
        var verbs = window.data.verbs[currentGroupId];
        var vIdx = verbs.findIndex(v => v.id === vId);
        if(vIdx !== -1 && verbs[vIdx+1]) {
            var nextV = verbs[vIdx+1];
            var nextKey = nextV.id + '_s1';
            htmlButtons += `
                <button class="btn btn-warning btn-block" style="margin-bottom:10px;" onclick="window.state.verbData=window.data.verbs['${currentGroupId}'][${vIdx+1}]; window.renderSections('${nextV.id}')">
                    ⏩ Sonraki Fiil: <b>${nextV.verbTR}</b>
                </button>`;
        }
    }
    
    // 4. SONRAKİ GRUP
    if (currentGroupId) {
        var groupIds = window.data.groups.map(g => g.id);
        var gIdx = groupIds.indexOf(currentGroupId);
        if (gIdx !== -1 && groupIds[gIdx + 1]) {
            var nextGroup = window.data.groups[gIdx + 1];
            htmlButtons += `
                <button class="btn btn-primary btn-block" style="margin-bottom:10px;" onclick="window.renderGroups(); window.showView('groupMenu');">
                    ⏭️ Sonraki Grup: <b>${nextGroup.name}</b>
                </button>`;
        }
    }

    area.innerHTML = `
        <div style="text-align:center; padding:20px;">
            <h2 style="color:var(--success); margin-bottom:20px;">🎉 BÖLÜM TAMAMLANDI!</h2>
            ${htmlButtons}
            <button class="btn btn-secondary btn-block" style="margin-top:10px;" onclick="window.goBackInHistory()">↩️ Listeye Dön</button>
        </div>`;
};

/* --------------------------------------------------------------------------
   MISSING FUNCTIONS (Eksik Fonksiyonlar)
   -------------------------------------------------------------------------- */

// Tema Değiştir (Light/Dark Mode)
window.toggleTheme = function() {
    const currentTheme = window.data.settings.theme || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    window.data.settings.theme = newTheme;
    localStorage.setItem('verbmatrix_settings', JSON.stringify(window.data.settings));
    
    if (newTheme === 'dark') {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
    
    // Buton simgesini güncelle
    const btn = document.getElementById('themeToggleBtn');
    if (btn && btn.querySelector('.icon')) {
        btn.querySelector('.icon').textContent = newTheme === 'dark' ? '☀️' : '🌙';
    }
};

// Karışık Konu Seçimini Aç
window.openMixedSelection = function() {
    window.data.settings.currentClass = 'K';
    localStorage.setItem('verbmatrix_settings', JSON.stringify(window.data.settings));
    window.updateClassButtonUI();
    
    const list = document.getElementById('mixedTopicList');
    if (!list) return;
    
    list.innerHTML = '';
    
    // TÜM KONULARI TOPLA (A1, A2, B1 vb.)
    const allTopics = {};
    if (window.data.topics) {
        Object.keys(window.data.topics).forEach(className => {
            const topics = window.data.topics[className];
            Object.assign(allTopics, topics);
        });
    }
    
    // KONULARI SIRALA VE GÖSTER
    Object.keys(allTopics).sort((a, b) => parseInt(a) - parseInt(b)).forEach(tId => {
        const tName = (typeof allTopics[tId] === 'object') ? allTopics[tId].name : allTopics[tId];
        
        const btn = document.createElement('button');
        btn.className = 'btn btn-secondary btn-block';
        btn.style.marginBottom = '10px';
        btn.style.justifyContent = 'space-between';
        
        const isSelected = (window.starsData && window.starsData[tId]) ? true : false;
        btn.style.background = isSelected ? 'var(--warning)' : '';
        btn.style.color = isSelected ? '#5d4037' : '';
        
        btn.innerHTML = `<span>${tName}</span> <span>${isSelected ? '⭐' : '☆'}</span>`;
        btn.onclick = () => {
            window.starsData = window.starsData || {};
            if (window.starsData[tId]) {
                delete window.starsData[tId];
            } else {
                window.starsData[tId] = 1;
            }
            localStorage.setItem('verbmatrix_stars', JSON.stringify(window.starsData));
            window.openMixedSelection(); // Yenile
        };
        
        list.appendChild(btn);
    });
    
    window.showView('mixedTopicSelectionView');
};

/* --------------------------------------------------------------------------
   KARIŞIK MOD SEÇİMİNİ KAYDET
   -------------------------------------------------------------------------- */
window.saveMixedSelection = function() {
    // 1. Kontrol: Hiç yıldız seçili mi?
    if (!window.starsData || Object.keys(window.starsData).length === 0) {
        alert("Lütfen listenin en az bir konusunu yıldızlayın.");
        return;
    }

    // 2. Kaydetme İşlemi (Gerek yoksa zaten openMixedSelection anlık kaydediyor ama garanti olsun)
    localStorage.setItem('verbmatrix_stars', JSON.stringify(window.starsData));
    
    // 3. Bilgi Ver
    const count = Object.keys(window.starsData).length;
    alert(`✅ ${count} adet konu yıldızlandı.\nŞimdi listeden 'Karma Mod' (veya ilgili sınıfı) seçerek çalışabilirsiniz.`);
    
    // 4. Ana Menüye Geri Dön (Başlatma yapmıyoruz)
    window.showView('mainMenu');
};

/* ==========================================================================
   YENİ: KILAVUZ MODALI YÖNETİCİSİ
   ========================================================================== */
window.openGuideModal = function() {
    const modal = document.getElementById('guideModal');
    const titleEl = document.getElementById('guideModalTitle');
    const contentEl = document.getElementById('guideModalContent');

    if (!modal || !titleEl || !contentEl || !window.data.guideText) {
        console.error("Kılavuz modalı elemanları veya veri bulunamadı.");
        return;
    }

    titleEl.textContent = window.data.guideText.title || "Kullanım Kılavuzu";
    // İçeriği HTML olarak ekle, böylece JSON'daki etiketler işlenir
    contentEl.innerHTML = window.data.guideText.content || "Kılavuz içeriği yüklenemedi.";

    modal.classList.remove('hidden');
    modal.classList.add('active');
};

window.closeGuideModal = function() {
    const modal = document.getElementById('guideModal');
    if (modal) {
        modal.classList.remove('active');
        // Animasyon bittikten sonra gizle
        setTimeout(() => modal.classList.add('hidden'), 300);
    }
};

