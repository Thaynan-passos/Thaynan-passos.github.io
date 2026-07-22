/* ── Year ── */
    document.getElementById('yr').textContent = new Date().getFullYear();

    /* ── Mobile menu ── */
    const menuBtn = document.getElementById('menuBtn');
    const navLinks = document.getElementById('navLinks');
    menuBtn.addEventListener('click', () => {
      const open = navLinks.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', open);
    });
    navLinks.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        navLinks.classList.remove('open');
        menuBtn.setAttribute('aria-expanded', 'false');
      });
    });

    /* ── Back to top ── */
    const btn = document.getElementById('back-top');
    window.addEventListener('scroll', () => {
      btn.classList.toggle('show', window.scrollY > 400);
    }, { passive: true });
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

    /* ── Terminal animation ── */
    (function () {
      const el = document.getElementById('terminalBody');

      // valores que não mudam por idioma (nome próprio, stack técnica, comandos de shell)
      const EMPRESA_VAL = 'Sesc Pernambuco / UTD';
      const STACK_VAL = '["Java","Python","Git","SQL","Docker"]';

      // fallback (pt) caso as traduções ainda não tenham carregado
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
      let runId = 0; // evita que uma digitação antiga "vaze" se o idioma mudar no meio da animação

      function typeLines(lines, myRunId, instant) {
        let i = 0;
        function next() {
          if (myRunId !== runId) return; // idioma mudou de novo, cancela essa execução
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
          else el.querySelector('.t-cmd').appendChild(document.createElement('span')).className = 'cursor';
        }
        next();
      }

      function render(dict, instant) {
        runId++;
        el.innerHTML = '';
        typeLines(buildLines(dict), runId, instant);
      }

      // primeira renderização (com o que já estiver disponível)
      setTimeout(() => render(window.__i18nDict, false), 400);

      // re-renderiza (instantâneo, sem re-digitar) sempre que o idioma mudar
      window.addEventListener('i18n:change', (e) => render(e.detail.dict, true));
    })();

    /* ── GitHub Projects ── */
    (function () {
      const grid = document.getElementById('projectsGrid');
      const GITHUB_USER = 'Thaynan-passos';
      const LANG_COLORS = {
        Python: '#3572A5', Java: '#b07219', HTML: '#e34c26',
        JavaScript: '#f1e05a', CSS: '#563d7c', 'Jupyter Notebook': '#DA5B0B'
      };

      // repos to skip (forks, meta repos)
      const SKIP = ['dio-lab-open-source', 'skills-communicate-using-markdown'];

      function langColor(lang) { return LANG_COLORS[lang] || '#58a6ff'; }

      fetch(`https://api.github.com/users/${GITHUB_USER}/repos?sort=updated&per_page=20&type=public`)
        .then(r => {
          if (!r.ok) throw new Error('GitHub API error');
          return r.json();
        })
        .then(repos => {
          const filtered = repos
            .filter(r => !r.fork && !SKIP.includes(r.name))
            .slice(0, 6);

          if (!filtered.length) {
            grid.innerHTML = '<p class="projects-error">Nenhum repositório público encontrado.</p>';
            return;
          }

          grid.innerHTML = filtered.map(repo => {
            const desc = repo.description || 'Sem descrição ainda.';
            const lang = repo.language;
            const stars = repo.stargazers_count;
            const color = lang ? langColor(lang) : '#58a6ff';
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
              ${lang ? `<span class="project-lang">
                <span class="lang-dot" style="background:${color}" aria-hidden="true"></span>
                ${lang}
              </span>` : ''}
              ${stars > 0 ? `<span class="project-stars">
                <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                ${stars}
              </span>` : ''}
              <span class="project-lang" style="margin-left:auto">
                atualizado ${timeAgo(repo.pushed_at)}
              </span>
            </div>
          </article>`;
          }).join('');
        })
        .catch(() => {
          grid.innerHTML = `<p class="projects-error">
        Não foi possível carregar os projetos. 
        <a href="https://github.com/${GITHUB_USER}" target="_blank" rel="noopener" style="color:var(--accent)">Ver no GitHub →</a>
      </p>`;
        });

      function timeAgo(dateStr) {
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
    })();

    /* ── Certificados (carrossel automático via pasta) ── */
    (function () {
      const track = document.getElementById('certTrack');
      const dotsBox = document.getElementById('certDots');
      const prevBtn = document.getElementById('certPrev');
      const nextBtn = document.getElementById('certNext');
      if (!track) return;

      const GITHUB_USER = 'Thaynan-passos';
      const REPO = `${GITHUB_USER}.github.io`;
      const FOLDER = 'certificados';

      const IMG_EXT = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
      const PDF_EXT = ['.pdf'];

      let index = 0;
      let slides = [];
      let autoplayId = null;
      const carousel = document.getElementById('certCarousel');
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

      function stopAutoplay() {
        if (autoplayId) {
          clearInterval(autoplayId);
          autoplayId = null;
        }
      }

      function startAutoplay() {
        stopAutoplay();
        if (slides.length < 2 || prefersReducedMotion.matches || document.hidden) return;
        autoplayId = setInterval(() => goTo(index + 1), 5000);
      }

      function restartAutoplay() {
        startAutoplay();
      }

      function extOf(name) {
        const i = name.lastIndexOf('.');
        return i === -1 ? '' : name.slice(i).toLowerCase();
      }

      function titleFromName(name) {
        const noExt = name.slice(0, name.lastIndexOf('.') || name.length);
        return noExt
          .replace(/[-_]+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .replace(/\b\w/g, c => c.toUpperCase());
      }

      function renderEmpty() {
        track.innerHTML = `<p class="cert-loading">
      Nenhum certificado por aqui ainda. Basta subir a imagem ou PDF na pasta
      <code style="background:var(--border); color:var(--accent); padding:2px 6px; border-radius:4px;">/${FOLDER}</code>
      do repositório que ele aparece aqui automaticamente.
    </p>`;
        dotsBox.innerHTML = '';
        prevBtn.disabled = true;
        nextBtn.disabled = true;
      }

      function renderError() {
        track.innerHTML = `<p class="cert-error">
      Não foi possível carregar os certificados agora.
      <a href="https://github.com/${GITHUB_USER}/${REPO}/tree/main/${FOLDER}" target="_blank" rel="noopener">Ver pasta no GitHub →</a>
    </p>`;
        dotsBox.innerHTML = '';
        prevBtn.disabled = true;
        nextBtn.disabled = true;
      }

      function render() {
        track.innerHTML = slides.map(s => `
      <div class="cert-slide">
        <div class="cert-card">
          <div class="cert-card-media ${s.isPdf ? 'is-pdf' : ''}">
            ${s.isPdf
            ? (s.previewUrl
              ? `<img src="${s.previewUrl}" alt="Prévia do certificado: ${s.title}" loading="lazy">`
              : `<object class="cert-pdf-preview" data="${s.url}#page=1&view=FitH&toolbar=0&navpanes=0" type="application/pdf" aria-label="Prévia do certificado: ${s.title}">
                <a href="${s.url}" target="_blank" rel="noopener noreferrer">Abrir certificado em PDF</a>
              </object>`)
            : `<img src="${s.url}" alt="Certificado: ${s.title}" loading="lazy">`
          }
          </div>
          <div class="cert-card-body">
            <h3>${s.title}</h3>
            <p class="cert-meta">${FOLDER}/${s.name}</p>
            <a class="btn btn-secondary" href="${s.url}" target="_blank" rel="noopener noreferrer">
              <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              Ver certificado
            </a>
          </div>
        </div>
      </div>`).join('');

        dotsBox.innerHTML = slides.map((_, i) =>
          `<button class="cert-dot${i === index ? ' active' : ''}" role="tab" aria-label="Certificado ${i + 1}" aria-selected="${i === index}"></button>`
        ).join('');

        dotsBox.querySelectorAll('.cert-dot').forEach((dot, i) => {
          dot.addEventListener('click', () => {
            goTo(i);
            restartAutoplay();
          });
        });

        update();
        startAutoplay();
      }

      function update() {
        track.style.transform = `translateX(-${index * 100}%)`;
        dotsBox.querySelectorAll('.cert-dot').forEach((d, i) => {
          d.classList.toggle('active', i === index);
          d.setAttribute('aria-selected', i === index);
        });
      }

      function goTo(i) {
        if (!slides.length) return;
        index = (i + slides.length) % slides.length;
        update();
      }

      prevBtn.addEventListener('click', () => {
        goTo(index - 1);
        restartAutoplay();
      });
      nextBtn.addEventListener('click', () => {
        goTo(index + 1);
        restartAutoplay();
      });

      carousel.addEventListener('mouseenter', stopAutoplay);
      carousel.addEventListener('mouseleave', startAutoplay);
      carousel.addEventListener('focusin', stopAutoplay);
      carousel.addEventListener('focusout', () => {
        setTimeout(() => {
          if (!carousel.contains(document.activeElement)) startAutoplay();
        }, 0);
      });
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) stopAutoplay();
        else startAutoplay();
      });
      prefersReducedMotion.addEventListener('change', startAutoplay);

      fetch(`https://api.github.com/repos/${GITHUB_USER}/${REPO}/contents/${FOLDER}`)
        .then(r => {
          if (!r.ok) throw new Error('GitHub API error');
          return r.json();
        })
        .then(files => {
          if (!Array.isArray(files)) throw new Error('unexpected response');

          const fileItems = files.filter(f => f.type === 'file');
          const pdfFiles = fileItems.filter(f => PDF_EXT.includes(extOf(f.name)));
          const previewNames = new Set(
            pdfFiles.map(f => `${f.name.slice(0, f.name.lastIndexOf('.'))}.preview.png`.toLowerCase())
          );
          const previewByName = new Map(
            fileItems
              .filter(f => IMG_EXT.includes(extOf(f.name)))
              .map(f => [f.name.toLowerCase(), f])
          );

          const pdfSlides = pdfFiles.map(f => {
            const previewName = `${f.name.slice(0, f.name.lastIndexOf('.'))}.preview.png`.toLowerCase();
            return {
              name: f.name,
              url: f.download_url,
              previewUrl: previewByName.get(previewName)?.download_url,
              isPdf: true,
              title: titleFromName(f.name)
            };
          });
          const imageSlides = fileItems
            .filter(f => IMG_EXT.includes(extOf(f.name)))
            .filter(f => !previewNames.has(f.name.toLowerCase()))
            .map(f => ({
              name: f.name,
              url: f.download_url,
              isPdf: false,
              title: titleFromName(f.name)
            }));

          slides = [...pdfSlides, ...imageSlides]
            .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

          if (!slides.length) { renderEmpty(); return; }
          render();
        })
        .catch(renderError);
    })();

    /* ── Contact form ── */
    (function () {
      const form = document.getElementById('contactForm');
      const status = document.getElementById('formStatus');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = form.querySelector('button[type=submit]');
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
          status.textContent = '✕ Erro ao enviar. Tente pelo e-mail diretamente.';
          status.classList.add('err');
        } finally {
          btn.disabled = false;
          btn.innerHTML = '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Enviar mensagem';
        }
      });
    })();
