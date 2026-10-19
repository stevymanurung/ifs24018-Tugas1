// Pengujian unit memakai test runner bawaan Node.js (node:test), tanpa dependensi tambahan.
// npm test       -> menguji src/planner.js (versi 2)
// npm run test:v1 -> menjalankan tes yang sama terhadap draf awal AI (versi 1)
const test = require('node:test');
const assert = require('node:assert');
const P = require(process.env.PLANNER_MODULE || '../src/planner.js');

const S = (course, day, start, end) => ({ course, day, start, end, room: '' });
const fmt = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const NOW = new Date(2026, 9, 19, 10, 0, 0); // Senin, 19 Okt 2026 10:00 waktu lokal
const shift = (n) => { const d = new Date(NOW); d.setDate(d.getDate() + n); return fmt(d); };
const tryAdd = (list, input) => { try { return P.addSession(list, input); } catch (e) { return list; } };
function fakeStorage(raw) {
  const data = raw === undefined ? {} : { planner: raw };
  return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = v; } };
}

// ---------- JADWAL ----------
test('S1: menambah sesi jadwal valid', () => {
  const r = P.addSession([], S('Pemrograman Web', 0, '08:00', '10:00'));
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].course, 'Pemrograman Web');
});

test('S2: menolak nama mata kuliah kosong', () => {
  assert.strictEqual(tryAdd([], S('   ', 0, '08:00', '09:00')).length, 0);
});

test('S3: menolak jam selesai sebelum atau sama dengan jam mulai', () => {
  assert.strictEqual(tryAdd([], S('A', 0, '10:00', '09:00')).length, 0);
  assert.strictEqual(tryAdd([], S('A', 0, '10:00', '10:00')).length, 0);
});

test('S4: menerima jam tanpa nol di depan (9:00 sampai 10:00)', () => {
  assert.strictEqual(tryAdd([], S('A', 0, '9:00', '10:00')).length, 1);
});

test('S5: menolak format jam tidak valid', () => {
  assert.strictEqual(tryAdd([], S('A', 0, '08:00', 'abc')).length, 0);
  assert.strictEqual(tryAdd([], S('A', 0, '25:00', '26:00')).length, 0);
});

test('S6: dua sesi berurutan (selesai 09:00, mulai 09:00) tidak dianggap bentrok', () => {
  let l = P.addSession([], S('A', 0, '08:00', '09:00'));
  l = tryAdd(l, S('B', 0, '09:00', '10:00'));
  assert.strictEqual(l.length, 2);
});

test('S7: sesi yang tumpang tindih pada hari sama ditolak', () => {
  let l = P.addSession([], S('A', 0, '08:00', '10:00'));
  l = tryAdd(l, S('B', 0, '09:00', '11:00'));
  assert.strictEqual(l.length, 1);
});

test('S8: jam sama pada hari berbeda diperbolehkan', () => {
  let l = P.addSession([], S('A', 0, '08:00', '10:00'));
  l = tryAdd(l, S('B', 1, '08:00', '10:00'));
  assert.strictEqual(l.length, 2);
});

test('S9: urutan jadwal berdasarkan hari lalu jam mulai', () => {
  let l = [];
  l = tryAdd(l, S('C', 1, '08:00', '09:00'));
  l = tryAdd(l, S('B', 0, '13:00', '14:00'));
  l = tryAdd(l, S('A', 0, '08:00', '09:00'));
  assert.deepStrictEqual(P.sortSessions(l).map((s) => s.course), ['A', 'B', 'C']);
});

test('S10: jadwal "hari ini" untuk hari Senin mengambil sesi Senin', () => {
  let l = tryAdd([], S('SENIN', 0, '08:00', '09:00'));
  l = tryAdd(l, S('SELASA', 1, '08:00', '09:00'));
  assert.deepStrictEqual(P.sessionsForDate(l, NOW).map((s) => s.course), ['SENIN']);
});

test('S11: id sesi unik setelah ada yang dihapus', () => {
  let l = tryAdd([], S('A', 0, '08:00', '09:00'));
  l = tryAdd(l, S('B', 1, '08:00', '09:00'));
  l = tryAdd(l, S('C', 2, '08:00', '09:00'));
  l = P.deleteSession(l, 1);
  l = tryAdd(l, S('D', 3, '08:00', '09:00'));
  const ids = l.map((s) => s.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'id duplikat: ' + ids.join(','));
});

// ---------- TUGAS ----------
test('K1: menambah tugas valid dan menolak judul kosong', () => {
  const r = P.addTask([], { title: 'Laporan', dueDate: '', course: '' });
  assert.strictEqual(r.length, 1);
  let l = [];
  try { l = P.addTask([], { title: '   ' }); } catch (e) { /* ditolak dengan error */ }
  assert.strictEqual(l.length, 0);
});

test('K2: tenggat hari ini belum terlambat; kemarin terlambat; selesai tidak', () => {
  assert.strictEqual(P.isOverdue({ dueDate: shift(0), done: false }, NOW), false);
  assert.strictEqual(P.isOverdue({ dueDate: shift(-1), done: false }, NOW), true);
  assert.strictEqual(P.isOverdue({ dueDate: shift(-1), done: true }, NOW), false);
});

test('K3: tugas mendekati tenggat 7 hari (termasuk hari ini), terurut', () => {
  const tasks = [
    { id: 1, title: 'jauh', dueDate: shift(10), done: false },
    { id: 2, title: 'lusa', dueDate: shift(2), done: false },
    { id: 3, title: 'hariini', dueDate: shift(0), done: false },
    { id: 4, title: 'lewat', dueDate: shift(-2), done: false },
    { id: 5, title: 'selesai', dueDate: shift(1), done: true },
  ];
  assert.deepStrictEqual(P.upcomingTasks(tasks, NOW, 7).map((t) => t.title), ['hariini', 'lusa']);
});

test('K4: toggle, hapus, dan filter tugas', () => {
  let t = P.addTask([], { title: 'A' });
  t = P.addTask(t, { title: 'B' });
  t = P.toggleTask(t, t[0].id);
  assert.strictEqual(P.filterTasks(t, 'active').length, 1);
  assert.strictEqual(P.filterTasks(t, 'done').length, 1);
  t = P.deleteTask(t, t[0].id);
  assert.strictEqual(t.length, 1);
});

// ---------- KEAMANAN & PENYIMPANAN ----------
test('X1: teks pengguna di-escape pada tampilan jadwal dan tugas', () => {
  const evil = '<img src=x onerror=alert(1)>';
  const a = P.renderSessionHtml({ id: 1, course: evil, day: 0, start: '08:00', end: '09:00', room: evil });
  const b = P.renderTaskHtml({ id: 1, title: evil, course: evil, dueDate: '', done: false }, NOW);
  assert.ok(!a.includes('<img'), 'jadwal lolos: ' + a);
  assert.ok(!b.includes('<img'), 'tugas lolos: ' + b);
});

test('X2: data localStorage rusak tidak membuat aplikasi crash', () => {
  assert.deepStrictEqual(P.loadData(fakeStorage('{bukan json')), { sessions: [], tasks: [] });
  assert.deepStrictEqual(P.loadData(fakeStorage(undefined)), { sessions: [], tasks: [] });
});

test('X3: simpan lalu muat menghasilkan data sama', () => {
  const s = fakeStorage();
  const data = { sessions: P.addSession([], S('A', 0, '08:00', '09:00')), tasks: P.addTask([], { title: 'T' }) };
  P.saveData(s, data);
  assert.deepStrictEqual(P.loadData(s), data);
});
