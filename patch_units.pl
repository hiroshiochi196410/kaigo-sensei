use strict;use warnings;
use File::Slurp qw(read_file write_file);

sub patch_file {
  my ($path) = @_;
  my $s = read_file($path, binmode => ':utf8');

  # 1) estimateCostUnits: add FORCE_NEXT_UNITS check
  $s =~ s/function\s+estimateCostUnits\(text\)\{\n\s*const\s+s\s*=\s*String\(text\s*\|\|\s*''\s*\);/function estimateCostUnits(text){\n  if (FORCE_NEXT_UNITS) return FORCE_NEXT_UNITS;\n  const s = String(text || '');/m
    or die "patch estimateCostUnits header failed in $path";

  # 2) insert helper block right after estimateCostUnits function definition end (first occurrence)
  my $helper = <<'JS';

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
    btn.textContent = `送信（-${u}unit）`;
  }catch(e){}
}

JS

  $s =~ s/(function\s+estimateCostUnits\(text\)\{[\s\S]*?\n\})/$1$helper/ or die "insert helper block failed in $path";

  # 3) setTrialInfo: call updateSendButtonCost
  $s =~ s/(function\s+setTrialInfo\(\)\{[\s\S]*?\n\s*\$\("trialInfo"\)\.textContent\s*=\s*[^;]+;)/$1\n  try{ updateSendButtonCost(); }catch(e){};/
    or die "patch setTrialInfo failed in $path";

  # 4) clear helpers: clearForceNextUnits()
  for my $fn (qw(clearSbar clearSoap clearFall)){
    $s =~ s/(function\s+$fn\(\)\{[\s\S]*?)(\n\})/$1\n  try{ clearForceNextUnits(); }catch(e){}\n  try{ updateSendButtonCost(); }catch(e){}$2/
      or die "patch $fn failed in $path";
  }

  # 5) build buttons: setForceNextUnits(LONG_UNIT_COST) after putting text into userInput
  $s =~ s/(\$\("userInput"\)\.value\s*=\s*sbarTxt;)/$1\n        setForceNextUnits(LONG_UNIT_COST);/ or die "patch sbar handler failed in $path";

  # SOAP: input.value = txt;
  $s =~ s/(input\.value\s*=\s*txt;)/$1\n          setForceNextUnits(LONG_UNIT_COST);/ or die "patch soap handler failed in $path";

  # Fall: input.value = txt;
  # There are two occurrences (fall & maybe others). We only want the one in fall build handler; safest: replace the first one after "const txt = buildFallText".
  $s =~ s/(const\s+txt\s*=\s*buildFallText\([^\)]+\);[\s\S]*?\n\s*if\s*\(input\)\{\n\s*input\.value\s*=\s*txt;)/$1\n      setForceNextUnits(LONG_UNIT_COST);/ or die "patch fall handler failed in $path";

  # 6) init: add input listener + initial updateSendButtonCost after binding send
  $s =~ s/(\$\("btnSend"\)\.addEventListener\("click",\s*send\);)/$1\n    $("userInput").addEventListener("input", ()=>{\n      try{ if (FORCE_NEXT_UNITS && !String($("userInput")?.value||"").trim()) clearForceNextUnits(); }catch(e){}\n      try{ updateSendButtonCost(); }catch(e){}\n    });\n    try{ updateSendButtonCost(); }catch(e){};/
    or die "patch init input listener failed in $path";

  # 7) send(): clearForceNextUnits on success, and update button after clearing
  # Insert right after applyChatResult(...);
  $s =~ s/(applyChatResult\(result\);)/$1\n\n    // consume forced long-unit after successful send\n    try{ clearForceNextUnits(); }catch(e){};/
    or die "patch send success clear failed in $path";

  # After userInput.value=""; add updateSendButtonCost
  $s =~ s/(\$\("userInput"\)\.value\s*=\s*"";)/$1\n    try{ updateSendButtonCost(); }catch(e){};/
    or die "patch send clear button update failed in $path";

  # 8) retryLastSend(): on success clear force and update button
  $s =~ s/(applyChatResult\(result\);\n\s*\$\("userInput"\)\.value\s*=\s*"";)/applyChatResult(result);\n\n      try{ clearForceNextUnits(); }catch(e){}\n      $("userInput").value = "";\n      try{ updateSendButtonCost(); }catch(e){};/
    or die "patch retryLastSend failed in $path";

  write_file($path, { binmode => ':utf8' }, $s);
}

patch_file($ARGV[0]);
