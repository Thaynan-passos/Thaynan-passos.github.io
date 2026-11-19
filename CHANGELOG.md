# Changelog

Todas as mudanças relevantes deste projeto são documentadas neste arquivo no formato *Keep a Changelog*.
O projeto adota versionamento semântico ([SemVer](https://semver.org/)).

## [3.0.0] - 2026-11-19

### Adicionado
- Sistema visual **Industrial** completo em `style.css` e `favicon.svg` (superfícies `#0B0C0A` e `#111310`, tema claro técnico `#F4F5F2`, sinal único `#00E676` / `#007A3D`, cantos `0px`, grade `1px` e tipografia `JetBrains Mono` com `tabular-nums`).
- Console interativo funcional no Hero com comandos clicáveis e por teclado (`whoami`, `stack`, `projects`, `certs`, `experience`, `education`, `contact`, `cv`, `help`, `clear`) e histórico por setas.
- Faixa de indicadores objetivos (KPIs reais), barra de progresso de leitura no cabeçalho, botão de copiar e-mail e fallback visual vetorial para certificados PDF sem miniatura WebP.
- Busca em tempo real com *debounce*, filtro por linguagem e *Skeleton Loading* na seção de projetos do GitHub.
- Módulo isomórfico `modules/portfolio-core.js`, suíte de testes automatizados `tests/portfolio.test.mjs` (`node --test`), `scripts/validate.mjs`, `scripts/build-check.mjs`, `.gitattributes` (padronização `LF` e binários) e `package.json` (`lint`, `test`, `build`).
- Tradução completa de datas relativas (`time.*`) e saídas do console interativo (`terminal.*`) nos 5 idiomas.
- Inclusão dos 4 certificados mais recentes em `certificados/certificados.json`: Bootcamp Itaú Java com Inteligência Artificial (45h), IA pra Devs (8,5h), Antigravity IDE (5h) e Claude Code 101.

### Corrigido
- Restauração dos dados reais de contato (`thaynan0davila@gmail.com`, `+55 (81) 99152-5664` e endpoint Formspree `https://formspree.io/f/myezyyke`) no `index.html`.
- Restauração do modal lightbox `#certModal` com gerenciamento acessível de foco e alinhamento estrutural da navegação `.cert-nav-btn` no carrossel de certificados.
- Remoção de `<noscript>` posicionado incorretamente dentro de `<head>` em `index.html`.
- Correção dos títulos com escapes `#u00e7`/`#u00e3` em `certificados/certificados.json`, atualização dinâmica dos contadores de filtro e sincronização de todas as chaves dos 5 arquivos `i18n/*.json`.
- Blindagem de `i18n.js` (traduções com `textContent` puro e `localStorage` protegido), `script.js` (`sanitizeHref`, `escapeHtml`, `AbortController`, sem `catch` vazio) e atualização de `watcher_certificados.py` e `.github/workflows/*.yml`.

### Removido
- Remoção de 12 arquivos `.preview.png` órfãos (~2,31 MB) e do certificado PDF duplicado `certificado-udemy-Procrastina-U00e7-U00e3oGest-U00e3o.pdf` (+ miniatura).

### Alterado
- Textos em `pt`, `en`, `es`, `fr` e `zh` reestruturados para leitura humana e parsers ATS/IA de recrutamento com termos técnicos reais da trajetória do autor, separando formação acadêmica (incluindo UFPE Engenharia Cartográfica) da linha do tempo profissional.
