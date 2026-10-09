"""
Renomeia os arquivos de certificados (PDF e PNG) para nomes sem acentos,
sem &, sem virgulas -- 100% ASCII seguro.
Execute uma unica vez antes do git add/commit/push.
"""

import json
import unicodedata
from pathlib import Path

CERTS_DIR = Path(__file__).resolve().parent / "certificados"


def slugify(name: str) -> str:
    """Remove acentos e substitui caracteres problematicos por '-'."""
    normalized = unicodedata.normalize("NFD", name)
    ascii_name = "".join(c for c in normalized if unicodedata.category(c) != "Mn")
    for old, new in [("&", "-"), (",", "-"), (" ", "-")]:
        ascii_name = ascii_name.replace(old, new)
    return ascii_name


def rename_files() -> int:
    renamed = 0
    for f in sorted(CERTS_DIR.iterdir()):
        if f.suffix.lower() not in (".pdf", ".png"):
            continue
        new_name = slugify(f.name)
        if new_name == f.name:
            continue
        new_path = CERTS_DIR / new_name
        if new_path.exists():
            print(f"[SKIP] destino ja existe: {new_name}")
            continue
        f.rename(new_path)
        print(f"[OK] {f.name}")
        print(f"     -> {new_name}")
        renamed += 1
    return renamed


def update_json() -> None:
    manifest = CERTS_DIR / "certificados.json"
    if not manifest.exists():
        print("certificados.json nao encontrado, pulando.")
        return
    items = json.loads(manifest.read_text(encoding="utf-8"))
    for item in items:
        for field in ("name", "url", "previewUrl"):
            val = item.get(field, "")
            # slugify apenas o nome de arquivo, preservando o prefixo de diretorio
            parts = val.rsplit("/", 1)
            if len(parts) == 2:
                item[field] = parts[0] + "/" + slugify(parts[1])
            else:
                item[field] = slugify(val)
    manifest.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"certificados.json atualizado ({len(items)} itens).")


if __name__ == "__main__":
    print("=== Renomeando arquivos em certificados/ ===")
    n = rename_files()
    print(f"\n{n} arquivo(s) renomeado(s).\n")
    print("=== Atualizando certificados.json ===")
    update_json()
    print("\nPronto! Agora faca: git add -A && git commit -m 'fix: rename certs to ascii' && git push")
