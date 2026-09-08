(function (root) {
  "use strict";

  const ID_RE = /^[a-z0-9][a-z0-9_-]*$/;
  const SECTION_ID_RE = /^(?:[1-9]|1[01])$/;
  const SUBSECTION_ID_RE = /^((?:[1-9]|1[01]))([a-z]+)$/;
  const BULLET_ID_RE = /^((?:[1-9]|1[01])[a-z]+)\.([1-9][0-9]*)$/;
  const SECTION_TITLES = {
    "1": "Situation overview",
    "2": "Timeline",
    "3": "Casualties and human impact",
    "4": "Infrastructure and service impact",
    "5": "Displacement and movement",
    "6": "Hazard assessment",
    "7": "Response actions",
    "8": "Communication and information",
    "9": "Aid and relief",
    "10": "Organizational and administrative activity",
    "11": "Social and community response"
  };
  const ALLOWED_CONFIDENCE = new Set(["confirmed", "unconfirmed"]);
  const FORBIDDEN_KEYS = new Set([
    "projection_signature", "canonical_links", "semantic_payload_hash", "source_plan",
    "source_plan_ids", "source_tweet_plan_id", "tweet_plan_id", "generation_method",
    "generation_valid", "projection_valid", "projection_warnings", "rewrite_status",
    "rewrite_candidate", "rewrite_model", "judge_status", "judge_verdict", "risk_level",
    "coverage", "bundle", "bundles", "canonical_entities", "events", "relations", "entities",
    "internal_id", "organizer", "organizer_metadata"
  ]);
  const FORBIDDEN_VALUE_PATTERNS = [/\bSYN_\d{4,}\b/, /\bEV_CAN_[A-Za-z0-9_]+\b/, /\bE_CAN_[A-Za-z0-9_]+\b/, /\bTP_\d{3,}\b/];

  function isObject(x) { return x !== null && typeof x === "object" && !Array.isArray(x); }
  function ownKeys(x) { return isObject(x) ? Object.keys(x) : []; }
  function exactKeys(obj, required, allowed, where, errors) {
    const keys = new Set(ownKeys(obj));
    required.forEach(k => { if (!keys.has(k)) errors.push(`${where}: missing required key ${k}`); });
    keys.forEach(k => { if (!allowed.has(k)) errors.push(`${where}: unexpected key ${k}`); });
  }
  function scanLeakage(obj, where, errors) {
    if (Array.isArray(obj)) {
      obj.forEach((v, i) => scanLeakage(v, `${where}[${i}]`, errors));
    } else if (isObject(obj)) {
      Object.entries(obj).forEach(([k, v]) => {
        if (FORBIDDEN_KEYS.has(k)) errors.push(`${where}: forbidden internal key ${JSON.stringify(k)}`);
        scanLeakage(v, `${where}.${k}`, errors);
      });
    } else if (typeof obj === "string") {
      FORBIDDEN_VALUE_PATTERNS.forEach(p => {
        if (p.test(obj)) errors.push(`${where}: contains forbidden internal identifier matching ${p}`);
      });
    }
  }
  function safeZipPath(name) {
    if (!name || name.startsWith("/") || name.includes("\\")) return false;
    const parts = name.split("/").filter(Boolean);
    return !parts.includes("..") && !parts.includes(".");
  }
  function isZipSymlink(entry) {
    return !!(entry && Number.isInteger(entry.unixPermissions) && ((entry.unixPermissions & 0o170000) === 0o120000));
  }
  async function readUtf8(zipObject, where) {
    try {
      const bytes = await zipObject.async('uint8array');
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch (e) {
      if (e && e.name === 'TypeError') throw new Error(`${where}: must be UTF-8`);
      throw e;
    }
  }
  function validateTestManifest(manifest, config) {
    const errors = [];
    if (!isObject(manifest)) return { errors: ['embedded test manifest: expected a JSON object'], valid: false };
    if (manifest.manifest_version !== '1.0') errors.push('embedded test manifest: manifest_version must be "1.0"');
    if (manifest.generated !== true) errors.push('embedded test manifest: generated must be true');
    if (!isObject(manifest.expected_counts)) errors.push('embedded test manifest: expected_counts must be an object');
    else {
      for (const [crisis, expected] of Object.entries(config.EXPECTED_CRISIS_COUNTS)) {
        if (manifest.expected_counts[crisis] !== expected) errors.push(`embedded test manifest: expected_counts.${crisis} must be ${expected}`);
      }
      for (const crisis of Object.keys(manifest.expected_counts)) {
        if (!(crisis in config.EXPECTED_CRISIS_COUNTS)) errors.push(`embedded test manifest: unexpected crisis in expected_counts: ${crisis}`);
      }
    }
    if (manifest.cell_count !== config.EXPECTED_TOTAL_REPORTS) errors.push(`embedded test manifest: cell_count must be ${config.EXPECTED_TOTAL_REPORTS}`);
    if (!isObject(manifest.cells)) errors.push('embedded test manifest: cells must be an object');
    else {
      const keys = Object.keys(manifest.cells);
      if (keys.length !== config.EXPECTED_TOTAL_REPORTS) errors.push(`embedded test manifest: contains ${keys.length} cells; expected ${config.EXPECTED_TOTAL_REPORTS}`);
      const crisisCounts = {};
      Object.keys(config.EXPECTED_CRISIS_COUNTS).forEach(c => crisisCounts[c] = 0);
      for (const key of keys) {
        const cell = manifest.cells[key];
        if (!isObject(cell)) { errors.push(`embedded test manifest: ${key} must be an object`); continue; }
        const slash = key.indexOf('/');
        if (slash <= 0 || slash === key.length - 1 || key.indexOf('/', slash + 1) !== -1) {
          errors.push(`embedded test manifest: invalid cell key ${key}; expected <crisis>/<stem>`);
          continue;
        }
        const crisis = key.slice(0, slash), stem = key.slice(slash + 1);
        if (!(crisis in config.EXPECTED_CRISIS_COUNTS)) errors.push(`embedded test manifest: ${key} has unexpected crisis ${crisis}`);
        else crisisCounts[crisis] += 1;
        if (cell.crisis !== crisis) errors.push(`embedded test manifest: ${key}.crisis does not match key`);
        if (cell.stem !== stem) errors.push(`embedded test manifest: ${key}.stem does not match key`);
        if (!Array.isArray(cell.tweet_ids) || cell.tweet_ids.length === 0) errors.push(`embedded test manifest: ${key}.tweet_ids must be a non-empty array`);
        else {
          const seen = new Set();
          for (const tid of cell.tweet_ids) {
            if (!Number.isInteger(tid) || tid <= 0) errors.push(`embedded test manifest: ${key} contains invalid tweet id ${JSON.stringify(tid)}`);
            if (seen.has(tid)) errors.push(`embedded test manifest: ${key} contains duplicate tweet id ${tid}`);
            seen.add(tid);
          }
        }
      }
      for (const [crisis, expected] of Object.entries(config.EXPECTED_CRISIS_COUNTS)) {
        if (crisisCounts[crisis] !== expected) errors.push(`embedded test manifest: ${crisis} contains ${crisisCounts[crisis]} cells; expected ${expected}`);
      }
    }
    return { errors, valid: errors.length === 0 };
  }

  function validateManifest(manifest, topDir, config) {
    const errors = [];
    if (!isObject(manifest)) return { errors: ["submission.json: expected a JSON object"], systems: {}, teamId: null };
    exactKeys(manifest, new Set(["submission_format_version", "team", "systems"]), new Set(["submission_format_version", "team", "systems"]), "submission.json", errors);
    if (manifest.submission_format_version !== config.SUBMISSION_FORMAT_VERSION) {
      errors.push(`submission.json: submission_format_version must be ${JSON.stringify(config.SUBMISSION_FORMAT_VERSION)}`);
    }
    let teamId = null;
    if (!isObject(manifest.team)) errors.push("submission.json.team: expected a JSON object");
    else {
      exactKeys(manifest.team, new Set(["id", "name"]), new Set(["id", "name"]), "submission.json.team", errors);
      if (typeof manifest.team.id !== "string" || !ID_RE.test(manifest.team.id)) errors.push("submission.json.team.id: must match [a-z0-9][a-z0-9_-]*");
      else {
        teamId = manifest.team.id;
        if (teamId !== topDir) errors.push(`submission.json.team.id does not match top-level directory: ${teamId} != ${topDir}`);
      }
      if (typeof manifest.team.name !== "string" || !manifest.team.name.trim()) errors.push("submission.json.team.name: must be a non-empty string");
    }
    const systems = {};
    if (!Array.isArray(manifest.systems)) errors.push("submission.json.systems: expected a JSON array");
    else {
      if (manifest.systems.length === 0) errors.push("submission.json.systems: at least one system is required");
      let primaryCount = 0;
      manifest.systems.forEach((s, i) => {
        const where = `submission.json.systems[${i}]`;
        if (!isObject(s)) { errors.push(`${where}: expected a JSON object`); return; }
        exactKeys(s, new Set(["id", "name", "primary"]), new Set(["id", "name", "primary"]), where, errors);
        if (typeof s.id !== "string" || !ID_RE.test(s.id)) errors.push(`${where}.id: must match [a-z0-9][a-z0-9_-]*`);
        else if (systems[s.id]) errors.push(`${where}.id: duplicate system id ${JSON.stringify(s.id)}`);
        else systems[s.id] = s;
        if (typeof s.name !== "string" || !s.name.trim()) errors.push(`${where}.name: must be a non-empty string`);
        if (typeof s.primary !== "boolean") errors.push(`${where}.primary: must be true or false`);
        else if (s.primary) primaryCount += 1;
      });
      if (primaryCount !== 1) errors.push(`submission.json.systems: exactly one system must have primary=true; found ${primaryCount}`);
    }
    return { errors, systems, teamId };
  }

  function validateReport(report, cell, where, config) {
    const errors = [];
    if (!isObject(report)) return [`${where}: expected a JSON object`];
    exactKeys(report, new Set(["meta", "sections"]), new Set(["meta", "sections"]), where, errors);
    scanLeakage(report, where, errors);
    if (!isObject(report.meta)) errors.push(`${where}.meta: expected a JSON object`);
    else {
      exactKeys(report.meta, new Set(["schema_version"]), new Set(["schema_version"]), `${where}.meta`, errors);
      if (report.meta.schema_version !== config.REPORT_SCHEMA_VERSION) errors.push(`${where}.meta.schema_version: must be ${JSON.stringify(config.REPORT_SCHEMA_VERSION)}`);
    }
    if (!Array.isArray(report.sections)) { errors.push(`${where}.sections: expected a JSON array`); return errors; }
    const seenSections = new Set();
    const seenBullets = new Set();
    let previousSection = 0;
    report.sections.forEach((sec, si) => {
      const sw = `${where}.sections[${si}]`;
      if (!isObject(sec)) { errors.push(`${sw}: expected a JSON object`); return; }
      exactKeys(sec, new Set(["id", "title", "subsections"]), new Set(["id", "title", "subsections"]), sw, errors);
      if (typeof sec.id !== "string" || !SECTION_ID_RE.test(sec.id)) { errors.push(`${sw}.id: expected string section id '1'..'11'`); return; }
      if (seenSections.has(sec.id)) errors.push(`${sw}.id: duplicate section id ${sec.id}`);
      seenSections.add(sec.id);
      const n = Number(sec.id);
      if (n <= previousSection) errors.push(`${sw}.id: sections must appear in increasing numeric order`);
      previousSection = n;
      if (sec.title !== SECTION_TITLES[sec.id]) errors.push(`${sw}.title: expected ${JSON.stringify(SECTION_TITLES[sec.id])}, got ${JSON.stringify(sec.title)}`);
      if (!Array.isArray(sec.subsections)) { errors.push(`${sw}.subsections: expected a JSON array`); return; }
      const seenSubs = new Set();
      sec.subsections.forEach((sub, subi) => {
        const subw = `${sw}.subsections[${subi}]`;
        if (!isObject(sub)) { errors.push(`${subw}: expected a JSON object`); return; }
        exactKeys(sub, new Set(["id", "title", "bullets"]), new Set(["id", "title", "bullets"]), subw, errors);
        if (typeof sub.id !== "string") { errors.push(`${subw}.id: must be a string`); return; }
        const sm = sub.id.match(SUBSECTION_ID_RE);
        if (!sm) errors.push(`${subw}.id: expected subsection id such as '3a' or '10b'`);
        else if (sm[1] !== sec.id) errors.push(`${subw}.id: subsection ${sub.id} does not belong to section ${sec.id}`);
        if (seenSubs.has(sub.id)) errors.push(`${subw}.id: duplicate subsection id ${sub.id}`);
        seenSubs.add(sub.id);
        if (typeof sub.title !== "string" || !sub.title.trim()) errors.push(`${subw}.title: must be a non-empty string`);
        if (!Array.isArray(sub.bullets)) { errors.push(`${subw}.bullets: expected a JSON array`); return; }
        sub.bullets.forEach((bullet, bi) => {
          const bw = `${subw}.bullets[${bi}]`;
          if (!isObject(bullet)) { errors.push(`${bw}: expected a JSON object`); return; }
          exactKeys(bullet, new Set(["id", "text", "confidence", "tweet_ids"]), new Set(["id", "text", "confidence", "tweet_ids"]), bw, errors);
          if (typeof bullet.id !== "string") errors.push(`${bw}.id: must be a string`);
          else {
            const bm = bullet.id.match(BULLET_ID_RE);
            if (!bm) errors.push(`${bw}.id: expected bullet id such as '3b.1'`);
            else if (bm[1] !== sub.id) errors.push(`${bw}.id: bullet ${bullet.id} does not belong to subsection ${sub.id}`);
            if (seenBullets.has(bullet.id)) errors.push(`${bw}.id: duplicate report bullet id ${bullet.id}`);
            seenBullets.add(bullet.id);
          }
          if (typeof bullet.text !== "string" || !bullet.text.trim()) errors.push(`${bw}.text: must be a non-empty string`);
          if (!ALLOWED_CONFIDENCE.has(bullet.confidence)) errors.push(`${bw}.confidence: expected 'confirmed' or 'unconfirmed', got ${JSON.stringify(bullet.confidence)}`);
          if (!Array.isArray(bullet.tweet_ids)) errors.push(`${bw}.tweet_ids: expected a JSON array`);
          else {
            const seen = new Set();
            bullet.tweet_ids.forEach((tid, ti) => {
              const tw = `${bw}.tweet_ids[${ti}]`;
              if (!Number.isInteger(tid)) errors.push(`${tw}: must be an integer tweet id from the paired input`);
              else {
                if (tid <= 0) errors.push(`${tw}: must be a positive integer`);
                if (seen.has(tid)) errors.push(`${tw}: duplicate tweet id ${tid} in the same evidence list`);
                seen.add(tid);
                if (cell && Array.isArray(cell.tweet_ids) && !cell.tweet_ids.includes(tid)) errors.push(`${tw}: tweet id ${tid} does not exist in ${cell.crisis}/${cell.stem}.tweets.jsonl`);
              }
            });
          }
        });
      });
    });
    return errors;
  }

  async function validateZip(file, zip, config, manifest) {
    const errors = [], warnings = [], systemSummaries = [];
    const entries = Object.values(zip.files);
    if (entries.length > config.MAX_ENTRIES) errors.push(`ZIP contains ${entries.length} entries; maximum allowed is ${config.MAX_ENTRIES}`);
    let totalUncompressed = 0;
    const fileNames = [];
    const topDirs = new Set();
    for (const e of entries) {
      if (!safeZipPath(e.name)) { errors.push(`ZIP contains unsafe path: ${e.name}`); continue; }
      if (isZipSymlink(e)) { errors.push(`ZIP contains symbolic link, which is not allowed: ${e.name}`); continue; }
      const parts = e.name.split('/').filter(Boolean);
      if (parts.length) topDirs.add(parts[0]);
      if (!e.dir) {
        fileNames.push(e.name);
        if (e._data && Number.isFinite(e._data.uncompressedSize)) totalUncompressed += e._data.uncompressedSize;
      }
    }
    if (totalUncompressed > config.MAX_TOTAL_UNCOMPRESSED_BYTES) errors.push(`ZIP uncompressed size exceeds configured limit (${config.MAX_TOTAL_UNCOMPRESSED_BYTES} bytes)`);
    if (topDirs.size !== 1) return { errors: errors.concat([`ZIP must contain exactly one top-level team directory; found: ${Array.from(topDirs).sort().join(', ') || '(none)'}`]), warnings, systemSummaries };
    const topDir = Array.from(topDirs)[0];
    if (!ID_RE.test(topDir)) errors.push(`Top-level directory ${JSON.stringify(topDir)} is not a valid machine-readable team ID`);
    const manifestPath = `${topDir}/submission.json`;
    const mf = zip.file(manifestPath);
    if (!mf) return { errors: errors.concat([`Missing required file: ${manifestPath}`]), warnings, systemSummaries, topDir };
    let manifestObj;
    try { manifestObj = JSON.parse(await readUtf8(mf, manifestPath)); }
    catch (e) { return { errors: errors.concat([e && e.message && e.message.includes('must be UTF-8') ? e.message : `${manifestPath}: invalid JSON: ${e.message}`]), warnings, systemSummaries, topDir }; }
    const mv = validateManifest(manifestObj, topDir, config);
    errors.push(...mv.errors);
    const declared = new Set(Object.keys(mv.systems));
    const actualSystems = new Set();
    const systemsPrefix = `${topDir}/systems/`;
    fileNames.forEach(n => {
      if (n.startsWith(systemsPrefix)) {
        const rest = n.slice(systemsPrefix.length).split('/').filter(Boolean);
        if (rest.length) actualSystems.add(rest[0]);
      }
    });
    declared.forEach(s => { if (!actualSystems.has(s)) errors.push(`Declared system has no directory: ${JSON.stringify(s)}`); });
    actualSystems.forEach(s => { if (!declared.has(s)) errors.push(`Undeclared system directory present: ${JSON.stringify(s)}`); });
    fileNames.forEach(n => {
      if (n !== manifestPath && !n.startsWith(systemsPrefix)) errors.push(`Unexpected file outside systems/: ${n}`);
    });

    const manifestCheck = validateTestManifest(manifest, config);
    const fullManifest = manifestCheck.valid;
    if (!fullManifest) {
      const msg = "Embedded test manifest is incomplete or inconsistent, so exact cell-name and tweet-ID checks are unavailable.";
      if (config.REQUIRE_FULL_TEST_MANIFEST) {
        errors.push(msg + " The site maintainer must regenerate submission-assets/test-manifest.json before deployment.");
        manifestCheck.errors.slice(0, 20).forEach(e => errors.push(e));
      } else {
        warnings.push(msg + " Use the CLI validator for full referential validation.");
        manifestCheck.errors.slice(0, 20).forEach(e => warnings.push(e));
      }
    }

    let reportsChecked = 0;
    for (const sid of Array.from(declared).sort()) {
      const prefix = `${topDir}/systems/${sid}/`;
      const obsolete = fileNames.filter(n => n.startsWith(`${prefix}test/`));
      if (obsolete.length) errors.push(`system ${JSON.stringify(sid)}: obsolete 'test/' directory is not allowed; put crisis directories directly under the system directory`);
      const reports = fileNames.filter(n => n.startsWith(prefix) && n.endsWith('.report.json'));
      const nonReports = fileNames.filter(n => n.startsWith(prefix) && !n.endsWith('.report.json'));
      nonReports.forEach(n => errors.push(`system ${JSON.stringify(sid)}: unexpected non-report file: ${n}`));
      const crisisCounts = {};
      Object.keys(config.EXPECTED_CRISIS_COUNTS).forEach(c => crisisCounts[c] = 0);
      const seenCellKeys = new Set();
      for (const path of reports) {
        const rel = path.slice(prefix.length);
        const parts = rel.split('/');
        if (parts.length !== 2) { errors.push(`${path}: expected <crisis>/<cell>.report.json directly under the system directory`); continue; }
        const [crisis, filename] = parts;
        if (!(crisis in config.EXPECTED_CRISIS_COUNTS)) { errors.push(`${path}: unexpected crisis directory ${JSON.stringify(crisis)}`); continue; }
        crisisCounts[crisis] += 1;
        const stem = filename.slice(0, -'.report.json'.length);
        const cellKey = `${crisis}/${stem}`;
        if (seenCellKeys.has(cellKey)) errors.push(`system ${JSON.stringify(sid)}: duplicate cell ${cellKey}`);
        seenCellKeys.add(cellKey);
        let cell = null;
        if (fullManifest) {
          cell = manifest.cells[cellKey] || null;
          if (!cell) errors.push(`${path}: no matching official test cell ${cellKey}`);
        }
        const zf = zip.file(path);
        let report;
        try { report = JSON.parse(await readUtf8(zf, path)); }
        catch (e) { errors.push(e && e.message && e.message.includes('must be UTF-8') ? e.message : `${path}: invalid JSON: ${e.message}`); continue; }
        errors.push(...validateReport(report, cell, path, config));
        reportsChecked += 1;
      }
      Object.entries(config.EXPECTED_CRISIS_COUNTS).forEach(([crisis, expected]) => {
        const got = crisisCounts[crisis] || 0;
        if (got !== expected) errors.push(`system ${JSON.stringify(sid)}: ${crisis} has ${got} report file(s); expected ${expected}`);
      });
      if (reports.length !== config.EXPECTED_TOTAL_REPORTS) errors.push(`system ${JSON.stringify(sid)}: has ${reports.length} report file(s); expected ${config.EXPECTED_TOTAL_REPORTS}`);
      systemSummaries.push({ id: sid, name: mv.systems[sid] && mv.systems[sid].name, primary: !!(mv.systems[sid] && mv.systems[sid].primary), reports: reports.length, crisisCounts });
    }
    return { errors, warnings, systemSummaries, topDir, manifest: manifestObj, reportsChecked, fullManifest };
  }

  root.LT4CPRValidator = { validateManifest, validateReport, validateTestManifest, validateZip, safeZipPath, isZipSymlink, constants: { ID_RE, SECTION_TITLES } };
  if (typeof module !== "undefined" && module.exports) module.exports = root.LT4CPRValidator;
})(typeof globalThis !== "undefined" ? globalThis : this);
