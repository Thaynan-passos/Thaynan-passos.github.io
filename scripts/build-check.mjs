import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();

// Orçamentos de performance para site estático (em bytes)
const MAX_HTML_BYTES = 60 * 1024;
const MAX_CSS_BYTES = 42 * 1024;
const MAX_CORE_JS_BYTES = 20 * 1024;
const MAX_APP_JS_BYTES = 52 * 1024;
const MAX_I18N_JS_BYTES = 10 * 1024;

const BUDGETS = [
  { file: 'index.html', limit: MAX_HTML_BYTES },
  { file: 'style.css', limit: MAX_CSS_BYTES },
  { file: 'modules/portfolio-core.js', limit: MAX_CORE_JS_BYTES },
  { file: 'script.js', limit: MAX_APP_JS_BYTES },
  { file: 'i18n.js', limit: MAX_I18N_JS_BYTES }
];

function checkBudgets() {
  let hasViolation = false;
  console.log('=== Verificação de Build Estático & Performance Budget ===');

  for (const entry of BUDGETS) {
    const absPath = path.join(ROOT_DIR, entry.file);
    if (!fs.existsSync(absPath)) {
      console.error(`[ERRO] Arquivo obrigatório ausente: ${entry.file}`);
      hasViolation = true;
      continue;
    }

    const size = fs.statSync(absPath).size;
    const kb = (size / 1024).toFixed(2);
    const limitKb = (entry.limit / 1024).toFixed(0);
    const ok = size <= entry.limit;

    console.log(`${ok ? '[OK]' : '[EXCEDIDO]'} ${entry.file}: ${kb} KB (limite: ${limitKb} KB)`);
    if (!ok) hasViolation = true;
  }

  // Garante que não sobraram miniaturas PNG órfãs em certificados/
  const certsDir = path.join(ROOT_DIR, 'certificados');
  const orphanPngs = fs.readdirSync(certsDir).filter(name => name.endsWith('.preview.png'));
  if (orphanPngs.length > 0) {
    console.error(`[ERRO] Arquivos .preview.png órfãos detectados: ${orphanPngs.join(', ')}`);
    hasViolation = true;
  } else {
    console.log('[OK] Nenhum arquivo .preview.png órfão em certificados/.');
  }

  // Garante que package.json, README.md e CHANGELOG.md compartilham a mesma versão
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
  const readme = fs.readFileSync(path.join(ROOT_DIR, 'README.md'), 'utf8');
  const changelog = fs.readFileSync(path.join(ROOT_DIR, 'CHANGELOG.md'), 'utf8');

  if (!readme.includes(pkg.version)) {
    console.error(`[ERRO] README.md não referencia a versão atual (${pkg.version}).`);
    hasViolation = true;
  }
  if (!changelog.includes(`[${pkg.version}]`)) {
    console.error(`[ERRO] CHANGELOG.md não contém a entrada [${pkg.version}].`);
    hasViolation = true;
  }

  if (hasViolation) {
    process.exit(1);
  }
  console.log(`[build] Distribuição estática v${pkg.version} íntegra e dentro do orçamento.`);
}

checkBudgets();
