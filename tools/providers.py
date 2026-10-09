"""AI providers shared by the asset tools. Keys come from .env (loaded by just).

Each provider is a thin httpx client so tests can swap the transport, and each
factory fails with a readable message when its key is missing.
"""
import base64
import os
import time
from pathlib import Path

import httpx

MIME = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp"}


def require_key(name: str) -> str:
    key = os.environ.get(name)
    if not key:
        raise SystemExit(f"Set {name} in .env first (see .env.example).")
    return key


class OpenAIImages:
    """OpenAI Images API: edits when there are reference images, generations otherwise."""
    base = "https://api.openai.com/v1/images"

    def __init__(self, api_key: str, model: str, client: httpx.Client | None = None):
        self.model = model
        # Detailed images with many references can take a couple of minutes.
        self.client = client or httpx.Client(timeout=300, headers={"Authorization": f"Bearer {api_key}"})

    def create(self, prompt: str, images: list[Path], size: str, background: str = "transparent") -> bytes:
        options = {"model": self.model, "prompt": prompt, "size": size, "quality": "high",
                   "background": background, "output_format": "png"}
        if images:
            files = [("image[]", (path.name, path.read_bytes(), MIME[path.suffix.lower()])) for path in images]
            response = self.client.post(f"{self.base}/edits", data=options, files=files)
        else:
            response = self.client.post(f"{self.base}/generations", json=options)
        if response.is_error:
            raise SystemExit(f"OpenAI images failed ({response.status_code}): {response.text}")
        return base64.b64decode(response.json()["data"][0]["b64_json"])


class Meshy:
    """Meshy image-to-3D: one character image in, a textured GLB out."""
    base = "https://api.meshy.ai/openapi/v1/image-to-3d"

    def __init__(self, api_key: str, client: httpx.Client | None = None, poll_seconds: float = 5):
        self.poll_seconds = poll_seconds
        self.client = client or httpx.Client(timeout=120, headers={"Authorization": f"Bearer {api_key}"})

    def start(self, image: bytes, **options) -> str:
        data_uri = "data:image/png;base64," + base64.b64encode(image).decode()
        response = self.client.post(self.base, json={"image_url": data_uri, **options})
        if response.is_error:
            raise SystemExit(f"Meshy failed ({response.status_code}): {response.text}")
        return response.json()["result"]

    def wait(self, task_id: str, on_progress=print, timeout: float = 1200) -> dict:
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            task = self.client.get(f"{self.base}/{task_id}").raise_for_status().json()
            if task["status"] == "SUCCEEDED":
                return task
            if task["status"] in ("FAILED", "CANCELED"):
                raise SystemExit(f"Meshy task {task_id} {task['status'].lower()}: "
                                 f"{(task.get('task_error') or {}).get('message', 'no reason given')}")
            on_progress(f"  Meshy {task['status'].lower()} {task.get('progress', 0)}%")
            time.sleep(self.poll_seconds)
        raise SystemExit(f"Meshy task {task_id} timed out; check it later in the Meshy dashboard.")

    def download(self, url: str) -> bytes:
        # Result URLs are pre-signed: no Authorization header.
        return httpx.get(url, timeout=300, follow_redirects=True).raise_for_status().content


class Claude:
    """Claude through the Anthropic SDK; it designs data (e.g. a character's primitives) from images and text."""

    def __init__(self, model: str, client=None, effort: str = "high"):
        import anthropic  # Dev dependency: only the tools need it.
        self.model, self.effort = model, effort
        try:  # ANTHROPIC_API_KEY from .env, or an `ant auth login` profile.
            self.client = client or anthropic.Anthropic()
        except anthropic.AnthropicError:
            raise SystemExit("Set ANTHROPIC_API_KEY in .env first (see .env.example).")

    def reply(self, system: str, messages: list) -> list:
        """One assistant turn; returns its content blocks so a repair turn can append them unchanged."""
        with self.client.messages.stream(model=self.model, max_tokens=64000, system=system, messages=messages,
                                         output_config={"effort": self.effort}) as stream:
            message = stream.get_final_message()
        if message.stop_reason in ("refusal", "max_tokens"):
            raise SystemExit(f"Claude stopped early ({message.stop_reason}); nothing was installed.")
        return message.content


def image_block(path: Path) -> dict:
    return {"type": "image", "source": {"type": "base64", "media_type": MIME[path.suffix.lower()],
                                        "data": base64.standard_b64encode(path.read_bytes()).decode()}}


def openai_images() -> OpenAIImages:
    return OpenAIImages(require_key("OPENAI_API_KEY"), os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-2.5-sunburst"))


def meshy() -> Meshy:
    return Meshy(require_key("MESHY_API_KEY"))


def claude() -> Claude:
    return Claude(os.environ.get("CLAUDE_MODEL", "claude-opus-5-5"))
