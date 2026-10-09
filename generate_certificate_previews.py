"""
Gera miniaturas WEBP da primeira pagina dos PDFs em certificados/.
Tambem renomeia arquivos para nomes ASCII-safe e atualiza certificados.json.
"""

from __future__ import annotations

import argparse
from watcher_certificados import process_all_files

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Gera previews WebP e renomeia certificados para ASCII-safe."
    )
    parser.parse_args()
    process_all_files(log_fn=print)

if __name__ == "__main__":
    main()
