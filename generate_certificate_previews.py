"""Gera miniaturas PNG da primeira página dos PDFs em certificados/."""

from __future__ import annotations

import argparse
import sys
import unicodedata
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError:
    sys.exit(
        "PyMuPDF não está instalado. Execute: python -m pip install -r requirements-certificates.txt"
    )


CERTIFICATES_DIR = Path(__file__).resolve().parent / "certificados"
MAX_WIDTH = 1400


def slugify(name: str) -> str:
    """Converte nome com acentos/caracteres especiais para ASCII seguro."""
    # Normaliza unicode (NFD) e remove diacríticos
    normalized = unicodedata.normalize("NFD", name)
    ascii_name = "".join(c for c in normalized if unicodedata.category(c) != "Mn")
    # Substitui caracteres problemáticos
    for old, new in [("&", "-"), (",", "-"), (" ", "-")]:
        ascii_name = ascii_name.replace(old, new)
    return ascii_name


def create_preview(pdf_path: Path, overwrite: bool) -> bool:
    # Usa nome slugificado para o preview (sem acentos)
    preview_name = slugify(pdf_path.stem) + ".preview.png"
    preview_path = pdf_path.parent / preview_name
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

    # Atualiza o manifesto certificados.json automaticamente
    import json
    items = []
    for pdf in pdfs:
        slug_stem = slugify(pdf.stem)
        preview_name = slug_stem + ".preview.png"
        preview = pdf.parent / preview_name
        slug_name = slug_stem + ".pdf"
        lower = slug_name.lower()
        # Categorias sem acentos
        if any(k in lower for k in ["python", "program", "git", "wordpress", "vendas"]):
            cat = "dev"
        elif any(k in lower for k in ["ciberseguran", "sharepoint", "redes", "suporte"]):
            cat = "infra"
        else:
            cat = "gestao"
        clean_title = pdf.name.replace(".pdf", "").replace("-", " ").replace("_", " ").strip()
        items.append({
            "name": slug_name,
            "title": clean_title,
            "category": cat,
            "url": f"certificados/{slug_name}",
            "previewUrl": f"certificados/{preview_name}" if preview.exists() else f"certificados/{slug_name}",
            "isPdf": True
        })
    manifest_path = CERTIFICATES_DIR / "certificados.json"
    manifest_path.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Manifesto atualizado com sucesso em {manifest_path.name} ({len(items)} itens).")


if __name__ == "__main__":
    main()

