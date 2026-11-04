"""Recalcule le total des revenus de REVENUE.md et met à jour le tableau de bord du README.md.

Usage (depuis le dossier money-skills-lab) :  python3 automation/revenue_total.py
Aucune dépendance : Python 3 standard (gratuit).
"""
from __future__ import annotations

import datetime as dt
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
REVENUE = ROOT / "REVENUE.md"
README = ROOT / "README.md"
START, END = "<!-- REVENUE:START -->", "<!-- REVENUE:END -->"
ROW = re.compile(r"^\|\s*(\d{4}-\d{2}-\d{2})\s*\|([^|]*)\|([^|]*)\|\s*([\d\s.,]+)\s*\|([^|]*)\|\s*$")


def read_entries(text: str) -> list[tuple[str, float]]:
    entries = []
    for line in text.splitlines():
        m = ROW.match(line.strip())
        if not m:
            continue  # en-têtes, séparateurs, commentaires
        amount = m.group(4).replace(" ", "").replace(",", ".")
        try:
            entries.append((m.group(1), float(amount)))
        except ValueError:
            print(f"Montant illisible, ligne ignorée : {line}", file=sys.stderr)
    return entries


def main() -> int:
    entries = read_entries(REVENUE.read_text(encoding="utf-8"))
    total = sum(a for _, a in entries)
    last = max((d for d, _ in entries), default=dt.date.today().isoformat())
    total_txt = f"{total:,.0f}".replace(",", " ")
    block = (
        f"{START}\n"
        "| Total encaissé (MAD) | Nombre d'encaissements | Dernière mise à jour |\n"
        "|---|---|---|\n"
        f"| {total_txt} | {len(entries)} | {last} |\n"
        f"{END}"
    )
    readme = README.read_text(encoding="utf-8")
    if START not in readme or END not in readme:
        print("Marqueurs REVENUE introuvables dans README.md", file=sys.stderr)
        return 1
    new = re.sub(re.escape(START) + r".*?" + re.escape(END), lambda _: block, readme, flags=re.S)
    README.write_text(new, encoding="utf-8")
    print(f"Total : {total_txt} MAD sur {len(entries)} encaissement(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
