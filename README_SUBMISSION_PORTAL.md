# LT4CPR browser submission portal

The LT4CPR submission workflow intentionally separates **validation** from **official file collection**.

```text
GitHub Pages submission.html
    -> local browser ZIP validation
    -> SHA-256 + local validation receipt
    -> official Google Form
    -> organizer Google Drive + linked response Sheet
    -> organizer-side Python revalidation
```

## Why this architecture

GitHub Pages is static hosting and should not be used as the permanent file receiver. The browser validator therefore reads the participant ZIP locally. The ZIP is sent only when the participant explicitly uploads it through the official Google Form.

This keeps the public website simple while giving organizers a centralized file collection and response table.

## Released test integration

`submission-assets/test-manifest.json` is generated from the released public `test.zip` and contains the exact 117 public test cells and their valid public tweet IDs.

Inventory:

- collapse: 19
- damsafety: 19
- heatwave: 13
- indfire: 16
- landslide: 28
- tornado: 22
- total: 117

The manifest contains only information required for validation; it does not contain tweet text, gold reports, hidden cells, seeds, organizer ID maps, or private semantic metadata.

## Browser checks

The browser validator checks, among other rules:

- readable/safe ZIP structure;
- exact `<team_id>.zip` filename and one matching top-level team directory;
- `submission.json` format/version;
- team/system IDs and exactly one primary system;
- exact manifest/system-directory agreement;
- rejection of obsolete `systems/<system>/test/...` nesting;
- complete 117-report coverage per submitted system;
- report schema v1.2 and Sections 1–11 hierarchy;
- `confirmed` / `unconfirmed` confidence values;
- positive integer evidence IDs belonging to the paired public test cell;
- duplicate evidence IDs and obvious internal-ID leakage;
- local SHA-256 calculation.

Passing the browser validator means the ZIP is structurally and referentially valid. It does **not** certify semantic quality.

## Configure the official Google Form

See `GOOGLE_FORM_SETUP.md` for the recommended fields and settings.

When the Form is ready, edit:

```text
submission-assets/config.js
```

and set:

```js
OFFICIAL_SUBMISSION_URL: "https://docs.google.com/forms/d/e/.../viewform",
```

Until this is configured, the Google Form button remains disabled even after successful validation.

## Authoritative validation

The organizer-side Python implementation remains authoritative:

```bash
python3 tools/validate_submission.py \
  --submission path/to/<team_id>.zip \
  --test-data path/to/released/test.zip
```

The recommended final-selection policy is:

> If multiple submissions are received from the same Team ID before the deadline, the most recent submission that passes organizer-side validation is treated as final.

Earlier responses/files should be preserved for provenance.

## Regression tests

Run from the repository root:

```bash
python -m unittest tools/test_validate_submission.py -v
node test_submission_validator.js
```

## Main files

- `submission.html` — participant-facing validator and Google Form handoff
- `submission-assets/submission.css` — page-specific styling
- `submission-assets/config.js` — workshop configuration and Google Form URL
- `submission-assets/validator-core.js` — browser validator
- `submission-assets/submission.js` — browser UI, SHA-256 receipt, Google Form unlock
- `submission-assets/test-manifest.json` — real released 117-cell public manifest
- `tools/build_test_manifest.py` — reproducible manifest generator
- `tools/validate_submission.py` — authoritative organizer CLI validator
- `tools/test_validate_submission.py` — Python regression tests
- `GOOGLE_FORM_SETUP.md` — exact recommended Form configuration
- `SUBMISSION_DEPLOYMENT_CHECKLIST.md` — release checklist
