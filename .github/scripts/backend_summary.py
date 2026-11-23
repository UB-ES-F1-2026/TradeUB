"""Resum dels tests i la cobertura del backend per al job summary de GitHub Actions.

S'executa des de backend/ després de pytest --cov --junitxml=pytest.xml i escriu Markdown a la sortida
estàndard. Si falta algun informe (pytest no ha arrencat), ho diu en lloc de fallar.
"""

import io
import math
import xml.etree.ElementTree as ET
from pathlib import Path

import coverage


def bar(pct: float) -> str:
    filled = math.floor(pct / 5)
    return "█" * filled + "░" * (20 - filled)


def icon(pct: float) -> str:
    return "🟢" if pct >= 90 else "🟡" if pct >= 75 else "🔴"


def percent(pct: float) -> str:
    return f"{pct:.1f} %".replace(".", ",")


def tests_line() -> str:
    if not Path("pytest.xml").exists():
        return "⚠️ No s'han executat"
    suite = ET.parse("pytest.xml").getroot()
    suite = suite.find("testsuite") if suite.tag == "testsuites" else suite
    total, skipped = int(suite.get("tests")), int(suite.get("skipped"))
    failed = int(suite.get("failures")) + int(suite.get("errors"))
    parts = [f"✅ {total - failed - skipped} passats"]
    if failed:
        parts.insert(0, f"❌ {failed} fallats")
    if skipped:
        parts.append(f"⏭️ {skipped} {'omès' if skipped == 1 else 'omesos'}")
    return " · ".join(parts)


print("### 🐍 Backend\n")
if not Path(".coverage").exists():
    print(f"| Tests | Cobertura |\n|:--|:--|\n| {tests_line()} | ⚠️ Sense dades |")
else:
    cov = coverage.Coverage()
    cov.load()
    total = cov.report(file=io.StringIO())
    print("| Tests | Cobertura de línies |\n|:--|:--|")
    print(f"| {tests_line()} | {icon(total)} **{percent(total)}** `{bar(total)}` |\n")
    files = io.StringIO()
    cov.report(
        file=files, output_format="markdown", skip_covered=True, show_missing=True
    )
    print("<details><summary>Fitxers sense cobertura completa</summary>\n")
    # Només la taula: coverage hi afegeix una línia en anglès amb els fitxers al 100 %
    print(
        "\n".join(
            line for line in files.getvalue().splitlines() if line.startswith("|")
        )
    )
    print("</details>")
