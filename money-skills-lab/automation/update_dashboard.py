#!/usr/bin/env python3
"""Met à jour le tableau de bord du README à partir de REVENUE.md, SKILLS.md et IDEAS.md.

Usage : python3 automation/update_dashboard.py [dossier_du_depot]
Sans dépendance externe (Python 3.8+). Lancé chaque semaine par GitHub Actions.
"""
import datetime
import pathlib
import re
import sys
from collections import defaultdict

ROOT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else pathlib.Path(__file__).resolve().parent.parent)


def table_rows(text):
    """Renvoie les lignes d'un tableau Markdown (hors en-tête et séparateur)."""
    rows = []
    for line in text.splitlines():
        line = line.strip()
        if not line.startswith("|") or re.match(r"^\|[\s:|-]+\|$", line):
            continue
        rows.append([c.strip() for c in line.strip("|").split("|")])
    return rows[1:] if rows else []


def revenue_totals(text):
    block = re.search(r"<!-- REVENUE:START -->(.*?)<!-- REVENUE:END -->", text, re.S)
    totals, count = defaultdict(float), 0
    for row in table_rows(block.group(1) if block else ""):
        if len(row) < 5 or not row[3]:
            continue
        try:
            amount = float(row[3].replace(" ", "").replace(",", "."))
        except ValueError:
            print(f"⚠️ Montant illisible ignoré : {row}", file=sys.stderr)
            continue
        totals[(row[4] or "?").upper()] += amount
        count += 1
    return totals, count


def skills_stats(text):
    statuses = re.findall(r"^\|\s*Statut\s*\|\s*([^|]+?)\s*\|", text, re.M)
    return len(statuses), sum(1 for s in statuses if s.lower().startswith("rentabilis"))


def priority_ideas(text):
    return len([m for m in re.findall(r"\*\*(\d+)\*\*", text) if int(m) >= 22])


def main():
    readme_path = ROOT / "README.md"
    readme = readme_path.read_text(encoding="utf-8")
    totals, n_rev = revenue_totals((ROOT / "REVENUE.md").read_text(encoding="utf-8"))
    n_skills, n_paid = skills_stats((ROOT / "SKILLS.md").read_text(encoding="utf-8"))
    n_ideas = priority_ideas((ROOT / "IDEAS.md").read_text(encoding="utf-8"))

    total_txt = " + ".join(f"{v:g} {k}" for k, v in sorted(totals.items())) or "0"
    table = "\n".join([
        "| Indicateur | Valeur |",
        "|---|---|",
        f"| Revenus cumulés | {total_txt} |",
        f"| Nombre d'encaissements | {n_rev} |",
        f"| Compétences enregistrées | {n_skills} |",
        f"| Compétences « Rentabilisée » | {n_paid} |",
        f"| Idées notées ≥ 22/30 | {n_ideas} |",
        f"| Dernière mise à jour | {datetime.date.today().isoformat()} |",
    ])
    new = re.sub(r"(<!-- DASHBOARD:START -->\n).*?(\n<!-- DASHBOARD:END -->)",
                 lambda m: m.group(1) + table + m.group(2), readme, flags=re.S)
    if new == readme:
        print("Aucun changement.")
        return
    readme_path.write_text(new, encoding="utf-8")
    print("README mis à jour :\n" + table)


if __name__ == "__main__":
    main()
