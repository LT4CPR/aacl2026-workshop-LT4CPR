# LT4CPR official submission form — Google Forms setup

This repository uses a deliberately simple submission architecture:

```text
participant ZIP
    -> browser validator on submission.html
    -> local SHA-256 + validation receipt
    -> official Google Form
    -> ZIP stored in organizer Google Drive
    -> response metadata stored in linked Google Sheet
    -> organizer reruns tools/validate_submission.py
```

The workshop website never receives the ZIP during validation.

## Recommended form title

**LT4CPR Shared Task — Official System Submission**

Suggested description:

> Use this form only after your team ZIP passes the LT4CPR submission validator. Upload the exact ZIP that you validated. A local validation receipt is not proof of official submission. The organizers will rerun the authoritative validator after collecting the file. If multiple valid submissions are received from the same Team ID before the deadline, the most recent valid submission will be treated as final.

## Recommended questions

Use the following order.

1. **Team ID** — Short answer — Required
   - Description: `Must match the top-level directory and ZIP filename, e.g. uw-crisisnlp.`

2. **Team name** — Short answer — Required

3. **Primary contact name** — Short answer — Required

4. **Contact email** — Short answer — Required
   - Use Google Forms email validation if desired.

5. **Primary system ID** — Short answer — Required
   - Description: `Must match the system marked "primary": true in submission.json.`

6. **Submission type** — Multiple choice — Required
   - `Initial submission`
   - `Replacement / revised submission`

7. **Team ZIP** — File upload — Required
   - Allow only: ZIP/archive if the UI offers the restriction; otherwise state `.zip` explicitly in the question.
   - Maximum number of files: 1
   - Choose a size limit comfortably above the website validator limit. The portal currently accepts ZIPs up to 100 MB.
   - Description: `Upload the exact <team_id>.zip that passed the LT4CPR validator.`

8. **SHA-256 from the LT4CPR validator** — Short answer — Required
   - Description: `Paste the 64-character SHA-256 displayed by the submission validator.`
   - Recommended response validation: regular expression matching 64 hexadecimal characters.

9. **Validator confirmation** — Checkbox — Required
   - `I confirm that this exact ZIP passed the LT4CPR browser submission validator.`

10. **Submission declaration** — Checkbox — Required
   - `I confirm that I am authorized to submit this system on behalf of the team and that the information above is accurate.`

11. **Comments** — Paragraph — Optional
   - For replacement notes, unusual circumstances, or organizer-facing comments.

## Form settings

Recommended settings:

- Keep the form in the organizer's **My Drive** rather than a Shared Drive when using a file-upload question.
- Link responses to a dedicated Google Sheet.
- Do **not** enable "Limit to 1 response" because teams are allowed to submit replacements.
- Decide whether to collect verified Google-account email addresses separately from the explicit `Contact email` question. Keeping the explicit contact field makes the response sheet easier to interpret.
- Leave response editing off unless the organizers specifically want it; a replacement submission is cleaner provenance than silently editing an earlier response.
- Customize the confirmation message to remind participants that organizer-side validation is still pending.

Google Forms file-upload questions require respondents to sign in to a Google Account. Consider stating this on the workshop submission page in advance.

## Recommended confirmation message

> Your LT4CPR submission has been received by the official submission form. This confirmation indicates receipt only. The organizers will rerun the authoritative LT4CPR submission validator. If you need to replace your submission before the deadline, validate the new ZIP and submit the form again using the same Team ID and selecting “Replacement / revised submission.”

## Link the website to the form

After the form is ready:

1. Open the form's public response link.
2. Copy the URL.
3. Edit `submission-assets/config.js`.
4. Set:

```js
OFFICIAL_SUBMISSION_URL: "https://docs.google.com/forms/d/e/.../viewform",
```

5. Commit and deploy the website.

Until this value is configured, the website intentionally keeps the Google Form button disabled even after a ZIP passes validation.

## Organizer response sheet

A useful sheet layout is:

| Timestamp | Team ID | Team name | Contact | Email | Primary system | Type | ZIP | SHA-256 | Browser confirmed | Comments | Organizer validation | Validation notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

The first fields come from Google Forms. The final two columns can be maintained by organizers after running the Python validator.

## Resubmission rule

Recommended policy:

> If multiple submissions are received from the same Team ID before the deadline, the most recent submission that passes organizer-side validation is treated as final.

Do not delete earlier responses or files. They are useful provenance if a replacement later proves invalid.

## Organizer-side validation

For each collected ZIP, run:

```bash
python3 tools/validate_submission.py \
  --submission path/to/<team_id>.zip \
  --test-data path/to/released/test.zip
```

Record the result in the linked response sheet. Only organizer-side `VALID` submissions should proceed to evaluation.
