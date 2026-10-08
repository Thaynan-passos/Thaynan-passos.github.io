/**
 * i18n.js — sistema de internacionalização com suporte a SEO dinâmico
 * ------------------------------------------------------------------
 * 1. Carrega /i18n/{codigo}.json
 * 2. Atualiza elementos com [data-i18n] e [data-i18n-placeholder]
 * 3. Atualiza document.title e meta description dinamicamente
 * 4. Salva a preferência no localStorage
 */
(function () {
  'use strict';

  const SUPPORTED_LANGS = ['pt', 'en', 'es', 'zh', 'fr'];
  const DEFAULT_LANG = 'pt';
  const STORAGE_KEY = 'site-lang';

  const LANG_LABELS = { pt: 'PT', en: 'EN', es: 'ES', zh: 'ZH', fr: 'FR' };
  const LANG_HTML_TAG = { pt: 'pt-BR', en: 'en', es: 'es', zh: 'zh-CN', fr: 'fr' };

  const cache = {};

  /* ── Detecta o idioma inicial ────────────────────────────── */
  function detectInitialLang() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED_LANGS.includes(saved)) return saved;

    const browserLang = (navigator.language || 'pt').slice(0, 2).toLowerCase();
    if (SUPPORTED_LANGS.includes(browserLang)) return browserLang;

    return DEFAULT_LANG;
  }

  /* ── Busca o arquivo de tradução (com cache em memória) ──── */
  async function loadLang(lang) {
    if (cache[lang]) return cache[lang];
    const res = await fetch(`i18n/${lang}.json`);
    if (!res.ok) throw new Error(`Falha ao carregar i18n/${lang}.json`);
    const data = await res.json();
    cache[lang] = data;
    return data;
  }

  /* ── Aplica as traduções no DOM e Metadados ──────────────── */
  function applyTranslations(dict, lang) {
    // Textos comuns
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (dict[key] !== undefined) {
        el.innerHTML = dict[key];
      }
    });

    // Placeholders de inputs
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (dict[key] !== undefined) {
        el.setAttribute('placeholder', dict[key]);
      }
    });

    // Atualização de SEO dinâmica (Título e Descrição da aba)
    if (dict['meta.title']) {
      document.title = dict['meta.title'];
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) ogTitle.setAttribute('content', dict['meta.title']);
      const twTitle = document.querySelector('meta[name="twitter:title"]');
      if (twTitle) twTitle.setAttribute('content', dict['meta.title']);
    }

    if (dict['meta.desc']) {
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) metaDesc.setAttribute('content', dict['meta.desc']);
      const ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc) ogDesc.setAttribute('content', dict['meta.desc']);
      const twDesc = document.querySelector('meta[name="twitter:description"]');
      if (twDesc) twDesc.setAttribute('content', dict['meta.desc']);
    }

    document.documentElement.setAttribute('lang', LANG_HTML_TAG[lang] || lang);

    const label = document.getElementById('langBtnLabel');
    if (label) label.textContent = LANG_LABELS[lang] || lang.toUpperCase();

    document.querySelectorAll('.lang-option').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });

    // Expõe globalmente
    window.__i18nDict = dict;
    window.__i18nLang = lang;
    window.t = (key, fallback) => (dict && dict[key] !== undefined ? dict[key] : (fallback || ''));
    window.dispatchEvent(new CustomEvent('i18n:change', { detail: { lang, dict } }));
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
      if (lang !== DEFAULT_LANG) setLang(DEFAULT_LANG);
    }
  }

  window.setLanguage = setLang;

  /* ── Dropdown do seletor de idioma ───────────────────────── */
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

    // Fecha ao clicar fora
    document.addEventListener('click', (e) => {
      if (!wrap.contains(e.target)) closeMenu();
    });

    // Fecha com Esc
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
