# LT4CPR submission portal — deployment checklist

## Website validator

- [x] Real public `submission-assets/test-manifest.json` is embedded
- [x] Manifest has exactly 117 cells
- [x] Crisis counts match the released test set
- [x] Browser validates evidence IDs against exact cells
- [x] Python/browser validator parity regression tests pass
- [x] Exact `<team_id>.zip` filename rule is enforced
- [x] Browser computes local SHA-256
- [x] Browser offers a downloadable local validation receipt
- [x] Browser does not upload or retain participant ZIPs during validation

## Google Form

- [ ] Create **LT4CPR Shared Task — Official System Submission** in organizer My Drive
- [ ] Add the questions specified in `GOOGLE_FORM_SETUP.md`
- [ ] File upload is required and limited to one ZIP
- [ ] Form allows replacement submissions (do not limit teams to one response)
- [ ] Response destination is linked to a dedicated Google Sheet
- [ ] Confirmation message explains that organizer validation is still pending
- [ ] Test the form using a non-organizer Google account
- [ ] Confirm uploaded ZIP appears in the organizer's Drive
- [ ] Confirm form response and file link appear in the response Sheet

## Website → Google Form handoff

- [ ] Copy the public Google Form response URL
- [ ] Set `OFFICIAL_SUBMISSION_URL` in `submission-assets/config.js`
- [ ] Confirm the button is locked before validation
- [ ] Confirm the button unlocks only after a valid ZIP
- [ ] Confirm clicking it opens the correct Google Form in a new tab
- [ ] Confirm page tells participants to upload the exact validated ZIP and retain SHA-256

## End-to-end acceptance test

- [ ] Valid one-system ZIP: browser PASS → form upload → organizer Python PASS
- [ ] Valid multi-system ZIP: browser PASS → form upload → organizer Python PASS
- [ ] Invalid ZIP: browser blocks official-form link
- [ ] Replacement submission from same Team ID can be received
- [ ] Earlier valid submission remains available if a later replacement is invalid
- [ ] SHA-256 pasted in the Form matches `sha256sum <team_id>.zip`
- [ ] Final submission Sheet can be filtered/sorted by Team ID and timestamp

## Organizer procedure after deadline

- [ ] Download all received ZIPs / preserve original Drive files
- [ ] Rerun `tools/validate_submission.py` on every candidate submission
- [ ] Record `VALID` / `INVALID` and notes in the linked Google Sheet
- [ ] For each Team ID, select the most recent organizer-valid submission before the deadline
- [ ] Preserve superseded submissions for provenance
- [ ] Only selected organizer-valid submissions proceed to evaluation
