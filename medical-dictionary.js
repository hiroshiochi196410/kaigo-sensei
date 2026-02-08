/*
  medical-dictionary.js
  Phase2: 急変（SBARなど）の医学用語・言い回しを「現場で通る」形に寄せるための
  置換辞書 + 自動補正ユーティリティ。

  使い方:
    const fixed = window.MED_TERM.apply(text);

  ポリシー:
  - ひらがな中心（記号は最小限）
  - 変換しすぎて意味が変わらないよう、対象は“医療連携/急変”寄りの語に限定
*/

(function(){
  const REPLACEMENTS = [
    // ===== 低血糖 =====
    { re: /低血糖/g, to: 'ていけっとう' },
    { re: /ひくけっとう/g, to: 'ていけっとう' },
    { re: /けっとう が ひくい/g, to: 'ていけっとう の うたがい' },

    // ===== 意識 =====
    { re: /意識変容/g, to: 'いしき の へんか' },
    { re: /意識変化/g, to: 'いしき の へんか' },
    { re: /いしき\s*へんよう/g, to: 'いしき の へんか' },

    // ===== 嘔吐 =====
    { re: /嘔吐/g, to: 'おうと' },
    { re: /はいた/g, to: 'おうと（はいた）' },

    // ===== 胸痛 =====
    { re: /胸痛/g, to: 'むね の いたみ' },
    { re: /きょうつう/g, to: 'むね の いたみ' },

    // ===== 発熱 =====
    { re: /発熱/g, to: 'ねつ が ある' },
    { re: /はつねつ/g, to: 'ねつ が ある' },

    // ===== SpO2 =====
    { re: /SpO2/gi, to: 'えすぴーおーつー' },
    { re: /spo2/gi, to: 'えすぴーおーつー' },
    { re: /すぽつー/g, to: 'えすぴーおーつー' },

    // ===== 低酸素/呼吸苦 =====
    { re: /呼吸苦/g, to: 'いきが くるしい' },
    { re: /息苦しさ/g, to: 'いきが くるしい' },
    { re: /いきぐるしさ/g, to: 'いきが くるしい' },

    // ===== その他よくある表記ゆれ =====
    { re: /しょくじ は 8わ/g, to: 'しょくじ は 8わり' },
    { re: /8わ\b/g, to: '8わり' },
    { re: /([0-9０-９]+)わ\b/g, to: '$1わり' },
    { re: /こうとう（ぶん）/g, to: 'こうとうぶん' },
    { re: /くちとう（ぶん）/g, to: 'こうとうぶん' }
  ];

  function looksJapanese(text){
    return /[\u3040-\u30ff\u4e00-\u9faf]/.test(text || '');
  }

  function apply(text){
    let t = String(text ?? '');
    if (!t) return t;
    if (!looksJapanese(t)) return t;

    // 二重適用をなるべく避ける（例: すでに おうと（はいた） の場合）
    for (const r of REPLACEMENTS){
      try{
        if (r.to.includes('（') && t.includes(r.to)) continue;
        t = t.replace(r.re, r.to);
      }catch(_e){/* noop */}
    }

    // 連続スペース整理（ひらがな学習向けに見た目を整える）
    t = t.replace(/\s{2,}/g, ' ').trim();
    return t;
  }

  window.MED_TERM = { apply, REPLACEMENTS };
})();
