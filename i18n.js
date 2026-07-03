/**
 * i18n.js — sistema simples de internacionalização
 * -----------------------------------------------------
 * Como funciona:
 * 1. Cada idioma tem um arquivo JSON em /i18n/{codigo}.json
 * 2. Elementos no HTML marcados com data-i18n="chave" recebem o texto traduzido
 * 3. Elementos com data-i18n-placeholder="chave" têm o atributo placeholder traduzido
 * 4. O idioma escolhido fica salvo no navegador (localStorage) para a próxima visita
 *
 * Para adicionar um novo idioma:
 * 1. Crie /i18n/{codigo}.json com as mesmas chaves dos outros arquivos
 * 2. Adicione um <button class="lang-option" data-lang="codigo"> no menu do HTML
 * 3. Adicione o rótulo curto (ex: "DE") no objeto LANG_LABELS abaixo
 *
 * Para editar um texto existente:
 * Basta abrir o arquivo JSON do idioma desejado e mudar o valor da chave.
 * Não é necessário mexer neste arquivo .js nem no index.html.
 */
(function () {
  'use strict';

  const SUPPORTED_LANGS = ['pt', 'en', 'es', 'zh', 'fr'];
  const DEFAULT_LANG = 'pt';
  const STORAGE_KEY = 'site-lang';

  const LANG_LABELS = { pt: 'PT', en: 'EN', es: 'ES', zh: 'ZH', fr: 'FR' };
  const LANG_HTML_TAG = { pt: 'pt-BR', en: 'en', es: 'es', zh: 'zh-CN', fr: 'fr' };

  const cache = {}; // guarda os JSONs já carregados, para não buscar de novo

  /* ── Detecta o idioma inicial ────────────────────────────── */
  function detectInitialLang() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED_LANGS.includes(saved)) return saved;

    const browserLang = (navigator.language || 'pt').slice(0, 2).toLowerCase();
    if (SUPPORTED_LANGS.includes(browserLang)) return browserLang;

    return DEFAULT_LANG;
  }

  /* ── Busca o arquivo de tradução (com cache) ────────────────── */
  async function loadLang(lang) {
    if (cache[lang]) return cache[lang];
    const res = await fetch(`i18n/${lang}.json`);
    if (!res.ok) throw new Error(`Falha ao carregar i18n/${lang}.json`);
    const data = await res.json();
    cache[lang] = data;
    return data;
  }

  /* ── Aplica as traduções no DOM ──────────────────────────── */
  function applyTranslations(dict, lang) {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (dict[key] !== undefined) {
        el.innerHTML = dict[key];
      }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (dict[key] !== undefined) {
        el.setAttribute('placeholder', dict[key]);
      }
    });

    document.documentElement.setAttribute('lang', LANG_HTML_TAG[lang] || lang);

    const label = document.getElementById('langBtnLabel');
    if (label) label.textContent = LANG_LABELS[lang] || lang.toUpperCase();

    document.querySelectorAll('.lang-option').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });
  }

  /* ── Troca de idioma ─────────────────────────────────────── */
  async function setLang(lang) {
    if (!SUPPORTED_LANGS.includes(lang)) lang = DEFAULT_LANG;
    try {
      const dict = await loadLang(lang);
      applyTranslations(dict, lang);
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (err) {
      console.error('[i18n] erro ao trocar idioma:', err);
      // se falhar e não for o idioma padrão, tenta cair pro padrão
      if (lang !== DEFAULT_LANG) setLang(DEFAULT_LANG);
    }
  }

  /* ── Liga o dropdown do seletor de idioma ────────────────── */
  function wireLangSwitcher() {
    const wrap = document.getElementById('langSwitch');
    const btn = document.getElementById('langBtn');
    const menu = document.getElementById('langMenu');
    if (!wrap || !btn || !menu) return;

    function closeMenu() {
      menu.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    }
    function toggleMenu() {
      const open = menu.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(open));
    }

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMenu();
    });

    menu.querySelectorAll('.lang-option').forEach(option => {
      option.addEventListener('click', () => {
        const lang = option.getAttribute('data-lang');
        setLang(lang);
        closeMenu();
      });
    });

    // fecha ao clicar fora
    document.addEventListener('click', (e) => {
      if (!wrap.contains(e.target)) closeMenu();
    });

    // fecha com Esc
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMenu();
    });
  }

  /* ── Inicialização ───────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    wireLangSwitcher();
    setLang(detectInitialLang());
  });
})();
