import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const JS_FILES = [
  'modules/portfolio-core.js',
  'i18n.js',
  'script.js',
  'scripts/validate.mjs',
  'scripts/build-check.mjs',
  'tests/portfolio.test.mjs'
];
const CRITICAL_ASSETS = [
  '.gitattributes',
  'index.html',
  'style.css',
  'script.js',
  'i18n.js',
  'modules/portfolio-core.js',
  'favicon.svg',
  'imagens/thaynan-foto.png',
  'THAYNANCurriculo.pdf',
  'certificados/certificados.json'
];
const LANG_FILES = ['pt', 'en', 'es', 'fr', 'zh'];

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function checkJsSyntax() {
  for (const relPath of JS_FILES) {
    const absPath = path.join(ROOT_DIR, relPath);
    assertCondition(fs.existsSync(absPath), `Arquivo JS ausente: ${relPath}`);
    execFileSync(process.execPath, ['--check', absPath], { stdio: 'pipe' });
  }
  console.log(`[lint] Sintaxe JS/MJS validada (${JS_FILES.length} arquivos).`);
}

function checkAssetsAndHtml() {
  for (const relPath of CRITICAL_ASSETS) {
    const absPath = path.join(ROOT_DIR, relPath);
    assertCondition(fs.existsSync(absPath), `Asset crítico ausente: ${relPath}`);
    const stat = fs.statSync(absPath);
    assertCondition(stat.size > 0, `Asset crítico vazio: ${relPath}`);
  }

  const html = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');
  const headMatch = html.match(/<head>([\s\S]*?)<\/head>/i);
  assertCondition(Boolean(headMatch), 'Bloco <head> não encontrado em index.html.');
  assertCondition(!/<noscript[\s>]/i.test(headMatch[1]), 'Tag <noscript> não deve ficar dentro de <head>.');

  assertCondition(html.includes('id="certModal"'), 'Elemento #certModal ausente em index.html.');
  assertCondition(html.includes('id="terminalForm"'), 'Console interativo #terminalForm ausente em index.html.');
  assertCondition(!/<section\s+class="terminal-card"/i.test(html), 'Console .terminal-card não deve usar <section> sem heading.');
  assertCondition(html.includes('thaynan0davila@gmail.com'), 'E-mail oficial esperado ausente em index.html.');
  assertCondition(html.includes('5581991525664'), 'Telefone/WhatsApp oficial ausente em index.html.');
  assertCondition(html.includes('https://formspree.io/f/myezyyke'), 'Endpoint oficial Formspree ausente em index.html.');
  assertCondition(!html.includes('thaynanpassos@gmail.com'), 'E-mail antigo incorreto ainda presente em index.html.');
  assertCondition(!html.includes('99900-6127'), 'Telefone antigo incorreto ainda presente em index.html.');
  assertCondition(!html.includes('formsubmit.co'), 'Endpoint Formsubmit antigo ainda presente em index.html.');

  const css = fs.readFileSync(path.join(ROOT_DIR, 'style.css'), 'utf8');
  const nonZeroRadius = [...css.matchAll(/border-radius\s*:\s*([^;]+);/gi)]
    .map(m => m[1].trim())
    .filter(val => val !== '0' && val !== '0px');
  assertCondition(nonZeroRadius.length === 0, `Âncora Industrial violada em style.css (border-radius != 0): [${nonZeroRadius.join(', ')}]`);

  console.log('[lint] Integridade de index.html, style.css e assets críticos validada.');
}

function checkI18nParity() {
  const dicts = {};
  for (const lang of LANG_FILES) {
    const relPath = `i18n/${lang}.json`;
    const absPath = path.join(ROOT_DIR, relPath);
    assertCondition(fs.existsSync(absPath), `Arquivo i18n ausente: ${relPath}`);
    dicts[lang] = JSON.parse(fs.readFileSync(absPath, 'utf8'));
  }

  const baseKeys = Object.keys(dicts.pt).sort();
  assertCondition(baseKeys.length > 0, 'i18n/pt.json está vazio.');

  const html = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');
  const jsCombined =
    fs.readFileSync(path.join(ROOT_DIR, 'script.js'), 'utf8') +
    '\n' +
    fs.readFileSync(path.join(ROOT_DIR, 'i18n.js'), 'utf8');

  const htmlKeyMatches = [...html.matchAll(/data-i18n(?:-(?:placeholder|aria-label|title))?="([^"]+)"/g)];
  const missingInDict = htmlKeyMatches
    .map(match => match[1])
    .filter(key => !Object.prototype.hasOwnProperty.call(dicts.pt, key));
  assertCondition(
    missingInDict.length === 0,
    `Chaves data-i18n referenciadas no HTML ausentes em pt.json: [${missingInDict.join(', ')}]`
  );

  const jsKeyMatches = [...jsCombined.matchAll(/['"]([a-z]+\.[a-zA-Z0-9_]+)['"]/g)].map(m => m[1]);
  const usedKeys = new Set([...htmlKeyMatches.map(m => m[1]), ...jsKeyMatches]);
  const unusedKeys = baseKeys.filter(key => !usedKeys.has(key));
  assertCondition(
    unusedKeys.length === 0,
    `Chaves órfãs em i18n/pt.json sem uso no HTML/JS: [${unusedKeys.join(', ')}]`
  );

  for (const lang of LANG_FILES) {
    const keys = Object.keys(dicts[lang]).sort();
    const missing = baseKeys.filter(k => !keys.includes(k));
    const extra = keys.filter(k => !baseKeys.includes(k));
    assertCondition(
      missing.length === 0 && extra.length === 0,
      `Inconsistência de chaves em i18n/${lang}.json -> faltando: [${missing.join(', ')}], extras: [${extra.join(', ')}]`
    );
  }

  console.log(`[lint] Paridade de i18n validada (${LANG_FILES.length} idiomas, ${baseKeys.length} chaves cada).`);
}

function checkCertificatesManifest() {
  const manifestPath = path.join(ROOT_DIR, 'certificados/certificados.json');
  const list = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assertCondition(Array.isArray(list) && list.length > 0, 'certificados.json inválido ou vazio.');

  const seenNames = new Set();
  for (const item of list) {
    assertCondition(typeof item.name === 'string' && item.name.length > 0, 'Certificado sem nome.');
    assertCondition(!seenNames.has(item.name), `Certificado duplicado no manifesto: ${item.name}`);
    seenNames.add(item.name);

    assertCondition(!/#u00/i.test(item.title || ''), `Título contém escape Unicode bruto: ${item.title}`);
    assertCondition(typeof item.url === 'string' && fs.existsSync(path.join(ROOT_DIR, item.url)), `PDF ausente no disco: ${item.url}`);

    if (item.previewUrl) {
      assertCondition(
        fs.existsSync(path.join(ROOT_DIR, item.previewUrl)),
        `Miniatura declarada ausente no disco: ${item.previewUrl}`
      );
    }
  }

  console.log(`[lint] Manifesto de certificados validado (${list.length} registros íntegros).`);
}

function main() {
  try {
    checkJsSyntax();
    checkAssetsAndHtml();
    checkI18nParity();
    checkCertificatesManifest();
    console.log('[lint] Todas as verificações estáticas passaram com sucesso.');
  } catch (err) {
    console.error('[lint] FALHA:', err.message);
    process.exit(1);
  }
}

main();
