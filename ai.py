"""AI providers behind the game API. The API key never reaches the browser.

Each game task picks its provider by name through an environment variable, so a
text model (for example real-time dialogue) can join later as another provider
without touching the battle code.
"""
import os

import httpx


class JevProvider:
    """TypeSafe's Jev: text state in, typed probabilistic decisions out."""
    name = "jev"
    url = "https://api.typesafe.ai/v1/systemone"

    def __init__(self, api_key: str, model: str = "jev-latest", client: httpx.Client | None = None):
        self.api_key, self.model = api_key, model
        self.client = client or httpx.Client(timeout=2.0)

    def decide(self, state: str, questions: dict) -> dict:
        response = self.client.post(self.url, headers={"Authorization": f"Bearer {self.api_key}"},
                                    json={"model": self.model, "state": state, "questions": questions})
        response.raise_for_status()
        return response.json()["answers"]


def jev() -> JevProvider | None:
    key = os.environ.get("TYPESAFE_API_KEY")
    return JevProvider(key, os.environ.get("JEV_MODEL", "jev-latest")) if key else None


DECISION_PROVIDERS = {"jev": jev}


def decision_provider(task: str) -> JevProvider | None:
    """The configured provider for a task (e.g. AI_BATTLE_PROVIDER), or None for rules only."""
    name = os.environ.get(f"AI_{task.upper()}_PROVIDER", "jev")
    factory = DECISION_PROVIDERS.get(name)
    return factory() if factory else None


# Friendly personalities keep each dog recognisable; indices match DOG_PROFILES in src/encounters.ts.
DOGS = [
    ("Canela", "bold and goes for whoever looks most tired"),
    ("Nube", "shy and avoids anyone who is guarding"),
    ("Trufa", "stubborn and prefers the strongest-looking hero"),
    ("Chispa", "playful and a little chaotic"),
]
HEROES = {"gerard": "Gerard", "bernat": "Bernat"}


def condition(hp: int, max_hp: int, guarding: bool) -> str:
    # Words instead of numbers: decision models reason poorly about raw figures.
    ratio = hp / max_hp
    shape = "fresh" if ratio > .75 else "a bit tired" if ratio > .4 else "very tired"
    return f"{shape}{', guarding (pushes barely land)' if guarding else ''}"


def plan_enemy_turn(provider: JevProvider, allies: list, foes: list) -> dict[str, str]:
    """Pick which hero each standing dog pushes. Returns {foe_id: ally_id}."""
    heroes = [a for a in allies if a.hp > 0]
    dogs = [(f, *DOGS[int(f.id.split("-")[1])]) for f in foes if f.hp > 0]
    if len(heroes) < 2 or not dogs:
        return {}  # Nothing to decide: every dog pushes the only hero left.
    state = "Cozy turn-based street scuffle in a birthday game: playful dogs push the heroes, nobody gets hurt.\n"
    state += "Heroes:\n" + "".join(f"- {HEROES[a.id]}: {condition(a.hp, a.max_hp, a.guarding)}\n" for a in heroes)
    state += "Dogs:\n" + "".join(f"- {name}: {condition(f.hp, f.max_hp, False)}, {temper}\n" for f, name, temper in dogs)
    criteria = {a.id: f"Push {HEROES[a.id]}" for a in heroes}
    questions = {f.id: {"type": "choice", "criteria": criteria,
                        "instructions": f"{name} is {temper}. Which hero does {name} push this turn?"}
                 for f, name, temper in dogs}
    answers = provider.decide(state, questions)
    return {foe: answer["choice"] for foe, answer in answers.items()
            if foe in questions and answer.get("choice") in criteria}
