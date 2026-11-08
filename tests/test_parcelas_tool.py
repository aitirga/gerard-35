import io
import json
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import parcelas  # noqa: E402

# The real levels are 5 × 5; the tests use small boards with the same rules.
parcelas.LEVELS["mini"] = {**parcelas.LEVELS["prueba"], "cols": 3, "rows": 3, "clues": [2, 2]}
parcelas.LEVELS["mini-dura"] = {**parcelas.LEVELS["produccion"], "cols": 4, "rows": 4, "clues": [3, 2, 2], "hits": .6}

BANK = ["MAR", "OLA", "ARENA", "TOALLA", "DADO", "CARTA", "PINO", "GATO", "LUNA", "TREN"]
# 3×3: PLAYA → OLA, ARENA; JUEGO → DADO, CARTA; TREN is the black pitch.
GOOD = {
    "pitches": [{"word": "OLA", "role": "ours"}, {"word": "DADO", "role": "ours"}, {"word": "PINO", "role": "tent"},
                {"word": "ARENA", "role": "ours"}, {"word": "CARTA", "role": "ours"}, {"word": "GATO", "role": "tent"},
                {"word": "LUNA", "role": "tent"}, {"word": "TREN", "role": "black"}, {"word": "TOALLA", "role": "tent"}],
    "clues": [{"word": "PLAYA", "count": 2, "targets": [0, 3]}, {"word": "JUEGO", "count": 2, "targets": [1, 4]}],
}


def block(data):
    return [SimpleNamespace(type="text", text=json.dumps(data))]


class FakeClaude:
    """Answers the composer with `puzzles` in turn and the guesser with `guesses`."""

    def __init__(self, puzzles, guesses):
        self.puzzles, self.guesses, self.calls = list(puzzles), list(guesses), []

    def reply(self, system, messages):
        self.calls.append(messages[-1]["content"])
        if "play word games" in system:
            return block({"guesses": self.guesses.pop(0)})
        return block(self.puzzles.pop(0))


class ValidateTest(unittest.TestCase):
    def test_a_sound_puzzle_has_no_problems(self):
        self.assertEqual(parcelas.validate(GOOD, "mini", BANK), [])

    def test_a_clue_that_gives_a_pitch_away_is_refused(self):
        bad = json.loads(json.dumps(GOOD))
        bad["clues"][0]["word"] = "OLAS"
        self.assertTrue(any("too close" in p for p in parcelas.validate(bad, "mini", BANK)))

    def test_every_ours_pitch_needs_one_clue_and_one_black(self):
        bad = json.loads(json.dumps(GOOD))
        bad["pitches"][2]["role"] = "ours"
        bad["pitches"][7]["role"] = "tent"
        problems = parcelas.validate(bad, "mini", BANK)
        self.assertTrue(any("black" in p for p in problems))
        self.assertTrue(any("exactly one clue" in p for p in problems))

    def test_words_must_come_from_the_bank(self):
        bad = json.loads(json.dumps(GOOD))
        bad["pitches"][2]["word"] = "NUBE"
        self.assertTrue(any("not in the word bank" in p for p in parcelas.validate(bad, "mini", BANK)))


class ScoreTest(unittest.TestCase):
    def test_a_guess_stops_at_the_first_wrong_pitch(self):
        result = parcelas.score(GOOD, [["OLA", "GATO"], ["CARTA", "DADO"]])
        self.assertEqual((result["hits"], result["black"]), (3, False))
        self.assertFalse(parcelas.passes(result, "mini"))

    def test_the_black_pitch_fails_the_easy_level(self):
        result = parcelas.score(GOOD, [["OLA", "ARENA"], ["TREN", "DADO"]])
        self.assertTrue(result["black_first"])
        self.assertFalse(parcelas.passes(result, "mini"))
        self.assertTrue(parcelas.passes(parcelas.score(GOOD, [["OLA", "ARENA"], ["DADO", "CARTA"]]), "mini"))


class RunTest(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp())
        (self.root / "assets/parcelas").mkdir(parents=True)
        (self.root / "assets/parcelas/palabras.txt").write_text("# words\n" + "\n".join(BANK) + "\n")

    def test_the_test_puzzle_is_retried_until_the_guesser_solves_it_and_gets_a_page(self):
        wrong = json.loads(json.dumps(GOOD))
        wrong["clues"][0]["word"] = "OLAS"
        claude = FakeClaude([wrong, GOOD], [[["OLA", "ARENA"], ["DADO", "CARTA"]]])
        target = parcelas.run(["mini"], root=self.root, claude=claude, log=lambda *a: None)
        self.assertEqual(json.loads(target.read_text())["pitches"][7], {"word": "TREN", "role": "black"})
        self.assertIn("too close", claude.calls[1])
        self.assertIn("PLAYA", (self.root / "output/parcelas/prueba.html").read_text())

    def test_the_real_puzzle_is_sealed_and_never_printed(self):
        hard = {"pitches": [{"word": w, "role": "tent"} for w in BANK[:6]] + [{"word": w, "role": "tent"} for w in
                ["SOL", "PIE", "MANO", "OJO", "LUZ", "FLOR", "PAN", "SAL", "COPA", "RED"]],
                "clues": [{"word": "VERANO", "count": 3, "targets": [0, 1, 2]}, {"word": "MESA", "count": 2, "targets": [4, 5]},
                          {"word": "BOSQUE", "count": 2, "targets": [6, 7]}]}
        for i in (0, 1, 2, 4, 5, 6, 7):
            hard["pitches"][i]["role"] = "ours"
        hard["pitches"][15]["role"] = "black"
        bank = [p["word"] for p in hard["pitches"]]
        (self.root / "assets/parcelas/palabras.txt").write_text("\n".join(bank))
        claude = FakeClaude([hard], [[["MAR", "OLA", "ARENA"], ["CARTA", "PINO"], ["SOL"]]])
        out = io.StringIO()
        with redirect_stdout(out):
            target = parcelas.run(["mini-dura"], root=self.root, claude=claude)
        stored = target.read_text()
        self.assertNotIn("VERANO", stored)
        self.assertNotIn("VERANO", out.getvalue())
        self.assertEqual(parcelas.unseal(json.loads(stored))["clues"][0]["word"], "VERANO")
        self.assertFalse((self.root / "output/parcelas/prueba.html").exists())
        with self.assertRaises(SystemExit):
            parcelas.run(["mini-dura"], root=self.root, claude=claude, log=lambda *a: None)


class AskTest(unittest.TestCase):
    def test_a_reply_stopped_by_a_filter_is_asked_again(self):
        answers = [SystemExit("Claude stopped early (refusal); nothing was installed."), block({"ok": 1})]

        class Flaky:
            def reply(self, system, messages):
                answer = answers.pop(0)
                if isinstance(answer, BaseException):
                    raise answer
                return answer
        self.assertEqual(parcelas.text_of(parcelas.ask(Flaky(), "s", [], log=lambda *a: None)), '{"ok": 1}')

if __name__ == "__main__":
    unittest.main()
