"""Contract checks at the real stdout and journal writers, without network."""
import contextlib
import importlib.util
import io
import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("jev", ROOT / "src/skills/expect/scripts/jev_shadow.py")
jev = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(jev)
KEYS = {"jev_pick", "jev_confidence", "incumbent_pick", "agree", "floor", "decided_by"}


class WriterContract(unittest.TestCase):
    def invoke(self, directory, *, action="click @e3", mode="shadow", response=None, error=None, config="normal", key="fixture"):
        args = ["jev_shadow.py", "--step-id", "contract",
                "--snapshot-file", str(ROOT / "tests/fixtures/expect/aria-login.txt"),
                "--log-file", str(directory / "journal.jsonl")]
        args += ["--model-action", action] if action else ["--incumbent-not-run", "incumbent_not_invoked"]
        output = io.StringIO()
        cfg = jev.resolve_config(None)
        if config == "absent":
            cfg = None
        elif config == "invalid":
            cfg["element_cap"] = 0
        with patch.dict(os.environ, {"ORK_EXPECT_JEV": mode, "ORK_TYPESAFE_API_KEY": key}, clear=True), \
                patch("sys.argv", args), patch.object(jev, "resolve_config", return_value=cfg), \
                patch.object(jev, "post_jev", return_value=response, side_effect=error), \
                contextlib.redirect_stdout(output):
            self.assertEqual(jev.main(), 0)
        row = json.loads(output.getvalue().split("|", 2)[2])
        saved = json.loads((directory / "journal.jsonl").read_text().splitlines()[-1])
        self.assertEqual(saved, row)
        for key in KEYS:
            self.assertIn(key, saved)
        if saved["incumbent_pick"] is None:
            self.assertTrue(saved["incumbent_pick_reason"])
        self.assertEqual((directory / "journal.jsonl").stat().st_mode & 0o777, 0o600)
        return row

    def test_success_and_all_failure_exits_append_complete_pairs(self):
        response = json.loads((ROOT / "tests/fixtures/expect/jev-response-agree.json").read_text())
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp)
            for case in [{"response": response}, {"error": TimeoutError()}, {"response": {}},
                         {"config": "absent"}, {"config": "invalid"}, {"error": ValueError()}, {"key": ""}]:
                with self.subTest(case=case):
                    row = self.invoke(directory, **case)
                    self.assertIn(row["incumbent_pick"], ["click:@e3", "click @e3"])
                    self.assertEqual(row["decided_by"], "incumbent")
            self.assertEqual(len((directory / "journal.jsonl").read_text().splitlines()), 7)

    def test_success_fields_and_act_authority(self):
        response = json.loads((ROOT / "tests/fixtures/expect/jev-response-agree.json").read_text())
        with tempfile.TemporaryDirectory() as temp:
            row = self.invoke(Path(temp), response=response, mode="act")
            self.assertEqual(row["jev_pick"], "click:@e3")
            self.assertEqual(row["jev_confidence"], response["answers"]["next_action"]["confidence"])
            self.assertEqual(row["floor"], 0.5)
            self.assertTrue(row["agree"])
            self.assertEqual(row["decided_by"], "jev")

    def test_unmatched_action_is_preserved_and_missing_action_explained(self):
        with tempfile.TemporaryDirectory() as temp:
            row = self.invoke(Path(temp), action="press Escape")
            self.assertEqual(row["incumbent_pick"], "press Escape")
            self.assertIsNone(row["agree"])
            row = self.invoke(Path(temp), action="")
            self.assertIsNone(row["incumbent_pick"])
            self.assertEqual(row["incumbent_pick_reason"], "incumbent_not_invoked")
            self.assertEqual(row["decided_by"], "none")

    def test_missing_incumbent_evidence_is_rejected_before_writing(self):
        with tempfile.TemporaryDirectory() as temp:
            log = Path(temp) / "journal.jsonl"
            with patch.dict(os.environ, {"ORK_EXPECT_JEV": "shadow"}, clear=True), \
                    patch("sys.argv", ["jev_shadow.py", "--log-file", str(log)]), \
                    contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit) as error:
                jev.main()
            self.assertEqual(error.exception.code, 2)
            self.assertFalse(log.exists())

    def test_report_writer_preserves_the_complete_producer_row(self):
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp)
            row = self.invoke(directory, key="")
            protocol = "STEP_START|contract|Writer check\nJEV_SHADOW|contract|" + json.dumps(row) + "\nSTEP_DONE|contract|ok\n"
            subprocess.run(["bash", str(ROOT / "src/skills/expect/scripts/report.sh"), "--save"],
                           input=protocol, text=True, capture_output=True, cwd=directory, check=True)
            report = json.loads(next((directory / ".expect/reports").glob("*.json")).read_text())
            saved = report["steps"][0]["jev_shadow"]
            self.assertEqual(saved, row)
            self.assertTrue(saved.keys() >= KEYS)


if __name__ == "__main__":
    unittest.main()
