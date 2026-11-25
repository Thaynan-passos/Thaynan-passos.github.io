import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';

const require = createRequire(import.meta.url);
const core = require('../modules/portfolio-core.js');

const ROOT_DIR = process.cwd();

test('escapeHtml neutraliza tags e aspas contra XSS', () => {
  assert.equal(
    core.escapeHtml('<script>alert("xss\'&")</script>'),
    '&lt;script&gt;alert(&quot;xss&#039;&amp;&quot;)&lt;/script&gt;'
  );
  assert.equal(core.escapeHtml(null), '');
  assert.equal(core.escapeHtml(undefined), '');
});

test('sanitizeHref permite apenas protocolos seguros e caminhos relativos válidos', () => {
  assert.equal(core.sanitizeHref('https://github.com/Thaynan-passos'), 'https://github.com/Thaynan-passos');
  assert.equal(core.sanitizeHref('mailto:thaynan0davila@gmail.com'), 'mailto:thaynan0davila@gmail.com');
  assert.equal(core.sanitizeHref('#projetos'), '#projetos');
  assert.equal(core.sanitizeHref('certificados/IAparaDevs.pdf'), 'certificados/IAparaDevs.pdf');

  // Bloqueios de segurança: XSS e path traversal
  assert.equal(core.sanitizeHref('javascript:alert(1)'), '#');
  assert.equal(core.sanitizeHref('DATA:text/html,<script>'), '#');
  assert.equal(core.sanitizeHref('//evil.example.com/payload'), '#');
  assert.equal(core.sanitizeHref('../segredo.txt'), '#');
  assert.equal(core.sanitizeHref('/etc/passwd'), '#');
  assert.equal(core.sanitizeHref('C:\\Windows\\System32\\cmd.exe'), '#');
  assert.equal(core.sanitizeHref('certificados/file.pdf\0.png'), '#');
});

test('isImagePreviewUrl aceita apenas extensões de imagem válidas', () => {
  assert.equal(core.isImagePreviewUrl('certificados/teste.preview.webp'), true);
  assert.equal(core.isImagePreviewUrl('certificados/teste.PNG?v=1'), true);
  assert.equal(core.isImagePreviewUrl('certificados/IAparaDevs.pdf'), false);
  assert.equal(core.isImagePreviewUrl(null), false);
});

test('countCertificatesByCategory e filterCertificates calculam categorias corretamente', () => {
  const sample = [
    { name: 'a.pdf', category: 'dev' },
    { name: 'b.pdf', category: 'dev' },
    { name: 'c.pdf', category: 'infra' },
    { name: 'd.pdf', category: 'gestao' }
  ];

  assert.deepEqual(core.countCertificatesByCategory(sample), {
    all: 4,
    dev: 2,
    infra: 1,
    gestao: 1
  });
  assert.equal(core.filterCertificates(sample, 'all').length, 4);
  assert.equal(core.filterCertificates(sample, 'infra').length, 1);
  assert.deepEqual(core.countCertificatesByCategory(null), { all: 0, dev: 0, infra: 0, gestao: 0 });
});

test('filterRepositories exclui forks, lista SKIP e aplica busca, linguagem e limite', () => {
  const repos = [
    { name: 'dio-lab-open-source', fork: false, language: 'Java' },
    { name: 'forked-repo', fork: true, language: 'Python' },
    { name: 'java-ia-api', fork: false, language: 'Java', description: 'API REST com Spring', topics: ['spring', 'ia'] },
    { name: 'python-cli', fork: false, language: 'Python', description: 'Automação CLI', topics: ['cli'] }
  ];

  const onlyJava = core.filterRepositories(repos, { language: 'Java' });
  assert.equal(onlyJava.length, 1);
  assert.equal(onlyJava[0].name, 'java-ia-api');

  const byTopic = core.filterRepositories(repos, { query: 'spring' });
  assert.equal(byTopic.length, 1);
  assert.equal(byTopic[0].name, 'java-ia-api');

  const langs = core.extractRepoLanguages(repos);
  assert.deepEqual(langs, ['Java', 'Python']);
});

test('isCacheFresh valida expiração de TTL corretamente', () => {
  const now = 1_700_000_000_000;
  assert.equal(core.isCacheFresh(now - 1000, now, 5000), true);
  assert.equal(core.isCacheFresh(now - 6000, now, 5000), false);
  assert.equal(core.isCacheFresh(now + 1000, now, 5000), false);
  assert.equal(core.isCacheFresh('invalid', now, 5000), false);
});

test('formatRelativeTime formata datas determinísticas sem depender do relógio global', () => {
  const base = Date.UTC(2026, 10, 19);
  assert.equal(core.formatRelativeTime('2026-11-19T00:00:00Z', base), 'hoje');
  assert.equal(core.formatRelativeTime('2026-11-18T00:00:00Z', base), 'ontem');
  assert.equal(core.formatRelativeTime('2026-11-09T00:00:00Z', base), 'há 10 dias');
  assert.equal(core.formatRelativeTime('', base), '');
});

test('parseTerminalCommand interpreta comandos conhecidos, clear, cv e desconhecidos', () => {
  const helpRes = core.parseTerminalCommand('help', { certCount: 15, repoCount: 4 });
  assert.equal(helpRes.type, 'output');
  assert.equal(helpRes.navigateTo, null);
  assert.ok(helpRes.lines.length >= 8);

  const certsRes = core.parseTerminalCommand('CERTS', { certCount: 15 });
  assert.equal(certsRes.navigateTo, '#certificados');
  assert.ok(certsRes.lines[0].text.includes('15 certificados'));

  const cvRes = core.parseTerminalCommand('cv');
  assert.equal(cvRes.downloadCv, true);

  const clearRes = core.parseTerminalCommand('clear');
  assert.equal(clearRes.type, 'clear');

  const errRes = core.parseTerminalCommand('comando_inexistente');
  assert.equal(errRes.type, 'error');
});

test('Manifesto certificados.json possui certificados únicos, sem #u00 e com arquivos existentes', () => {
  const raw = fs.readFileSync(path.join(ROOT_DIR, 'certificados/certificados.json'), 'utf8');
  const list = JSON.parse(raw);
  assert.ok(Array.isArray(list) && list.length >= 16, `Esperado ao menos 16 certificados, encontrado ${list.length}`);

  for (const item of list) {
    assert.equal(/#u00/i.test(item.title), false, `Escape Unicode encontrado em: ${item.title}`);
    assert.equal(fs.existsSync(path.join(ROOT_DIR, item.url)), true, `PDF ausente: ${item.url}`);
  }
});
