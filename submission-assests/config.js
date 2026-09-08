/* LT4CPR submission portal configuration.
 * Set OFFICIAL_SUBMISSION_URL to the public Google Form response URL.
 * The released 117-cell public test manifest is already embedded in this bundle.
 */
window.LT4CPR_SUBMISSION_CONFIG = {
  VALIDATOR_VERSION: "1.2-browser",
  SUBMISSION_FORMAT_VERSION: "1.0",
  REPORT_SCHEMA_VERSION: "1.2",
  OFFICIAL_SUBMISSION_URL: "https://forms.gle/bo41dwmdYouLqqXe9",
  TEST_MANIFEST_URL: "submission-assets/test-manifest.json",
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
  MAX_ZIP_BYTES: 100 * 1024 * 1024,
  MAX_ENTRIES: 1000,
  MAX_TOTAL_UNCOMPRESSED_BYTES: 300 * 1024 * 1024
};
