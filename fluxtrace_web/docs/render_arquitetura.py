"""Exporta fluxtrace-arquitetura.html → PNG (Chrome headless, estilo do diagrama original)."""
from __future__ import annotations

import subprocess
from pathlib import Path

CHROME = Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe")
HERE = Path(__file__).resolve().parent
HTML = HERE / "fluxtrace-arquitetura.html"
PNG = HERE / "fluxtrace-arquitetura.png"


def main() -> None:
    if not CHROME.is_file():
        raise SystemExit(f"Chrome não encontrado: {CHROME}")
    uri = HTML.resolve().as_uri()
    subprocess.run(
        [
            str(CHROME),
            "--headless=new",
            "--disable-gpu",
            "--hide-scrollbars",
            "--force-device-scale-factor=1",
            "--window-size=2048,1116",
            f"--screenshot={PNG}",
            uri,
        ],
        check=True,
    )
    print(PNG, PNG.stat().st_size)


if __name__ == "__main__":
    main()
