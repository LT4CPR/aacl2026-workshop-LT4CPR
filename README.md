# LT4CPR 2026 workshop website

Official website for Language Technologies for Crisis Preparedness and Response at AACL-IJCNLP 2026.

[Visit the website](https://lt4cpr.github.io/aacl2026-workshop-LT4CPR/index.html)

## Repository layout

| Location | Contents |
| --- | --- |
| Root HTML files | Published website pages; `index.html` and `program.html` contain the public agenda |
| Root CSS and `navigation.js` | Shared website styles and navigation |
| `img/` | Speaker photos, logos, and venue images |
| `outreach/linkedin/` | Editable LinkedIn post, HTML flyer, and exported PNG |
| `outreach/flyers/` | Printable flyer and other social graphics |
| `outreach/announcements/` | Slack and ACL announcement copy |
| `drafts/` | Working and preview versions of the programme |
| `docs/submissions/` | Submission portal documentation, Google Form setup, and deployment checklist |
| `docs/organizing/` | Organizing materials, including the programme committee source |
| `reports/` | Published field reports; `source/` preserves original supplied files |
| `submission-assets/` | Browser submission validator code, configuration, styles, and test manifest |
| `tools/` | Organizer CLI validator and manifest generator |
| `tests/` | Python and JavaScript validator tests |

The published results workbook, favicon, and social preview image stay at the root to preserve their download and metadata URLs. The old `flyer.html`, `program-draft.html`, and `program-preview.html` URLs redirect to their new locations, preserving query strings and fragments when JavaScript is enabled.

## Current outreach drafts

- [LinkedIn post](outreach/linkedin/linkedin-post.md)
- [Editable LinkedIn flyer](outreach/linkedin/linkedin-flyer.html)
- [LinkedIn flyer PNG](outreach/linkedin/linkedin-flyer.png)

Edit the HTML flyer and re-export the PNG after visual changes. Image paths in the HTML are relative to its folder.

## Local preview

Run from the repository root:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/` for the website or `http://localhost:8000/outreach/linkedin/linkedin-flyer.html` for the flyer.

## Submission validation

See the [submission portal documentation](docs/submissions/README_SUBMISSION_PORTAL.md). Run these checks from the repository root:

```sh
python3 -m unittest discover -s tests -p 'test_*.py' -v
node tests/test_submission_validator.js
```
