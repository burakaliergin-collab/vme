/* ==========================================================================
   VERB MATRIX v6.3 - GROUP TRANSITION FIX
   ========================================================================== */

window.data = { 
    settings: { theme: 'light', conversionMode: 'tr-de', currentClass: 'A1' },
    content: {}, classes: [], groups: [], topics: {}, verbs: {} 
}; 
window.state = { 
    history: ['mainMenu'], deck: [], deckPos: 0, mode: 'study', autoPlayAudio: true, slowMode: false,
    currentCardKey: null, activeLearningPanel: null, tekrarStatus: null, 
    currentVerbId: null, wordSelected: [], correctAnswer: '',
    deferredPrompt: null,
    parallel: { queue: [], index: 0, isPlaying: false, timer: null },
    speechSynthesisAvailable: ('speechSynthesis' in window)
};

/* --- 1. BAŞLATMA --- */
window.init = async function() {
    const storedSettings = localStorage.getItem('verbmatrix_settings');
    if (storedSettings) window.data.settings = JSON.parse(storedSettings);

    try {
        window.srsData = JSON.parse(localStorage.getItem('verbmatrix_srs_data_v3') || '{}');
        window.contentOverride = JSON.parse(localStorage.getItem('verbmatrix_content_override') || '{}');
        window.starsData = JSON.parse(localStorage.getItem('verbmatrix_stars') || '{}');
        
        const savedData = localStorage.getItem('verbmatrix_full_data');
        if (savedData) {
            window.data = { ...window.data, ...JSON.parse(savedData) };
        } else {
            try {
                const response = await fetch('verbmatrix_data.json');
                if(response.ok) { window.data = { ...window.data, ...await response.json() }; }
            } catch(err) { console.log("Varsayılan veri dosyası bulunamadı."); }
        }
    } catch (e) { console.error("Veri hatası:", e); window.srsData={}; }

    window.updateSRSCounts();
    window.updateTotalProgress(); 
    window.renderClassSelection(); 
    window.updateClassButtonUI();
    window.updateLanguageToggleUI();
    window.checkPWAStatus(); 
    if(window.data.settings.theme === 'dark') document.body.classList.add('dark-mode');
    
    const logo = document.getElementById('appLogo');
    if(logo) logo.style.display = 'inline-block';
};
document.addEventListener('DOMContentLoaded', window.init);


/* --- 2. TEKRAR MODU (SRS) --- */
window.startTekrar = function(status) {
    window.state.tekrarStatus = status;
    const srsKeys = Object.keys(window.srsData || {}).filter(key => window.srsData[key].status === status);
    
    if (srsKeys.length === 0) { alert(`'${status.toUpperCase()}' havuzunda cümle yok.`); return; }

    const deck = [];
    Object.keys(window.data.content).forEach(k => {
        window.data.content[k].forEach((s, i) => { 
            const id = `${k}_${i}`; 
            if (srsKeys.includes(id)) deck.push({ ...s, id: id }); 
        });
    });
    
    window.state.deck = deck;
    if (window.state.deck.length === 0) { alert("Havuzda ID var ama içerik bulunamadı."); return; }
    
    window.showView('tekrarModeMenu');
};


/* --- 3. ÇALIŞMA MODU (Study) --- */
window.selectStudyMode = function(mode) { 
    window.state.mode = mode; 
    window.state.tekrarStatus = null; 
    window.showView('groupMenu'); 
    window.renderGroups(); 
};

window.renderGroups = function() {
    const list = document.getElementById('groupList'); list.innerHTML = '';
    const groups = window.data.groups || [];
    
    groups.forEach(g => {
        const wrapper = document.createElement('div'); wrapper.style.display = 'flex'; wrapper.style.gap = '8px'; wrapper.style.marginBottom = '10px';
        const btn = document.createElement('button'); btn.className = 'btn btn-secondary'; btn.style.textAlign = 'left'; btn.style.flexGrow = '1';
        btn.innerHTML = `<span><b>${g.name}</b><br><small>${g.nameDE || ''}</small></span> 👉`;
        btn.onclick = () => window.renderVerbs(g.id); 
        wrapper.appendChild(btn);
        
        if (window.state.mode === 'standard' && g.story && g.story.title) {
            const storyBtn = document.createElement('button'); storyBtn.className = 'btn btn-warning'; storyBtn.style.width = '60px'; storyBtn.style.fontSize = '1.2rem';
            storyBtn.innerHTML = '📖'; 
            storyBtn.onclick = () => window.showStory(g.id); 
            wrapper.appendChild(storyBtn);
        }
        list.appendChild(wrapper);
    });
};

window.showStory = function(groupId) {
    const group = window.data.groups.find(g => g.id === groupId);
    if (!group || !group.story) return;
    
    document.getElementById('storyTitle').innerText = group.story.title;
    document.getElementById('storyContent').innerText = group.story.text || "Hikaye içeriği bulunamadı.";
    window.state.currentStoryText = group.story.text; 
    window.showView('storyView');
};
window.playStoryAudio = function() {
    if(window.state.currentStoryText) window.speakText(window.state.currentStoryText, 'de');
};


window.renderVerbs = function(groupId) {
    const list = document.getElementById('verbList'); list.innerHTML = '';
    const verbs = window.data.verbs ? window.data.verbs[groupId] : [];
    
    verbs.forEach(v => {
        const btn = document.createElement('button'); btn.className = 'btn btn-secondary btn-block'; btn.style.marginBottom = '10px'; btn.style.textAlign = 'left';
        btn.innerHTML = `<b>${v.verbTR}</b> <small>(${v.verbDE})</small>`;
        btn.onclick = () => { 
            window.state.verbData = v; 
            if (window.state.mode === 'parallel') window.prepareParallelMenu(v);
            else window.renderSections(v.id); 
        };
        list.appendChild(btn);
    });
    window.showView('verbMenu');
};

/* --- DÜZENLEME (EDIT) FONKSİYONLARI --- */

// Edit butonuna basınca açılacak panel fonksiyonu (Mevcut toggleLearningPanel içine entegre çalışır)
// HTML tarafında panelEdit içine şu yapıyı koyman gerek, ya da dinamik oluşturuyorum:

window.openEditPanel = function() {
    const card = window.state.currentCardData;
    if(!card) return;

    // Paneli görünür yap
    window.toggleLearningPanel('panelEdit');

    const panel = document.getElementById('panelEdit');
    
    // Panel içini dinamik doldur (Senin HTML'inde boş olabilir)
    panel.innerHTML = `
        <h4 style="margin-top:0;">Kartı Düzenle</h4>
        <label>Almanca:</label>
        <input id="editInputDE" class="input-field" value="${card.de}">
        
        <label>Türkçe:</label>
        <input id="editInputTR" class="input-field" value="${card.tr}">
        
        <div style="margin-top:10px; display:flex; gap:5px;">
            <button class="btn btn-success" onclick="window.saveCurrentCardEdit()">Kaydet</button>
            <button class="btn btn-secondary" onclick="window.toggleLearningPanel(null)">İptal</button>
        </div>
    `;
};

// Edit butonuna onclick="window.openEditPanel()" verilmeli.
// Eğer HTML'de buton id="btnEditCard" ise, init fonksiyonunda event listener ekleyelim:
// (Bunu init fonksiyonunun sonuna ekle veya manuel çalıştır)
document.addEventListener('click', function(e){
    if(e.target && e.target.id == 'btnEditCard'){
        window.openEditPanel();
    }
});


window.saveCurrentCardEdit = function() {
    const newDE = document.getElementById('editInputDE').value;
    const newTR = document.getElementById('editInputTR').value;
    const cardId = window.state.currentCardKey;

    if(!cardId) return;

    // 1. Ana veriyi güncelle (RAM)
    // Content içindeki referansı bulmamız lazım. ID üzerinden override yapalım.
    if(!window.contentOverride) window.contentOverride = {};
    
    window.contentOverride[cardId] = {
        de: newDE,
        tr: newTR
    };

    // 2. LocalStorage'a kaydet (Kalıcılık)
    localStorage.setItem('verbmatrix_content_override', JSON.stringify(window.contentOverride));

    // 3. Mevcut kart verisini güncelle
    window.state.currentCardData.de = newDE;
    window.state.currentCardData.tr = newTR;

    alert("✅ Değişiklikler kaydedildi!");
    window.toggleLearningPanel(null);

    // 4. Ekranı yenile
    if(window.state.mode === 'cloze') window.renderClozeCard();
    else if(window.state.mode === 'quiz') window.renderQuizCard();
    else window.renderSentence();
};
/* --- 4. ORTAK MOTOR --- */
window.startQuizMode = function(mode) {
    window.state.mode = mode;
    window.state.deckPos = 0;

    if (!window.state.deck || window.state.deck.length === 0) {
        alert("Çalışılacak kart bulunamadı."); return;
    }

    if (mode === 'parallel') {
        const queue = window.state.deck.map(c => ({ ...c, title: `${window.state.tekrarStatus ? window.state.tekrarStatus.toUpperCase() : 'Çalışma'} Listesi` }));
        window.state.parallel.queue = queue; 
        window.state.parallel.index = 0; 
        window.state.parallel.isPlaying = true;
        window.showView('parallelPlayerView'); 
        window.playParallelLoop();
        return;
    }

    window.showView('learningView');
    
    document.getElementById('learningContent').classList.remove('hidden');
    document.getElementById('wordOrderArea').classList.add('hidden');
    document.getElementById('actionBtn').classList.remove('hidden');
    document.getElementById('quizResultArea').classList.add('hidden');
    document.getElementById('clozeResultArea').classList.add('hidden');
    document.getElementById('learningControlsArea').classList.remove('hidden');
    
    const editBtn = document.getElementById('btnEditCard');
    if(editBtn) editBtn.style.display = 'none';

    if (mode === 'wordorder') {
        document.getElementById('learningContent').classList.add('hidden');
        document.getElementById('wordOrderArea').classList.remove('hidden');
        document.getElementById('actionBtn').classList.add('hidden'); 
        window.renderWordOrderCard();
    } 
    else if (mode === 'quiz') window.renderQuizCard();
    else if (mode === 'cloze') window.renderClozeCard();
};


/* --- 5. PARALEL DİNLEME --- */
window.prepareParallelMenu = function(verbData) {
    let fullQueue = [];
    const currentClass = window.data.settings.currentClass || "A1";
    let topics = window.data.topics[currentClass] || {};
    if (currentClass === 'MIXED') topics = window.data.topicPool || {};

    Object.keys(topics).sort((a,b)=>parseInt(a)-parseInt(b)).forEach(tId => {
        const contentKey = `${verbData.id}_s${tId}`;
        const sentences = window.data.content[contentKey];
        if(sentences && sentences.length > 0) {
            const labelledSentences = sentences.map(s => ({ ...s, title: `${verbData.verbTR} - Konu ${tId}` }));
            fullQueue = fullQueue.concat(labelledSentences);
        }
    });

    if (fullQueue.length === 0) { alert("Bu fiil için içerik yok."); return; }

    window.state.parallel.queue = fullQueue;
    window.state.parallel.index = 0;
    window.state.parallel.isPlaying = true;
    window.showView('parallelPlayerView');
    window.playParallelLoop();
};

window.playParallelLoop = function() {
    if(!window.state.parallel.isPlaying) return;
    const q = window.state.parallel.queue;
    if (window.state.parallel.index >= q.length) window.state.parallel.index = 0;
    
    const item = q[window.state.parallel.index];
    const isTrDe = window.data.settings.conversionMode === 'tr-de';
    
    const displayArea = document.getElementById('parallelPlayerView');
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

    window.speakText(isTrDe ? item.tr : item.de, isTrDe ? 'tr' : 'de', () => {
        if(!window.state.parallel.isPlaying) return;
        setTimeout(() => {
            document.getElementById('pp_lang2').innerText = isTrDe ? item.de : item.tr;
            window.speakText(isTrDe ? item.de : item.tr, isTrDe ? 'de' : 'tr', () => {
                if(!window.state.parallel.isPlaying) return;
                setTimeout(() => { window.state.parallel.index++; window.playParallelLoop(); }, 1500);
            });
        }, 800);
    });
};
window.controlParallel = function(action) {
    if(action === 'toggle') { window.state.parallel.isPlaying = !window.state.parallel.isPlaying; if(window.state.parallel.isPlaying) window.playParallelLoop(); else window.speechSynthesis.cancel(); }
    if(action === 'next') { window.speechSynthesis.cancel(); window.state.parallel.index++; window.state.parallel.isPlaying = true; window.playParallelLoop(); }
    if(action === 'prev') { window.speechSynthesis.cancel(); if(window.state.parallel.index > 0) window.state.parallel.index--; window.state.parallel.isPlaying = true; window.playParallelLoop(); }
};
window.stopParallelAndExit = function() { window.state.parallel.isPlaying = false; window.speechSynthesis.cancel(); window.goBackInHistory(); };









window.addWord = function(i) { window.state.wordSelected.push(window.state.wordPool.splice(i,1)[0]); window.renderWordOrder(); };
window.removeWord = function(i) { window.state.wordPool.push(window.state.wordSelected.splice(i,1)[0]); window.renderWordOrder(); };







/* --- 7. BİTİŞ EKRANI (TAM AKIŞ KONTROLÜ) --- */
window.showCompletion = function() {
    const area = document.getElementById('learningContent');
    document.getElementById('actionBtn').style.display = 'none';
    document.getElementById('srsControls').style.display = 'none';

    if(window.state.tekrarStatus) {
        area.innerHTML = `<div style="text-align:center; padding:30px;"><h2>🏁 Tekrar Tamamlandı</h2><button class="btn btn-secondary" onclick="window.goBackInHistory()">Geri Dön</button></div>`;
        return;
    }
    
    let htmlButtons = "";
    
    var lastCardId = window.state.currentCardKey || "";
    var parts = lastCardId.split('_'); 
    var vId = parts[0]; var tId = parseInt(parts[1]?.replace('s', '') || 1);
    var currentGroupId = window.data.groups.find(g => window.data.verbs[g.id] && window.data.verbs[g.id].some(v => v.id === vId))?.id;
    var remainingInfo = findFirstUnconsumedSentenceInGroup(currentGroupId);

    // 1. Önce Tüketilmeyenleri Öner
    if (remainingInfo) {
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
        var topicName = (window.data.topicPool && window.data.topicPool[nextTId]) ? window.data.topicPool[nextTId] : (nextTId + ". Bölüm");
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
                <button class="btn btn-warning btn-block" style="margin-bottom:10px;" onclick="window.state.verbData=window.data.verbs['${currentGroupId}'][${vIdx+1}]; window.startStudy(window.data.content['${nextKey}'] || [], '${nextV.id}', '1')">
                    ⏩ Sonraki Fiil: <b>${nextV.verbTR}</b>
                </button>`;
        }
    }
    
    // 4. SONRAKİ GRUP (Yeni Eklenti: Eğer fiil veya konu kalmadıysa)
    if (currentGroupId) {
        var groupIds = window.data.groups.map(g => g.id);
        var gIdx = groupIds.indexOf(currentGroupId);
        if (gIdx !== -1 && groupIds[gIdx + 1]) {
            var nextGroup = window.data.groups[gIdx + 1];
            // Eğer "Sonraki Fiil" ve "Sonraki Konu" butonu yoksa, Sonraki Grup'u öner.
            // Ama kullanıcı isterse her zaman görsün diyorsanız if şartını kaldırabilirsiniz.
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
        </div>`;
};

function findFirstUnconsumedSentenceInGroup(currentGroupId) {
    if(!currentGroupId) return null;
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
}


/* --- 8. YARDIMCILAR --- */
window.handleAction = function() {
    if (window.state.mode === 'study') {
         document.getElementById('answerArea').classList.remove('hidden');
         if (window.data.settings.conversionMode === 'tr-de') window.playCurrentSentence('de');
         if (!window.state.tekrarStatus) { 
             document.getElementById('actionBtn').style.display = 'none';
             document.getElementById('srsControls').classList.remove('hidden');
             document.getElementById('srsControls').style.display = 'grid'; 
         } else { window.state.deckPos++; window.renderSentence(); }
    } else if (window.state.mode === 'quiz') window.checkQuizAnswer();
    else if (window.state.mode === 'cloze') window.checkClozeAnswer();
};
window.renderSections = function(verbId) {
    const list = document.getElementById('sectionList'); list.innerHTML = '';
    window.state.currentVerbId = verbId;
    const currentClass = window.data.settings.currentClass || "A1";
    let topicSource = window.data.topics[currentClass] || {};
    if (currentClass === 'MIXED') topicSource = window.data.topicPool || {};
    Object.keys(topicSource).sort((a,b)=>parseInt(a)-parseInt(b)).forEach(tId => {
        const tName = typeof topicSource[tId] === 'object' ? topicSource[tId].name : topicSource[tId];
        if (currentClass === 'MIXED' && (!window.starsData[tId] || window.starsData[tId] === 0)) return;
        const key = `${verbId}_s${tId}`;
        const sentences = window.data.content ? window.data.content[key] : null;
        if (sentences && sentences.length > 0) {
            let completedCount = 0; sentences.forEach((s, idx) => { if (window.srsData[`${key}_${idx}`]) completedCount++; });
            const total = sentences.length; const isFinished = completedCount === total;
            let btnClass = isFinished ? 'btn-success' : (completedCount > 0 ? 'btn-info' : 'btn-secondary');
            const row = document.createElement('button'); row.className = `btn ${btnClass} btn-block`;
            row.style.justifyContent = 'space-between'; row.style.textAlign = 'left';
            row.innerHTML = `<div><div style="font-size:0.8rem; opacity:0.8">Konu ${tId}</div><div style="font-size:1.1rem; font-weight:bold;">${tName}</div></div><div style="font-size:0.85rem; font-weight:700; min-width:80px; text-align:right;">${isFinished ? '✅ TAMAM' : `⏳ ${completedCount} / ${total}`}</div>`;
            row.onclick = () => window.startStudy(sentences, verbId, tId); list.appendChild(row);
        }
    });
    window.showView('sectionMenu');
};
window.startStudy = function(sentences, vId, tId) {
    if(!sentences) { alert("Bu bölüm için içerik bulunamadı."); return; }
    const allCards = sentences.map((s, i) => { const id = `${vId}_s${tId}_${i}`; const ovr = window.contentOverride[id] || {}; return { ...s, ...ovr, id: id }; });
    const newCards = allCards.filter(card => !window.srsData[card.id]);
    if (newCards.length === 0) { alert("🎉 Bu konudaki tüm cümleler tamamlandı."); return; }
    window.state.deck = newCards; window.state.deckPos = 0; window.state.mode = 'study'; window.state.tekrarStatus = null;
    window.showView('learningView'); window.renderSentence();
};
window.renderSentence = function() {
    if (!window.state.deck || window.state.deckPos >= window.state.deck.length) { window.showCompletion(); return; }
    const card = window.state.deck[window.state.deckPos]; window.state.currentCardData = card; window.state.currentCardKey = card.id;
    document.getElementById('wordOrderArea').classList.add('hidden');
    document.getElementById('learningContent').classList.remove('hidden');
    document.getElementById('quizResultArea').classList.add('hidden'); document.getElementById('clozeResultArea').classList.add('hidden');
    document.getElementById('srsControls').classList.add('hidden'); document.getElementById('srsControls').style.display = 'none';
    const actBtn = document.getElementById('actionBtn'); actBtn.style.display = 'block'; actBtn.textContent = 'GÖSTER'; actBtn.onclick = window.handleAction;
    const isTrDe = window.data.settings.conversionMode === 'tr-de';
    let html = `<div class="sentence"><strong>${isTrDe?'TR':'DE'}:</strong> ${isTrDe?card.tr:card.de}</div>`;
    html += `<div id="answerArea" class="sentence hidden" style="color:var(--primary); margin-top:20px;"><strong>${isTrDe?'DE':'TR'}:</strong> ${isTrDe?card.de:card.tr}</div>`;
    document.getElementById('learningContent').innerHTML = html;
    document.getElementById('learnProgressText').textContent = `${window.state.deckPos + 1} / ${window.state.deck.length}`;
    document.getElementById('progressBar').style.width = ((window.state.deckPos + 1) / window.state.deck.length * 100) + '%';
    document.getElementById('learningControlsArea').classList.remove('hidden');
    const editBtn = document.getElementById('btnEditCard'); if(editBtn) editBtn.style.display = window.state.tekrarStatus ? 'none' : 'block';
    if (window.state.autoPlayAudio && window.data.settings.conversionMode !== 'tr-de') setTimeout(() => window.playCurrentSentence('de'), 300);
    window.toggleLearningPanel(null);
};
window.playCurrentSentence = function(lang) { if(!window.state.currentCardData) return; const text = (lang === 'de' ? window.state.currentCardData.de : window.state.currentCardData.tr); window.speakText(text, lang); };
window.speakText = function(text, lang, cb) { const u = new SpeechSynthesisUtterance(text); u.lang = lang === 'de' ? 'de-DE' : 'tr-TR'; u.rate = window.state.slowMode ? 0.7 : 0.9; u.onend = cb; u.onerror = cb; window.speechSynthesis.speak(u); };
window.rateCard = function(status) {
    if (!window.state.currentCardKey) return;
    
    // SRS verisini kaydet
    window.srsData[window.state.currentCardKey] = { status: status, date: Date.now() };
    localStorage.setItem('verbmatrix_srs_data_v3', JSON.stringify(window.srsData));
    window.updateSRSCounts();
    
    // İlerle
    window.state.deckPos++;
    
    // Hangi moddaysak o render fonksiyonunu çağır!
    if (window.state.mode === 'cloze') {
        window.renderClozeCard();
    } else if (window.state.mode === 'quiz') {
        window.renderQuizCard();
    } else if (window.state.mode === 'wordorder') {
        window.renderWordOrderCard();
    } else {
        window.renderSentence(); // Varsayılan (Study)
    }
};window.handleImport = function(event) { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = function(e) { try { const json = JSON.parse(e.target.result); if (json.verbs || json.content) window.data = { ...window.data, ...json }; if (json.srs) window.srsData = json.srs; localStorage.setItem('verbmatrix_full_data', JSON.stringify(window.data)); localStorage.setItem('verbmatrix_srs_data_v3', JSON.stringify(window.srsData)); alert("✅ Veriler yüklendi!"); window.location.reload(); } catch (err) { alert("Hata: Dosya bozuk."); } }; reader.readAsText(file); };
window.exportData = function() { const exportObj = { srs: window.srsData, stars: window.starsData, settings: window.data.settings }; const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj)); const a = document.createElement('a'); a.href = dataStr; a.download = "verbmatrix_yedek.json"; document.body.appendChild(a); a.click(); a.remove(); };
window.resetProgress = function() { if(confirm("TÜM İLERLEME SİLİNECEK!")) { localStorage.removeItem('verbmatrix_srs_data_v3'); location.reload(); }};
window.forceUpdateApp = function() { localStorage.removeItem('verbmatrix_full_data'); location.reload(); };
window.updateTotalProgress = function() { let learned = 0; Object.values(window.srsData).forEach(i => { if(i.status === 'ogrendim') learned++; }); let total = 0; if(window.data.content) Object.values(window.data.content).forEach(arr => total += arr.length); if(total===0) total=1; const percent = Math.round((learned/total)*100); const bar = document.getElementById('totalProgressBar'); const txt = document.getElementById('totalProgressText'); if(bar) bar.style.width=percent+"%"; if(txt) txt.textContent=`${learned} / ${total} (%${percent})`; };
window.checkPWAStatus = function() { if(/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream && !navigator.standalone) document.getElementById('iosInstallInfo').classList.remove('hidden'); };
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.state.deferredPrompt = e; document.getElementById('installAppBtn').classList.remove('hidden'); });
window.installPWA = async function() { if(window.state.deferredPrompt) { window.state.deferredPrompt.prompt(); window.state.deferredPrompt=null; }};
window.updateSRSCounts = function() { const c={zor:0,normal:0,ogrendim:0}; Object.values(window.srsData).forEach(i=>c[i.status]++); ['zor','normal','ogrendim'].forEach(k=>{const el=document.getElementById('tekrarCount'+k.charAt(0).toUpperCase()+k.slice(1)); if(el) el.innerText=c[k];});};
window.toggleMusic=function(){const m=document.getElementById('bgMusic');if(m.paused)m.play();else m.pause();};
window.toggleLearningPanel=function(id){['panelHint','panelListen','panelEdit'].forEach(p=>document.getElementById(p).classList.add('hidden'));if(id)document.getElementById(id).classList.remove('hidden');};
window.showSpecificHint=function(t){document.getElementById('hintTextDisplay').innerText=`İpucu (${t}): ...`;};
window.toggleAutoPlay=function(){window.state.autoPlayAudio=!window.state.autoPlayAudio; document.getElementById('autoPlayLed').classList.toggle('active');};
window.toggleSlowMode=function(){window.state.slowMode=!window.state.slowMode; document.getElementById('slowModeLed').classList.toggle('active');};
window.showView = function(viewId, pushToHistory = true) { document.querySelectorAll('.view').forEach(el => el.classList.remove('active')); const target = document.getElementById(viewId); if(target) { target.classList.add('active'); if (pushToHistory) { if (window.state.history.length === 0 || window.state.history[window.state.history.length-1] !== viewId) { window.state.history.push(viewId); } } } if(viewId === 'settingsView') window.updateTotalProgress(); window.scrollTo(0, 0); };
window.goBackInHistory = function() { if (window.state.history.length > 1) { window.state.history.pop(); const prev = window.state.history[window.state.history.length - 1]; if (prev === 'sectionMenu' && window.state.currentVerbId) window.renderSections(window.state.currentVerbId); if (prev === 'tekrarMenu') window.updateSRSCounts(); if (prev === 'settingsView') window.updateTotalProgress(); if (window.state.activeLearningPanel) window.toggleLearningPanel(null); window.showView(prev, false); }};
window.renderClassSelection = function() { const grid = document.getElementById('classGrid'); if(!grid) return; grid.innerHTML = ''; const classes = (window.data.classes && window.data.classes.length > 0) ? window.data.classes : [{id:'A1'}, {id:'A2'}, {id:'B1'}]; classes.forEach(cls => { const btn = document.createElement('button'); btn.className = 'btn btn-secondary btn-lg'; btn.innerText = cls.name||cls.id; btn.onclick = () => window.changeClass(cls.id); grid.appendChild(btn); }); const mixBtn = document.createElement('button'); mixBtn.className = 'btn btn-info btn-lg'; mixBtn.innerText = '🔀 MIXED'; mixBtn.onclick = () => window.openMixedSelection(); grid.appendChild(mixBtn); };
window.changeClass = function(className) { window.data.settings.currentClass = className; localStorage.setItem('verbmatrix_settings', JSON.stringify(window.data.settings)); window.updateClassButtonUI(); window.goBackInHistory(); };
window.updateClassButtonUI = function() { const cls = window.data.settings.currentClass || 'A1'; document.getElementById('classNavBtn').textContent = cls; document.getElementById('currentClassDisplay').textContent = cls; };
window.openMixedSelection = function() { const list = document.getElementById('mixedTopicList'); list.innerHTML = ''; const pool = window.data.topicPool || {}; Object.keys(pool).sort((a,b)=>parseInt(a)-parseInt(b)).forEach(tId => { const isSelected = window.starsData[tId] > 0; const btn = document.createElement('button'); btn.className = isSelected ? 'btn btn-success-light' : 'btn btn-secondary'; btn.innerHTML = `<span>Topic ${tId}: ${pool[tId]}</span> <span>${isSelected?'⭐':'☆'}</span>`; btn.style.justifyContent='space-between'; btn.onclick = () => { window.starsData[tId] = window.starsData[tId]>0?0:1; window.openMixedSelection(); }; list.appendChild(btn); }); window.showView('mixedTopicSelectionView'); };
window.saveMixedSelection = function() { localStorage.setItem('verbmatrix_stars', JSON.stringify(window.starsData)); window.changeClass('MIXED'); };
window.toggleLanguageMode = function() { window.data.settings.conversionMode = (window.data.settings.conversionMode === 'tr-de') ? 'de-tr' : 'tr-de'; localStorage.setItem('verbmatrix_settings', JSON.stringify(window.data.settings)); window.updateLanguageToggleUI(); };
window.updateLanguageToggleUI = function() { const mode = window.data.settings.conversionMode; document.getElementById('led_tr_de').classList.toggle('active', mode === 'tr-de'); document.getElementById('led_de_tr').classList.toggle('active', mode === 'de-tr'); };
/* --- YENİ: NAVİGASYON BİLGİ ÇUBUĞU GÜNCELLEYİCİ --- */
window.updateHeaderStatus = function() {
    // 1. Mevcut "learningContent" alanının tepesine bilgi çubuğu ekleyelim
    // Eğer daha önce eklenmemişse oluştur:
    let statusBar = document.getElementById('dynamicStatusBar');
    if (!statusBar) {
        statusBar = document.createElement('div');
        statusBar.id = 'dynamicStatusBar';
        statusBar.style.cssText = "background:#f0f4c3; padding:8px; margin-bottom:15px; border-left:4px solid #afb42b; font-size:0.9rem; color:#333;";
        // learningContent'in en tepesine yerleştir
        const container = document.getElementById('learningContent');
        container.insertBefore(statusBar, container.firstChild);
    }

    // 2. Verileri Çek
    let infoText = "Genel Çalışma";
    
    // Eğer bir fiil seçiliyse:
    if (window.state.currentVerbId) {
        // Hangi grupta olduğunu bulmaya çalışalım
        let groupName = "Bilinmeyen Grup";
        let verbName = "Fiil";
        
        // Tüm grupları tara ve fiili bul
        const groups = window.data.groups || [];
        for (let g of groups) {
            const verbs = window.data.verbs[g.id] || [];
            const foundVerb = verbs.find(v => v.id === window.state.currentVerbId);
            if (foundVerb) {
                groupName = g.name;
                verbName = foundVerb.verbTR;
                break;
            }
        }
        
        // Hangi Topic (Konu)? Card ID'den anlarız (örn: v1_s2_4 -> s2 -> Topic 2)
        let topicName = "";
        if (window.state.currentCardKey) {
            const parts = window.state.currentCardKey.split('_'); // [v1, s2, 4]
            const topicPart = parts.find(p => p.startsWith('s')); // s2
            if (topicPart) {
                const tId = parseInt(topicPart.replace('s', ''));
                const topicPool = window.data.topicPool || window.data.topics[window.data.settings.currentClass];
                if (topicPool && topicPool[tId]) {
                    topicName = typeof topicPool[tId] === 'object' ? topicPool[tId].name : topicPool[tId];
                }
            }
        }

        infoText = `📂 <b>${groupName}</b> &nbsp;👉&nbsp; ✏️ <b>${verbName}</b> &nbsp;👉&nbsp; 📑 <b>${topicName}</b>`;
    } 
    else if (window.state.tekrarStatus) {
        infoText = `🔄 <b>TEKRAR MODU:</b> ${window.state.tekrarStatus.toUpperCase()}`;
    }

    // 3. Ekrana Yaz
    statusBar.innerHTML = infoText;
};
/* ==========================================================================
   ACİL MÜDAHALE PAKETİ - QUIZ, CLOZE, WORD ORDER & UI FIX
   ========================================================================== */

// 1. MERKEZİ EKRAN TEMİZLEYİCİ VE BAŞLIK YÖNETİCİSİ (HEPSİ ORTALI)
window.setupCleanUI = function(title) {
    const content = document.getElementById('learningContent');
    const wordOrderArea = document.getElementById('wordOrderArea');
    const resultAreas = ['quizResultArea', 'clozeResultArea', 'wordOrderResult'];
    
    // Her şeyi gizle ve temizle
    content.innerHTML = ''; 
    content.classList.remove('hidden');
    content.style.textAlign = 'center'; // İSTEDİĞİN GİBİ: Hepsini ortala
    
    if(wordOrderArea) {
        wordOrderArea.innerHTML = '';
        wordOrderArea.classList.add('hidden'); // Kelime sıralama özel alanı gizle (içine inject edeceğiz)
    }

    // Eski sonuçları gizle
    resultAreas.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.classList.add('hidden');
    });

    // Butonları sıfırla
    const actionBtn = document.getElementById('actionBtn');
    if(actionBtn) {
        actionBtn.style.display = 'block'; // Görünür yap
        actionBtn.classList.remove('hidden');
        actionBtn.textContent = 'KONTROL ET';
        actionBtn.onclick = null; // Eventi temizle
        actionBtn.style.margin = "20px auto"; // Butonu da ortala
    }

    // Ortalanmış Başlık Ekle
    const h3 = document.createElement('h3');
    h3.innerText = title;
    h3.style.color = '#333';
    h3.style.borderBottom = '2px solid #ff9800';
    h3.style.display = 'inline-block';
    h3.style.paddingBottom = '5px';
    h3.style.marginBottom = '20px';
    content.appendChild(h3);

    return content;
};

// 2. QUIZ MODU (YAZMA) - SIFIRDAN
window.renderQuizCard = function() {
    if (!window.state.deck || window.state.deckPos >= window.state.deck.length) { window.showCompletion(); return; }
    
    const card = window.state.deck[window.state.deckPos];
    window.state.currentCardKey = card.id;
    const isTrDe = window.data.settings.conversionMode === 'tr-de';
    
    // Cevap (Noktalama temizlenmiş)
    window.state.correctAnswer = isTrDe ? card.de : card.tr;
    
    // UI Kur
    const container = window.setupCleanUI("📝 Quiz (Yazma)");
    
    // Soru HTML
    const qDiv = document.createElement('div');
    qDiv.innerHTML = `<div style="font-size:1.2rem; margin-bottom:15px;">${isTrDe ? card.tr : card.de}</div>`;
    container.appendChild(qDiv);

    // Input
    const input = document.createElement('input');
    input.id = 'quizInput';
    input.className = 'input-field';
    input.placeholder = 'Cevabı buraya yaz...';
    input.style.textAlign = 'center'; // Input yazısı da ortalı
    input.autocomplete = 'off';
    container.appendChild(input);

    // Enter desteği
    input.onkeydown = (e) => { if(e.key === 'Enter') window.checkQuizAnswer(); };

    // Buton bağla
    document.getElementById('actionBtn').onclick = window.checkQuizAnswer;
    
    // Odaklan
    setTimeout(() => input.focus(), 100);
};

window.checkQuizAnswer = function() {
    const input = document.getElementById('quizInput').value.trim();
    // Regex: Noktalama işaretlerini yoksay, küçült
    const cleanInput = input.toLowerCase().replace(/[.,!?;:()]/g,'');
    const cleanCorrect = window.state.correctAnswer.toLowerCase().replace(/[.,!?;:()]/g,'');
    
    const container = document.getElementById('learningContent');
    const feedback = document.createElement('div');
    feedback.style.marginTop = '15px';
    feedback.style.fontWeight = 'bold';

    const btn = document.getElementById('actionBtn');

    if (cleanInput === cleanCorrect) {
        feedback.innerHTML = '✅ DOĞRU!';
        feedback.style.color = 'green';
        if(window.state.autoPlayAudio) window.playCurrentSentence('de');
        
        // SONRAKİNE GEÇ
        btn.textContent = 'DEVAM ET >';
        btn.onclick = () => { window.rateCard('normal'); }; // Burası önemli: rateCard üzerinden akışı devam ettirir
    } else {
        feedback.innerHTML = `❌ YANLIŞ!<br><span style="color:#555">Doğru: ${window.state.correctAnswer}</span>`;
        feedback.style.color = 'red';
        
        btn.textContent = 'DEVAM ET >';
        btn.onclick = () => { window.state.deckPos++; window.renderQuizCard(); };
    }
    
    // Varsa eski feedback'i sil, yenisini ekle
    const oldF = container.querySelector('.feedback-msg');
    if(oldF) oldF.remove();
    feedback.className = 'feedback-msg';
    container.appendChild(feedback);
};

// 3. BOŞLUK DOLDURMA (CLOZE) - SIFIRDAN
window.renderClozeCard = function() {
    if (!window.state.deck || window.state.deckPos >= window.state.deck.length) { window.showCompletion(); return; }
    
    const card = window.state.deck[window.state.deckPos];
    window.state.currentCardKey = card.id;
    const isTrDe = window.data.settings.conversionMode === 'tr-de';
    
    const targetText = isTrDe ? card.de : card.tr; // Cevap cümlesi
    const words = targetText.split(' ');
    
    // Sadece harf içeren bir kelime seç
    let validIndices = [];
    words.forEach((w, i) => { if(w.length > 2) validIndices.push(i); }); // En az 2 harfli olsun
    if(validIndices.length === 0) validIndices = [0];
    
    const randIndex = validIndices[Math.floor(Math.random() * validIndices.length)];
    window.state.correctAnswer = words[randIndex].replace(/[.,!?;:()]/g,''); // Temiz cevap
    
    // Soruyu oluştur (Seçilen kelime yerine _____)
    const clozeSentence = words.map((w, i) => i === randIndex ? '________' : w).join(' ');

    // UI Kur
    const container = window.setupCleanUI("✏️ Boşluk Doldurma");

    container.innerHTML += `
        <div style="font-size:1rem; color:#666; margin-bottom:10px;">${isTrDe ? card.tr : card.de}</div>
        <div style="font-size:1.4rem; font-weight:bold; margin-bottom:20px; color:#2c3e50;">${clozeSentence}</div>
        <input id="clozeInput" class="input-field" placeholder="Eksik kelime?" style="text-align:center;" autocomplete="off">
        <div id="clozeFeedback" class="hidden"></div>
    `;

    const input = document.getElementById('clozeInput');
    input.onkeydown = (e) => { if(e.key === 'Enter') window.checkClozeAnswer(); };
    
    document.getElementById('actionBtn').onclick = window.checkClozeAnswer;
    setTimeout(() => input.focus(), 100);
};

window.checkClozeAnswer = function() {
    const input = document.getElementById('clozeInput').value.trim().toLowerCase();
    const correct = window.state.correctAnswer.toLowerCase();
    const feedback = document.getElementById('clozeFeedback');
    feedback.classList.remove('hidden');
    feedback.style.marginTop = "15px";

    const btn = document.getElementById('actionBtn');

    if (input === correct) {
        feedback.innerHTML = '✅ MÜKEMMEL!';
        feedback.style.color = 'green';
        if(window.state.autoPlayAudio) window.playCurrentSentence('de');
        
        btn.textContent = 'DEVAM ET >';
        btn.onclick = () => { window.rateCard('normal'); };
    } else {
        feedback.innerHTML = `❌ OLMADI.<br>Doğru cevap: <b>${window.state.correctAnswer}</b>`;
        feedback.style.color = 'red';
        
        btn.textContent = 'DEVAM ET >';
        btn.onclick = () => { window.state.deckPos++; window.renderClozeCard(); };
    }
};

// 4. KELİME SIRALAMA (WORD ORDER) - SIFIRDAN (SENİN İSTEDİĞİN GİBİ)
window.renderWordOrderCard = function() {
    if (!window.state.deck || window.state.deckPos >= window.state.deck.length) { window.showCompletion(); return; }
    
    const card = window.state.deck[window.state.deckPos];
    window.state.currentCardKey = card.id;
    const isTrDe = window.data.settings.conversionMode === 'tr-de';
    
    const targetText = isTrDe ? card.de : card.tr;
    window.state.correctAnswer = targetText;
    
    // Kelimeleri parçala ve karıştır
    let pool = targetText.match(/(\w+'?\w*|[.,!?;])/g) || targetText.split(' ');
    pool.sort(() => Math.random() - 0.5);
    
    window.state.wordPool = pool;
    window.state.wordSelected = [];

    // UI Kur
    const container = window.setupCleanUI("🧩 Kelime Sıralama");

    // Soru Metni
    const qText = document.createElement('div');
    qText.innerHTML = `<small>Bunu çevir:</small><br><b style="font-size:1.1em">${isTrDe ? card.tr : card.de}</b>`;
    qText.style.marginBottom = "20px";
    container.appendChild(qText);

    // Seçilenler Alanı (Çizgili yer)
    const selectedArea = document.createElement('div');
    selectedArea.id = 'woSelected';
    selectedArea.style.minHeight = '50px';
    selectedArea.style.borderBottom = '2px dashed #ccc';
    selectedArea.style.marginBottom = '20px';
    selectedArea.style.display = 'flex';
    selectedArea.style.flexWrap = 'wrap';
    selectedArea.style.justifyContent = 'center';
    selectedArea.style.gap = '8px';
    selectedArea.style.padding = '10px';
    container.appendChild(selectedArea);

    // Havuz Alanı (Butonlar)
    const poolArea = document.createElement('div');
    poolArea.id = 'woPool';
    poolArea.style.display = 'flex';
    poolArea.style.flexWrap = 'wrap';
    poolArea.style.justifyContent = 'center';
    poolArea.style.gap = '8px';
    container.appendChild(poolArea);

    // Feedback Alanı
    const fb = document.createElement('div');
    fb.id = 'woFeedback';
    fb.style.marginTop = '15px';
    fb.style.fontWeight = 'bold';
    container.appendChild(fb);

    window.updateWordOrderUI();
    document.getElementById('actionBtn').onclick = window.checkWordOrder;
};

window.updateWordOrderUI = function() {
    const selDiv = document.getElementById('woSelected');
    const poolDiv = document.getElementById('woPool');
    if(!selDiv || !poolDiv) return;

    selDiv.innerHTML = '';
    poolDiv.innerHTML = '';

    // Seçilenleri Çiz
    window.state.wordSelected.forEach((w, i) => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-info btn-sm';
        btn.innerText = w;
        btn.onclick = () => { 
            window.state.wordSelected.splice(i, 1); 
            window.state.wordPool.push(w); 
            window.updateWordOrderUI(); 
        };
        selDiv.appendChild(btn);
    });

    // Havuzu Çiz
    window.state.wordPool.forEach((w, i) => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-secondary btn-sm'; // Daha sönük renk
        btn.innerText = w;
        btn.onclick = () => {
            window.state.wordPool.splice(i, 1);
            window.state.wordSelected.push(w);
            window.updateWordOrderUI();
        };
        poolDiv.appendChild(btn);
    });
};

window.checkWordOrder = function() {
    const userAns = window.state.wordSelected.join(' ').replace(/\s([.,!?;])/g, '$1').trim().toLowerCase();
    const correct = window.state.correctAnswer.trim().toLowerCase();
    const feedback = document.getElementById('woFeedback');
    const btn = document.getElementById('actionBtn');

    if (userAns === correct) {
        feedback.innerHTML = '✅ DOĞRU!';
        feedback.style.color = 'green';
        if(window.state.autoPlayAudio) window.playCurrentSentence('de');
        
        btn.textContent = 'DEVAM ET >';
        btn.onclick = () => { window.rateCard('normal'); };
    } else {
        feedback.innerHTML = '❌ YANLIŞ! Tekrar dene.';
        feedback.style.color = 'red';
        // Yanlışsa hemen geçmesin, kullanıcı düzeltsin
    }
};

// 5. KRİTİK DÜZELTME: RATE CARD ROUTER (AKIŞI KİLİTLEYEN YER BURASIYDI)
window.rateCard = function(status) {
    if (!window.state.currentCardKey) return;

    // SRS verisini kaydet
    window.srsData[window.state.currentCardKey] = { status: status, date: Date.now() };
    localStorage.setItem('verbmatrix_srs_data_v3', JSON.stringify(window.srsData));
    
    if(window.updateSRSCounts) window.updateSRSCounts();

    // İLERLE
    window.state.deckPos++;

    // MODA GÖRE YÖNLENDİR (Burası "Standard"a atıyordu, şimdi düzeldi)
    if (window.state.mode === 'quiz') {
        window.renderQuizCard();
    } else if (window.state.mode === 'cloze') {
        window.renderClozeCard();
    } else if (window.state.mode === 'wordorder') {
        window.renderWordOrderCard();
    } else {
        // Varsayılan çalışma modu
        window.renderSentence(); 
    }
};
/* ==========================================================================
   VERİ YÜKLEME VE BAŞLATMA (SERVER UYUMLU)
   ========================================================================== */

window.init = async function() {
    console.log("🚀 Uygulama başlatılıyor...");

    // 1. Önce Ayarları Yükle
    const storedSettings = localStorage.getItem('verbmatrix_settings');
    if (storedSettings) window.data.settings = JSON.parse(storedSettings);

    // 2. Diğer Yerel Verileri (İlerleme, SRS vb.) Yükle
    try {
        window.srsData = JSON.parse(localStorage.getItem('verbmatrix_srs_data_v3') || '{}');
        window.contentOverride = JSON.parse(localStorage.getItem('verbmatrix_content_override') || '{}');
        window.starsData = JSON.parse(localStorage.getItem('verbmatrix_stars') || '{}');
    } catch (e) { 
        console.error("Yerel veri hatası:", e); 
        window.srsData = {}; 
    }

    // 3. JSON VERİSİNİ SUNUCUDAN ÇEK (En Kritik Kısım)
    await window.loadServerData();

    // 4. Arayüzü Güncelle ve Başlat
    window.updateSRSCounts();
    window.updateTotalProgress(); 
    window.renderClassSelection(); 
    window.updateClassButtonUI();
    window.updateLanguageToggleUI();
    window.checkPWAStatus(); 
    
    // Tema ayarı
    if(window.data.settings.theme === 'dark') document.body.classList.add('dark-mode');
    
    // Logo görünürlüğü
    const logo = document.getElementById('appLogo');
    if(logo) logo.style.display = 'inline-block';
};

/* --- JSON ÇEKME FONKSİYONU --- */
window.loadServerData = async function() {
    const jsonFileName = 'verbmatrix_data.json';
    
    // Cache Busting: Dosya adının sonuna rastgele sayı ekleyerek tarayıcıyı kandırıyoruz.
    // Böylece sunucuya her girdiğinde EN GÜNCEL json dosyasını çeker.
    const url = `./${jsonFileName}?v=${new Date().getTime()}`;

    try {
        console.log(`📡 Sunucudan veri çekiliyor: ${jsonFileName}...`);
        
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP Hatası: ${response.status}`);
        }

        const jsonData = await response.json();

        // Gelen veriyi ana veri havuzuna birleştir
        window.data = {
            ...window.data,
            ...jsonData
        };

        // Başarılı olursa, bu veriyi "Offline" kullanım için LocalStorage'a da yedekle
        localStorage.setItem('verbmatrix_full_data', JSON.stringify(window.data));
        console.log("✅ Veri sunucudan alındı ve güncellendi.");

    } catch (error) {
        console.error("⚠️ Sunucu verisi alınamadı (Offline olabilir):", error);

        // Sunucudan çekemezsek (İnternet yoksa), mecburen yerel yedeğe bak
        const localBackup = localStorage.getItem('verbmatrix_full_data');
        if (localBackup) {
            console.log("📂 Yerel yedekten (Offline) veri yükleniyor...");
            window.data = { ...window.data, ...JSON.parse(localBackup) };
        } else {
            alert("HATA: Veri dosyası yüklenemedi ve çevrimdışı yedek bulunamadı!");
        }
    }
};
