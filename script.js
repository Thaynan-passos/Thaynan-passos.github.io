/**
 * script.js — Interatividade, API GitHub com Cache & Proteção,
 * Carrossel com Suporte Touch/Swipe, Grade de Certificados e WhatsApp FAB.
 */

/* ── Ano automático no rodapé ── */
const yrEl = document.getElementById('yr');
if (yrEl) yrEl.textContent = new Date().getFullYear();

/* ── Alternância de Tema Claro / Escuro ── */
(function () {
  const themeToggle = document.getElementById('themeToggle');
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  const THEME_KEY = 'site-theme';

  function setTheme(theme) {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem(THEME_KEY, 'light');
      if (metaTheme) metaTheme.setAttribute('content', '#f8fafc');
      if (themeToggle) themeToggle.setAttribute('aria-label', 'Ativar modo escuro');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem(THEME_KEY, 'dark');
      if (metaTheme) metaTheme.setAttribute('content', '#0d0f14');
      if (themeToggle) themeToggle.setAttribute('aria-label', 'Ativar modo claro');
    }
  }

  const saved = localStorage.getItem(THEME_KEY);
  if (saved) {
    setTheme(saved);
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
    setTheme('light');
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      setTheme(isLight ? 'dark' : 'light');
    });
  }

  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
      if (!localStorage.getItem(THEME_KEY)) {
        setTheme(e.matches ? 'light' : 'dark');
      }
    });
  }
})();

/* ── Menu Mobile ── */
const menuBtn = document.getElementById('menuBtn');
const navLinks = document.getElementById('navLinks');
const siteHeader = document.querySelector('header');

if (menuBtn && navLinks) {
  function toggleMobileMenu(open) {
    const isOpen = open !== undefined ? open : !navLinks.classList.contains('open');
    navLinks.classList.toggle('open', isOpen);
    menuBtn.setAttribute('aria-expanded', String(isOpen));
    if (siteHeader) siteHeader.classList.toggle('nav-open', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  }

  menuBtn.addEventListener('click', () => toggleMobileMenu());

  navLinks.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => toggleMobileMenu(false));
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && navLinks.classList.contains('open')) {
      toggleMobileMenu(false);
    }
  });
}

/* ── ScrollSpy (Indicador de Seção Ativa) ── */
(function () {
  const sections = document.querySelectorAll('section[id], header[id]');
  const links = document.querySelectorAll('.nav-links a');
  if (!sections.length || !links.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id');
        links.forEach(link => {
          const href = link.getAttribute('href');
          const isCurrent = href === `#${id}` || (id === 'top' && href === '#sobre');
          link.classList.toggle('active', isCurrent);
        });
      }
    });
  }, {
    rootMargin: '-20% 0px -70% 0px',
    threshold: 0
  });

  sections.forEach(sec => observer.observe(sec));
})();

/* ── Botão Voltar ao Topo ── */
const backTopBtn = document.getElementById('back-top');
if (backTopBtn) {
  window.addEventListener('scroll', () => {
    backTopBtn.classList.toggle('show', window.scrollY > 400);
  }, { passive: true });
  backTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

/* ── WhatsApp FAB (Balão com timer e dispensar) ── */
(function () {
  const fab = document.getElementById('whatsappFab');
  const bubble = document.getElementById('whatsappBubble');
  const closeBtn = document.getElementById('whatsappBubbleClose');
  if (!fab) return;

  const isDismissed = sessionStorage.getItem('wa-bubble-dismissed') === 'true';

  if (!isDismissed) {
    // Exibe suavemente após 2.2 segundos de navegação
    setTimeout(() => {
      fab.classList.add('show');
    }, 2200);
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      fab.classList.remove('show');
      sessionStorage.setItem('wa-bubble-dismissed', 'true');
    });
  }
})();

/* ── Helper de Cache para Requisições à API ── */
async function fetchWithCache(url, cacheKey, ttlMs = 1000 * 60 * 60 * 6) {
  const cachedStr = localStorage.getItem(cacheKey);
  if (cachedStr) {
    try {
      const parsed = JSON.parse(cachedStr);
      const isFresh = (Date.now() - parsed.timestamp) < ttlMs;
      if (isFresh) return parsed.data;
    } catch (e) {
      localStorage.removeItem(cacheKey);
    }
  }

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data }));
    return data;
  } catch (err) {
    // Em caso de falha de rede ou Rate Limit (403), usa o cache antigo se existir
    if (cachedStr) {
      try {
        const parsed = JSON.parse(cachedStr);
        return parsed.data;
      } catch (e) {}
    }
    throw err;
  }
}

/* ── Terminal interativo (Hero) ── */
(function () {
  const el = document.getElementById('terminalBody');
  if (!el) return;

  const EMPRESA_VAL = 'Sesc Pernambuco / UTD';
  const STACK_VAL = '["Java","Python","Git","SQL","Docker"]';

  const FALLBACK = {
    'terminal.subtitle': 'ADS &amp; Sistemas',
    'terminal.cargoKey': 'cargo',
    'terminal.cargoVal': 'Estagiário em Tecnologia',
    'terminal.empresaKey': 'empresa',
    'terminal.stackKey': 'stack',
    'terminal.statusKey': 'status',
    'terminal.statusVal': 'estagiando 🟢',
  };

  function t(dict, key) {
    return (dict && dict[key] !== undefined) ? dict[key] : FALLBACK[key];
  }

  function buildLines(dict) {
    return [
      { type: 'prompt', text: 'whoami' },
      { type: 'out', text: `<span class="t-key">Thaynan Passos</span> — ${t(dict, 'terminal.subtitle')}` },
      { type: 'prompt', text: 'cat perfil.json' },
      { type: 'out', text: '{' },
      { type: 'out', text: `  <span class="t-key">"${t(dict, 'terminal.cargoKey')}"</span>: <span class="t-val">"${t(dict, 'terminal.cargoVal')}"</span>,` },
      { type: 'out', text: `  <span class="t-key">"${t(dict, 'terminal.empresaKey')}"</span>: <span class="t-val">"${EMPRESA_VAL}"</span>,` },
      { type: 'out', text: `  <span class="t-key">"${t(dict, 'terminal.stackKey')}"</span>: <span class="t-val">${STACK_VAL}</span>,` },
      { type: 'out', text: `  <span class="t-key">"${t(dict, 'terminal.statusKey')}"</span>: <span class="t-val">"${t(dict, 'terminal.statusVal')}"</span>` },
      { type: 'out', text: '}' },
      { type: 'prompt', text: '_' },
    ];
  }

  const cursorEl = '<span class="cursor" aria-hidden="true"></span>';
  let runId = 0;

  function typeLines(lines, myRunId, instant) {
    let i = 0;
    function next() {
      if (myRunId !== runId) return;
      if (i >= lines.length) return;
      const line = lines[i++];
      const div = document.createElement('div');
      if (line.type === 'prompt') {
        div.innerHTML = `<span class="t-prompt">~/thaynan $</span> <span class="t-cmd">${line.text === '_' ? cursorEl : line.text}</span>`;
      } else {
        div.innerHTML = `<span class="t-out">${line.text}</span>`;
      }
      el.querySelectorAll('.cursor').forEach(c => c.remove());
      el.appendChild(div);
      if (i < lines.length) setTimeout(next, instant ? 0 : (line.type === 'prompt' ? 600 : 180));
      else {
        const lastCmd = el.querySelector('.t-cmd:last-of-type') || el.lastElementChild;
        if (lastCmd) {
          const cur = document.createElement('span');
          cur.className = 'cursor';
          lastCmd.appendChild(cur);
        }
      }
    }
    next();
  }

  function render(dict, instant) {
    runId++;
    el.innerHTML = '';
    typeLines(buildLines(dict), runId, instant);
  }

  setTimeout(() => render(window.__i18nDict, false), 350);
  window.addEventListener('i18n:change', (e) => render(e.detail.dict, true));
})();

/* ── Projetos no GitHub com Cache & Fallback ── */
(function () {
  const grid = document.getElementById('projectsGrid');
  if (!grid) return;

  const GITHUB_USER = 'Thaynan-passos';
  const LANG_COLORS = {
    Python: '#3572A5', Java: '#b07219', HTML: '#e34c26',
    JavaScript: '#f1e05a', CSS: '#563d7c', 'Jupyter Notebook': '#DA5B0B'
  };

  const SKIP = ['dio-lab-open-source', 'skills-communicate-using-markdown'];

  // Repositórios de reserva caso a API do GitHub esteja bloqueada ou sem internet
  const FALLBACK_REPOS = [
    {
      name: 'Thaynan-passos.github.io',
      html_url: `https://github.com/${GITHUB_USER}/Thaynan-passos.github.io`,
      description: 'Portfólio profissional moderno com suporte multilíngue (i18n), terminal interativo e certificados dinâmicos.',
      language: 'JavaScript',
      stargazers_count: 1,
      pushed_at: new Date().toISOString()
    }
  ];

  function langColor(lang) { return LANG_COLORS[lang] || '#58a6ff'; }

  function timeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr);
    const d = Math.floor(diff / 86400000);
    if (d === 0) return 'hoje';
    if (d === 1) return 'ontem';
    if (d < 30) return `há ${d} dias`;
    const m = Math.floor(d / 30);
    if (m < 12) return `há ${m} ${m === 1 ? 'mês' : 'meses'}`;
    const y = Math.floor(m / 12);
    return `há ${y} ${y === 1 ? 'ano' : 'anos'}`;
  }

  function renderRepos(repos) {
    const filtered = repos
      .filter(r => !r.fork && !SKIP.includes(r.name))
      .slice(0, 6);

    const list = filtered.length ? filtered : FALLBACK_REPOS;

    grid.innerHTML = list.map(repo => {
      const desc = repo.description || 'Repositório de desenvolvimento de software e soluções práticas.';
      const lang = repo.language;
      const stars = repo.stargazers_count;
      const color = lang ? langColor(lang) : '#58a6ff';
      const updated = timeAgo(repo.pushed_at);

      return `
        <article class="project-card">
          <div class="project-header">
            <h3>${repo.name}</h3>
            <a href="${repo.html_url}" target="_blank" rel="noopener noreferrer"
               class="project-link" aria-label="Abrir ${repo.name} no GitHub">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </a>
          </div>
          <p class="project-desc">${desc}</p>
          <div class="project-meta">
            ${lang ? `
              <span class="project-lang">
                <span class="lang-dot" style="background:${color}" aria-hidden="true"></span>
                ${lang}
              </span>` : ''}
            ${stars > 0 ? `
              <span class="project-stars">
                <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                ${stars}
              </span>` : ''}
            ${updated ? `
              <span class="project-lang" style="margin-left:auto">
                atualizado ${updated}
              </span>` : ''}
          </div>
        </article>`;
    }).join('');
  }

  fetchWithCache(`https://api.github.com/users/${GITHUB_USER}/repos?sort=updated&per_page=20&type=public`, `gh-repos-${GITHUB_USER}`)
    .then(repos => {
      renderRepos(repos);
    })
    .catch(() => {
      renderRepos(FALLBACK_REPOS);
    });
})();

/* ── Certificados (Carrossel Touch + Grade + Filtros + Lightbox) ── */
(function () {
  const track = document.getElementById('certTrack');
  const dotsBox = document.getElementById('certDots');
  const prevBtn = document.getElementById('certPrev');
  const nextBtn = document.getElementById('certNext');
  const carousel = document.getElementById('certCarousel');
  const viewport = document.getElementById('certViewport');
  const gridView = document.getElementById('certGridView');
  const counterEl = document.getElementById('certCounter');

  const btnViewCarousel = document.getElementById('btnViewCarousel');
  const btnViewGrid = document.getElementById('btnViewGrid');
  const filterBtns = document.querySelectorAll('.cert-filter-btn');

  const modal = document.getElementById('certModal');
  const modalContent = document.getElementById('certModalContent');
  const modalClose = document.getElementById('certModalClose');
  const modalBackdrop = document.getElementById('certModalBackdrop');

  if (!track) return;

  // Catálogo completo pré-carregado: funciona 100% offline, em file:// e sem depender de requisições de rede
  const INITIAL_CERTIFICATES = [
    {
      name: "certificado-udemy-Python-PCEP.pdf",
      title: "Python PCEP — Preparatório de Certificação",
      category: "dev",
      url: "certificados/certificado-udemy-Python-PCEP.pdf",
      previewUrl: "certificados/certificado-udemy-Python-PCEP.preview.webp",
      isPdf: true
    },
    {
      name: "Cesar-School-Nocoes-de-Programacao.pdf",
      title: "Cesar School — Noções de Programação",
      category: "dev",
      url: "certificados/Cesar-School-Nocoes-de-Programacao.pdf",
      previewUrl: "certificados/Cesar-School-Nocoes-de-Programacao.preview.webp",
      isPdf: true
    },
    {
      name: "certificado-udemy-Git-Github-Zero-Avancado.pdf",
      title: "Git & GitHub — Do Zero ao Avançado",
      category: "dev",
      url: "certificados/certificado-udemy-Git-Github-Zero-Avancado.pdf",
      previewUrl: "certificados/certificado-udemy-Git-Github-Zero-Avancado.preview.webp",
      isPdf: true
    },
    {
      name: "certificado-udemy-WordPress-bAsico-Avancado.pdf",
      title: "WordPress — Do Básico ao Avançado",
      category: "dev",
      url: "certificados/certificado-udemy-WordPress-bAsico-Avancado.pdf",
      previewUrl: "certificados/certificado-udemy-WordPress-bAsico-Avancado.preview.webp",
      isPdf: true
    },
    {
      name: "Bootvamp-HEINEKEN-I.A-aplicada-a-Vendas.pdf",
      title: "Bootcamp HEINEKEN — I.A. Aplicada a Vendas",
      category: "dev",
      url: "certificados/Bootvamp-HEINEKEN-I.A-aplicada-a-Vendas.pdf",
      previewUrl: "certificados/Bootvamp-HEINEKEN-I.A-aplicada-a-Vendas.preview.webp",
      isPdf: true
    },
    {
      name: "FAST-rilha-de-Transicao-de-carreira-em-Ciberseguranca.pdf",
      title: "FAST — Transição de Carreira em Cibersegurança",
      category: "infra",
      url: "certificados/FAST-rilha-de-Transicao-de-carreira-em-Ciberseguranca.pdf",
      previewUrl: "certificados/FAST-rilha-de-Transicao-de-carreira-em-Ciberseguranca.preview.webp",
      isPdf: true
    },
    {
      name: "certificado-udemy-Sharepoint-Zero-Avancado.pdf",
      title: "Microsoft SharePoint — Do Zero ao Avançado",
      category: "infra",
      url: "certificados/certificado-udemy-Sharepoint-Zero-Avancado.pdf",
      previewUrl: "certificados/certificado-udemy-Sharepoint-Zero-Avancado.preview.webp",
      isPdf: true
    },
    {
      name: "certificado-udemy_Metodologias-Ageis-XP-Scrum-LeamEKanban.pdf",
      title: "Metodologias Ágeis — XP, Scrum, Lean e Kanban",
      category: "gestao",
      url: "certificados/certificado-udemy_Metodologias-Ageis-XP-Scrum-LeamEKanban.pdf",
      previewUrl: "certificados/certificado-udemy_Metodologias-Ageis-XP-Scrum-LeamEKanban.preview.webp",
      isPdf: true
    },
    {
      name: "certificado-udemy_comunicacaoAssertiva.pdf",
      title: "Comunicação Assertiva no Ambiente Profissional",
      category: "gestao",
      url: "certificados/certificado-udemy_comunicacaoAssertiva.pdf",
      previewUrl: "certificados/certificado-udemy_comunicacaoAssertiva.preview.webp",
      isPdf: true
    },
    {
      name: "certificado-udemy-ProdutividadeProcrastinacaoGestaoTempo.pdf",
      title: "Produtividade & Gestão de Tempo",
      category: "gestao",
      url: "certificados/certificado-udemy-ProdutividadeProcrastinacaoGestaoTempo.pdf",
      previewUrl: "certificados/certificado-udemy-ProdutividadeProcrastinacaoGestaoTempo.preview.webp",
      isPdf: true
    },
    {
      name: "certificado-udemy-Hiper-Eficiencia-Gestao-Tempo.pdf",
      title: "Hiper Eficiência & Gestão de Tempo",
      category: "gestao",
      url: "certificados/certificado-udemy-Hiper-Eficiencia-Gestao-Tempo.pdf",
      previewUrl: "certificados/certificado-udemy-Hiper-Eficiencia-Gestao-Tempo.preview.webp",
      isPdf: true
    }
  ];

  let allCertificates = [...INITIAL_CERTIFICATES];
  let currentFilter = 'all';
  let activeSlides = [...allCertificates];
  let index = 0;
  let autoplayId = null;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function stopAutoplay() {
    if (autoplayId) {
      clearInterval(autoplayId);
      autoplayId = null;
    }
  }

  function startAutoplay() {
    stopAutoplay();
    if (activeSlides.length < 2 || prefersReducedMotion.matches || document.hidden) return;
    autoplayId = setInterval(() => goTo(index + 1), 6000);
  }

  function restartAutoplay() {
    startAutoplay();
  }

  function getBadgeLabel(cat) {
    if (cat === 'dev') return 'Dev';
    if (cat === 'infra') return 'Infra';
    return 'Gestão';
  }

  /* ── Lightbox Modal ── */
  function openModal(item) {
    if (!modal || !modalContent) return;
    const viewBtnText = (window.__i18nDict && window.__i18nDict['cert.viewBtn']) || 'Abrir PDF';
    const preview = item.previewUrl || item.url;
    const safeUrl = encodeURI(item.url);

    modalContent.innerHTML = `
      <img src="${preview}" alt="${item.title}" onerror="if(this.src.endsWith('.webp')){this.onerror=null;this.src=this.src.replace('.webp','.png');}">
      <div class="cert-modal-footer">
        <div>
          <h3>${item.title}</h3>
          <span class="cert-grid-badge" style="position:static; display:inline-block; margin-top:4px;">${getBadgeLabel(item.category)}</span>
        </div>
        <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
          <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-primary">
            <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            ${viewBtnText}
          </a>
          <a href="${safeUrl}" download="${item.name}" class="btn btn-secondary">
            <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Baixar
          </a>
        </div>
      </div>
    `;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (modalBackdrop) modalBackdrop.addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && modal.classList.contains('open')) closeModal();
  });

  /* ── Renderização do Carrossel ── */
  function updateCarousel() {
    if (!activeSlides.length) {
      track.innerHTML = `<p class="cert-loading">Nenhum certificado encontrado para esta categoria.</p>`;
      if (dotsBox) dotsBox.innerHTML = '';
      if (prevBtn) prevBtn.disabled = true;
      if (nextBtn) nextBtn.disabled = true;
      if (counterEl) counterEl.textContent = '0 / 0';
      return;
    }

    if (prevBtn) prevBtn.disabled = false;
    if (nextBtn) nextBtn.disabled = false;

    track.innerHTML = activeSlides.map((s, i) => {
      const preview = s.previewUrl || s.url;
      const safeUrl = encodeURI(s.url);
      const viewBtnText = (window.__i18nDict && window.__i18nDict['cert.viewBtn']) || 'Ver certificado';
      return `
        <div class="cert-slide">
          <div class="cert-card">
            <div class="cert-card-media" data-index="${i}">
              <img src="${preview}" alt="Certificado: ${s.title}" loading="lazy" style="cursor:pointer;" title="Clique para ampliar" onerror="if(this.src.endsWith('.webp')){this.onerror=null;this.src=this.src.replace('.webp','.png');}">
            </div>
            <div class="cert-card-body">
              <span class="pill" style="align-self:flex-start;">${getBadgeLabel(s.category)}</span>
              <h3>${s.title}</h3>
              <p class="cert-meta">Documento certificado e verificado</p>
              <div style="display:flex; gap:10px; flex-wrap:wrap;">
                <button type="button" class="btn btn-secondary cert-zoom-btn" data-index="${i}">
                  <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                  Ampliar
                </button>
                <a class="btn btn-primary" href="${safeUrl}" target="_blank" rel="noopener noreferrer">
                  <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  ${viewBtnText}
                </a>
              </div>
            </div>
          </div>
        </div>`;
    }).join('');

    track.querySelectorAll('.cert-card-media, .cert-zoom-btn').forEach(el => {
      el.addEventListener('click', () => {
        const idx = Number(el.getAttribute('data-index'));
        if (activeSlides[idx]) openModal(activeSlides[idx]);
      });
    });

    if (dotsBox) {
      dotsBox.innerHTML = activeSlides.map((_, i) =>
        `<button class="cert-dot${i === index ? ' active' : ''}" role="tab" aria-label="Certificado ${i + 1}" aria-selected="${i === index}"></button>`
      ).join('');

      dotsBox.querySelectorAll('.cert-dot').forEach((dot, i) => {
        dot.addEventListener('click', () => {
          goTo(i);
          restartAutoplay();
        });
      });
    }

    applyPosition();
    startAutoplay();
  }

  function applyPosition() {
    track.style.transform = `translateX(-${index * 100}%)`;
    if (counterEl) {
      counterEl.textContent = `${index + 1} / ${activeSlides.length}`;
    }
    if (dotsBox) {
      dotsBox.querySelectorAll('.cert-dot').forEach((d, i) => {
        d.classList.toggle('active', i === index);
        d.setAttribute('aria-selected', String(i === index));
      });
    }
  }

  function goTo(i) {
    if (!activeSlides.length) return;
    index = (i + activeSlides.length) % activeSlides.length;
    applyPosition();
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      goTo(index - 1);
      restartAutoplay();
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      goTo(index + 1);
      restartAutoplay();
    });
  }

  /* ── Teclado no Carrossel ── */
  if (carousel) {
    carousel.setAttribute('tabindex', '0');
    carousel.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') {
        goTo(index - 1);
        restartAutoplay();
      } else if (e.key === 'ArrowRight') {
        goTo(index + 1);
        restartAutoplay();
      }
    });
  }

  /* ── Suporte a Touch Swipe no Celular ── */
  if (viewport) {
    let startX = 0;
    let endX = 0;

    viewport.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      endX = startX;
      stopAutoplay();
    }, { passive: true });

    viewport.addEventListener('touchmove', (e) => {
      endX = e.touches[0].clientX;
    }, { passive: true });

    viewport.addEventListener('touchend', () => {
      const diffX = endX - startX;
      if (Math.abs(diffX) > 40) {
        if (diffX < 0) {
          goTo(index + 1);
        } else {
          goTo(index - 1);
        }
      }
      restartAutoplay();
    });
  }

  /* ── Renderização da Grade Completa ── */
  function renderGrid() {
    if (!gridView) return;
    if (!activeSlides.length) {
      gridView.innerHTML = `<p class="cert-loading" style="grid-column: 1/-1;">Nenhum certificado para o filtro selecionado.</p>`;
      return;
    }

    const viewBtnText = (window.__i18nDict && window.__i18nDict['cert.viewBtn']) || 'Abrir PDF';

    gridView.innerHTML = activeSlides.map((s, i) => {
      const preview = s.previewUrl || s.url;
      const safeUrl = encodeURI(s.url);
      return `
        <article class="cert-grid-card">
          <div class="cert-grid-media" data-index="${i}">
            <img src="${preview}" alt="${s.title}" loading="lazy" onerror="if(this.src.endsWith('.webp')){this.onerror=null;this.src=this.src.replace('.webp','.png');}">
            <span class="cert-grid-badge">${getBadgeLabel(s.category)}</span>
          </div>
          <div class="cert-grid-body">
            <h3>${s.title}</h3>
            <div class="cert-grid-footer">
              <button type="button" class="cert-preview-btn cert-grid-zoom" data-index="${i}">
                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                Ver prévia
              </button>
              <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">
                ${viewBtnText}
              </a>
            </div>
          </div>
        </article>`;
    }).join('');

    gridView.querySelectorAll('.cert-grid-media, .cert-grid-zoom').forEach(el => {
      el.addEventListener('click', () => {
        const idx = Number(el.getAttribute('data-index'));
        if (activeSlides[idx]) openModal(activeSlides[idx]);
      });
    });
  }

  /* ── Alternância de Filtros ── */
  function applyFilter(cat) {
    currentFilter = cat;
    filterBtns.forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-filter') === cat);
    });

    activeSlides = currentFilter === 'all'
      ? allCertificates
      : allCertificates.filter(c => c.category === currentFilter);

    index = 0;
    updateCarousel();
    renderGrid();
  }

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      applyFilter(btn.getAttribute('data-filter'));
    });
  });

  /* ── Alternância de Visualização (Carrossel vs Grade) ── */
  if (btnViewCarousel && btnViewGrid && carousel && gridView) {
    btnViewCarousel.addEventListener('click', () => {
      btnViewCarousel.classList.add('active');
      btnViewGrid.classList.remove('active');
      carousel.style.display = 'flex';
      gridView.style.display = 'none';
      startAutoplay();
    });

    btnViewGrid.addEventListener('click', () => {
      btnViewGrid.classList.add('active');
      btnViewCarousel.classList.remove('active');
      carousel.style.display = 'none';
      gridView.style.display = 'grid';
      stopAutoplay();
      renderGrid();
    });
  }

  if (carousel) {
    carousel.addEventListener('mouseenter', stopAutoplay);
    carousel.addEventListener('mouseleave', startAutoplay);
    carousel.addEventListener('focusin', stopAutoplay);
    carousel.addEventListener('focusout', () => {
      setTimeout(() => {
        if (!carousel.contains(document.activeElement)) startAutoplay();
      }, 0);
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopAutoplay();
    else startAutoplay();
  });

  // Renderiza imediatamente na inicialização
  updateCarousel();
  renderGrid();

  // Tenta sincronizar silenciosamente com o JSON local se disponível em ambiente HTTP/HTTPS
  if (window.location.protocol.startsWith('http')) {
    fetch('certificados/certificados.json')
      .then(r => r.ok ? r.json() : null)
      .then(list => {
        if (Array.isArray(list) && list.length) {
          allCertificates = list;
          activeSlides = currentFilter === 'all'
            ? allCertificates
            : allCertificates.filter(c => c.category === currentFilter);
          updateCarousel();
          renderGrid();
        }
      })
      .catch(() => {});
  }
})();

/* ── Formulário de Contato ── */
(function () {
  const form = document.getElementById('contactForm');
  const status = document.getElementById('formStatus');
  if (!form || !status) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type=submit]');
    if (!btn) return;

    btn.disabled = true;
    btn.textContent = 'Enviando…';
    status.textContent = '';
    status.className = 'form-status';

    try {
      const res = await fetch(form.action, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: new FormData(form)
      });
      if (res.ok) {
        status.textContent = '✓ Mensagem enviada! Responderei em breve.';
        status.classList.add('ok');
        form.reset();
      } else {
        throw new Error();
      }
    } catch {
      status.textContent = '✕ Erro ao enviar. Tente pelo e-mail ou WhatsApp diretamente.';
      status.classList.add('err');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
        <span>Enviar mensagem</span>
      `;
    }
  });
})();