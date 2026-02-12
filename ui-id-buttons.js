// ui-id-buttons.js
// Key buttons bilingual (Indonesian + Japanese) + show unit cost on Send.
// (Keep it lightweight: no dependency on UI mode.)

(function(){
  const LABEL = {
    btnRetry:        'Kirim ulang / 再送',
    btnCopyDebug:    'Salin status / 状態コピー',
    btnExample:      'Masukkan contoh / 例文を入れる',
    btnHistoryClear: 'Hapus riwayat / 履歴クリア',
    btnResetLog:     'Reset / リセット',

    // Document helpers
    btnSbarBuild:    'Buat SBAR / SBAR文を作る',
    btnSoapBuild:    'Buat SOAP / SOAP文を作る',
    btnFallBuild:    'Buat laporan jatuh / 転倒報告文を作る',

    // Clears (some pages reuse same label)
    btnSbarClear:    'Hapus / クリア',
    btnSoapClear:    'Hapus / クリア',
    btnFallClear:    'Hapus / クリア',
    btnClear:        'Hapus / クリア'
  };

  function injectStyles(){
    const css = `
      .unitHint{margin-top:6px;font-size:12px;color:#666;}
    `;
    const s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
  }

  function setText(id, txt){
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  }

  function getScene(){
    const sel = document.getElementById('sceneSel');
    return sel ? sel.value : '';
  }

  function estimateUnits(text, scene){
    // Prefer page-defined function.
    if (typeof window.estimateCostUnitsWithScene === 'function') {
      try { return Number(window.estimateCostUnitsWithScene(text, scene)) || 1; } catch(_) {}
    }
    if (typeof window.estimateCostUnits === 'function') {
      try { return Number(window.estimateCostUnits(text)) || 1; } catch(_) {}
    }
    return 1;
  }

  function ensureUnitHint(sendBtn){
    if (!sendBtn) return null;
    let hint = document.getElementById('unitHint');
    if (hint) return hint;
    hint = document.createElement('div');
    hint.id = 'unitHint';
    hint.className = 'unitHint';
    // Place right under the Send button.
    sendBtn.insertAdjacentElement('afterend', hint);
    return hint;
  }

  function updateSendLabel(){
    const sendBtn = document.getElementById('btnSend');
    if (!sendBtn) return;

    const input = document.getElementById('userInput');
    const text = input ? input.value : '';
    const scene = getScene();
    const units = estimateUnits(text, scene);

    // Button label
    sendBtn.textContent = `Kirim (-${units} unit) / 送信`;

    // Small hint
    const hint = ensureUnitHint(sendBtn);
    if (hint){
      hint.textContent = (units >= 5)
        ? 'Dokumen panjang: 5 unit / 長文: 5unit'
        : 'Pesan normal: 1 unit / 通常: 1unit';
    }
  }

  function updateMoreButtons(){
    // If page already renders Indonesian labels via dataset, do nothing.
    document.querySelectorAll('button.moreBtn').forEach(b=>{
      const t = (b.textContent || '').trim();
      if (t === 'もっと見る') b.textContent = 'Lihat / もっと見る';
      if (t === 'たたむ') b.textContent = 'Tutup / たたむ';
    });
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    injectStyles();

    // Apply fixed labels (if elements exist on the page)
    Object.entries(LABEL).forEach(([id, txt])=> setText(id, txt));

    // Send button is dynamic (units)
    updateSendLabel();

    // Update when input/scene changes
    const input = document.getElementById('userInput');
    if (input) input.addEventListener('input', updateSendLabel);
    const sceneSel = document.getElementById('sceneSel');
    if (sceneSel) sceneSel.addEventListener('change', updateSendLabel);

    // More buttons may be injected later; keep them readable
    updateMoreButtons();
    const obs = new MutationObserver(()=> updateMoreButtons());
    obs.observe(document.body, { childList:true, subtree:true });
  });
})();
