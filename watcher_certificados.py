"""
Aplicacao GUI & CLI para monitorar e renomear certificados automaticamente.
- Monitora a pasta certificados/ (com watchdog ou polling automatico).
- Renomeia uploads futuros para nomes 100% ASCII (sem acentos, sem cedilhas, sem espacos ou caracteres especiais).
- Converte a 1ª pagina de cada PDF para WebP (.preview.webp) em alta definicao.
- Atualiza certificados.json automaticamente com URLs seguras e categorias inteligentes.

Dependencias:
  pip install PyMuPDF watchdog
  (Se 'watchdog' nao estiver instalado, o app usa modo polling nativo automaticamente)

Uso:
  python watcher_certificados.py         -> Interface Grafica Moderna (Dark Theme)
  python watcher_certificados.py --cli   -> Linha de comando direta (executa e encerra)
"""

from __future__ import annotations

import argparse
import io
import json
import os
import sys
import threading
import time
import unicodedata
from pathlib import Path

# ── Verificacao de dependencias opcionais ─────────────────────────────────────
MISSING = []
try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None
    MISSING.append("PyMuPDF")

try:
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler
    HAS_WATCHDOG = True
except ImportError:
    Observer = None
    FileSystemEventHandler = object
    HAS_WATCHDOG = False

try:
    import tkinter as tk
    from tkinter import messagebox, scrolledtext
    HAS_TK = True
except ImportError:
    HAS_TK = False

# ── Constantes ────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent
CERTS_DIR = BASE_DIR / "certificados"
MAX_WIDTH = 1400
MANIFEST = CERTS_DIR / "certificados.json"

CATEGORY_KEYWORDS = {
    "dev": ["python", "program", "git", "wordpress", "vendas", "bootcamp", "heineken", "java", "web", "dev", "codigo"],
    "infra": ["ciberseguran", "sharepoint", "redes", "suporte", "infra", "cisco", "linux", "cloud", "aws", "azure"],
}


# ── Utilitarios de Normalizacao e Slug ─────────────────────────────────────────
def slugify(name: str) -> str:
    """
    Remove acentos, converte cedilha e substitui caracteres especiais por '-'.
    Preserva a extensao do arquivo e nao quebra compostos como '.preview.webp'.
    Exemplo: 'Cesar-School-Noções-de-Programação.pdf' -> 'Cesar-School-Nocoes-de-Programacao.pdf'
    """
    lower = name.lower()
    if lower.endswith(".preview.webp"):
        base = name[:-13]
        ext = ".preview.webp"
    elif lower.endswith(".preview.png"):
        base = name[:-12]
        ext = ".preview.png"
    else:
        p = Path(name)
        base = p.stem
        ext = p.suffix.lower()

    # Decompoe caracteres acentuados (NFD) e descarta marcas de acento
    normalized = unicodedata.normalize("NFD", base)
    ascii_stem = "".join(c for c in normalized if unicodedata.category(c) != "Mn")

    # Substitui caracteres especiais por hifen
    for ch in ["&", ",", "+", " ", "_", "(", ")", "[", "]", "{", "}", "=", ";", "%", "$", "#", "@", "!"]:
        ascii_stem = ascii_stem.replace(ch, "-")

    # Permite alfanumericos, hifens e pontos isolados (ex: I.A)
    ascii_stem = "".join(c for c in ascii_stem if c.isalnum() or c in ("-", "."))

    # Compacta hifens consecutivos
    while "--" in ascii_stem:
        ascii_stem = ascii_stem.replace("--", "-")

    ascii_stem = ascii_stem.strip("-")
    if not ascii_stem:
        ascii_stem = "certificado"

    return f"{ascii_stem}{ext}"


def detect_category(slug_lower: str) -> str:
    """Detecta se a categoria e dev, infra ou gestao com base no nome do arquivo."""
    for cat, keywords in CATEGORY_KEYWORDS.items():
        if any(k in slug_lower for k in keywords):
            return cat
    return "gestao"


def generate_preview_webp(pdf_path: Path, log_fn=print, overwrite: bool = False) -> Path | None:
    """
    Renderiza a 1ª pagina do PDF em formato WebP (.preview.webp).
    Possui fallback automatico para Pillow e PNG caso o MuPDF nao tenha WebP embutido.
    """
    if not fitz:
        log_fn("[AVISO] PyMuPDF (fitz) nao esta instalado. Execute: pip install PyMuPDF")
        return None

    preview_name = f"{pdf_path.stem}.preview.webp"
    preview_path = pdf_path.parent / preview_name

    if preview_path.exists() and not overwrite:
        return preview_path

    try:
        with fitz.open(str(pdf_path)) as doc:
            if not doc.page_count:
                log_fn(f"[AVISO] '{pdf_path.name}' nao contem paginas.")
                return None
            page = doc.load_page(0)
            scale = MAX_WIDTH / max(page.rect.width, 1)
            pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)

            # 1. Tenta salvar nativamente como WebP
            try:
                pix.save(str(preview_path))
            except Exception:
                # 2. Fallback via Pillow se MuPDF requerer codec externo
                try:
                    from PIL import Image
                    img = Image.open(io.BytesIO(pix.tobytes("png")))
                    img.save(str(preview_path), "WEBP", quality=85)
                except Exception:
                    # 3. Fallback seguro para PNG
                    png_path = preview_path.with_suffix(".png")
                    pix.save(str(png_path))
                    log_fn(f"[PNG] WebP indisponivel no ambiente; salvo como PNG: {png_path.name}")
                    return png_path

        log_fn(f"[WEBP] Miniatura gerada: {preview_name}")
        return preview_path
    except Exception as e:
        log_fn(f"[ERRO] Falha ao gerar preview para '{pdf_path.name}': {e}")
        return None


def rename_file(path: Path, log_fn=print) -> Path:
    """
    Renomeia um arquivo para o formato seguro (ASCII, sem acentos).
    Se o novo nome ja existir, evita colisao.
    """
    new_name = slugify(path.name)
    if new_name == path.name:
        return path

    new_path = path.parent / new_name
    if new_path.exists() and new_path != path:
        log_fn(f"[SKIP] Arquivo de destino ja existe: {new_name}")
        return new_path

    try:
        path.rename(new_path)
        log_fn(f"[RENOMEADO] {path.name} -> {new_name}")
        return new_path
    except Exception as e:
        log_fn(f"[ERRO] Falha ao renomear {path.name}: {e}")
        return path


def update_manifest(log_fn=print) -> None:
    """
    Varre a pasta certificados/ e sincroniza o certificados.json com os nomes corretos e WebP,
    preservando titulos existentes bem formatados.
    """
    if not CERTS_DIR.is_dir():
        return

    # Carrega titulos e categorias pre-existentes para nao sobrescrever edicoes manuais
    existing_titles = {}
    existing_cats = {}
    if MANIFEST.exists():
        try:
            old_items = json.loads(MANIFEST.read_text(encoding="utf-8"))
            for oi in old_items:
                n = oi.get("name", "")
                existing_titles[n] = oi.get("title", "")
                existing_titles[slugify(n)] = oi.get("title", "")
                existing_cats[n] = oi.get("category", "")
                existing_cats[slugify(n)] = oi.get("category", "")
        except Exception:
            pass

    pdfs = sorted(CERTS_DIR.glob("*.pdf"))
    items = []

    for pdf in pdfs:
        slug_name = pdf.name
        slug_stem = pdf.stem
        preview_webp = CERTS_DIR / f"{slug_stem}.preview.webp"
        preview_png = CERTS_DIR / f"{slug_stem}.preview.png"

        if preview_webp.exists():
            preview_url = f"certificados/{preview_webp.name}"
        elif preview_png.exists():
            preview_url = f"certificados/{preview_png.name}"
        else:
            preview_url = f"certificados/{slug_name}"

        # Obtem titulo existente ou gera um titulo legivel
        if existing_titles.get(slug_name):
            title = existing_titles[slug_name]
        else:
            clean_title = (
                slug_stem.replace("-", " ")
                .replace("_", " ")
                .replace("certificado", "")
                .replace("udemy", "")
                .strip()
            )
            if not clean_title:
                clean_title = slug_stem
            title = " ".join(w.capitalize() for w in clean_title.split())

        cat = existing_cats.get(slug_name) or detect_category(slug_name.lower())

        items.append({
            "name": slug_name,
            "title": title,
            "category": cat,
            "url": f"certificados/{slug_name}",
            "previewUrl": preview_url,
            "isPdf": True,
        })

    try:
        MANIFEST.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
        log_fn(f"[JSON] certificados.json atualizado com sucesso ({len(items)} certificados).")
    except Exception as e:
        log_fn(f"[ERRO] Falha ao escrever {MANIFEST}: {e}")


def process_single_file(path: Path, log_fn=print) -> None:
    """Processa um arquivo detectado: renomeia, converte para WebP e atualiza o JSON."""
    if not path.is_file():
        return

    # Evita reprocessar arquivos de preview gerados pelo proprio script
    if ".preview." in path.name:
        return

    ext = path.suffix.lower()
    if ext not in (".pdf", ".png", ".jpg", ".jpeg", ".webp"):
        return

    # Renomeia se tiver caracteres especiais ou acentos
    safe_path = rename_file(path, log_fn=log_fn)

    # Se for PDF, gera a miniatura WebP
    if safe_path.suffix.lower() == ".pdf":
        generate_preview_webp(safe_path, log_fn=log_fn, overwrite=False)

    # Atualiza o manifesto de certificados
    update_manifest(log_fn=log_fn)


def process_all_files(log_fn=print) -> None:
    """Processa todos os arquivos existentes na pasta certificados/ de uma so vez."""
    if not CERTS_DIR.is_dir():
        log_fn(f"[ERRO] Pasta nao encontrada: {CERTS_DIR}")
        return

    log_fn("=== Processando todos os certificados da pasta ===")

    # 1. Renomeia PDFs e arquivos de imagem
    for item in sorted(CERTS_DIR.iterdir()):
        if item.is_file() and item.suffix.lower() in (".pdf", ".png", ".jpg", ".jpeg", ".webp"):
            rename_file(item, log_fn=log_fn)

    # 2. Gera miniaturas WebP para cada PDF
    pdfs = sorted(CERTS_DIR.glob("*.pdf"))
    log_fn(f"[INFO] Gerando miniaturas WebP para {len(pdfs)} PDF(s)...")
    for pdf in pdfs:
        generate_preview_webp(pdf, log_fn=log_fn, overwrite=False)

    # 3. Atualiza certificados.json
    update_manifest(log_fn=log_fn)
    log_fn("=== Processamento concluido com sucesso! ===")


# ── Watcher com Watchdog ou Polling Fallback ──────────────────────────────────
class FileWatcher:
    """Gerencia o monitoramento da pasta via watchdog ou polling em background."""

    def __init__(self, log_fn=print):
        self.log_fn = log_fn
        self._running = False
        self._observer = None
        self._poll_thread = None
        self._known_mtimes: dict[str, float] = {}

    def start(self) -> None:
        if self._running:
            return
        self._running = True

        if HAS_WATCHDOG:
            self._start_watchdog()
        else:
            self._start_polling()

    def stop(self) -> None:
        self._running = False
        if self._observer:
            try:
                self._observer.stop()
                self._observer.join(timeout=2)
            except Exception:
                pass
            self._observer = None
        if self._poll_thread:
            self._poll_thread.join(timeout=2)
            self._poll_thread = None

    def _start_watchdog(self) -> None:
        class Handler(FileSystemEventHandler):
            def __init__(self, watcher):
                self.watcher = watcher
                self._busy = set()

            def on_created(self, event):
                if not event.is_directory:
                    self._schedule(event.src_path)

            def on_moved(self, event):
                if not event.is_directory:
                    self._schedule(event.dest_path)

            def _schedule(self, pth):
                if pth in self._busy:
                    return
                self._busy.add(pth)
                def _run():
                    time.sleep(1.2)  # aguarda upload/copia terminar
                    p = Path(pth)
                    if p.exists():
                        process_single_file(p, log_fn=self.watcher.log_fn)
                    self._busy.discard(pth)
                threading.Thread(target=_run, daemon=True).start()

        self._observer = Observer()
        self._observer.schedule(Handler(self), str(CERTS_DIR), recursive=False)
        self._observer.start()
        self.log_fn("[MONITOR] Watchdog ativado — observando uploads em tempo real...")

    def _start_polling(self) -> None:
        def _loop():
            self.log_fn("[MONITOR] Polling nativo ativado (checagem a cada 2s)...")
            while self._running:
                try:
                    current_files = list(CERTS_DIR.glob("*.*"))
                    for f in current_files:
                        if f.suffix.lower() not in (".pdf", ".png", ".jpg", ".jpeg", ".webp"):
                            continue
                        if ".preview." in f.name:
                            continue
                        mtime = f.stat().st_mtime
                        if str(f) not in self._known_mtimes:
                            self._known_mtimes[str(f)] = mtime
                            # Novo arquivo detectado
                            if f.name != slugify(f.name) or (f.suffix.lower() == ".pdf" and not (CERTS_DIR / f"{f.stem}.preview.webp").exists()):
                                process_single_file(f, log_fn=self.log_fn)
                        elif mtime > self._known_mtimes[str(f)]:
                            self._known_mtimes[str(f)] = mtime
                            process_single_file(f, log_fn=self.log_fn)
                except Exception:
                    pass
                time.sleep(2)

        self._poll_thread = threading.Thread(target=_loop, daemon=True)
        self._poll_thread.start()


# ── Interface Grafica (Tkinter) ───────────────────────────────────────────────
class AppGUI(tk.Tk if HAS_TK else object):
    def __init__(self):
        if not HAS_TK:
            return
        super().__init__()
        self.title("Gerenciador de Certificados — Thaynan Passos")
        self.geometry("760x540")
        self.configure(bg="#0d0f14")
        self.minsize(640, 460)

        self.watcher = FileWatcher(log_fn=self.log)
        self.is_watching = False

        self._setup_ui()
        self._initial_check()

    def _setup_ui(self):
        # Top banner
        top = tk.Frame(self, bg="#151820", pady=14, padx=20)
        top.pack(fill="x")
        tk.Label(
            top, text="🚀 Gerenciador & Conversor de Certificados (WebP)",
            font=("Segoe UI", 14, "bold"), bg="#151820", fg="#f97316"
        ).pack(anchor="w")
        tk.Label(
            top, text="Padroniza nomes para ASCII (sem acentos) e converte PDFs para miniaturas WebP",
            font=("Segoe UI", 9), bg="#151820", fg="#7b849a"
        ).pack(anchor="w")

        # Pasta
        row_dir = tk.Frame(self, bg="#0d0f14", padx=20, pady=8)
        row_dir.pack(fill="x")
        tk.Label(row_dir, text="Pasta:", bg="#0d0f14", fg="#e2e6f0", font=("Segoe UI", 9, "bold")).pack(side="left")
        e = tk.Entry(row_dir, bg="#151820", fg="#e2e6f0", relief="flat", font=("Consolas", 9))
        e.insert(0, str(CERTS_DIR))
        e.config(state="readonly")
        e.pack(side="left", fill="x", expand=True, padx=10)

        # Barra de acoes
        row_actions = tk.Frame(self, bg="#0d0f14", padx=20, pady=6)
        row_actions.pack(fill="x")

        self.btn_watch = tk.Button(
            row_actions, text="▶ Iniciar Monitoramento", command=self._toggle_monitor,
            bg="#f97316", fg="#ffffff", activebackground="#ea580c", relief="flat",
            font=("Segoe UI", 9, "bold"), padx=14, pady=6, cursor="hand2"
        )
        self.btn_watch.pack(side="left", padx=(0, 10))

        self.btn_process = tk.Button(
            row_actions, text="⚡ Processar Todos Agora", command=self._process_all,
            bg="#1f2430", fg="#e2e6f0", activebackground="#2e3548", relief="flat",
            font=("Segoe UI", 9, "bold"), padx=14, pady=6, cursor="hand2"
        )
        self.btn_process.pack(side="left", padx=(0, 10))

        tk.Button(
            row_actions, text="Limpar Log", command=self._clear_log,
            bg="#151820", fg="#7b849a", activebackground="#1f2430", relief="flat",
            font=("Segoe UI", 9), padx=10, pady=6, cursor="hand2"
        ).pack(side="left")

        self.lbl_status = tk.Label(
            row_actions, text="● Parado", bg="#0d0f14", fg="#7b849a", font=("Segoe UI", 9, "bold")
        )
        self.lbl_status.pack(side="right")

        # Area de Log
        log_frame = tk.Frame(self, bg="#0d0f14", padx=20, pady=6)
        log_frame.pack(fill="both", expand=True)
        self.log_widget = scrolledtext.ScrolledText(
            log_frame, bg="#151820", fg="#e2e6f0", relief="flat",
            font=("Consolas", 9), wrap="word", insertbackground="#f97316"
        )
        self.log_widget.pack(fill="both", expand=True)

        self.log_widget.tag_config("ok", foreground="#22c55e")
        self.log_widget.tag_config("warn", foreground="#f97316")
        self.log_widget.tag_config("err", foreground="#ef4444")

        # Rodape
        bot = tk.Frame(self, bg="#0d0f14", pady=6)
        bot.pack(fill="x")
        tk.Label(
            bot, text="Ao arrastar novos PDFs para a pasta certificados/, eles serao renomeados e convertidos automaticamente.",
            bg="#0d0f14", fg="#4b5563", font=("Segoe UI", 8)
        ).pack()

    def _initial_check(self):
        if MISSING:
            self.log(f"[AVISO] Modulos pendentes: {', '.join(MISSING)}. Execute: pip install PyMuPDF watchdog", "warn")
        else:
            self.log("[SISTEMA] PyMuPDF detectado com sucesso. Conversor WebP pronto!", "ok")
        self.log(f"[SISTEMA] Pasta monitorada: {CERTS_DIR}")
        pdfs = list(CERTS_DIR.glob("*.pdf"))
        self.log(f"[SISTEMA] {len(pdfs)} arquivo(s) PDF encontrado(s).")

    def log(self, msg: str, tag: str = ""):
        def _append():
            try:
                self.log_widget.config(state="normal")
                ts = time.strftime("%H:%M:%S")
                self.log_widget.insert("end", f"[{ts}] {msg}\n", tag or "")
                self.log_widget.see("end")
                self.log_widget.config(state="disabled")
            except Exception:
                pass

        if HAS_TK:
            try:
                self.after(0, _append)
            except Exception:
                print(msg)
        else:
            print(msg)

    def _clear_log(self):
        self.log_widget.config(state="normal")
        self.log_widget.delete("1.0", "end")
        self.log_widget.config(state="disabled")

    def _toggle_monitor(self):
        if self.is_watching:
            self.watcher.stop()
            self.is_watching = False
            self.btn_watch.config(text="▶ Iniciar Monitoramento", bg="#f97316")
            self.lbl_status.config(text="● Parado", fg="#7b849a")
            self.log("[MONITOR] Monitoramento interrompido.")
        else:
            self.watcher.start()
            self.is_watching = True
            self.btn_watch.config(text="⏹ Parar Monitoramento", bg="#ef4444")
            self.lbl_status.config(text="● Monitorando Ativo", fg="#22c55e")

    def _process_all(self):
        def _worker():
            try:
                self.btn_process.config(state="disabled")
                process_all_files(log_fn=self.log)
            finally:
                try:
                    self.btn_process.config(state="normal")
                except Exception:
                    pass
        threading.Thread(target=_worker, daemon=True).start()

    def on_close(self):
        if self.is_watching:
            self.watcher.stop()
        self.destroy()


# ── Execucao Principal ────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Gerenciador e Conversor WebP de Certificados")
    parser.add_argument("--cli", action="store_true", help="Executa o processamento em modo linha de comando")
    args = parser.parse_args()

    if args.cli or not HAS_TK:
        process_all_files(log_fn=print)
    else:
        app = AppGUI()
        app.protocol("WM_DELETE_WINDOW", app.on_close)
        app.mainloop()


if __name__ == "__main__":
    main()
