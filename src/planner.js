// VERSI 2 - logika Study Planner (sudah diperbaiki setelah pengujian).
// Fungsi murni tanpa DOM: dapat diuji dengan Node.js dan dipakai browser lewat window.Planner.
(function (root) {
  'use strict';

  var STORAGE_KEY = 'planner';
  var DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  var TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

  function pad(n) { return String(n).padStart(2, '0'); }

  // FIX S4/S5: jam diurai menjadi menit; format salah menghasilkan NaN
  function toMinutes(text) {
    var m = TIME_RE.exec(String(text == null ? '' : text).trim());
    return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
  }
  function normTime(text) {
    var min = toMinutes(text);
    return pad(Math.floor(min / 60)) + ':' + pad(min % 60);
  }
  // FIX S11/K-id: id = id terbesar + 1
  function nextId(items) {
    return items.reduce(function (max, x) { return Math.max(max, x.id); }, 0) + 1;
  }
  // FIX S6: rentang setengah terbuka [mulai, selesai) -> sesi berurutan tidak bentrok
  function overlaps(a, b) {
    return a.day === b.day &&
      toMinutes(a.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(a.end);
  }

  function addSession(sessions, input) {
    var course = String(input.course == null ? '' : input.course).trim();   // FIX S2
    if (course === '') throw new Error('Nama mata kuliah/kegiatan tidak boleh kosong');
    if (course.length > 60) throw new Error('Nama maksimal 60 karakter');
    var day = Number(input.day);
    if (!Number.isInteger(day) || day < 0 || day > 6) throw new Error('Hari tidak valid');
    var s = toMinutes(input.start), e = toMinutes(input.end);
    if (isNaN(s) || isNaN(e)) throw new Error('Format jam tidak valid (gunakan HH:MM)');
    if (e <= s) throw new Error('Jam selesai harus setelah jam mulai');
    var item = { id: nextId(sessions), course: course, day: day,
      start: normTime(input.start), end: normTime(input.end),
      room: String(input.room == null ? '' : input.room).trim().slice(0, 30) };
    var clash = sessions.find(function (x) { return overlaps(x, item); });
    if (clash) throw new Error('Bentrok dengan "' + clash.course + '" (' + clash.start + ' - ' + clash.end + ')');
    return sessions.concat([item]);
  }

  function deleteSession(sessions, id) {
    return sessions.filter(function (s) { return s.id !== id; });
  }

  function sortSessions(sessions) {
    return sessions.slice().sort(function (a, b) {
      return a.day - b.day || toMinutes(a.start) - toMinutes(b.start);
    });
  }

  // FIX S10: Date.getDay() Minggu=0, sedangkan indeks aplikasi Senin=0
  function dayIndex(date) { return (date.getDay() + 6) % 7; }

  function sessionsForDate(sessions, date) {
    var d = dayIndex(date);
    return sortSessions(sessions.filter(function (s) { return s.day === d; }));
  }

  function addTask(tasks, input) {
    var title = String(input.title == null ? '' : input.title).trim();
    if (title === '') throw new Error('Judul tugas tidak boleh kosong');
    if (title.length > 100) throw new Error('Judul maksimal 100 karakter');
    // Pengingat tugas (opsional): jam wajib valid dan butuh tanggal tenggat
    var remindAt = '';
    if (input.remindAt) {
      var rm = toMinutes(input.remindAt);
      if (isNaN(rm)) throw new Error('Format jam pengingat tidak valid (gunakan HH:MM)');
      if (!input.dueDate) throw new Error('Pengingat tugas membutuhkan tanggal tenggat');
      remindAt = normTime(input.remindAt);
    }
    var task = { id: nextId(tasks), title: title,
      course: String(input.course == null ? '' : input.course).trim().slice(0, 60),
      dueDate: input.dueDate || '', done: false };
    if (remindAt) task.remindAt = remindAt;
    return tasks.concat([task]);
  }

  function toggleTask(tasks, id) {
    return tasks.map(function (t) { return t.id === id ? Object.assign({}, t, { done: !t.done }) : t; });
  }
  function deleteTask(tasks, id) {
    return tasks.filter(function (t) { return t.id !== id; });
  }
  function filterTasks(tasks, filter) {
    if (filter === 'active') return tasks.filter(function (t) { return !t.done; });
    if (filter === 'done') return tasks.filter(function (t) { return t.done; });
    return tasks;
  }

  function localDateString(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  // FIX K2: bandingkan string tanggal lokal YYYY-MM-DD, bukan objek Date (UTC)
  function isOverdue(task, now) {
    if (!task.dueDate || task.done) return false;
    return task.dueDate < localDateString(now || new Date());
  }

  // FIX K3: tenggat hari ini sampai N hari ke depan, terurut
  function upcomingTasks(tasks, now, days) {
    var base = now || new Date();
    var from = localDateString(base);
    var end = new Date(base); end.setDate(end.getDate() + (days || 7));
    var to = localDateString(end);
    return tasks.filter(function (t) {
      return !t.done && t.dueDate && t.dueDate >= from && t.dueDate <= to;
    }).sort(function (a, b) { return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0; });
  }

  // FIX X1: escape semua teks dari pengguna
  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function renderSessionHtml(s) {
    return '<li class="session" data-id="' + Number(s.id) + '">' +
      '<span class="time">' + escapeHtml(s.start) + ' - ' + escapeHtml(s.end) + '</span>' +
      '<span class="info"><span class="title">' + escapeHtml(s.course) + '</span>' +
      (s.room ? '<span class="meta">Ruang: ' + escapeHtml(s.room) + '</span>' : '') + '</span>' +
      '<button class="delete" aria-label="Hapus sesi">Hapus</button></li>';
  }

  function renderTaskHtml(t, now) {
    var late = isOverdue(t, now);
    var cls = 'task' + (t.done ? ' done' : '') + (late ? ' overdue' : '');
    var meta = [];
    if (t.course) meta.push(escapeHtml(t.course));
    if (t.dueDate) meta.push('Tenggat: ' + escapeHtml(t.dueDate) + (late ? ' (terlambat)' : ''));
    if (t.remindAt) meta.push('Ingatkan ' + escapeHtml(t.remindAt));
    return '<li class="' + cls + '" data-id="' + Number(t.id) + '">' +
      '<input type="checkbox" class="toggle" aria-label="Tandai selesai"' + (t.done ? ' checked' : '') + '>' +
      '<span class="info"><span class="title">' + escapeHtml(t.title) + '</span>' +
      (meta.length ? '<span class="meta">' + meta.join(' | ') + '</span>' : '') + '</span>' +
      '<button class="delete" aria-label="Hapus tugas">Hapus</button></li>';
  }

  // FIX X2: try/catch + validasi bentuk data
  function loadData(storage) {
    var empty = { sessions: [], tasks: [] };
    try {
      var d = JSON.parse(storage.getItem(STORAGE_KEY));
      if (!d || typeof d !== 'object') return empty;
      var okS = function (s) { return s && typeof s.id === 'number' && typeof s.course === 'string' &&
        s.day >= 0 && s.day <= 6 && !isNaN(toMinutes(s.start)) && !isNaN(toMinutes(s.end)); };
      var okT = function (t) { return t && typeof t.id === 'number' && typeof t.title === 'string'; };
      return { sessions: Array.isArray(d.sessions) ? d.sessions.filter(okS) : [],
               tasks: Array.isArray(d.tasks) ? d.tasks.filter(okT) : [] };
    } catch (e) { return empty; }
  }

  function saveData(storage, data) {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  var api = { DAYS: DAYS, addSession: addSession, deleteSession: deleteSession, sortSessions: sortSessions,
    sessionsForDate: sessionsForDate, dayIndex: dayIndex, addTask: addTask, toggleTask: toggleTask,
    deleteTask: deleteTask, filterTasks: filterTasks, isOverdue: isOverdue, upcomingTasks: upcomingTasks,
    escapeHtml: escapeHtml, renderSessionHtml: renderSessionHtml, renderTaskHtml: renderTaskHtml,
    loadData: loadData, saveData: saveData, toMinutes: toMinutes };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Planner = api;
})(typeof window !== 'undefined' ? window : this);
