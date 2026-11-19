/**
 * i18n.js — Sistema de internacionalização com cache seguro e atualização SEO.
 * Aplica traduções via textContent puro (sem innerHTML) para eliminar risco de XSS.
 */
(function () {
  'use strict';

  const core = window.PortfolioCore || {};
  const SUPPORTED_LANGS = core.SUPPORTED_LANGS || ['pt', 'en', 'es', 'fr', 'zh'];
  const DEFAULT_LANG = core.DEFAULT_LANG || 'pt';
  const STORAGE_KEY = 'site-lang';

  const LANG_LABELS = { pt: 'PT', en: 'EN', es: 'ES', zh: 'ZH', fr: 'FR' };
  const LANG_HTML_TAG = { pt: 'pt-BR', en: 'en', es: 'es', zh: 'zh-CN', fr: 'fr' };
  const memoryCache = {};

  function getStoredLang() {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      console.warn('[i18n] Não foi possível ler o idioma salvo:', err);
      return null;
    }
  }

  function saveStoredLang(lang) {
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch (err) {
      console.warn('[i18n] Não foi possível salvar o idioma no localStorage:', err);
    }
  }

  function detectInitialLang() {
    const saved = getStoredLang();
    if (saved && SUPPORTED_LANGS.includes(saved)) return saved;

    const browserLang = (navigator.language || DEFAULT_LANG).slice(0, 2).toLowerCase();
    if (SUPPORTED_LANGS.includes(browserLang)) return browserLang;

    return DEFAULT_LANG;
  }

  async function loadLang(lang) {
    if (memoryCache[lang]) return memoryCache[lang];
    const response = await fetch(`i18n/${lang}.json`);
    if (!response.ok) {
      throw new Error(`Falha ao carregar i18n/${lang}.json (HTTP ${response.status})`);
    }
    const data = await response.json();
    memoryCache[lang] = data;
    return data;
  }

  function updateMetaTag(selector, value) {
    if (!value) return;
    const node = document.querySelector(selector);
    if (node) node.setAttribute('content', value);
  }

  function applyTranslations(dict, lang) {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key && dict[key] !== undefined) {
        el.textContent = dict[key];
      }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key && dict[key] !== undefined) {
        el.setAttribute('placeholder', dict[key]);
      }
    });

    document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
      const key = el.getAttribute('data-i18n-aria-label');
      if (key && dict[key] !== undefined) {
        el.setAttribute('aria-label', dict[key]);
      }
    });

    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      if (key && dict[key] !== undefined) {
        el.setAttribute('title', dict[key]);
      }
    });

    if (dict['meta.title']) {
      document.title = dict['meta.title'];
      updateMetaTag('meta[property="og:title"]', dict['meta.title']);
      updateMetaTag('meta[name="twitter:title"]', dict['meta.title']);
    }

    if (dict['meta.desc']) {
      updateMetaTag('meta[name="description"]', dict['meta.desc']);
      updateMetaTag('meta[property="og:description"]', dict['meta.desc']);
      updateMetaTag('meta[name="twitter:description"]', dict['meta.desc']);
    }

    document.documentElement.setAttribute('lang', LANG_HTML_TAG[lang] || lang);

    const labelEl = document.getElementById('langBtnLabel');
    if (labelEl) labelEl.textContent = LANG_LABELS[lang] || lang.toUpperCase();

    document.querySelectorAll('.lang-option').forEach(btn => {
      const isSelected = btn.getAttribute('data-lang') === lang;
      btn.classList.toggle('active', isSelected);
      btn.setAttribute('aria-checked', String(isSelected));
    });

    window.__i18nDict = dict;
    window.__i18nLang = lang;
    window.t = (key, fallback) => (dict && dict[key] !== undefined ? dict[key] : (fallback || ''));
    window.dispatchEvent(new CustomEvent('i18n:change', { detail: { lang, dict } }));
  }

  async function setLang(lang) {
    const targetLang = SUPPORTED_LANGS.includes(lang) ? lang : DEFAULT_LANG;
    try {
      const dict = await loadLang(targetLang);
      applyTranslations(dict, targetLang);
      saveStoredLang(targetLang);
    } catch (err) {
      console.error('[i18n] Erro ao carregar idioma:', err);
      if (targetLang !== DEFAULT_LANG) {
        await setLang(DEFAULT_LANG);
      }
    }
  }

  window.setLanguage = setLang;

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
      const isOpen = menu.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(isOpen));
    }

    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleMenu();
    });

    menu.querySelectorAll('.lang-option').forEach(option => {
      option.addEventListener('click', () => {
        const lang = option.getAttribute('data-lang');
        setLang(lang).catch(err => {
          console.error('[i18n] Falha ao alternar idioma:', err);
        });
        closeMenu();
      });
    });

    document.addEventListener('click', (event) => {
      if (!wrap.contains(event.target)) closeMenu();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMenu();
    });
  }

  function initI18n() {
    wireLangSwitcher();
    setLang(detectInitialLang()).catch(err => {
      console.error('[i18n] Falha na inicialização de idioma:', err);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initI18n);
  } else {
    initI18n();
  }
})();
