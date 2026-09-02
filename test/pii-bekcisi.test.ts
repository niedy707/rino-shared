/**
 * pii-bekcisi.mjs — izin listesi (.pii-bekcisi-allow) davranışı.
 *
 * Tüm numaralar SENTETİKTİR: telefonlar beyaz-liste ailesinin DIŞINDAN seçilmiş
 * rastgele diziler, TC ise checksum tutan ama kimseye ait olmayan test değeridir.
 * Her test geçici bir git deposunda çalışır; hiçbir gerçek repoya dokunmaz.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'pii-bekcisi.mjs');

// Sentetik ama beyaz-liste ailesi dışında → normalde raporlanır.
const PHONE_A = '0532 987 65 43';        // last10 = 5329876543
const PHONE_B = '+90 541 246 80 13';     // last10 = 5412468013
const TC_OK = '10000000146';             // checksum tutar, gerçek kişi değil
const TC_SYNTH = '11111111110';          // yerleşik test TC'si — script içinde sentetik

interface Result { toplam: number; allowed: number; repolar: Array<{ eslesme: number; allowed: number; eslesmeler: Array<{ dosya: string; kalip: string }> }> }

function run(args: string[], cwd: string): { rc: number; json: Result; stderr: string } {
  const r = spawnSync(process.execPath, [SCRIPT, ...args, '--json'], { cwd, encoding: 'utf8' });
  return { rc: r.status ?? -1, json: JSON.parse(r.stdout), stderr: r.stderr };
}

let repo: string;
function write(rel: string, content: string) {
  const full = join(repo, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}
function gitAdd() { execFileSync('git', ['add', '-A'], { cwd: repo, stdio: 'ignore' }); }

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'pii-allow-'));
  execFileSync('git', ['init', '-q'], { cwd: repo, stdio: 'ignore' });
  write('src/a.ts', `// tel ${PHONE_A}\nconst tc = "${TC_OK}";\n`);
  write('docs/b.md', `İletişim: ${PHONE_B}\n`);
  gitAdd();
});
afterEach(() => rmSync(repo, { recursive: true, force: true }));

describe('pii-bekcisi izin listesi', () => {
  it('izin dosyası yokken her şey raporlanır (allowed=0)', () => {
    const { rc, json } = run(['--repo', repo], repo);
    expect(rc).toBe(1);
    expect(json.toplam).toBe(3);
    expect(json.allowed).toBe(0);
    expect(json.repolar[0].allowed).toBe(0);
  });

  it('num: telefonu biçimden bağımsız (son 10 hane) tanır, TC etkilenmez', () => {
    write('.pii-bekcisi-allow', '# iş telefonu\nnum:+905329876543\n');
    gitAdd();
    const { rc, json } = run(['--repo', repo], repo);
    expect(rc).toBe(1);
    expect(json.repolar[0].allowed).toBe(1);
    const kaliplar = json.repolar[0].eslesmeler.map((e) => e.kalip).sort();
    expect(kaliplar).toEqual(['tc', 'telefon']); // PHONE_B ve TC_OK kaldı
  });

  it('num: 0-önekli ve boşluklu yazım da aynı numarayı eşler', () => {
    write('.pii-bekcisi-allow', 'num:0532 987 65 43\nnum:0541-246-80-13\n');
    gitAdd();
    const { json } = run(['--repo', repo], repo);
    expect(json.repolar[0].allowed).toBe(2);
    expect(json.repolar[0].eslesmeler.map((e) => e.kalip)).toEqual(['tc']);
  });

  it('num: 11 haneli girdi TC olarak da izin verir', () => {
    write('.pii-bekcisi-allow', `num:${TC_OK}\n`);
    gitAdd();
    const { json } = run(['--repo', repo], repo);
    expect(json.repolar[0].eslesmeler.map((e) => e.kalip).sort()).toEqual(['telefon', 'telefon']);
    expect(json.repolar[0].allowed).toBe(1);
  });

  it('path: öneki altındaki tüm eşleşmeleri yoksayar, dışını raporlar', () => {
    write('.pii-bekcisi-allow', 'path:docs/\n');
    gitAdd();
    const { json } = run(['--repo', repo], repo);
    expect(json.repolar[0].allowed).toBe(1);
    expect(json.repolar[0].eslesmeler.every((e) => e.dosya.startsWith('src/'))).toBe(true);
  });

  it('hepsi izinliyse exit 0 ve toplam 0, allowed toplamı doğru', () => {
    write('.pii-bekcisi-allow', `path:docs\nnum:5329876543\nnum:${TC_OK}\n`);
    gitAdd();
    const { rc, json } = run(['--repo', repo], repo);
    expect(rc).toBe(0);
    expect(json.toplam).toBe(0);
    expect(json.allowed).toBe(3);
  });

  it('--staged modu da izin listesini onurlandırır', () => {
    write('.pii-bekcisi-allow', 'num:5329876543\npath:docs/\n');
    gitAdd();
    const { rc, json } = run(['--staged'], repo);
    expect(rc).toBe(1);
    expect(json.repolar[0].allowed).toBe(2);
    expect(json.repolar[0].eslesmeler.map((e) => e.kalip)).toEqual(['tc']);
  });

  it('tanınmayan satır izin vermez, stderr uyarısı basar', () => {
    write('.pii-bekcisi-allow', 'tel:5329876543\n');
    gitAdd();
    const { json, stderr } = run(['--repo', repo], repo);
    expect(json.repolar[0].allowed).toBe(0);
    expect(json.toplam).toBe(3);
    expect(stderr).toMatch(/tanınmayan satır/);
  });

  it('yerleşik test TC\'si (11111111110) izin listesi olmadan da raporlanmaz', () => {
    write('src/c.ts', `const tc = "${TC_SYNTH}";\n`);
    gitAdd();
    const { json } = run(['--repo', repo], repo);
    expect(json.repolar[0].eslesmeler.some((e) => e.dosya === 'src/c.ts')).toBe(false);
  });
});
