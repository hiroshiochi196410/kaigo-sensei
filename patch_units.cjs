const fs = require('fs');

const helperBlock = `

// ===== force unit costing for document buttons (SBAR/SOAP/転倒報告) =====
let FORCE_NEXT_UNITS = null;
function setForceNextUnits(units){
  FORCE_NEXT_UNITS = Number(units) || null;
  updateSendButtonCost();
}
function clearForceNextUnits(){
  FORCE_NEXT_UNITS = null;
  updateSendButtonCost();
}
function isUnlockedNow(){
  try{ return !!ls.get("aiga_unlocked_"+VARIANT, false); }catch(e){ return false; }
}
function updateSendButtonCost(){
  try{
    const btn = $("btnSend");
    if (!btn) return;
    if (!isUnlockedNow()){
      btn.textContent = "送信";
      return;
    }
    const txt = String($("userInput")?.value || "").trim();
    const u = txt ? estimateCostUnits(txt) : 1;
    btn.textContent = "送信（-" + u + "unit）";
  }catch(e){}
}
`;

function insertBeforeClosingBrace(fnMatch, insert){
  // insert right before the last closing brace of the matched function block
  return fnMatch.replace(/\n\}$/, '\n' + insert + '\n}');
}

function patchIndex(file){
  let s = fs.readFileSync(file, 'utf8');

  // 1) estimateCostUnits: add FORCE_NEXT_UNITS check line
  if (s.includes('function estimateCostUnits(text){') && !s.includes('if (FORCE_NEXT_UNITS) return FORCE_NEXT_UNITS;')){
    s = s.replace('function estimateCostUnits(text){\n', 'function estimateCostUnits(text){\n  if (FORCE_NEXT_UNITS) return FORCE_NEXT_UNITS;\n');
  }

  // 2) insert helper block once (after estimateCostUnits function)
  if (!s.includes('let FORCE_NEXT_UNITS = null;')){
    s = s.replace(/(return isLong \? LONG_UNIT_COST : 1;\s*\n\})/m, `$1${helperBlock}`);
  }

  // 3) setTrialInfo: refresh send button label when unlocked state is updated
  s = s.replace(/function setTrialInfo\([^)]*\)\{[\s\S]*?\n\}/m, (m)=>{
    if (m.includes('updateSendButtonCost')) return m;
    return insertBeforeClosingBrace(m, '  try{ updateSendButtonCost(); }catch(e){}');
  });

  // 4) clear functions should clear forced units
  for (const fnName of ['clearSbar','clearSoap','clearFall']){
    const re = new RegExp(`function ${fnName}\\(\\)\\{[\\s\\S]*?\\n\\}`, 'm');
    s = s.replace(re, (m)=>{
      if (m.includes('clearForceNextUnits')) return m;
      return insertBeforeClosingBrace(m, '  try{ clearForceNextUnits(); }catch(e){}\n  try{ updateSendButtonCost(); }catch(e){}');
    });
  }

  // 5) document build buttons: force 5 unit for next send
  if (s.includes('$("userInput").value = sbarTxt;') && !s.includes('setForceNextUnits(LONG_UNIT_COST);')){
    s = s.replace('$("userInput").value = sbarTxt;\n', '$("userInput").value = sbarTxt;\n        setForceNextUnits(LONG_UNIT_COST);\n');
  }
  // SOAP / fall builders share the same assignment line
  s = s.replace(/input\.value = txt;\n/g, (m)=>{
    if (m.includes('setForceNextUnits')) return m;
    return m + '          setForceNextUnits(LONG_UNIT_COST);\n';
  });

  // 6) after successful applyChatResult, clear forced units
  s = s.replace(/await applyChatResult\(out, p\);\n/g, 'await applyChatResult(out, p);\n    try{ clearForceNextUnits(); }catch(e){}\n');
  s = s.replace(/await applyChatResult\(out, \{ text, scene, persona, category, level, userItem, aiItem, meta, costUnits \}\);\n/g,
                'await applyChatResult(out, { text, scene, persona, category, level, userItem, aiItem, meta, costUnits });\n    try{ clearForceNextUnits(); }catch(e){}\n');

  // 7) whenever input is cleared, refresh send button label
  s = s.replace(/\$\("userInput"\)\.value = "";\n/g, '$("userInput").value = "";\n    try{ updateSendButtonCost(); }catch(e){}\n');

  // 8) init: add input listener + initial label update (placed after keydown listener)
  s = s.replace(/\$\("userInput"\)\.addEventListener\("keydown",\s*\(e\)=>\{\n\s*if \(\(e\.ctrlKey \|\| e\.metaKey\) && e\.key === "Enter"\) send\(\);\n\s*\}\);\n/m,
`$("userInput").addEventListener("keydown", (e)=>{\n      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") send();\n    });\n    $("userInput").addEventListener("input", ()=>{\n      try{ if (FORCE_NEXT_UNITS && !$("userInput").value.trim()) clearForceNextUnits(); }catch(e){}\n      try{ updateSendButtonCost(); }catch(e){}\n    });\n    try{ updateSendButtonCost(); }catch(e){}\n`);

  fs.writeFileSync(file, s, 'utf8');
}

const targets = [
  '/mnt/data/work/app/ssw/index.html',
  '/mnt/data/work/app/trainee/index.html'
];

for (const f of targets){
  if (fs.existsSync(f)){
    patchIndex(f);
    console.log('patched', f);
  } else {
    console.log('missing', f);
  }
}
