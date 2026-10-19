// Pengujian fitur pengingat (alarm). Semua waktu memakai tanggal lokal yang ditentukan sendiri.
// npm test            -> menguji src/reminder.js (versi 2)
// npm run test:v1     -> termasuk draf awal AI (versi 1) lewat test/reminder-v1.test.js
const test = require('node:test');
const assert = require('node:assert');
const R = require(process.env.REMINDER_MODULE || '../src/reminder.js');
const P = require('../src/planner.js');

// Senin, 19 Oktober 2026 (indeks hari 0). Parameter: jam, menit, detik, offset hari
const at = (h, m, s, dayOff) => new Date(2026, 9, 19 + (dayOff || 0), h, m, s || 0);
const state = (o) => Object.assign({ sessions: [], tasks: [], alarms: [], lead: 0 }, o);
const alarm = (o) => Object.assign({ id: 1, label: 'Belajar', time: '08:00', days: [0], enabled: true }, o);
const keys = (list) => list.map((x) => x.key);
function fakeStorage(raw) {
  const data = raw === undefined ? {} : { 'planner-reminders': raw };
  return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = v; } };
}

// ---------- ALARM ----------
test('R1: menambah alarm valid (jam dinormalkan, label bawaan)', () => {
  const r = R.addAlarm([], { label: '  Belajar  ', time: '8:05', days: [0, 2] });
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].label, 'Belajar');
  assert.strictEqual(r[0].time, '08:05');
  assert.strictEqual(R.addAlarm([], { label: '', time: '08:00', days: [1] })[0].label, 'Alarm');
});

test('R2: menolak jam tidak valid dan alarm tanpa hari', () => {
  const tryAdd = (i) => { try { return R.addAlarm([], i); } catch (e) { return []; } };
  assert.strictEqual(tryAdd({ label: 'A', time: '25:00', days: [0] }).length, 0);
  assert.strictEqual(tryAdd({ label: 'A', time: 'abc', days: [0] }).length, 0);
  assert.strictEqual(tryAdd({ label: 'A', time: '08:00', days: [] }).length, 0);
  assert.strictEqual(tryAdd({ label: 'A', time: '08:00', days: [9] }).length, 0);
});

test('R3: id alarm unik setelah ada yang dihapus', () => {
  let a = R.addAlarm([], { label: 'A', time: '08:00', days: [0] });
  a = R.addAlarm(a, { label: 'B', time: '09:00', days: [0] });
  a = R.addAlarm(a, { label: 'C', time: '10:00', days: [0] });
  a = R.deleteAlarm(a, 1);
  a = R.addAlarm(a, { label: 'D', time: '11:00', days: [0] });
  const ids = a.map((x) => x.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'id duplikat: ' + ids.join(','));
});

test('R4: alarm berbunyi pada menitnya di hari yang dipilih saja', () => {
  const s = state({ alarms: [alarm({ days: [0] })] });
  assert.strictEqual(R.dueReminders(s, at(8, 0, 5), {}).length, 1);
  assert.strictEqual(R.dueReminders(s, at(8, 0, 5, 1), {}).length, 0); // Selasa
});

test('R5: alarm belum berbunyi sebelum waktunya', () => {
  const s = state({ alarms: [alarm()] });
  assert.strictEqual(R.dueReminders(s, at(7, 59, 59), {}).length, 0);
});

test('R6: alarm tetap berbunyi jika pengecekan terlambat (toleransi 2 menit)', () => {
  const s = state({ alarms: [alarm()] });
  assert.strictEqual(R.dueReminders(s, at(8, 1, 30), {}).length, 1, 'terlambat 1,5 menit');
  assert.strictEqual(R.dueReminders(s, at(8, 2, 30), {}).length, 0, 'terlambat 2,5 menit sudah kedaluwarsa');
});

test('R7: alarm tidak berbunyi dua kali pada hari yang sama', () => {
  const s = state({ alarms: [alarm()] });
  const first = R.dueReminders(s, at(8, 0, 5), {});
  const fired = {}; fired[first[0].key] = at(8, 0, 5).getTime();
  assert.strictEqual(R.dueReminders(s, at(8, 0, 20), fired).length, 0);
});

test('R8: alarm yang sudah berbunyi kemarin tetap berbunyi hari ini', () => {
  const s = state({ alarms: [alarm({ days: [0, 1] })] });
  const yesterday = R.dueReminders(s, at(8, 0, 5), {});
  const fired = {}; fired[yesterday[0].key] = at(8, 0, 5).getTime();
  assert.strictEqual(R.dueReminders(s, at(8, 0, 5, 1), fired).length, 1);
});

test('R9: alarm yang dimatikan tidak berbunyi', () => {
  const s = state({ alarms: [alarm({ enabled: false })] });
  assert.strictEqual(R.dueReminders(s, at(8, 0, 5), {}).length, 0);
});

test('R10: hari Minggu dipetakan benar (indeks 6), bukan Senin', () => {
  const s = state({ alarms: [alarm({ days: [6] })] });
  assert.strictEqual(R.dueReminders(s, at(8, 0, 5, 6), {}).length, 1, 'Minggu 25 Okt');
  assert.strictEqual(R.dueReminders(s, at(8, 0, 5, 0), {}).length, 0, 'Senin 19 Okt');
});

// ---------- PENGINGAT JADWAL ----------
const kuliah = { id: 7, course: 'Basis Data', day: 0, start: '08:00', end: '10:00', room: 'GD 514' };

test('R11: pengingat kuliah muncul tepat N menit sebelum mulai', () => {
  const s = state({ sessions: [kuliah], lead: 10 });
  assert.strictEqual(R.dueReminders(s, at(7, 49, 59), {}).length, 0);
  const due = R.dueReminders(s, at(7, 50, 5), {});
  assert.strictEqual(due.length, 1);
  assert.ok(due[0].text.includes('Basis Data'));
});

test('R12: pengingat kuliah mati jika lead = 0', () => {
  assert.strictEqual(R.dueReminders(state({ sessions: [kuliah], lead: 0 }), at(7, 50, 5), {}).length, 0);
});

test('R13: kuliah hari Selasa pukul 00:10 dengan lead 30 mengingatkan Senin pukul 23:40', () => {
  const s = state({ sessions: [{ id: 1, course: 'Kelas Malam', day: 1, start: '00:10', end: '01:00', room: '' }], lead: 30 });
  assert.strictEqual(R.dueReminders(s, at(23, 40, 5, 0), {}).length, 1);
});

test('R14: pengingat kuliah tidak muncul pada hari lain', () => {
  const s = state({ sessions: [kuliah], lead: 10 });
  assert.strictEqual(R.dueReminders(s, at(7, 50, 5, 1), {}).length, 0);
});

// ---------- PENGINGAT TUGAS ----------
test('R15: pengingat tugas pada tanggal tenggat dan jam yang dipilih', () => {
  const t = { id: 3, title: 'Laporan', dueDate: '2026-10-19', done: false, remindAt: '09:00' };
  assert.strictEqual(R.dueReminders(state({ tasks: [t] }), at(9, 0, 5), {}).length, 1);
  assert.strictEqual(R.dueReminders(state({ tasks: [t] }), at(9, 0, 5, 1), {}).length, 0);
});

test('R16: tugas yang sudah selesai atau tanpa jam tidak mengingatkan', () => {
  const done = { id: 3, title: 'L', dueDate: '2026-10-19', done: true, remindAt: '09:00' };
  const none = { id: 4, title: 'M', dueDate: '2026-10-19', done: false };
  assert.strictEqual(R.dueReminders(state({ tasks: [done, none] }), at(9, 0, 5), {}).length, 0);
});

test('R17: addTask menyimpan remindAt dan menolak jam tanpa tenggat', () => {
  const t = P.addTask([], { title: 'Laporan', dueDate: '2026-10-19', remindAt: '9:00' });
  assert.strictEqual(t[0].remindAt, '09:00');
  let l = [];
  try { l = P.addTask([], { title: 'X', remindAt: '09:00' }); } catch (e) { /* ditolak */ }
  assert.strictEqual(l.length, 0);
});

// ---------- TUNDA, BERSIH-BERSIH, PENYIMPANAN ----------
test('R18: tunda 5 menit: tidak jatuh tempo sebelum, jatuh tempo tepat saat waktunya', () => {
  const z = R.makeSnooze({ key: 'k', title: 'T', text: 'x' }, at(8, 0, 0), 5);
  assert.strictEqual(R.splitSnoozes([z], at(8, 4, 59).getTime()).due.length, 0);
  const exact = R.splitSnoozes([z], at(8, 5, 0).getTime());
  assert.strictEqual(exact.due.length, 1, 'tepat 08:05:00 harus berbunyi');
  assert.strictEqual(exact.pending.length, 0);
});

test('R19: catatan "sudah berbunyi" lama dibersihkan agar penyimpanan tidak membengkak', () => {
  const now = at(8, 0, 0).getTime();
  const fired = { lama: now - 5 * 86400000, baru: now - 3600000 };
  const kept = R.pruneFired(fired, now);
  assert.deepStrictEqual(Object.keys(kept), ['baru']);
});

test('R20: teks alarm di-escape saat ditampilkan', () => {
  const html = R.renderAlarmHtml({ id: 1, label: '<img src=x onerror=alert(1)>', time: '08:00', days: [0], enabled: true });
  assert.ok(!html.includes('<img'), 'HTML mentah lolos: ' + html);
});

test('R21: penyimpanan kosong atau rusak memberi nilai bawaan, bukan crash', () => {
  const def = { alarms: [], lead: 10, fired: {}, snoozes: [] };
  assert.deepStrictEqual(R.loadReminders(fakeStorage(undefined)), def);
  assert.deepStrictEqual(R.loadReminders(fakeStorage('{rusak')), def);
});

test('R22: simpan lalu muat menghasilkan data sama', () => {
  const s = fakeStorage();
  const data = { alarms: R.addAlarm([], { label: 'A', time: '08:00', days: [0, 4] }), lead: 15, fired: { k: 5 }, snoozes: [] };
  R.saveReminders(s, data);
  assert.deepStrictEqual(R.loadReminders(s), data);
});
