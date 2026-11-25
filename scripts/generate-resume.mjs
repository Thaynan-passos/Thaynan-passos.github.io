import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { escapeHtml } = require('../modules/portfolio-core.js');

const ROOT_DIR = process.cwd();
const PT_I18N_PATH = path.join(ROOT_DIR, 'i18n', 'pt.json');
const CERTS_MANIFEST_PATH = path.join(ROOT_DIR, 'certificados', 'certificados.json');
const PHOTO_PATH = path.join(ROOT_DIR, 'imagens', 'thaynan-foto.png');
const OUTPUT_PDF_PATH = path.join(ROOT_DIR, 'THAYNANCurriculo.pdf');
const PDF_TIMEOUT_MS = 30000;

const BROWSER_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser'
].filter(Boolean);

const CONTACT_INFO = {
  fullName: 'Thaynan Passos',
  location: 'Paulista, PE · CNH B',
  email: 'thaynan0davila@gmail.com',
  phoneDisplay: '(81) 99152-5664',
  phoneHref: 'tel:+5581991525664',
  whatsappHref: 'https://wa.me/5581991525664',
  linkedinDisplay: 'linkedin.com/in/thaynan-passos-91bb86181',
  linkedinHref: 'https://www.linkedin.com/in/thaynan-passos-91bb86181',
  githubDisplay: 'github.com/Thaynan-passos',
  githubHref: 'https://github.com/Thaynan-passos',
  portfolioDisplay: 'thaynan-passos.github.io',
  portfolioHref: 'https://thaynan-passos.github.io/'
};

function findBrowserExecutable() {
  for (const candidate of BROWSER_CANDIDATES) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error(
    'Nenhum navegador compatível (Chrome ou Edge) encontrado para gerar o PDF. Defina CHROME_PATH se necessário.'
  );
}

function readJsonFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Arquivo obrigatório ausente (${label}): ${path.basename(filePath)}`);
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    throw new Error(`Falha ao interpretar JSON (${label}): ${err.message}`);
  }
}

function readPhotoDataUri(filePath) {
  if (!fs.existsSync(filePath)) {
    return '';
  }
  const buffer = fs.readFileSync(filePath);
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

function normalizeCertificateTitle(item) {
  const title = String(item.title || '').trim();
  if (title === 'Claude Academy Badge Claude 101') {
    return 'Claude 101 — Course Completion Badge';
  }
  return title;
}

function normalizeCertificateIssuer(item) {
  const issuer = String(item.issuer || '').trim();
  if (issuer) return issuer;
  if (String(item.name || '').toLowerCase().includes('claude-academy')) {
    return 'Claude Academy / Anthropic';
  }
  return '';
}

function buildResumeData(dict, certs) {
  const experiences = [
    {
      period: dict['exp.period0'],
      org: 'Sesc Pernambuco — Unidade de Tecnologia Digital (UTD)',
      role: dict['exp.role0'],
      current: true,
      bullets: [dict['exp.b0_1'], dict['exp.b0_2'], dict['exp.b0_3'], dict['exp.b0_4'], dict['exp.b0_5']]
    },
    {
      period: dict['exp.period1'],
      org: 'UFPE — STI / NATI-CB',
      role: dict['exp.role1'],
      current: false,
      bullets: [dict['exp.b1_1'], dict['exp.b1_2'], dict['exp.b1_3'], dict['exp.b1_4'], dict['exp.b1_5']]
    },
    {
      period: dict['exp.period3'],
      org: 'Davila & Passos Representações',
      role: dict['exp.role3'],
      current: false,
      bullets: [dict['exp.b3_1'], dict['exp.b3_2'], dict['exp.b3_3']]
    },
    {
      period: dict['exp.period2'],
      org: 'Tratomaq Serviços e Peças',
      role: dict['exp.role2'],
      current: false,
      bullets: [dict['exp.b2_1'], dict['exp.b2_2'], dict['exp.b2_3']]
    }
  ];

  const education = [
    {
      title: dict['edu.c1_title'],
      institution: 'Instituto Federal de Pernambuco — IFPE',
      status: dict['edu.ongoing'],
      description: dict['edu.c1_desc'],
      active: true
    },
    {
      title: dict['edu.c2_title'],
      institution: 'IFPE — Campus Paulista/PE',
      status: dict['edu.completed'],
      description: dict['edu.c2_desc'],
      active: false
    },
    {
      title: dict['edu.c3_title'],
      institution: dict['edu.c3_meta'],
      status: dict['edu.paused'],
      description: dict['edu.c3_desc'],
      active: false
    }
  ];

  const skillGroups = [
    {
      title: dict['skills.card1'],
      items: [
        'Java',
        'Python',
        'SQL',
        'Git & GitHub',
        dict['skills.aiDev'],
        dict['skills.logic'],
        'HTML5 & CSS3',
        'JavaScript'
      ]
    },
    {
      title: dict['skills.card3'],
      items: [
        dict['skills.qaTesting'],
        dict['skills.techDocs'],
        'Docker',
        'MySQL Workbench',
        'WordPress',
        'Microsoft SharePoint',
        'SIPAC',
        'VS Code'
      ]
    },
    {
      title: dict['skills.card2'],
      items: [
        'Linux',
        'Windows',
        dict['skills.networks'],
        dict['skills.support1'],
        dict['skills.hardware'],
        dict['skills.security']
      ]
    },
    {
      title: dict['skills.card4'],
      items: [
        'Scrum / Kanban / XP / Lean',
        dict['skills.comm'],
        dict['skills.team'],
        dict['skills.org'],
        dict['skills.proactive'],
        dict['skills.learn']
      ]
    }
  ];

  const certGroups = [
    { key: 'dev', label: 'Desenvolvimento & IA', items: [] },
    { key: 'infra', label: 'Infraestrutura, Segurança & Plataformas', items: [] },
    { key: 'gestao', label: 'Metodologias Ágeis & Gestão', items: [] }
  ];

  for (const cert of certs) {
    const targetGroup = certGroups.find(g => g.key === cert.category) || certGroups[0];
    targetGroup.items.push({
      title: normalizeCertificateTitle(cert),
      issuer: normalizeCertificateIssuer(cert),
      hours: String(cert.hours || '').trim()
    });
  }

  return {
    roleLine: dict['hero.roleLine'],
    eyebrow: dict['hero.eyebrow'],
    summaryParagraphs: [dict['about.p1'], dict['about.p2']],
    experiences,
    education,
    skillGroups,
    certGroups: certGroups.filter(g => g.items.length > 0),
    totalCerts: certs.length
  };
}

function renderResumeHtml(data, photoDataUri) {
  const experiencesHtml = data.experiences
    .map(exp => {
      const bulletsHtml = exp.bullets
        .filter(Boolean)
        .map(item => `<li>${escapeHtml(item)}</li>`)
        .join('');
      return `
        <article class="exp-item${exp.current ? ' is-current' : ''}">
          <div class="exp-top">
            <div>
              <h3 class="exp-org">${escapeHtml(exp.org)}</h3>
              <p class="exp-role">${escapeHtml(exp.role)}</p>
            </div>
            <span class="exp-period${exp.current ? ' badge-active' : ''}">${escapeHtml(exp.period)}</span>
          </div>
          <ul class="bullet-list">${bulletsHtml}</ul>
        </article>
      `;
    })
    .join('');

  const educationHtml = data.education
    .map(edu => `
      <article class="edu-item">
        <div class="edu-top">
          <h3 class="edu-title">${escapeHtml(edu.title)}</h3>
          <span class="edu-status${edu.active ? ' badge-active' : ''}">${escapeHtml(edu.status)}</span>
        </div>
        <p class="edu-inst">${escapeHtml(edu.institution)}</p>
        <p class="edu-desc">${escapeHtml(edu.description)}</p>
      </article>
    `)
    .join('');

  const skillsHtml = data.skillGroups
    .map(group => {
      const tagsHtml = group.items
        .filter(Boolean)
        .map(tag => `<span class="skill-tag">${escapeHtml(tag)}</span>`)
        .join('');
      return `
        <div class="skill-group">
          <h3 class="skill-group-title">${escapeHtml(group.title)}</h3>
          <div class="skill-tags">${tagsHtml}</div>
        </div>
      `;
    })
    .join('');

  const certsHtml = data.certGroups
    .map(group => {
      const rowsHtml = group.items
        .map(cert => {
          const metaParts = [cert.issuer, cert.hours].filter(Boolean);
          const metaText = metaParts.length ? ` <span class="cert-meta">(${escapeHtml(metaParts.join(' · '))})</span>` : '';
          return `<li><strong>${escapeHtml(cert.title)}</strong>${metaText}</li>`;
        })
        .join('');
      return `
        <div class="cert-group">
          <h3 class="cert-group-title">${escapeHtml(group.label)}</h3>
          <ul class="cert-list">${rowsHtml}</ul>
        </div>
      `;
    })
    .join('');

  const summaryHtml = data.summaryParagraphs
    .filter(Boolean)
    .map(p => `<p class="summary-p">${escapeHtml(p)}</p>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Currículo — ${escapeHtml(CONTACT_INFO.fullName)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 11mm 12mm 11mm 12mm;
    }

    @page :first {
      margin-top: 0;
      margin-left: 0;
      margin-right: 0;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
      color: #141714;
      background: #FFFFFF;
      font-size: 9.2pt;
      line-height: 1.44;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    a {
      color: inherit;
      text-decoration: none;
    }

    /* ── CABEÇALHO EXECUTIVO ── */
    .cv-header {
      background: #0F120E;
      color: #F2F5F0;
      padding: 18px 28px 16px 28px;
      border-bottom: 3px solid #00C864;
      display: flex;
      align-items: center;
      gap: 18px;
    }

    .cv-photo {
      width: 78px;
      height: 78px;
      object-fit: cover;
      object-position: center top;
      border: 2px solid #00C864;
      flex-shrink: 0;
      background: #1A1F19;
    }

    .cv-header-main {
      flex: 1;
      min-width: 0;
    }

    .cv-eyebrow {
      font-family: 'Cascadia Mono', 'Consolas', 'Courier New', monospace;
      font-size: 7.4pt;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #00E676;
      margin-bottom: 3px;
    }

    .cv-name {
      font-size: 20pt;
      font-weight: 700;
      letter-spacing: -0.01em;
      line-height: 1.1;
      color: #FFFFFF;
      margin-bottom: 3px;
    }

    .cv-roleline {
      font-size: 9.2pt;
      color: #C7D0C4;
      font-weight: 500;
      margin-bottom: 8px;
    }

    .cv-contacts {
      display: flex;
      flex-wrap: wrap;
      gap: 5px 14px;
      font-size: 8pt;
      color: #D9E1D6;
    }

    .cv-contact-item {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .cv-contact-label {
      color: #00E676;
      font-family: 'Cascadia Mono', 'Consolas', monospace;
      font-size: 7.4pt;
      font-weight: 700;
    }

    /* ── CORPO ── */
    .cv-body {
      padding: 16px 28px 6px 28px;
    }

    .cv-section {
      margin-bottom: 13px;
    }

    .section-heading {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 10pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #0F120E;
      border-bottom: 1.5px solid #141714;
      padding-bottom: 3px;
      margin-bottom: 8px;
      break-after: avoid;
    }

    .section-num {
      font-family: 'Cascadia Mono', 'Consolas', monospace;
      font-size: 8.5pt;
      color: #007A3D;
      font-weight: 700;
    }

    .summary-p {
      color: #262B25;
      margin-bottom: 5px;
      text-align: justify;
    }

    .summary-p:last-child {
      margin-bottom: 0;
    }

    /* ── COMPETÊNCIAS (GRID 2 COLUNAS) ── */
    .skills-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 14px;
    }

    .skill-group {
      background: #F6F8F5;
      border: 1px solid #D7DDD4;
      border-left: 3px solid #007A3D;
      padding: 7px 9px;
      break-inside: avoid;
    }

    .skill-group-title {
      font-size: 8.2pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #0F120E;
      margin-bottom: 5px;
    }

    .skill-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    .skill-tag {
      background: #FFFFFF;
      border: 1px solid #C6CEC3;
      color: #1C211B;
      font-size: 7.7pt;
      padding: 1.5px 6px;
      font-weight: 500;
    }

    /* ── EXPERIÊNCIA ── */
    .exp-item {
      border-left: 2px solid #CFD6CC;
      padding: 0 0 8px 11px;
      margin-bottom: 8px;
      break-inside: avoid;
    }

    .exp-item.is-current {
      border-left-color: #007A3D;
    }

    .exp-item:last-child {
      margin-bottom: 0;
      padding-bottom: 2px;
    }

    .exp-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 10px;
      margin-bottom: 4px;
    }

    .exp-org {
      font-size: 9.6pt;
      font-weight: 700;
      color: #0F120E;
      line-height: 1.25;
    }

    .exp-role {
      font-size: 8.6pt;
      font-weight: 600;
      color: #007A3D;
      margin-top: 1px;
    }

    .exp-period,
    .edu-status {
      font-family: 'Cascadia Mono', 'Consolas', monospace;
      font-size: 7.4pt;
      font-weight: 700;
      color: #3D453B;
      background: #EEF1EC;
      border: 1px solid #CFD6CC;
      padding: 2px 6px;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .badge-active {
      background: #E4F5EC;
      color: #006633;
      border-color: #8CD3AE;
    }

    .bullet-list {
      list-style: none;
      padding-left: 0;
    }

    .bullet-list li {
      position: relative;
      padding-left: 11px;
      margin-bottom: 2.5px;
      color: #262B25;
      font-size: 8.7pt;
    }

    .bullet-list li::before {
      content: '▪';
      position: absolute;
      left: 0;
      top: 0;
      color: #007A3D;
      font-size: 8pt;
    }

    /* ── FORMAÇÃO ── */
    .edu-list {
      display: flex;
      flex-direction: column;
      gap: 7px;
    }

    .edu-item {
      background: #FAFBFA;
      border: 1px solid #DCE2D9;
      padding: 7px 10px;
      break-inside: avoid;
    }

    .edu-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 10px;
    }

    .edu-title {
      font-size: 9.2pt;
      font-weight: 700;
      color: #0F120E;
    }

    .edu-inst {
      font-size: 8.3pt;
      font-weight: 600;
      color: #007A3D;
      margin-top: 1px;
    }

    .edu-desc {
      font-size: 8.4pt;
      color: #353C33;
      margin-top: 2px;
    }

    /* ── CERTIFICAÇÕES ── */
    .certs-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 7px;
    }

    .cert-group {
      break-inside: avoid;
    }

    .cert-group-title {
      font-size: 8pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #007A3D;
      margin-bottom: 3px;
    }

    .cert-list {
      list-style: none;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3px 14px;
    }

    .cert-list li {
      position: relative;
      padding-left: 10px;
      font-size: 8.1pt;
      color: #1F241E;
      line-height: 1.35;
    }

    .cert-list li::before {
      content: '▪';
      position: absolute;
      left: 0;
      color: #007A3D;
      font-size: 7.5pt;
    }

    .cert-meta {
      color: #555E52;
      font-weight: 400;
    }

    .cv-footer-note {
      margin-top: 10px;
      padding-top: 6px;
      border-top: 1px solid #D7DDD4;
      font-size: 7.6pt;
      color: #4D554B;
      display: flex;
      justify-content: space-between;
      align-items: center;
      break-inside: avoid;
    }

    .cv-footer-link {
      color: #007A3D;
      font-weight: 600;
    }

    /* Margem lateral restaurada na página 2+ (quando @page :first remove margem) */
    @media print {
      .page-two-start {
        page-break-before: always;
        break-before: page;
        padding-top: 0;
      }
    }
  </style>
</head>
<body>
  <header class="cv-header">
    ${photoDataUri ? `<img class="cv-photo" src="${photoDataUri}" alt="Foto profissional de ${escapeHtml(CONTACT_INFO.fullName)}">` : ''}
    <div class="cv-header-main">
      <p class="cv-eyebrow">${escapeHtml(data.eyebrow)}</p>
      <h1 class="cv-name">${escapeHtml(CONTACT_INFO.fullName)}</h1>
      <p class="cv-roleline">${escapeHtml(data.roleLine)}</p>
      <div class="cv-contacts">
        <span class="cv-contact-item"><span class="cv-contact-label">LOC</span> ${escapeHtml(CONTACT_INFO.location)}</span>
        <a class="cv-contact-item" href="mailto:${escapeHtml(CONTACT_INFO.email)}"><span class="cv-contact-label">EMAIL</span> ${escapeHtml(CONTACT_INFO.email)}</a>
        <a class="cv-contact-item" href="${escapeHtml(CONTACT_INFO.whatsappHref)}"><span class="cv-contact-label">TEL/WA</span> ${escapeHtml(CONTACT_INFO.phoneDisplay)}</a>
        <a class="cv-contact-item" href="${escapeHtml(CONTACT_INFO.linkedinHref)}"><span class="cv-contact-label">IN</span> ${escapeHtml(CONTACT_INFO.linkedinDisplay)}</a>
        <a class="cv-contact-item" href="${escapeHtml(CONTACT_INFO.githubHref)}"><span class="cv-contact-label">GH</span> ${escapeHtml(CONTACT_INFO.githubDisplay)}</a>
        <a class="cv-contact-item" href="${escapeHtml(CONTACT_INFO.portfolioHref)}"><span class="cv-contact-label">WEB</span> ${escapeHtml(CONTACT_INFO.portfolioDisplay)}</a>
      </div>
    </div>
  </header>

  <main class="cv-body">
    <section class="cv-section">
      <h2 class="section-heading"><span class="section-num">01 //</span> Resumo Profissional</h2>
      ${summaryHtml}
    </section>

    <section class="cv-section">
      <h2 class="section-heading"><span class="section-num">02 //</span> Experiência Profissional</h2>
      ${experiencesHtml}
    </section>

    <section class="cv-section">
      <h2 class="section-heading"><span class="section-num">03 //</span> Competências Técnicas &amp; Metodologias</h2>
      <div class="skills-grid">${skillsHtml}</div>
    </section>

    <section class="cv-section">
      <h2 class="section-heading"><span class="section-num">04 //</span> Formação Acadêmica</h2>
      <div class="edu-list">${educationHtml}</div>
    </section>

    <section class="cv-section">
      <h2 class="section-heading"><span class="section-num">05 //</span> Certificações e Cursos Verificados (${data.totalCerts})</h2>
      <div class="certs-grid">${certsHtml}</div>
    </section>

    <footer class="cv-footer-note">
      <span>Currículo sincronizado com o portfólio técnico de Thaynan Passos.</span>
      <a class="cv-footer-link" href="${escapeHtml(CONTACT_INFO.portfolioHref)}">Certificados em PDF e projetos: ${escapeHtml(CONTACT_INFO.portfolioDisplay)}</a>
    </footer>
  </main>
</body>
</html>`;
}

function generatePdfFromHtml(htmlContent, outputPath) {
  const browserPath = findBrowserExecutable();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'thaynan-cv-'));
  const tempHtmlPath = path.join(tempDir, 'resume.html');
  const tempProfileDir = path.join(tempDir, 'profile');

  try {
    fs.writeFileSync(tempHtmlPath, htmlContent, 'utf8');
    const fileUrl = pathToFileURL(tempHtmlPath).href;

    execFileSync(
      browserPath,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        `--user-data-dir=${tempProfileDir}`,
        '--no-pdf-header-footer',
        `--print-to-pdf=${outputPath}`,
        fileUrl
      ],
      {
        stdio: 'pipe',
        timeout: PDF_TIMEOUT_MS
      }
    );
  } catch (err) {
    throw new Error(`Falha ao renderizar PDF via navegador headless: ${err.message}`);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function main() {
  const dict = readJsonFile(PT_I18N_PATH, 'i18n/pt.json');
  const certs = readJsonFile(CERTS_MANIFEST_PATH, 'certificados/certificados.json');
  const photoDataUri = readPhotoDataUri(PHOTO_PATH);

  const resumeData = buildResumeData(dict, certs);
  const html = renderResumeHtml(resumeData, photoDataUri);

  generatePdfFromHtml(html, OUTPUT_PDF_PATH);

  if (!fs.existsSync(OUTPUT_PDF_PATH) || fs.statSync(OUTPUT_PDF_PATH).size === 0) {
    throw new Error('O arquivo THAYNANCurriculo.pdf não foi gerado corretamente.');
  }

  const sizeKb = (fs.statSync(OUTPUT_PDF_PATH).size / 1024).toFixed(1);
  console.log(`[resume] THAYNANCurriculo.pdf gerado com sucesso (${sizeKb} KB, ${resumeData.totalCerts} certificações).`);
}

try {
  main();
} catch (err) {
  console.error('[resume] ERRO:', err.message);
  process.exit(1);
}
