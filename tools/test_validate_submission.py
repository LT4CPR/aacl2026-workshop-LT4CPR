#!/usr/bin/env python3
"""Self-tests for validate_submission.py using a tiny synthetic release."""

from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
import zipfile
from pathlib import Path


HERE = Path(__file__).resolve().parent
VALIDATOR = HERE / "validate_submission.py"

spec = importlib.util.spec_from_file_location("validate_submission", VALIDATOR)
mod = importlib.util.module_from_spec(spec)
assert spec.loader is not None
import sys
sys.modules[spec.name] = mod
spec.loader.exec_module(mod)


def write_test_input(root: Path) -> None:
    p = root / "test" / "tornado"
    p.mkdir(parents=True)
    f = p / "tornado.W1.k1.tweets.jsonl"
    rows = [
        {"record_type": "crisis", "title": "Synthetic tornado"},
        {"record_type": "window", "cell_id": "tornado.W1.k1"},
        {
            "id": 1,
            "text": "Three people were injured.",
            "information_source": "Media",
            "timestamp": "Tue Jul 08 19:57:44 +0000 2025",
        },
        {
            "id": 2,
            "text": "The school was closed.",
            "information_source": "Government",
            "timestamp": "Tue Jul 08 20:00:00 +0000 2025",
        },
    ]
    f.write_text("\n".join(json.dumps(x) for x in rows) + "\n", encoding="utf-8")


def valid_report():
    return {
        "meta": {"schema_version": "1.2"},
        "sections": [
            {
                "id": "3",
                "title": "Casualties and human impact",
                "subsections": [
                    {
                        "id": "3b",
                        "title": "Injuries",
                        "bullets": [
                            {
                                "id": "3b.1",
                                "text": "Three people were injured.",
                                "confidence": "confirmed",
                                "tweet_ids": [1],
                            }
                        ],
                    }
                ],
            }
        ],
    }


def build_submission(path: Path, report=None, manifest=None, extra_files=None):
    report = valid_report() if report is None else report
    manifest = manifest or {
        "submission_format_version": "1.0",
        "team": {"id": "team-a", "name": "Team A"},
        "systems": [{"id": "sys1", "name": "System One", "primary": True}],
    }
    extra_files = extra_files or {}

    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as z:
        z.writestr("team-a/submission.json", json.dumps(manifest))
        z.writestr(
            "team-a/systems/sys1/tornado/tornado.W1.k1.report.json",
            json.dumps(report),
        )
        for name, content in extra_files.items():
            z.writestr(name, content)


class ValidatorTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.test_data = self.root / "testdata"
        self.test_data.mkdir()
        write_test_input(self.test_data)

    def tearDown(self):
        self.tmp.cleanup()

    def run_validation(self, *, report=None, manifest=None, extra_files=None):
        sub = self.root / "team-a.zip"
        build_submission(sub, report=report, manifest=manifest, extra_files=extra_files)
        return mod.validate_submission(sub, self.test_data)

    def test_valid_submission(self):
        r = self.run_validation()
        self.assertEqual(r.errors, [])

    def test_invalid_tweet_id(self):
        report = valid_report()
        report["sections"][0]["subsections"][0]["bullets"][0]["tweet_ids"] = [999]
        r = self.run_validation(report=report)
        self.assertTrue(any("does not exist" in e for e in r.errors))

    def test_duplicate_evidence_id(self):
        report = valid_report()
        report["sections"][0]["subsections"][0]["bullets"][0]["tweet_ids"] = [1, 1]
        r = self.run_validation(report=report)
        self.assertTrue(any("duplicate tweet id" in e for e in r.errors))

    def test_invalid_confidence(self):
        report = valid_report()
        report["sections"][0]["subsections"][0]["bullets"][0]["confidence"] = "potential"
        r = self.run_validation(report=report)
        self.assertTrue(any("confirmed" in e and "unconfirmed" in e for e in r.errors))

    def test_internal_id_leakage(self):
        report = valid_report()
        report["sections"][0]["subsections"][0]["bullets"][0]["text"] = "EV_CAN_017 happened."
        r = self.run_validation(report=report)
        self.assertTrue(any("forbidden internal identifier" in e for e in r.errors))

    def test_primary_rule(self):
        manifest = {
            "submission_format_version": "1.0",
            "team": {"id": "team-a", "name": "Team A"},
            "systems": [{"id": "sys1", "name": "System One", "primary": False}],
        }
        r = self.run_validation(manifest=manifest)
        self.assertTrue(any("exactly one system" in e for e in r.errors))

    def test_undeclared_system_directory(self):
        r = self.run_validation(
            extra_files={
                "team-a/systems/sys2/tornado/tornado.W1.k1.report.json":
                    json.dumps(valid_report())
            }
        )
        self.assertTrue(any("Undeclared system directory" in e for e in r.errors))

    def test_obsolete_test_layer_rejected(self):
        sub = self.root / "team-a.zip"
        manifest = {
            "submission_format_version": "1.0",
            "team": {"id": "team-a", "name": "Team A"},
            "systems": [{"id": "sys1", "name": "System One", "primary": True}],
        }
        with zipfile.ZipFile(sub, "w", compression=zipfile.ZIP_DEFLATED) as z:
            z.writestr("team-a/submission.json", json.dumps(manifest))
            z.writestr(
                "team-a/systems/sys1/test/tornado/tornado.W1.k1.report.json",
                json.dumps(valid_report()),
            )
        r = mod.validate_submission(sub, self.test_data)
        self.assertTrue(any("obsolete 'test/' directory" in e for e in r.errors))

    def test_bad_bullet_hierarchy(self):
        report = valid_report()
        report["sections"][0]["subsections"][0]["bullets"][0]["id"] = "4a.1"
        r = self.run_validation(report=report)
        self.assertTrue(any("does not belong to subsection" in e for e in r.errors))


if __name__ == "__main__":
    unittest.main()
