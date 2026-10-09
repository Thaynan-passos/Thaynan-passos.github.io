"""
Script standalone para renomear certificados existentes e gerar miniaturas WebP.
Execute:
  python rename_certificates.py
"""

from watcher_certificados import process_all_files

if __name__ == "__main__":
    process_all_files(log_fn=print)
    print("\n[SUCESSO] Todos os certificados foram renomeados para ASCII-safe e miniaturas WebP geradas!")
    print("Agora execute no seu terminal:")
    print("  git add -A")
    print("  git commit -m 'fix: renomear certificados e atualizar miniaturas para webp'")
    print("  git push")
