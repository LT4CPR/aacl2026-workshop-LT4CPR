const assert = require('assert');
const fs = require('fs');
const V = require('./submission-assets/validator-core.js');

const cfg = {
  SUBMISSION_FORMAT_VERSION: '1.0',
  REPORT_SCHEMA_VERSION: '1.2',
  REQUIRE_FULL_TEST_MANIFEST: true,
  EXPECTED_TOTAL_REPORTS: 117,
  EXPECTED_CRISIS_COUNTS: {
    collapse: 19,
    damsafety: 19,
    heatwave: 13,
    indfire: 16,
    landslide: 28,
    tornado: 22
  },
  MAX_ENTRIES: 1000,
  MAX_TOTAL_UNCOMPRESSED_BYTES: 300 * 1024 * 1024
};

function fakeFile(name, text, unixPermissions = 0o100644) {
  const bytes = new TextEncoder().encode(text);
  return {
    name,
    dir: false,
    unixPermissions,
    _data: { uncompressedSize: bytes.length },
    async: async (type) => {
      if (type === 'uint8array') return bytes;
      if (type === 'string') return text;
      throw new Error(`unsupported fake async type ${type}`);
    }
  };
}

function fakeZip(textFiles) {
  const files = {};
  for (const [name, text] of Object.entries(textFiles)) files[name] = fakeFile(name, text);
  return { files, file: name => files[name] || null };
}

async function main() {
  const m = {submission_format_version:'1.0',team:{id:'team-a',name:'Team A'},systems:[{id:'sys1',name:'System 1',primary:true}]};
  assert.deepStrictEqual(V.validateManifest(m,'team-a',cfg).errors,[]);
  assert(V.validateManifest({...m, systems:[{id:'sys1',name:'System 1',primary:false}]},'team-a',cfg).errors.some(x=>x.includes('exactly one')));
  assert.strictEqual(V.safeZipPath('team-a/systems/sys1/tornado/a.report.json'), true);
  assert.strictEqual(V.safeZipPath('../evil'), false);
  assert.strictEqual(V.isZipSymlink({unixPermissions: 0o120777}), true);
  assert.strictEqual(V.isZipSymlink({unixPermissions: 0o100644}), false);

  const report={meta:{schema_version:'1.2'},sections:[{id:'3',title:'Casualties and human impact',subsections:[{id:'3b',title:'Injuries',bullets:[{id:'3b.1',text:'Three people were injured.',confidence:'confirmed',tweet_ids:[1]}]}]}]};
  assert.deepStrictEqual(V.validateReport(report,{crisis:'tornado',stem:'x',tweet_ids:[1]},'r',cfg),[]);
  assert(V.validateReport(report,{crisis:'tornado',stem:'x',tweet_ids:[2]},'r',cfg).some(x=>x.includes('does not exist')));

  const testManifest = JSON.parse(fs.readFileSync('./submission-assets/test-manifest.json', 'utf8'));
  const mc = V.validateTestManifest(testManifest, cfg);
  assert.deepStrictEqual(mc.errors, []);
  assert.strictEqual(mc.valid, true);

  // Regression for the earlier wrong key format: 117 cells is not sufficient if keys are malformed.
  const wrongKeyManifest = JSON.parse(JSON.stringify(testManifest));
  const firstKey = Object.keys(wrongKeyManifest.cells)[0];
  const wrongKey = firstKey.replace('/', '.');
  wrongKeyManifest.cells[wrongKey] = wrongKeyManifest.cells[firstKey];
  delete wrongKeyManifest.cells[firstKey];
  assert.strictEqual(V.validateTestManifest(wrongKeyManifest, cfg).valid, false);

  // Full 117-cell browser integration test using the released manifest.
  const textFiles = {
    'team-a/submission.json': JSON.stringify(m)
  };
  const emptyReport = JSON.stringify({meta:{schema_version:'1.2'},sections:[]});
  for (const key of Object.keys(testManifest.cells)) {
    const [crisis, stem] = key.split('/');
    textFiles[`team-a/systems/sys1/${crisis}/${stem}.report.json`] = emptyReport;
  }
  const res = await V.validateZip({name:'team-a.zip'}, fakeZip(textFiles), cfg, testManifest);
  assert.deepStrictEqual(res.errors, []);
  assert.strictEqual(res.fullManifest, true);
  assert.strictEqual(res.reportsChecked, 117);
  assert.strictEqual(res.systemSummaries.length, 1);
  assert.strictEqual(res.systemSummaries[0].reports, 117);

  const wrongFilename = await V.validateZip({name:'not-team-a.zip'}, fakeZip(textFiles), cfg, testManifest);
  assert(wrongFilename.errors.some(x => x.includes('ZIP filename must be exactly team-a.zip')));

  // A report referencing an ID outside its paired cell must fail.
  const evidenceFiles = {...textFiles};
  const sampleKey = Object.keys(testManifest.cells)[0];
  const [crisis, stem] = sampleKey.split('/');
  const maxId = Math.max(...testManifest.cells[sampleKey].tweet_ids);
  evidenceFiles[`team-a/systems/sys1/${crisis}/${stem}.report.json`] = JSON.stringify({
    meta:{schema_version:'1.2'},
    sections:[{id:'1',title:'Situation overview',subsections:[{id:'1a',title:'Overview',bullets:[{id:'1a.1',text:'Test.',confidence:'confirmed',tweet_ids:[maxId+1]}]}]}]
  });
  const badEvidence = await V.validateZip({name:'team-a.zip'}, fakeZip(evidenceFiles), cfg, testManifest);
  assert(badEvidence.errors.some(x => x.includes('does not exist')));

  console.log('browser validator core + released-manifest integration tests: OK');
}

main().catch(err => { console.error(err); process.exit(1); });
