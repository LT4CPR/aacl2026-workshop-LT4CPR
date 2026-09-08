/* LT4CPR submission portal configuration.
 * Edit OFFICIAL_SUBMISSION_URL when the upload form is ready.
 * Generate a complete test manifest with tools/build_test_manifest.py before deployment.
 */
window.LT4CPR_SUBMISSION_CONFIG = {
  VALIDATOR_VERSION: "1.1-browser",
  SUBMISSION_FORMAT_VERSION: "1.0",
  REPORT_SCHEMA_VERSION: "1.2",
  OFFICIAL_SUBMISSION_URL: "",
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
