const fs = require('fs');
const path = require('path');

function patchIndex(file){
  let s = fs.readFileSync(file, 'utf8');

  // 1) Add FORCE_NEXT_UNITS check in estimateCostUnits
  if (!s.includes('if (FORCE_NEXT_UNITS) return FORCE_NEXT_UNITS;') && s.includes('function estimateCostUnits(text){')){
    s = s.replace('function estimateCostUnits(text){\n', 'function estimateCostUnits(text){\n  if (FORCE_NEXT_UNITS) return FORCE_NEXT_UNITS;\n');
  }

  // 2) Insert helper block after estimateCostUnits definition
  const helperBlock = `\n\n// ===== force unit costing for document buttons (SBAR/SOAP/転倒報告/申し送り文) =====\nlet FORCE_NEXT_UNITS = null;\nfunction setForceNextUnits(units){\n  FORCE_NEXT_UNITS = Number(units) || null;\n  updateSendButtonCost();\n}\nfunction clearForceNextUnits(){\n  FORCE_NEXT_UNITS = null;\n  updateSendButtonCost();\n}\nfunction isUnlockedNow(){\n  try{ return !!ls.get(\"aiga_unlocked_\"+VARIANT, false); }catch(e){ return false; }\n}\nfunction updateSendButtonCost(){\n  try{\n    const btn = $(\"btnSend\");\n    if (!btn) return;\n    if (!isUnlockedNow()){\n      btn.textContent = \"送信\";\n      return;\n    }\n    const txt = String($(\"userInput\")?.value || \"\").trim();\n    const u = txt ? estimateCostUnits(txt) : 1;\n    btn.textContent = ` + "`" + `送信（-${u}unit）` + "`" + `;\n  }catch(e){}\n}\n`;

  if (!s.includes('function setForceNextUnits') && s.includes('function estimateCostUnits(text){')){
    // insert right after the first closing brace of estimateCostUnits
    s = s.replace(/(function\s+estimateCostUnits\(text\)\{[\s\S]*?return\s+isLong\s*\?\s*LONG_UNIT_COST\s*:\s*1;\n\})/, `$1${helperBlock}`);
  }

  // 3) Ensure setTrialInfo updates send button label
  if (s.includes('function setTrialInfo(){') && !s.includes('updateSendButtonCost();', s.indexOf('function setTrialInfo(){'))){
    s = s.replace(/(function\s+setTrialInfo\(\)\{[\s\S]*?\$\("trialInfo"\)\.textContent\s*=\s*[^;]+;)/, `$1\n  try{ updateSendButtonCost(); }catch(e){}`);
  }

  // 4) Clear force when panels cleared
  const clearFns = ['clearSbar','clearSoap','clearFall'];
  for (const fn of clearFns){
    const re = new RegExp(`function\\s+${fn}\\(\\)\\{([\\s\\S]*?)\\n\\}`, 'm');
    const m = s.match(re);
    if (m && !m[1].includes('clearForceNextUnits')){
      const replaced = `function ${fn}(){${m[1]}\n  try{ clearForceNextUnits(); }catch(e){}\n  try{ updateSendButtonCost(); }catch(e){}\n}`;
      s = s.replace(re, replaced);
    }
  }

  // 5) Force 5 unit when doc buttons fill input
  if (!s.includes('setForceNextUnits(LONG_UNIT_COST);')){
    s = s.replace(/\$\("userInput"\)\.value\s*=\s*sbarTxt;\n/g, `$("userInput").value = sbarTxt;\n      setForceNextUnits(LONG_UNIT_COST);\n`);
    s = s.replace(/input\.value\s*=\s*txt;\n/g, `input.value = txt;\n          setForceNextUnits(LONG_UNIT_COST);\n`);
  }

  // 6) Add input listener + initial update
  if (!s.includes('addEventListener("input"') && s.includes('$("userInput").addEventListener("keydown"')){
    s = s.replace(/\$\("userInput"\)\.addEventListener\("keydown",\s*\(e\)=>\{\n\s*if\s*\(\(e\.ctrlKey\s*\|\|\s*e\.metaKey\)\s*&&\s*e\.key\s*===\s*"Enter"\)\s*send\(\);\n\s*\}\);/,
`$("userInput").addEventListener("keydown", (e)=>{\n      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") send();\n    });\n    $("userInput").addEventListener("input", ()=>{\n      try{ if (FORCE_NEXT_UNITS && !$("userInput").value.trim()) clearForceNextUnits(); }catch(e){}\n      try{ updateSendButtonCost(); }catch(e){}\n    });\n    updateSendButtonCost();`);
  }

  // 7) Clear force on successful send/retry and refresh button
  // send path
  s = s.replace(/await\s+applyChatResult\(out,\s*\{\s*text,\s*scene,\s*persona,\s*category,\s*level,\s*userItem,\s*aiItem,\s*meta,\s*costUnits\s*\}\);/,
`await applyChatResult(out, { text, scene, persona, category, level, userItem, aiItem, meta, costUnits });\n      try{ clearForceNextUnits(); }catch(e){}\n      try{ updateSendButtonCost(); }catch(e){}`);

  // retry path
  s = s.replace(/await\s+applyChatResult\(out,\s*p\);/g, `await applyChatResult(out, p);\n    try{ clearForceNextUnits(); }catch(e){}\n    try{ updateSendButtonCost(); }catch(e){}`);

  // when input cleared
  s = s.replace(/\$\("userInput"\)\.value\s*=\s*"";\n/g, `$("userInput").value = "";\n      try{ updateSendButtonCost(); }catch(e){}\n`);

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
    console.error('missing', f);
  }
}
