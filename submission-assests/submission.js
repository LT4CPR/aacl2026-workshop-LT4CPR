(function () {
  "use strict";
  const config = window.LT4CPR_SUBMISSION_CONFIG;
  const $ = id => document.getElementById(id);
  let selectedFile = null;
  let lastReceipt = null;
  let testManifest = null;

  const els = {
    input: $('submission-file'), drop: $('drop-zone'), fileCard: $('file-card'), fileName: $('file-name'), fileSize: $('file-size'), clear: $('clear-file'), validate: $('validate-button'),
    idle: $('idle-state'), working: $('working-state'), workingMsg: $('working-message'), result: $('result-state'), status: $('result-status'), title: $('result-title'), summary: $('result-summary'),
    summaryList: $('summary-list'), team: $('summary-team'), systems: $('summary-systems'), primary: $('summary-primary'), reports: $('summary-reports'), sha: $('summary-sha'), version: $('summary-version'),
    systemResults: $('system-results'), warningsBox: $('warnings-box'), warningList: $('warning-list'), warningCount: $('warning-count'), errorsBox: $('errors-box'), errorList: $('error-list'), errorCount: $('error-count'),
    receipt: $('receipt-button'), reset: $('reset-button'), manifestWarning: $('manifest-warning'), submitLink: $('official-submit-link'), submitLock: $('submit-lock'), configNote: $('submission-config-note')
  };

  function humanBytes(n) {
    if (n < 1024) return `${n} B`;
    if (n < 1024*1024) return `${(n/1024).toFixed(1)} KB`;
    return `${(n/(1024*1024)).toFixed(1)} MB`;
  }
  function setFile(file) {
    selectedFile = file || null;
    if (!file) {
      els.fileCard.classList.add('hidden'); els.validate.disabled = true; els.input.value = ''; return;
    }
    els.fileName.textContent = file.name; els.fileSize.textContent = humanBytes(file.size); els.fileCard.classList.remove('hidden'); els.validate.disabled = false;
  }
  function showWorking(msg) {
    els.idle.classList.add('hidden'); els.result.classList.add('hidden'); els.working.classList.remove('hidden'); els.workingMsg.textContent = msg;
  }
  function resetResult() {
    lastReceipt = null;
    els.working.classList.add('hidden'); els.result.classList.add('hidden'); els.idle.classList.remove('hidden');
    els.submitLink.classList.add('portal-disabled'); els.submitLink.setAttribute('aria-disabled','true'); els.submitLink.href = '#'; els.submitLock.classList.remove('hidden');
  }
  function appendIssues(listEl, issues) {
    listEl.innerHTML = ''; issues.slice(0, 250).forEach(x => { const li=document.createElement('li'); li.textContent=x; listEl.appendChild(li); });
    if (issues.length > 250) { const li=document.createElement('li'); li.textContent=`…and ${issues.length-250} more`; listEl.appendChild(li); }
  }
  async function sha256(file) {
    const buf = await file.arrayBuffer();
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
  }
  function unlockSubmission() {
    if (!config.OFFICIAL_SUBMISSION_URL) {
      els.configNote.textContent = 'The official upload URL has not yet been configured by the organizers.';
      return;
    }
    els.submitLink.href = config.OFFICIAL_SUBMISSION_URL;
    els.submitLink.classList.remove('portal-disabled'); els.submitLink.removeAttribute('aria-disabled'); els.submitLock.classList.add('hidden');
    els.configNote.textContent = 'Your ZIP passed the browser validator. The upload form opens in a new tab.';
  }
  function renderResult(res, digest) {
    els.working.classList.add('hidden'); els.result.classList.remove('hidden');
    const valid = res.errors.length === 0;
    els.status.textContent = valid ? 'Valid' : 'Invalid'; els.status.className = `result-status ${valid ? 'valid' : 'invalid'}`;
    els.title.textContent = valid ? 'Submission passed validation' : 'Submission needs attention';
    els.summary.textContent = valid ? 'No blocking validation errors were found.' : `${res.errors.length} blocking issue${res.errors.length===1?'':'s'} found. Fix them and validate again.`;
    const m = res.manifest || {};
    const team = m.team || {};
    const systems = Array.isArray(m.systems) ? m.systems : [];
    const primary = systems.find(s => s && s.primary === true);
    els.team.textContent = team.name ? `${team.name} (${team.id || 'no id'})` : (team.id || '—');
    els.systems.textContent = String(systems.length || res.systemSummaries.length || 0);
    els.primary.textContent = primary ? `${primary.name || primary.id} (${primary.id})` : '—';
    els.reports.textContent = String(res.reportsChecked || 0);
    els.sha.textContent = digest; els.version.textContent = config.VALIDATOR_VERSION; els.summaryList.classList.remove('hidden');
    els.systemResults.innerHTML = '';
    res.systemSummaries.forEach(s => { const row=document.createElement('div'); row.className='system-row'; row.innerHTML=`<strong></strong><span></span>`; row.querySelector('strong').textContent=`${s.name || s.id}${s.primary ? ' · primary' : ''}`; row.querySelector('span').textContent=`${s.reports}/${config.EXPECTED_TOTAL_REPORTS} reports`; els.systemResults.appendChild(row); });
    els.systemResults.classList.toggle('hidden', res.systemSummaries.length===0);
    if (res.warnings.length) { appendIssues(els.warningList,res.warnings); els.warningCount.textContent=String(res.warnings.length); els.warningsBox.classList.remove('hidden'); } else els.warningsBox.classList.add('hidden');
    if (res.errors.length) { appendIssues(els.errorList,res.errors); els.errorCount.textContent=String(res.errors.length); els.errorsBox.classList.remove('hidden'); } else els.errorsBox.classList.add('hidden');
    if (valid) {
      lastReceipt = { receipt_version:'1.0', validator_version:config.VALIDATOR_VERSION, validated_at:new Date().toISOString(), filename:selectedFile.name, bytes:selectedFile.size, sha256:digest, team:team, systems:systems, reports_checked:res.reportsChecked, full_test_manifest:!!res.fullManifest, result:'VALID' };
      els.receipt.classList.remove('hidden'); unlockSubmission();
    } else { els.receipt.classList.add('hidden'); }
  }
  async function doValidate() {
    if (!selectedFile) return;
    resetResult(); showWorking('Checking ZIP size and reading archive…');
    try {
      if (selectedFile.size > config.MAX_ZIP_BYTES) throw new Error(`ZIP is ${humanBytes(selectedFile.size)}; maximum accepted size is ${humanBytes(config.MAX_ZIP_BYTES)}.`);
      if (typeof JSZip === 'undefined') throw new Error('ZIP library failed to load. Check your internet connection or use the CLI validator.');
      const zip = await JSZip.loadAsync(selectedFile);
      els.workingMsg.textContent = 'Validating manifest, systems, reports, and evidence IDs…';
      const res = await window.LT4CPRValidator.validateZip(selectedFile, zip, config, testManifest);
      els.workingMsg.textContent = 'Calculating SHA-256…';
      const digest = await sha256(selectedFile);
      renderResult(res, digest);
    } catch (e) {
      renderResult({ errors:[e && e.message ? e.message : String(e)], warnings:[], systemSummaries:[], manifest:null, reportsChecked:0, fullManifest:false }, '—');
    }
  }
  async function loadManifest() {
    try {
      const r = await fetch(config.TEST_MANIFEST_URL, {cache:'no-store'});
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      testManifest = await r.json();
      const count = testManifest && testManifest.cells ? Object.keys(testManifest.cells).length : 0;
      const manifestCheck = window.LT4CPRValidator.validateTestManifest(testManifest, config);
      if (!manifestCheck.valid) {
        els.manifestWarning.textContent = `Site setup incomplete: the embedded test manifest is not release-valid (${count}/${config.EXPECTED_TOTAL_REPORTS} cells). Full evidence-ID validation is not enabled.`;
        els.manifestWarning.classList.remove('hidden');
      } else {
        els.manifestWarning.classList.add('hidden');
      }
    } catch (e) {
      els.manifestWarning.textContent = 'Site setup incomplete: the embedded test manifest could not be loaded. Use the CLI validator until the organizer installs it.';
      els.manifestWarning.classList.remove('hidden');
    }
  }
  els.input.addEventListener('change', e => { resetResult(); setFile(e.target.files[0]); });
  els.clear.addEventListener('click', () => { setFile(null); resetResult(); });
  els.validate.addEventListener('click', doValidate);
  els.reset.addEventListener('click', () => { setFile(null); resetResult(); window.scrollTo({top:els.drop.getBoundingClientRect().top + window.scrollY - 100, behavior:'smooth'}); });
  els.receipt.addEventListener('click', () => {
    if (!lastReceipt) return;
    const blob = new Blob([JSON.stringify(lastReceipt,null,2)+'\n'],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`${lastReceipt.team && lastReceipt.team.id ? lastReceipt.team.id : 'lt4cpr'}_validation_receipt.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),5000);
  });
  ['dragenter','dragover'].forEach(ev => els.drop.addEventListener(ev,e=>{e.preventDefault();els.drop.classList.add('dragover');}));
  ['dragleave','drop'].forEach(ev => els.drop.addEventListener(ev,e=>{e.preventDefault();els.drop.classList.remove('dragover');}));
  els.drop.addEventListener('drop',e=>{const f=e.dataTransfer.files && e.dataTransfer.files[0]; if(f){resetResult();setFile(f);}});
  if (!config.OFFICIAL_SUBMISSION_URL) els.configNote.textContent = 'Organizer setup: add the final upload URL in submission-assets/config.js.';
  loadManifest();
})();
