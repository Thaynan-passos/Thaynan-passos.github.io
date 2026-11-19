/**
 * script.js — Camada de interface e interatividade do portfólio Industrial.
 * Depende de modules/portfolio-core.js (carregado via defer antes deste arquivo).
 */
(function () {
  'use strict';

  const core = window.PortfolioCore;
  if (!core) {
    console.error('[app] PortfolioCore não carregado. Verifique a ordem dos scripts.');
    return;
  }

  const {
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
    SKIP_REPOS,
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
  } = core;

  const THEME_STORAGE_KEY = 'site-theme';
  const WA_DISMISSED_KEY = 'wa-bubble-dismissed';
  const COPY_FEEDBACK_MS = 2000;
  const DARK_THEME_META_COLOR = '#0B0C0A';
  const LIGHT_THEME_META_COLOR = '#F4F5F2';

  const safeLocalStorage = createStorageAdapter(window.localStorage, 'localStorage');
  const safeSessionStorage = createStorageAdapter(window.sessionStorage, 'sessionStorage');

  function createStorageAdapter(storageRef, label) {
    return {
      get(key) {
        try {
          return storageRef ? storageRef.getItem(key) : null;
        } catch (err) {
          console.warn(`[storage] Falha ao ler "${key}" em ${label}:`, err);
          return null;
        }
      },
      set(key, value) {
        try {
          if (storageRef) storageRef.setItem(key, value);
        } catch (err) {
          console.warn(`[storage] Falha ao gravar "${key}" em ${label}:`, err);
        }
      },
      remove(key) {
        try {
          if (storageRef) storageRef.removeItem(key);
        } catch (err) {
          console.warn(`[storage] Falha ao remover "${key}" em ${label}:`, err);
        }
      }
    };
  }

  function translate(key, fallback) {
    if (typeof window.t === 'function') {
      const value = window.t(key, fallback);
      if (value) return value;
    }
    return fallback;
  }

  /* ── 1. Ano dinâmico no rodapé ── */
  const yearEl = document.getElementById('yr');
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  /* ── 2. Alternância de Tema Claro / Escuro ── */
  (function initThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    const metaTheme = document.querySelector('meta[name="theme-color"]');

    function applyTheme(theme) {
      const isLight = theme === 'light';
      if (isLight) {
        document.documentElement.setAttribute('data-theme', 'light');
        if (metaTheme) metaTheme.setAttribute('content', LIGHT_THEME_META_COLOR);
      } else {
        document.documentElement.removeAttribute('data-theme');
        if (metaTheme) metaTheme.setAttribute('content', DARK_THEME_META_COLOR);
      }
      if (themeToggle) {
        themeToggle.setAttribute('aria-pressed', String(isLight));
      }
    }

    const savedTheme = safeLocalStorage.get(THEME_STORAGE_KEY);
    const systemLight = Boolean(window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);
    applyTheme(savedTheme || (systemLight ? 'light' : 'dark'));

    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        const currentLight = document.documentElement.getAttribute('data-theme') === 'light';
        const nextTheme = currentLight ? 'dark' : 'light';
        safeLocalStorage.set(THEME_STORAGE_KEY, nextTheme);
        applyTheme(nextTheme);
      });
    }

    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (event) => {
        if (!safeLocalStorage.get(THEME_STORAGE_KEY)) {
          applyTheme(event.matches ? 'light' : 'dark');
        }
      });
    }
  })();

  /* ── 3. Menu Mobile ── */
  (function initMobileMenu() {
    const menuBtn = document.getElementById('menuBtn');
    const navLinks = document.getElementById('navLinks');
    if (!menuBtn || !navLinks) return;

    function setMenuOpen(open) {
      const shouldOpen = open !== undefined ? open : !navLinks.classList.contains('open');
      navLinks.classList.toggle('open', shouldOpen);
      menuBtn.setAttribute('aria-expanded', String(shouldOpen));
      document.body.style.overflow = shouldOpen ? 'hidden' : '';
    }

    menuBtn.addEventListener('click', () => setMenuOpen());

    navLinks.querySelectorAll('a').forEach(anchor => {
      anchor.addEventListener('click', () => setMenuOpen(false));
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && navLinks.classList.contains('open')) {
        setMenuOpen(false);
        menuBtn.focus();
      }
    });
  })();

  /* ── 4. Barra de Leitura + ScrollSpy + Voltar ao Topo ── */
  (function initScrollIndicators() {
    const meterFill = document.getElementById('scrollMeterFill');
    const backTopBtn = document.getElementById('back-top');
    const activeBadge = document.getElementById('activeSectionBadge');
    const navAnchors = document.querySelectorAll('.nav-links a[href^="#"]');
    const trackedSections = document.querySelectorAll('main section[id]');

    const SECTION_CODES = {
      top: 'SEC 01/07',
      sobre: 'SEC 01/07',
      habilidades: 'SEC 02/07',
      projetos: 'SEC 03/07',
      experiencia: 'SEC 04/07',
      formacao: 'SEC 05/07',
      certificados: 'SEC 06/07',
      contato: 'SEC 07/07'
    };

    let rafPending = false;
    function updateScrollProgress() {
      rafPending = false;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = docHeight > 0 ? Math.min(1, Math.max(0, window.scrollY / docHeight)) : 0;
      if (meterFill) {
        meterFill.style.transform = `scaleX(${ratio.toFixed(4)})`;
      }
      if (backTopBtn) {
        backTopBtn.classList.toggle('show', window.scrollY > SCROLL_TOP_THRESHOLD_PX);
      }
    }

    window.addEventListener('scroll', () => {
      if (!rafPending) {
        rafPending = true;
        window.requestAnimationFrame(updateScrollProgress);
      }
    }, { passive: true });
    updateScrollProgress();

    if (backTopBtn) {
      backTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    if (trackedSections.length && 'IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const sectionId = entry.target.getAttribute('id') || '';
          if (activeBadge && SECTION_CODES[sectionId]) {
            activeBadge.textContent = SECTION_CODES[sectionId];
          }
          navAnchors.forEach(link => {
            const href = link.getAttribute('href');
            const matches = href === `#${sectionId}` || (sectionId === 'top' && href === '#sobre');
            link.classList.toggle('active', matches);
          });
        });
      }, {
        rootMargin: '-25% 0px -65% 0px',
        threshold: 0
      });

      trackedSections.forEach(section => observer.observe(section));
    }
  })();

  /* ── 5. Botão Copiar E-mail & WhatsApp FAB ── */
  (function initDirectContactHelpers() {
    const copyBtn = document.getElementById('copyEmailBtn');
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        const email = copyBtn.getAttribute('data-email') || 'thaynan0davila@gmail.com';
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(email);
          } else {
            const tempInput = document.createElement('input');
            tempInput.value = email;
            document.body.appendChild(tempInput);
            tempInput.select();
            document.execCommand('copy');
            document.body.removeChild(tempInput);
          }
          copyBtn.classList.add('copied');
          copyBtn.textContent = translate('contact.copiedEmail', 'Copiado');
          setTimeout(() => {
            copyBtn.classList.remove('copied');
            copyBtn.textContent = translate('contact.copyEmail', 'Copiar e-mail');
          }, COPY_FEEDBACK_MS);
        } catch (err) {
          console.warn('[clipboard] Não foi possível copiar o e-mail:', err);
        }
      });
    }

    const fab = document.getElementById('whatsappFab');
    const closeBtn = document.getElementById('whatsappBubbleClose');
    if (!fab) return;

    const isDismissed = safeSessionStorage.get(WA_DISMISSED_KEY) === 'true';
    if (!isDismissed) {
      setTimeout(() => fab.classList.add('show'), WA_BUBBLE_DELAY_MS);
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        fab.classList.remove('show');
        safeSessionStorage.set(WA_DISMISSED_KEY, 'true');
      });
    }
  })();

  /* ── Estado compartilhado entre Console, GitHub e Certificados ── */
  const appState = {
    certCount: 15,
    repoCount: 0
  };

  /* ── 6. Console Interativo Real (Hero) ── */
  (function initInteractiveTerminal() {
    const bodyEl = document.getElementById('terminalBody');
    const formEl = document.getElementById('terminalForm');
    const inputEl = document.getElementById('terminalInput');
    const chipButtons = document.querySelectorAll('.term-chip[data-cmd]');
    if (!bodyEl) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const commandHistory = [];
    let historyCursor = -1;
    let bootRunId = 0;

    function getBootLines() {
      return [
        { kind: 'prompt', text: 'whoami' },
        { kind: 'ok', text: `Thaynan Passos — ${translate('terminal.subtitle', 'Análise e Desenvolvimento de Sistemas')}` },
        { kind: 'prompt', text: 'cat perfil.json' },
        { kind: 'out', text: '{' },
        { kind: 'key', text: `  "${translate('terminal.cargoKey', 'cargo')}": "${translate('terminal.cargoVal', 'Estagiário em Tecnologia / Análise de Sistemas')}",` },
        { kind: 'out', text: `  "${translate('terminal.empresaKey', 'unidade')}": "Sesc Pernambuco — UTD",` },
        { kind: 'out', text: `  "${translate('terminal.stackKey', 'stack')}": ["Java", "Python", "SQL", "Git", "Docker", "IA"],` },
        { kind: 'key', text: `  "${translate('terminal.statusKey', 'status')}": "${translate('terminal.statusVal', 'ativo // aberto a oportunidades em Dev & TI')}"` },
        { kind: 'out', text: '}' }
      ];
    }

    function appendTerminalLine(kind, text) {
      const row = document.createElement('div');
      row.className = 't-line';

      if (kind === 'prompt') {
        const promptSpan = document.createElement('span');
        promptSpan.className = 't-prompt';
        promptSpan.textContent = '~/thaynan $ ';

        const cmdSpan = document.createElement('span');
        cmdSpan.className = 't-cmd';
        cmdSpan.textContent = text;

        row.appendChild(promptSpan);
        row.appendChild(cmdSpan);
      } else {
        const outSpan = document.createElement('span');
        outSpan.className = `t-${kind}`;
        outSpan.textContent = text;
        row.appendChild(outSpan);
      }

      bodyEl.appendChild(row);
      bodyEl.scrollTop = bodyEl.scrollHeight;
    }

    function playBootSequence(instant) {
      bootRunId += 1;
      const myRun = bootRunId;
      bodyEl.textContent = '';
      const lines = getBootLines();
      const skipAnim = instant || prefersReducedMotion.matches;

      let cursor = 0;
      function step() {
        if (myRun !== bootRunId || cursor >= lines.length) return;
        const item = lines[cursor++];
        appendTerminalLine(item.kind, item.text);
        if (cursor < lines.length) {
          const delay = skipAnim
            ? 0
            : (item.kind === 'prompt' ? TERMINAL_PROMPT_DELAY_MS : TERMINAL_LINE_DELAY_MS);
          setTimeout(step, delay);
        }
      }
      step();
    }

    function executeCommand(rawCmd) {
      const trimmed = String(rawCmd || '').trim();
      if (!trimmed) return;

      bootRunId += 1;
      if (commandHistory[0] !== trimmed) {
        commandHistory.unshift(trimmed);
        if (commandHistory.length > MAX_TERMINAL_HISTORY) {
          commandHistory.pop();
        }
      }
      historyCursor = -1;

      const terminalLabels = {
        role: translate('terminal.cargoVal', 'Estagiário em Tecnologia / Análise de Sistemas'),
        helpHeader: translate('terminal.helpHeader', 'COMANDOS DISPONÍVEIS:'),
        helpWhoami: translate('terminal.helpWhoami', 'Resumo profissional e atuação atual'),
        helpStack: translate('terminal.helpStack', 'Linguagens, ferramentas e infraestrutura'),
        helpProjects: translate('terminal.helpProjects', 'Repositórios públicos no GitHub'),
        helpCerts: translate('terminal.helpCerts', 'Certificados verificados (Java, IA, Python, Infra)'),
        helpExperience: translate('terminal.helpExperience', 'Histórico em TI e suporte técnico'),
        helpEducation: translate('terminal.helpEducation', 'Formação acadêmica no IFPE e UFPE'),
        helpContact: translate('terminal.helpContact', 'Canais diretos de contato'),
        helpCv: translate('terminal.helpCv', 'Baixar currículo em PDF'),
        helpClear: translate('terminal.helpClear', 'Limpar histórico do console'),
        navProjects: translate('terminal.navProjects', 'Navegando para seção 03 // Projetos no GitHub...'),
        navCerts: translate('terminal.navCerts', 'Navegando para seção 06 // Certificados e Cursos...'),
        cvTriggered: translate('terminal.cvTriggered', 'Abrindo currículo oficial: THAYNANCurriculo.pdf'),
        unknownCmd: translate(
          'terminal.unknownCmd',
          'Comando não reconhecido: "{cmd}". Digite "help" para listar os comandos.'
        )
      };

      const parsed = parseTerminalCommand(trimmed, {
        certCount: appState.certCount,
        repoCount: appState.repoCount,
        labels: terminalLabels
      });

      if (parsed.type === 'clear') {
        bodyEl.textContent = '';
        return;
      }

      appendTerminalLine('prompt', trimmed);
      parsed.lines.forEach(line => appendTerminalLine(line.kind, line.text));

      if (parsed.navigateTo) {
        const targetEl = document.querySelector(parsed.navigateTo);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: prefersReducedMotion.matches ? 'auto' : 'smooth' });
        }
      }

      if (parsed.downloadCv) {
        const link = document.createElement('a');
        link.href = 'THAYNANCurriculo.pdf';
        link.download = 'THAYNANCurriculo.pdf';
        link.rel = 'noopener';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }

    chipButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const cmd = btn.getAttribute('data-cmd') || '';
        executeCommand(cmd);
        if (inputEl && cmd !== 'clear') {
          inputEl.focus();
        }
      });
    });

    if (formEl && inputEl) {
      formEl.addEventListener('submit', (event) => {
        event.preventDefault();
        const value = inputEl.value;
        inputEl.value = '';
        executeCommand(value);
      });

      inputEl.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowUp') {
          if (!commandHistory.length) return;
          event.preventDefault();
          historyCursor = Math.min(commandHistory.length - 1, historyCursor + 1);
          inputEl.value = commandHistory[historyCursor];
        } else if (event.key === 'ArrowDown') {
          event.preventDefault();
          historyCursor = Math.max(-1, historyCursor - 1);
          inputEl.value = historyCursor === -1 ? '' : commandHistory[historyCursor];
        }
      });
    }

    setTimeout(() => playBootSequence(false), TERMINAL_BOOT_DELAY_MS);
    window.addEventListener('i18n:change', () => playBootSequence(true));
  })();

  /* ── 7. Projetos no GitHub (Cache + Timeout + Busca Debounce + Filtro) ── */
  (function initGithubProjects() {
    const gridEl = document.getElementById('projectsGrid');
    const searchEl = document.getElementById('projectSearch');
    const langBarEl = document.getElementById('projectLangFilters');
    if (!gridEl) return;

    const LANG_COLORS = {
      Python: '#3572A5',
      Java: '#B07219',
      HTML: '#E34C26',
      JavaScript: '#F1E05A',
      CSS: '#563D7C',
      TypeScript: '#3178C6',
      Shell: '#89E051',
      'Jupyter Notebook': '#DA5B0B'
    };

    const FALLBACK_REPOS = [
      {
        name: 'Thaynan-passos.github.io',
        html_url: `https://github.com/${GITHUB_USER}/Thaynan-passos.github.io`,
        homepage: 'https://thaynan-passos.github.io/',
        description: 'Portfólio técnico estático com arquitetura Industrial, i18n em 5 idiomas, console interativo e gestão automatizada de certificados.',
        language: 'JavaScript',
        topics: ['portfolio', 'accessibility', 'i18n'],
        stargazers_count: 1,
        pushed_at: new Date().toISOString()
      }
    ];

    let allRepos = FALLBACK_REPOS.slice();
    let activeLang = 'all';
    let searchQuery = '';

    async function fetchJsonWithTimeout(url, cacheKey) {
      const cachedRaw = safeLocalStorage.get(cacheKey);
      let cachedData = null;

      if (cachedRaw) {
        try {
          const parsed = JSON.parse(cachedRaw);
          cachedData = parsed.data;
          if (isCacheFresh(parsed.timestamp, Date.now(), GITHUB_CACHE_TTL_MS) && Array.isArray(cachedData)) {
            return cachedData;
          }
        } catch (err) {
          console.warn('[github] Cache local corrompido removido:', err);
          safeLocalStorage.remove(cacheKey);
        }
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), GITHUB_TIMEOUT_MS);

      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        if (Array.isArray(data)) {
          safeLocalStorage.set(cacheKey, JSON.stringify({ timestamp: Date.now(), data }));
          return data;
        }
        throw new Error('Resposta inesperada da API do GitHub');
      } catch (err) {
        if (Array.isArray(cachedData) && cachedData.length) {
          console.warn('[github] Usando cache anterior após falha de rede:', err);
          return cachedData;
        }
        throw err;
      } finally {
        clearTimeout(timeoutId);
      }
    }

    function renderLanguageButtons() {
      if (!langBarEl) return;
      const langs = extractRepoLanguages(allRepos, SKIP_REPOS);
      const allLabel = escapeHtml(translate('projects.filterAll', 'Todas'));

      const buttonsHtml = [
        `<button type="button" class="filter-chip${activeLang === 'all' ? ' active' : ''}" data-lang-filter="all">${allLabel}</button>`
      ];

      langs.forEach(lang => {
        const safeLang = escapeHtml(lang);
        const isActive = activeLang === lang;
        buttonsHtml.push(
          `<button type="button" class="filter-chip${isActive ? ' active' : ''}" data-lang-filter="${safeLang}">${safeLang}</button>`
        );
      });

      langBarEl.innerHTML = buttonsHtml.join('');
      langBarEl.querySelectorAll('.filter-chip').forEach(btn => {
        btn.addEventListener('click', () => {
          activeLang = btn.getAttribute('data-lang-filter') || 'all';
          renderLanguageButtons();
          renderRepos();
        });
      });
    }

    function renderRepos() {
      const visible = filterRepositories(allRepos, {
        query: searchQuery,
        language: activeLang,
        skipNames: SKIP_REPOS,
        maxItems: MAX_VISIBLE_REPOS
      });

      if (!visible.length) {
        const emptyMsg = escapeHtml(translate('projects.empty', 'Nenhum repositório encontrado para o filtro aplicado.'));
        gridEl.innerHTML = `<p class="projects-empty">${emptyMsg}</p>`;
        return;
      }

      const updatedPrefix = escapeHtml(translate('projects.updatedPrefix', 'atualizado'));
      const demoLabel = escapeHtml(translate('projects.demoBtn', 'Demo'));
      const fallbackDesc = translate('projects.fallbackDesc', 'Repositório de estudo e desenvolvimento de software.');
      const timeLabels = {
        today: translate('time.today', 'hoje'),
        yesterday: translate('time.yesterday', 'ontem'),
        daysAgo: translate('time.daysAgo', 'há {n} dias'),
        monthAgo: translate('time.monthAgo', 'há 1 mês'),
        monthsAgo: translate('time.monthsAgo', 'há {n} meses'),
        yearAgo: translate('time.yearAgo', 'há 1 ano'),
        yearsAgo: translate('time.yearsAgo', 'há {n} anos')
      };

      gridEl.innerHTML = visible.map(repo => {
        const name = escapeHtml(repo.name || 'Projeto');
        const repoHref = sanitizeHref(repo.html_url || '#');
        const demoHref = repo.homepage ? sanitizeHref(repo.homepage) : '#';
        const desc = escapeHtml(repo.description || fallbackDesc);
        const lang = escapeHtml(repo.language || '');
        const dotColor = LANG_COLORS[repo.language] || '#00E676';
        const stars = Number(repo.stargazers_count || 0);
        const updatedText = escapeHtml(formatRelativeTime(repo.pushed_at, Date.now(), timeLabels));
        const topics = Array.isArray(repo.topics)
          ? repo.topics.slice(0, MAX_REPO_TOPICS).map(t => `<span class="project-topic">${escapeHtml(t)}</span>`).join('')
          : '';

        return `
          <article class="project-card">
            <div class="project-header">
              <h3>${name}</h3>
              <div class="project-actions">
                ${demoHref !== '#' ? `<a href="${demoHref}" target="_blank" rel="noopener noreferrer" class="project-demo-link">${demoLabel}</a>` : ''}
                <a href="${repoHref}" target="_blank" rel="noopener noreferrer" class="project-link" aria-label="Abrir ${name} no GitHub">
                  <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M18 13v6H5V6h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              </div>
            </div>
            <p class="project-desc">${desc}</p>
            ${topics ? `<div class="project-topics">${topics}</div>` : ''}
            <div class="project-meta">
              ${lang ? `<span class="project-lang"><span class="lang-dot" style="background:${dotColor}" aria-hidden="true"></span>${lang}</span>` : ''}
              ${stars > 0 ? `<span class="project-stars" aria-label="${stars} estrelas"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24" aria-hidden="true"><polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3 12 2" /></svg>${stars}</span>` : ''}
              ${updatedText ? `<span class="project-updated">${updatedPrefix} ${updatedText}</span>` : ''}
            </div>
          </article>
        `;
      }).join('');
    }

    if (searchEl) {
      let debounceTimer = null;
      searchEl.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          searchQuery = searchEl.value || '';
          renderRepos();
        }, SEARCH_DEBOUNCE_MS);
      });
    }

    window.addEventListener('i18n:change', () => {
      renderLanguageButtons();
      renderRepos();
    });

    fetchJsonWithTimeout(
      `https://api.github.com/users/${GITHUB_USER}/repos?sort=updated&per_page=20&type=public`,
      `gh-repos-${GITHUB_USER}`
    )
      .then(repos => {
        const clean = repos.filter(r => r && !r.fork && !SKIP_REPOS.includes(r.name));
        allRepos = clean.length ? clean : FALLBACK_REPOS.slice();
        appState.repoCount = allRepos.length;
        renderLanguageButtons();
        renderRepos();
      })
      .catch(err => {
        console.warn('[github] Falha ao carregar API do GitHub; exibindo fallback local:', err);
        allRepos = FALLBACK_REPOS.slice();
        appState.repoCount = allRepos.length;
        renderLanguageButtons();
        renderRepos();
      });
  })();

  /* ── 8. Certificados (Carrossel Touch + Grade + Contadores + Lightbox) ── */
  (function initCertificates() {
    const trackEl = document.getElementById('certTrack');
    const dotsBox = document.getElementById('certDots');
    const prevBtn = document.getElementById('certPrev');
    const nextBtn = document.getElementById('certNext');
    const carouselEl = document.getElementById('certCarousel');
    const viewportEl = document.getElementById('certViewport');
    const gridViewEl = document.getElementById('certGridView');
    const counterEl = document.getElementById('certCounter');
    const kpiCertEl = document.getElementById('kpiCertCount');

    const btnViewCarousel = document.getElementById('btnViewCarousel');
    const btnViewGrid = document.getElementById('btnViewGrid');
    const filterButtons = document.querySelectorAll('.cert-filter-btn[data-filter]');

    const modalEl = document.getElementById('certModal');
    const modalContentEl = document.getElementById('certModalContent');
    const modalCloseBtn = document.getElementById('certModalClose');
    const modalBackdropEl = document.getElementById('certModalBackdrop');

    if (!trackEl) return;

    const FALLBACK_CERTIFICATES = [
      {
        name: 'Itau-Java-com-Inteligencia-Artificial.pdf',
        title: 'Bootcamp Itaú — Java com Inteligência Artificial',
        issuer: 'DIO / Itaú',
        hours: '45h',
        category: 'dev',
        url: 'certificados/Itau-Java-com-Inteligencia-Artificial.pdf',
        previewUrl: null,
        isPdf: true
      },
      {
        name: 'IAparaDevs.pdf',
        title: 'IA pra Devs — Como Extrair o Máximo com Inteligência Artificial',
        issuer: 'Udemy',
        hours: '8,5h',
        category: 'dev',
        url: 'certificados/IAparaDevs.pdf',
        previewUrl: null,
        isPdf: true
      },
      {
        name: 'Antigravity-IDE-Guia-Pratico-de-Desenvolvimento-com-IA.pdf',
        title: 'Antigravity IDE — Guia Prático de Desenvolvimento com IA',
        issuer: 'Udemy',
        hours: '5h',
        category: 'dev',
        url: 'certificados/Antigravity-IDE-Guia-Pratico-de-Desenvolvimento-com-IA.pdf',
        previewUrl: null,
        isPdf: true
      },
      {
        name: 'claude-academy-badge-claude-code-101.pdf',
        title: 'Claude Code 101 — Course Completion Badge',
        issuer: 'Claude Academy / Anthropic',
        hours: '',
        category: 'dev',
        url: 'certificados/claude-academy-badge-claude-code-101.pdf',
        previewUrl: null,
        isPdf: true
      },
      {
        name: 'certificado-udemy-Python-PCEP.pdf',
        title: 'Python PCEP — Preparatório de Certificação',
        issuer: 'Udemy',
        hours: '',
        category: 'dev',
        url: 'certificados/certificado-udemy-Python-PCEP.pdf',
        previewUrl: 'certificados/certificado-udemy-Python-PCEP.preview.webp',
        isPdf: true
      },
      {
        name: 'certificado-udemy-Git-Github-Zero-Avan-U00e7ado.pdf',
        title: 'Git & GitHub — Do Zero ao Avançado',
        issuer: 'Udemy',
        hours: '',
        category: 'dev',
        url: 'certificados/certificado-udemy-Git-Github-Zero-Avan-U00e7ado.pdf',
        previewUrl: 'certificados/certificado-udemy-Git-Github-Zero-Avan-U00e7ado.preview.webp',
        isPdf: true
      },
      {
        name: 'Cesar-School-No-U00e7-U00f5es-de-Programa-U00e7-U00e3o.pdf',
        title: 'CESAR School — Noções de Programação',
        issuer: 'CESAR School',
        hours: '',
        category: 'dev',
        url: 'certificados/Cesar-School-No-U00e7-U00f5es-de-Programa-U00e7-U00e3o.pdf',
        previewUrl: 'certificados/Cesar-School-No-U00e7-U00f5es-de-Programa-U00e7-U00e3o.preview.webp',
        isPdf: true
      },
      {
        name: 'Bootvamp-HEINEKEN-I.A-aplicada-a-Vendas.pdf',
        title: 'Bootcamp HEINEKEN — Inteligência Artificial Aplicada a Vendas',
        issuer: 'DIO / HEINEKEN',
        hours: '',
        category: 'dev',
        url: 'certificados/Bootvamp-HEINEKEN-I.A-aplicada-a-Vendas.pdf',
        previewUrl: 'certificados/Bootvamp-HEINEKEN-I.A-aplicada-a-Vendas.preview.webp',
        isPdf: true
      },
      {
        name: 'certificado-udemy-WordPress-bAsico-Avan-U00e7ado.pdf',
        title: 'WordPress — Do Básico ao Avançado',
        issuer: 'Udemy',
        hours: '',
        category: 'dev',
        url: 'certificados/certificado-udemy-WordPress-bAsico-Avan-U00e7ado.pdf',
        previewUrl: 'certificados/certificado-udemy-WordPress-bAsico-Avan-U00e7ado.preview.webp',
        isPdf: true
      },
      {
        name: 'FAST-rilha-de-Transi-U00e7-U00e3o-de-carreira-em-Ciberseguran-U00e7a.pdf',
        title: 'FAST — Trilha de Transição de Carreira em Cibersegurança',
        issuer: 'CESAR School / FAST',
        hours: '',
        category: 'infra',
        url: 'certificados/FAST-rilha-de-Transi-U00e7-U00e3o-de-carreira-em-Ciberseguran-U00e7a.pdf',
        previewUrl: 'certificados/FAST-rilha-de-Transi-U00e7-U00e3o-de-carreira-em-Ciberseguran-U00e7a.preview.webp',
        isPdf: true
      },
      {
        name: 'certificado-udemy-Sharepoint-Zero-Avan-U00e7ado.pdf',
        title: 'Microsoft SharePoint — Do Zero ao Avançado',
        issuer: 'Udemy',
        hours: '',
        category: 'infra',
        url: 'certificados/certificado-udemy-Sharepoint-Zero-Avan-U00e7ado.pdf',
        previewUrl: 'certificados/certificado-udemy-Sharepoint-Zero-Avan-U00e7ado.preview.webp',
        isPdf: true
      },
      {
        name: 'certificado-udemy-Metodologias-U00c1geis-XP-Scrum-LeamEKanban.pdf',
        title: 'Metodologias Ágeis — XP, Scrum, Lean e Kanban',
        issuer: 'Udemy',
        hours: '',
        category: 'gestao',
        url: 'certificados/certificado-udemy-Metodologias-U00c1geis-XP-Scrum-LeamEKanban.pdf',
        previewUrl: 'certificados/certificado-udemy-Metodologias-U00c1geis-XP-Scrum-LeamEKanban.preview.webp',
        isPdf: true
      },
      {
        name: 'certificado-udemy-comunica-U00e7-U00e3oAssertiva.pdf',
        title: 'Comunicação Assertiva no Ambiente Profissional',
        issuer: 'Udemy',
        hours: '',
        category: 'gestao',
        url: 'certificados/certificado-udemy-comunica-U00e7-U00e3oAssertiva.pdf',
        previewUrl: 'certificados/certificado-udemy-comunica-U00e7-U00e3oAssertiva.preview.webp',
        isPdf: true
      },
      {
        name: 'certificado-udemy-ProdutividadeProcrastina-U00e7-U00e3oGest-U00e3oTempo.pdf',
        title: 'Produtividade, Procrastinação e Gestão de Tempo',
        issuer: 'Udemy',
        hours: '',
        category: 'gestao',
        url: 'certificados/certificado-udemy-ProdutividadeProcrastina-U00e7-U00e3oGest-U00e3oTempo.pdf',
        previewUrl: 'certificados/certificado-udemy-ProdutividadeProcrastina-U00e7-U00e3oGest-U00e3oTempo.preview.webp',
        isPdf: true
      },
      {
        name: 'certificado-udemy-Hiper-Efici-U00eancia-Gest-U00e3o-Tempo.pdf',
        title: 'Hiper Eficiência & Gestão de Tempo',
        issuer: 'Udemy',
        hours: '',
        category: 'gestao',
        url: 'certificados/certificado-udemy-Hiper-Efici-U00eancia-Gest-U00e3o-Tempo.pdf',
        previewUrl: 'certificados/certificado-udemy-Hiper-Efici-U00eancia-Gest-U00e3o-Tempo.preview.webp',
        isPdf: true
      }
    ];

    let allCertificates = FALLBACK_CERTIFICATES.slice();
    let currentFilter = 'all';
    let activeSlides = allCertificates.slice();
    let activeIndex = 0;
    let autoplayTimer = null;
    let lastFocusedTrigger = null;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    function formatTwoDigits(num) {
      return String(num).padStart(2, '0');
    }

    function getBadgeLabel(category) {
      if (category === 'dev') return translate('cert.badgeDev', 'DEV & IA');
      if (category === 'infra') return translate('cert.badgeInfra', 'INFRA & SEC');
      return translate('cert.badgeGestao', 'GESTÃO');
    }

    function updateCounters() {
      const counts = countCertificatesByCategory(allCertificates);
      appState.certCount = counts.all;

      if (kpiCertEl) {
        kpiCertEl.textContent = formatTwoDigits(counts.all);
      }

      document.querySelectorAll('.cert-filter-count[data-count-for]').forEach(el => {
        const key = el.getAttribute('data-count-for');
        if (key && Object.prototype.hasOwnProperty.call(counts, key)) {
          el.textContent = String(counts[key]);
        }
      });
    }

    function buildDocFallbackMarkup(item) {
      const safeTitle = escapeHtml(item.title || item.name || 'Certificado');
      const safeIssuer = escapeHtml(item.issuer || 'Certificação Verificada');
      const safeHours = escapeHtml(item.hours || '');
      const statusLabel = escapeHtml(translate('cert.pendingPreview', 'DOCUMENTO PDF VERIFICADO'));

      return `
        <div class="cert-doc-fallback">
          <div class="cert-doc-top">
            <span>${statusLabel}</span>
            ${safeHours ? `<span>${safeHours}</span>` : '<span>PDF</span>'}
          </div>
          <p class="cert-doc-title">${safeTitle}</p>
          <p class="cert-doc-issuer">${safeIssuer}</p>
        </div>
      `;
    }

    function buildMediaMarkup(item, indexAttr) {
      const safeTitle = escapeHtml(item.title || 'Certificado');
      if (isImagePreviewUrl(item.previewUrl)) {
        const previewSrc = sanitizeHref(item.previewUrl);
        return `
          <img src="${previewSrc}" alt="Prévia do certificado: ${safeTitle}" loading="lazy" decoding="async"
            data-cert-img="${indexAttr}">
        `;
      }
      return buildDocFallbackMarkup(item);
    }

    function bindCertOpenTriggers(container) {
      container.querySelectorAll('[data-cert-open]').forEach(trigger => {
        trigger.addEventListener('click', () => {
          const idx = Number(trigger.getAttribute('data-cert-open'));
          if (activeSlides[idx]) openModal(activeSlides[idx], trigger);
        });
        if (trigger.getAttribute('role') === 'button') {
          trigger.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              const idx = Number(trigger.getAttribute('data-cert-open'));
              if (activeSlides[idx]) openModal(activeSlides[idx], trigger);
            }
          });
        }
      });
    }

    function wireImageFallbacks(container) {
      container.querySelectorAll('img[data-cert-img]').forEach(img => {
        img.addEventListener('error', () => {
          const idx = Number(img.getAttribute('data-cert-img'));
          const item = activeSlides[idx];
          const parent = img.parentElement;
          if (parent && item) {
            parent.innerHTML = buildDocFallbackMarkup(item);
          }
        });
      });
    }

    function stopAutoplay() {
      if (autoplayTimer) {
        clearInterval(autoplayTimer);
        autoplayTimer = null;
      }
    }

    function startAutoplay() {
      stopAutoplay();
      if (activeSlides.length < 2 || prefersReducedMotion.matches || document.hidden) return;
      if (carouselEl && carouselEl.style.display === 'none') return;
      autoplayTimer = setInterval(() => goTo(activeIndex + 1), CAROUSEL_AUTOPLAY_MS);
    }

    function openModal(item, triggerEl) {
      if (!modalEl || !modalContentEl || !item) return;
      lastFocusedTrigger = triggerEl || document.activeElement;

      const safeTitle = escapeHtml(item.title || 'Certificado');
      const safeUrl = sanitizeHref(item.url);
      const safeFileName = escapeHtml(item.name || 'certificado.pdf');
      const viewText = escapeHtml(translate('cert.viewBtn', 'Abrir PDF'));
      const downloadText = escapeHtml(translate('cert.downloadBtn', 'Baixar PDF'));

      const mediaMarkup = isImagePreviewUrl(item.previewUrl)
        ? `<img src="${sanitizeHref(item.previewUrl)}" alt="${safeTitle}" decoding="async">`
        : buildDocFallbackMarkup(item);

      modalContentEl.innerHTML = `
        ${mediaMarkup}
        <div class="cert-modal-footer">
          <div>
            <h3 id="certModalTitle">${safeTitle}</h3>
            <span class="pill" style="margin-top:8px;">${escapeHtml(getBadgeLabel(item.category))}</span>
          </div>
          <div class="cert-modal-actions">
            <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-primary">${viewText}</a>
            <a href="${safeUrl}" download="${safeFileName}" class="btn btn-secondary">${downloadText}</a>
          </div>
        </div>
      `;

      modalEl.classList.add('open');
      modalEl.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      stopAutoplay();

      if (modalCloseBtn) {
        modalCloseBtn.focus();
      }
    }

    function closeModal() {
      if (!modalEl || !modalEl.classList.contains('open')) return;
      modalEl.classList.remove('open');
      modalEl.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      startAutoplay();

      if (lastFocusedTrigger && typeof lastFocusedTrigger.focus === 'function') {
        lastFocusedTrigger.focus();
      }
    }

    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
    if (modalBackdropEl) modalBackdropEl.addEventListener('click', closeModal);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modalEl && modalEl.classList.contains('open')) {
        closeModal();
      }
    });

    function applyCarouselPosition() {
      trackEl.style.transform = `translateX(-${activeIndex * 100}%)`;
      if (counterEl) {
        counterEl.textContent = `${formatTwoDigits(activeIndex + 1)} / ${formatTwoDigits(activeSlides.length)}`;
      }
      if (dotsBox) {
        dotsBox.querySelectorAll('.cert-dot').forEach((dot, i) => {
          const isCurrent = i === activeIndex;
          dot.classList.toggle('active', isCurrent);
          dot.setAttribute('aria-selected', String(isCurrent));
        });
      }
    }

    function goTo(targetIndex) {
      if (!activeSlides.length) return;
      activeIndex = (targetIndex + activeSlides.length) % activeSlides.length;
      applyCarouselPosition();
    }

    function renderCarousel() {
      if (!activeSlides.length) {
        const emptyText = escapeHtml(translate('cert.emptyCategory', 'Nenhum certificado encontrado nesta categoria.'));
        trackEl.innerHTML = `<p class="cert-loading">${emptyText}</p>`;
        if (dotsBox) dotsBox.innerHTML = '';
        if (prevBtn) prevBtn.disabled = true;
        if (nextBtn) nextBtn.disabled = true;
        if (counterEl) counterEl.textContent = '00 / 00';
        return;
      }

      if (prevBtn) prevBtn.disabled = false;
      if (nextBtn) nextBtn.disabled = false;

      const viewText = escapeHtml(translate('cert.viewBtn', 'Abrir PDF'));
      const zoomText = escapeHtml(translate('cert.zoomBtn', 'Ampliar'));
      const metaText = escapeHtml(translate('cert.verifiedMeta', 'Documento PDF verificado no repositório'));

      trackEl.innerHTML = activeSlides.map((item, i) => {
        const safeTitle = escapeHtml(item.title || 'Certificado');
        const safeIssuer = escapeHtml(item.issuer || '');
        const safeHours = escapeHtml(item.hours || '');
        const safeUrl = sanitizeHref(item.url);

        return `
          <div class="cert-slide">
            <article class="cert-card">
              <div class="cert-card-media" data-cert-open="${i}" role="button" tabindex="0" aria-label="${zoomText}: ${safeTitle}">
                ${buildMediaMarkup(item, i)}
              </div>
              <div class="cert-card-body">
                <div class="cert-card-meta-row">
                  <span class="pill pill-active">${escapeHtml(getBadgeLabel(item.category))}</span>
                  ${safeIssuer ? `<span class="cert-issuer-tag">${safeIssuer}</span>` : ''}
                  ${safeHours ? `<span class="cert-issuer-tag">${safeHours}</span>` : ''}
                </div>
                <h3>${safeTitle}</h3>
                <p class="cert-meta">${metaText}</p>
                <div class="cert-card-actions">
                  <button type="button" class="btn btn-secondary" data-cert-open="${i}">${zoomText}</button>
                  <a class="btn btn-primary" href="${safeUrl}" target="_blank" rel="noopener noreferrer">${viewText}</a>
                </div>
              </div>
            </article>
          </div>
        `;
      }).join('');

      wireImageFallbacks(trackEl);
      bindCertOpenTriggers(trackEl);

      if (dotsBox) {
        dotsBox.innerHTML = activeSlides.map((_, i) =>
          `<button type="button" class="cert-dot${i === activeIndex ? ' active' : ''}" role="tab" aria-label="Certificado ${i + 1}" aria-selected="${i === activeIndex}"></button>`
        ).join('');

        dotsBox.querySelectorAll('.cert-dot').forEach((dot, i) => {
          dot.addEventListener('click', () => {
            goTo(i);
            startAutoplay();
          });
        });
      }

      applyCarouselPosition();
      startAutoplay();
    }

    function renderGrid() {
      if (!gridViewEl) return;
      if (!activeSlides.length) {
        const emptyText = escapeHtml(translate('cert.emptyCategory', 'Nenhum certificado encontrado nesta categoria.'));
        gridViewEl.innerHTML = `<p class="cert-loading">${emptyText}</p>`;
        return;
      }

      const viewText = escapeHtml(translate('cert.viewBtn', 'Abrir PDF'));
      const zoomText = escapeHtml(translate('cert.zoomBtn', 'Ampliar'));

      gridViewEl.innerHTML = activeSlides.map((item, i) => {
        const safeTitle = escapeHtml(item.title || 'Certificado');
        const safeUrl = sanitizeHref(item.url);

        return `
          <article class="cert-grid-card">
            <div class="cert-grid-media" data-cert-open="${i}" role="button" tabindex="0" aria-label="${zoomText}: ${safeTitle}">
              ${buildMediaMarkup(item, i)}
              <span class="cert-grid-badge">${escapeHtml(getBadgeLabel(item.category))}</span>
            </div>
            <div class="cert-grid-body">
              <h3>${safeTitle}</h3>
              <div class="cert-grid-footer">
                <button type="button" class="cert-preview-btn" data-cert-open="${i}">${zoomText}</button>
                <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">${viewText}</a>
              </div>
            </div>
          </article>
        `;
      }).join('');

      wireImageFallbacks(gridViewEl);
      bindCertOpenTriggers(gridViewEl);
    }

    function applyFilter(category) {
      currentFilter = category || 'all';
      filterButtons.forEach(btn => {
        const isSelected = btn.getAttribute('data-filter') === currentFilter;
        btn.classList.toggle('active', isSelected);
        btn.setAttribute('aria-selected', String(isSelected));
      });
      activeSlides = filterCertificates(allCertificates, currentFilter);
      activeIndex = 0;
      renderCarousel();
      renderGrid();
    }

    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        applyFilter(btn.getAttribute('data-filter'));
      });
    });

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        goTo(activeIndex - 1);
        startAutoplay();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        goTo(activeIndex + 1);
        startAutoplay();
      });
    }

    if (carouselEl) {
      carouselEl.setAttribute('tabindex', '0');
      carouselEl.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowLeft') {
          goTo(activeIndex - 1);
          startAutoplay();
        } else if (event.key === 'ArrowRight') {
          goTo(activeIndex + 1);
          startAutoplay();
        }
      });
      carouselEl.addEventListener('mouseenter', stopAutoplay);
      carouselEl.addEventListener('mouseleave', startAutoplay);
      carouselEl.addEventListener('focusin', stopAutoplay);
      carouselEl.addEventListener('focusout', () => {
        setTimeout(() => {
          if (!carouselEl.contains(document.activeElement)) startAutoplay();
        }, 0);
      });
    }

    if (viewportEl) {
      let startX = 0;
      let endX = 0;

      viewportEl.addEventListener('touchstart', (event) => {
        startX = event.touches[0].clientX;
        endX = startX;
        stopAutoplay();
      }, { passive: true });

      viewportEl.addEventListener('touchmove', (event) => {
        endX = event.touches[0].clientX;
      }, { passive: true });

      viewportEl.addEventListener('touchend', () => {
        const deltaX = endX - startX;
        if (Math.abs(deltaX) > SWIPE_THRESHOLD_PX) {
          goTo(deltaX < 0 ? activeIndex + 1 : activeIndex - 1);
        }
        startAutoplay();
      });
    }

    if (btnViewCarousel && btnViewGrid && carouselEl && gridViewEl) {
      btnViewCarousel.addEventListener('click', () => {
        btnViewCarousel.classList.add('active');
        btnViewCarousel.setAttribute('aria-pressed', 'true');
        btnViewGrid.classList.remove('active');
        btnViewGrid.setAttribute('aria-pressed', 'false');
        carouselEl.style.display = 'flex';
        gridViewEl.style.display = 'none';
        startAutoplay();
      });

      btnViewGrid.addEventListener('click', () => {
        btnViewGrid.classList.add('active');
        btnViewGrid.setAttribute('aria-pressed', 'true');
        btnViewCarousel.classList.remove('active');
        btnViewCarousel.setAttribute('aria-pressed', 'false');
        carouselEl.style.display = 'none';
        gridViewEl.style.display = 'grid';
        stopAutoplay();
        renderGrid();
      });
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopAutoplay();
      else startAutoplay();
    });

    window.addEventListener('i18n:change', () => {
      renderCarousel();
      renderGrid();
    });

    updateCounters();
    renderCarousel();
    renderGrid();

    if (window.location.protocol.startsWith('http')) {
      fetch('certificados/certificados.json')
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then(list => {
          if (Array.isArray(list) && list.length) {
            allCertificates = list;
            updateCounters();
            activeSlides = filterCertificates(allCertificates, currentFilter);
            activeIndex = 0;
            renderCarousel();
            renderGrid();
          }
        })
        .catch(err => {
          console.warn('[certificates] Falha ao carregar certificados.json; mantendo fallback:', err);
        });
    }
  })();

  /* ── 9. Formulário de Contato (Formspree com AbortController) ── */
  (function initContactForm() {
    const formEl = document.getElementById('contactForm');
    const statusEl = document.getElementById('formStatus');
    const submitBtn = document.getElementById('contactSubmitBtn');
    if (!formEl || !statusEl || !submitBtn) return;

    const btnTextSpan = submitBtn.querySelector('span');

    formEl.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!formEl.checkValidity()) {
        formEl.reportValidity();
        return;
      }

      submitBtn.disabled = true;
      if (btnTextSpan) {
        btnTextSpan.textContent = translate('contact.formSending', 'Enviando...');
      }
      statusEl.textContent = '';
      statusEl.className = 'form-status';

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FORM_TIMEOUT_MS);

      try {
        const response = await fetch(formEl.action, {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body: new FormData(formEl),
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        statusEl.textContent = translate('contact.formSuccess', 'Mensagem enviada com sucesso. Retornarei em breve.');
        statusEl.classList.add('ok');
        formEl.reset();
      } catch (err) {
        console.error('[contact] Erro ao enviar mensagem via formulário:', err);
        statusEl.textContent = translate(
          'contact.formError',
          'Não foi possível enviar pelo formulário agora. Utilize o e-mail ou WhatsApp ao lado.'
        );
        statusEl.classList.add('err');
      } finally {
        clearTimeout(timeoutId);
        submitBtn.disabled = false;
        if (btnTextSpan) {
          btnTextSpan.textContent = translate('contact.formSubmit', 'Enviar mensagem');
        }
      }
    });
  })();
})();
