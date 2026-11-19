/**
 * modules/portfolio-core.js
 * Módulo isomórfico com constantes globais e funções puras de negócio,
 * sanitização de segurança e parser do console interativo.
 * Compatível com navegador (window.PortfolioCore) e Node.js (CommonJS / ESM).
 */
(function (root, factory) {
  'use strict';
  const exported = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = exported;
  }
  if (root) {
    root.PortfolioCore = exported;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const GITHUB_USER = 'Thaynan-passos';
  const GITHUB_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
  const GITHUB_TIMEOUT_MS = 8000;
  const FORM_TIMEOUT_MS = 10000;
  const SEARCH_DEBOUNCE_MS = 220;
  const CAROUSEL_AUTOPLAY_MS = 6500;
  const SWIPE_THRESHOLD_PX = 40;
  const MAX_VISIBLE_REPOS = 6;
  const MAX_REPO_TOPICS = 3;
  const MAX_TERMINAL_HISTORY = 25;
  const WA_BUBBLE_DELAY_MS = 2400;
  const SCROLL_TOP_THRESHOLD_PX = 400;
  const TERMINAL_BOOT_DELAY_MS = 220;
  const TERMINAL_LINE_DELAY_MS = 110;
  const TERMINAL_PROMPT_DELAY_MS = 260;

  const SUPPORTED_LANGS = ['pt', 'en', 'es', 'fr', 'zh'];
  const DEFAULT_LANG = 'pt';
  const SKIP_REPOS = ['dio-lab-open-source', 'skills-communicate-using-markdown'];
  const SAFE_URL_PROTOCOLS = ['https:', 'http:', 'mailto:', 'tel:'];
  const IMAGE_PREVIEW_EXTENSIONS = ['.webp', '.png', '.jpg', '.jpeg', '.gif', '.svg'];
  const TERMINAL_COMMANDS = [
    'help',
    'whoami',
    'stack',
    'projects',
    'certs',
    'experience',
    'education',
    'contact',
    'cv',
    'clear'
  ];

  const MS_PER_DAY = 86400000;
  const DAYS_PER_MONTH = 30;
  const MONTHS_PER_YEAR = 12;

  /**
   * Escapa caracteres especiais HTML para evitar injeção de marcação (XSS).
   * @param {unknown} value
   * @returns {string}
   */
  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Valida e higieniza URLs de navegação/download contra XSS e path traversal.
   * Permite apenas protocolos seguros (https, http, mailto, tel), âncoras (#)
   * ou caminhos relativos seguros dentro do site estático.
   * @param {unknown} rawUrl
   * @returns {string} URL segura ou '#' quando inválida.
   */
  function sanitizeHref(rawUrl) {
    if (typeof rawUrl !== 'string') return '#';
    const trimmed = rawUrl.trim();
    if (!trimmed || trimmed.includes('\0')) return '#';

    // Rejeita URLs protocol-relative (//host), barras iniciais absolutas ou drives Windows (C:\)
    if (trimmed.startsWith('//') || trimmed.startsWith('/') || trimmed.startsWith('\\')) return '#';
    if (/^[a-zA-Z]:/.test(trimmed)) return '#';

    if (trimmed.startsWith('#')) {
      return /^#[A-Za-z0-9_-]+$/.test(trimmed) ? trimmed : '#';
    }

    const schemeMatch = trimmed.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
    if (schemeMatch) {
      const protocol = `${schemeMatch[1].toLowerCase()}:`;
      if (!SAFE_URL_PROTOCOLS.includes(protocol)) {
        return '#';
      }
      try {
        const parsed = new URL(trimmed);
        return SAFE_URL_PROTOCOLS.includes(parsed.protocol) ? parsed.href : '#';
      } catch (err) {
        console.warn('[security] URL externa inválida ignorada:', err);
        return '#';
      }
    }

    // Caminho relativo: rejeita path traversal (../ ou ..\)
    const decoded = safeDecodeUri(trimmed);
    const segments = decoded.split(/[\\/]/);
    if (segments.some(seg => seg === '..')) {
      return '#';
    }

    return encodeURI(decoded);
  }

  function safeDecodeUri(value) {
    try {
      return decodeURI(value);
    } catch (err) {
      return value;
    }
  }

  /**
   * Verifica se uma URL aponta para imagem válida de pré-visualização.
   * @param {unknown} previewUrl
   * @returns {boolean}
   */
  function isImagePreviewUrl(previewUrl) {
    if (typeof previewUrl !== 'string') return false;
    const clean = previewUrl.trim().toLowerCase().split('?')[0].split('#')[0];
    return IMAGE_PREVIEW_EXTENSIONS.some(ext => clean.endsWith(ext));
  }

  /**
   * Calcula a contagem total e por categoria de uma lista de certificados.
   * @param {Array<{category?: string}>} certificates
   * @returns {{ all: number, dev: number, infra: number, gestao: number }}
   */
  function countCertificatesByCategory(certificates) {
    const counts = { all: 0, dev: 0, infra: 0, gestao: 0 };
    if (!Array.isArray(certificates)) return counts;

    for (const item of certificates) {
      if (!item || typeof item !== 'object') continue;
      counts.all += 1;
      if (item.category === 'dev') counts.dev += 1;
      else if (item.category === 'infra') counts.infra += 1;
      else if (item.category === 'gestao') counts.gestao += 1;
    }
    return counts;
  }

  /**
   * Filtra certificados por categoria.
   * @param {Array<object>} certificates
   * @param {string} category
   * @returns {Array<object>}
   */
  function filterCertificates(certificates, category) {
    if (!Array.isArray(certificates)) return [];
    if (!category || category === 'all') return certificates.slice();
    return certificates.filter(item => item && item.category === category);
  }

  /**
   * Extrai lista ordenada de linguagens únicas dos repositórios públicos elegíveis.
   * @param {Array<object>} repos
   * @param {Array<string>} [skipNames]
   * @returns {Array<string>}
   */
  function extractRepoLanguages(repos, skipNames) {
    if (!Array.isArray(repos)) return [];
    const skip = Array.isArray(skipNames) ? skipNames : SKIP_REPOS;
    const seen = new Set();

    for (const repo of repos) {
      if (!repo || repo.fork || skip.includes(repo.name)) continue;
      if (typeof repo.language === 'string' && repo.language.trim()) {
        seen.add(repo.language.trim());
      }
    }

    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }

  /**
   * Filtra repositórios por forks, lista de exclusão, termo de busca e linguagem.
   * @param {Array<object>} repos
   * @param {object} [options]
   * @returns {Array<object>}
   */
  function filterRepositories(repos, options) {
    if (!Array.isArray(repos)) return [];
    const opts = options || {};
    const skip = Array.isArray(opts.skipNames) ? opts.skipNames : SKIP_REPOS;
    const query = typeof opts.query === 'string' ? opts.query.trim().toLowerCase() : '';
    const language = typeof opts.language === 'string' ? opts.language.trim() : 'all';
    const maxItems = typeof opts.maxItems === 'number' && opts.maxItems > 0
      ? opts.maxItems
      : MAX_VISIBLE_REPOS;

    return repos
      .filter(repo => {
        if (!repo || repo.fork || skip.includes(repo.name)) return false;

        if (language && language !== 'all') {
          if ((repo.language || '') !== language) return false;
        }

        if (query) {
          const name = String(repo.name || '').toLowerCase();
          const desc = String(repo.description || '').toLowerCase();
          const lang = String(repo.language || '').toLowerCase();
          const topics = Array.isArray(repo.topics)
            ? repo.topics.join(' ').toLowerCase()
            : '';
          if (
            !name.includes(query) &&
            !desc.includes(query) &&
            !lang.includes(query) &&
            !topics.includes(query)
          ) {
            return false;
          }
        }

        return true;
      })
      .slice(0, maxItems);
  }

  /**
   * Verifica se uma entrada de cache ainda está dentro do prazo de validade (TTL).
   * @param {unknown} timestamp
   * @param {number} [now]
   * @param {number} [ttlMs]
   * @returns {boolean}
   */
  function isCacheFresh(timestamp, now, ttlMs) {
    if (typeof timestamp !== 'number' || !Number.isFinite(timestamp) || timestamp <= 0) {
      return false;
    }
    const currentNow = typeof now === 'number' ? now : Date.now();
    const currentTtl = typeof ttlMs === 'number' ? ttlMs : GITHUB_CACHE_TTL_MS;
    if (currentNow < timestamp) return false;
    return (currentNow - timestamp) < currentTtl;
  }

  /**
   * Formata uma data ISO em rótulo relativo legível.
   * @param {string} dateStr
   * @param {number} [nowMs]
   * @param {object} [labels]
   * @returns {string}
   */
  function formatRelativeTime(dateStr, nowMs, labels) {
    if (!dateStr) return '';
    const parsedMs = new Date(dateStr).getTime();
    if (!Number.isFinite(parsedMs)) return '';

    const currentMs = typeof nowMs === 'number' ? nowMs : Date.now();
    const diffDays = Math.max(0, Math.floor((currentMs - parsedMs) / MS_PER_DAY));
    const dict = Object.assign({
      today: 'hoje',
      yesterday: 'ontem',
      daysAgo: 'há {n} dias',
      monthAgo: 'há 1 mês',
      monthsAgo: 'há {n} meses',
      yearAgo: 'há 1 ano',
      yearsAgo: 'há {n} anos'
    }, labels || {});

    if (diffDays === 0) return dict.today;
    if (diffDays === 1) return dict.yesterday;
    if (diffDays < DAYS_PER_MONTH) return dict.daysAgo.replace('{n}', String(diffDays));

    const months = Math.floor(diffDays / DAYS_PER_MONTH);
    if (months < MONTHS_PER_YEAR) {
      return months === 1
        ? dict.monthAgo
        : dict.monthsAgo.replace('{n}', String(months));
    }

    const years = Math.floor(months / MONTHS_PER_YEAR);
    return years === 1
      ? dict.yearAgo
      : dict.yearsAgo.replace('{n}', String(years));
  }

  /**
   * Interpreta um comando digitado ou clicado no console interativo do Hero.
   * Não manipula o DOM; retorna saída estruturada e eventuais ações de navegação.
   * @param {unknown} rawInput
   * @param {object} [context]
   * @returns {{ type: string, command: string, lines: Array<{kind: string, text: string}>, navigateTo: string|null, downloadCv: boolean }}
   */
  function parseTerminalCommand(rawInput, context) {
    const raw = typeof rawInput === 'string' ? rawInput.trim() : '';
    const normalized = raw.toLowerCase().split(/\s+/)[0] || '';
    const ctx = context || {};
    const certCount = typeof ctx.certCount === 'number' ? ctx.certCount : 15;
    const repoCount = typeof ctx.repoCount === 'number' ? ctx.repoCount : 0;
    const labels = ctx.labels || {};

    if (!normalized) {
      return {
        type: 'noop',
        command: '',
        lines: [],
        navigateTo: null,
        downloadCv: false
      };
    }

    if (normalized === 'clear' || normalized === 'cls') {
      return {
        type: 'clear',
        command: normalized,
        lines: [],
        navigateTo: null,
        downloadCv: false
      };
    }

    const map = {
      help: {
        navigateTo: null,
        downloadCv: false,
        lines: [
          { kind: 'key', text: labels.helpHeader || 'COMANDOS DISPONÍVEIS:' },
          { kind: 'out', text: '  whoami      -> ' + (labels.helpWhoami || 'Resumo profissional e atuação atual') },
          { kind: 'out', text: '  stack       -> ' + (labels.helpStack || 'Linguagens, ferramentas e infraestrutura') },
          { kind: 'out', text: '  projects    -> ' + (labels.helpProjects || 'Repositórios públicos no GitHub') },
          { kind: 'out', text: '  certs       -> ' + (labels.helpCerts || 'Certificados verificados (Java, IA, Python, Infra)') },
          { kind: 'out', text: '  experience  -> ' + (labels.helpExperience || 'Histórico em TI e suporte técnico') },
          { kind: 'out', text: '  education   -> ' + (labels.helpEducation || 'Formação acadêmica no IFPE e UFPE') },
          { kind: 'out', text: '  contact     -> ' + (labels.helpContact || 'Canais diretos de contato') },
          { kind: 'out', text: '  cv          -> ' + (labels.helpCv || 'Baixar currículo em PDF') },
          { kind: 'out', text: '  clear       -> ' + (labels.helpClear || 'Limpar histórico do console') }
        ]
      },
      whoami: {
        navigateTo: '#sobre',
        downloadCv: false,
        lines: [
          { kind: 'ok', text: 'Thaynan Passos :: ' + (labels.role || 'Estagiário em Tecnologia / Análise de Sistemas') },
          { kind: 'out', text: 'org      : Sesc Pernambuco — Unidade de Tecnologia Digital (UTD)' },
          { kind: 'out', text: 'base     : Paulista, PE — Brasil | IFPE (ADS)' },
          { kind: 'out', text: 'history  : 4+ anos em Suporte Técnico e Infraestrutura TI (UFPE STI/NATI-CB)' }
        ]
      },
      stack: {
        navigateTo: '#habilidades',
        downloadCv: false,
        lines: [
          { kind: 'key', text: 'DEV & IA : Java · Python · SQL · Git/GitHub · HTML/CSS · IA para Devs' },
          { kind: 'out', text: 'INFRA    : Linux · Windows · Redes LAN · Suporte N1 · Cibersegurança · Docker' },
          { kind: 'out', text: 'TOOLS    : SIPAC · WordPress · SharePoint · MySQL Workbench · QA/Testes · Kanban/Scrum' }
        ]
      },
      projects: {
        navigateTo: '#projetos',
        downloadCv: false,
        lines: [
          { kind: 'ok', text: `github.com/${GITHUB_USER} (${repoCount > 0 ? `${repoCount} repositórios carregados` : 'sincronizando API'})` },
          { kind: 'out', text: labels.navProjects || 'Navegando para seção 03 // Projetos no GitHub...' }
        ]
      },
      certs: {
        navigateTo: '#certificados',
        downloadCv: false,
        lines: [
          { kind: 'ok', text: `${certCount} certificados verificados (Itaú Java+IA, IA pra Devs, Claude Code 101, Python PCEP, FAST Cibersegurança)` },
          { kind: 'out', text: labels.navCerts || 'Navegando para seção 06 // Certificados e Cursos...' }
        ]
      },
      experience: {
        navigateTo: '#experiencia',
        downloadCv: false,
        lines: [
          { kind: 'ok', text: '[2026-ATUAL] Sesc Pernambuco (UTD) — Estagiário em Tecnologia' },
          { kind: 'out', text: '[2022-2026]  UFPE (STI/NATI-CB) — Bolsista de Suporte Técnico em TI' },
          { kind: 'out', text: '[2019-2020]  Tratomaq Serviços e Peças — Estagiário de TI' }
        ]
      },
      education: {
        navigateTo: '#formacao',
        downloadCv: false,
        lines: [
          { kind: 'ok', text: 'IFPE — Tecnólogo em Análise e Desenvolvimento de Sistemas (Em andamento)' },
          { kind: 'out', text: 'IFPE — Técnico em Manutenção e Suporte em Informática (Concluído)' },
          { kind: 'out', text: 'UFPE — Engenharia Cartográfica e Agrimensura (Trancada no 8º período)' }
        ]
      },
      contact: {
        navigateTo: '#contato',
        downloadCv: false,
        lines: [
          { kind: 'ok', text: 'email    : thaynan0davila@gmail.com' },
          { kind: 'out', text: 'whatsapp : +55 (81) 99152-5664' },
          { kind: 'out', text: 'linkedin : linkedin.com/in/thaynan-passos-91bb86181' }
        ]
      },
      cv: {
        navigateTo: null,
        downloadCv: true,
        lines: [
          { kind: 'ok', text: labels.cvTriggered || 'Abrindo currículo oficial: THAYNANCurriculo.pdf' }
        ]
      }
    };

    if (Object.prototype.hasOwnProperty.call(map, normalized)) {
      const entry = map[normalized];
      return {
        type: 'output',
        command: normalized,
        lines: entry.lines,
        navigateTo: entry.navigateTo,
        downloadCv: entry.downloadCv
      };
    }

    return {
      type: 'error',
      command: normalized,
      lines: [
        {
          kind: 'err',
          text: (labels.unknownCmd || 'Comando não reconhecido: "{cmd}". Digite "help" para listar os comandos.').replace('{cmd}', normalized)
        }
      ],
      navigateTo: null,
      downloadCv: false
    };
  }

  return {
    GITHUB_USER,
    GITHUB_CACHE_TTL_MS,
    GITHUB_TIMEOUT_MS,
    FORM_TIMEOUT_MS,
    SEARCH_DEBOUNCE_MS,
    CAROUSEL_AUTOPLAY_MS,
    SWIPE_THRESHOLD_PX,
    MAX_VISIBLE_REPOS,
    MAX_REPO_TOPICS,
    MAX_TERMINAL_HISTORY,
    WA_BUBBLE_DELAY_MS,
    SCROLL_TOP_THRESHOLD_PX,
    TERMINAL_BOOT_DELAY_MS,
    TERMINAL_LINE_DELAY_MS,
    TERMINAL_PROMPT_DELAY_MS,
    SUPPORTED_LANGS,
    DEFAULT_LANG,
    SKIP_REPOS,
    SAFE_URL_PROTOCOLS,
    IMAGE_PREVIEW_EXTENSIONS,
    TERMINAL_COMMANDS,
    escapeHtml,
    sanitizeHref,
    isImagePreviewUrl,
    countCertificatesByCategory,
    filterCertificates,
    extractRepoLanguages,
    filterRepositories,
    isCacheFresh,
    formatRelativeTime,
    parseTerminalCommand
  };
});
