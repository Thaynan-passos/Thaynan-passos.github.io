"""Gera miniaturas PNG da primeira página dos PDFs em certificados/."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError:
    sys.exit(
        "PyMuPDF não está instalado. Execute: python -m pip install -r requirements-certificates.txt"
    )


CERTIFICATES_DIR = Path(__file__).resolve().parent / "certificados"
MAX_WIDTH = 1400


def create_preview(pdf_path: Path, overwrite: bool) -> bool:
    preview_path = pdf_path.with_suffix(".preview.png")
    if preview_path.exists() and not overwrite:
        print(f"Ignorado (já existe): {preview_path.name}")
        return False

    with fitz.open(pdf_path) as document:
        if not document.page_count:
            print(f"Ignorado (sem páginas): {pdf_path.name}")
            return False
        page = document.load_page(0)
        scale = MAX_WIDTH / page.rect.width
        pixmap = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
        pixmap.save(preview_path)

    print(f"Gerado: {preview_path.name}")
    return True


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Gera PNGs da primeira página dos certificados em PDF."
    )
    parser.add_argument(
        "--force", action="store_true", help="regenera miniaturas que já existem"
    )
    args = parser.parse_args()

    if not CERTIFICATES_DIR.is_dir():
        sys.exit(f"Pasta não encontrada: {CERTIFICATES_DIR}")

    pdfs = sorted(CERTIFICATES_DIR.glob("*.pdf"))
    if not pdfs:
        print("Nenhum PDF encontrado em certificados/.")
        return

    generated = sum(create_preview(pdf, args.force) for pdf in pdfs)
    print(f"Concluído: {generated} miniatura(s) gerada(s).")


if __name__ == "__main__":
    main()
