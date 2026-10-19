// VERSI 2 - logika pengingat/alarm (fungsi murni, tanpa DOM).
// Pemicu dihitung sebagai waktu absolut (ms) lalu dibandingkan dengan "sekarang",
// sehingga pengecekan yang terlambat tetap tertangkap dan tidak ada pemicu ganda.
(function (root) {
  'use strict';

  var P = root.Planner || (typeof require === 'function' ? require('./planner.js') : null);
  var STORAGE_KEY = 'planner-reminders';
  var GRACE_MS = 2 * 60 * 1000;     // FIX R6: toleransi keterlambatan pengecekan
  var KEEP_MS = 2 * 24 * 60 * 60 * 1000;
  var LEADS = [0, 5, 10, 15, 30];
  var DEFAULT_LEAD = 10;

  function pad(n) { return String(n).padStart(2, '0'); }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function normTime(text) {
    var m = P.toMinutes(text);
    return pad(Math.floor(m / 60)) + ':' + pad(m % 60);
  }
  function nextId(items) {
    return items.reduce(function (max, x) { return Math.max(max, x.id); }, 0) + 1;   // FIX R3
  }
  // Waktu absolut (ms) untuk menit-ke-N dalam sehari pada tanggal d; nilai negatif mundur ke hari sebelumnya
  function atMinute(d, minute) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, minute, 0, 0).getTime();   // FIX R13
  }

  function addAlarm(alarms, input) {
    var m = P.toMinutes(input.time);                                               // FIX R2
    if (isNaN(m)) throw new Error('Format jam tidak valid (gunakan HH:MM)');
    var days = Array.isArray(input.days) ? input.days.map(Number) : [];
    var okDays = days.length > 0 && days.every(function (d) { return Number.isInteger(d) && d >= 0 && d <= 6; });
    if (!okDays) throw new Error('Pilih minimal satu hari yang valid');
    var label = String(input.label == null ? '' : input.label).trim().slice(0, 40) || 'Alarm';
    var uniq = days.filter(function (d, i) { return days.indexOf(d) === i; }).sort();
    return alarms.concat([{ id: nextId(alarms), label: label, time: normTime(input.time), days: uniq, enabled: true }]);
  }
  function deleteAlarm(alarms, id) { return alarms.filter(function (a) { return a.id !== id; }); }
  function toggleAlarm(alarms, id) {
    return alarms.map(function (a) { return a.id === id ? Object.assign({}, a, { enabled: !a.enabled }) : a; });
  }

  // Semua pemicu untuk hari ini dan besok (besok perlu untuk pengingat yang mundur melewati tengah malam)
  function computeTriggers(state, now) {
    var out = [];
    var lead = Number(state.lead) || 0;
    [0, 1].forEach(function (off) {
      var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + off);
      var di = P.dayIndex(d);                                                      // FIX R10
      var ds = ymd(d);
      (state.alarms || []).forEach(function (a) {
        var m = P.toMinutes(a.time);
        if (a.enabled !== false && !isNaN(m) && a.days.indexOf(di) >= 0) {
          out.push({ key: 'a:' + a.id + ':' + ds, kind: 'alarm', title: a.label || 'Alarm',
            text: 'Waktunya: ' + (a.label || 'Alarm') + ' (' + a.time + ')', triggerMs: atMinute(d, m) });
        }
      });
      if (lead > 0) {
        (state.sessions || []).forEach(function (s) {
          var m = P.toMinutes(s.start);
          if (s.day === di && !isNaN(m)) {
            out.push({ key: 's:' + s.id + ':' + ds + ':' + lead, kind: 'session', title: 'Kuliah segera dimulai',
              text: s.course + ' mulai ' + s.start + (s.room ? ' di ' + s.room : '') + ' (' + lead + ' menit lagi)',
              triggerMs: atMinute(d, m - lead) });
          }
        });
      }
      (state.tasks || []).forEach(function (t) {
        var m = P.toMinutes(t.remindAt);
        if (!t.done && t.dueDate === ds && !isNaN(m)) {
          out.push({ key: 't:' + t.id + ':' + ds, kind: 'task', title: 'Tugas jatuh tempo hari ini',
            text: t.title + (t.course ? ' (' + t.course + ')' : ''), triggerMs: atMinute(d, m) });
        }
      });
    });
    return out;
  }

  // FIX R4-R8: pemicu "jatuh tempo" jika 0 <= sekarang - pemicu < GRACE dan kuncinya (memuat tanggal) belum tercatat
  function dueReminders(state, now, fired) {
    var nowMs = now.getTime();
    return computeTriggers(state, now).filter(function (t) {
      var diff = nowMs - t.triggerMs;
      return diff >= 0 && diff < GRACE_MS && !(fired && fired[t.key]);
    }).sort(function (a, b) { return a.triggerMs - b.triggerMs; });
  }

  function makeSnooze(reminder, now, minutes) {
    return { key: reminder.key, title: reminder.title, text: reminder.text, at: now.getTime() + minutes * 60000 };
  }
  // FIX R18: jatuh tempo jika at <= sekarang (batas inklusif)
  function splitSnoozes(snoozes, nowMs) {
    return { due: snoozes.filter(function (s) { return s.at <= nowMs; }),
             pending: snoozes.filter(function (s) { return s.at > nowMs; }) };
  }
  // FIX R19: buang catatan lama
  function pruneFired(fired, nowMs) {
    var kept = {};
    Object.keys(fired || {}).forEach(function (k) { if (fired[k] >= nowMs - KEEP_MS) kept[k] = fired[k]; });
    return kept;
  }

  function renderAlarmHtml(a) {                                                    // FIX R20
    var names = a.days.map(function (d) { return P.DAYS[d].slice(0, 3); }).join(', ');
    return '<li class="alarm' + (a.enabled === false ? ' off' : '') + '" data-id="' + Number(a.id) + '">' +
      '<input type="checkbox" class="toggle" aria-label="Aktifkan alarm"' + (a.enabled === false ? '' : ' checked') + '>' +
      '<span class="time">' + P.escapeHtml(a.time) + '</span>' +
      '<span class="info"><span class="title">' + P.escapeHtml(a.label) + '</span>' +
      '<span class="meta">' + P.escapeHtml(names) + '</span></span>' +
      '<button class="delete" aria-label="Hapus alarm">Hapus</button></li>';
  }

  function loadReminders(storage) {                                                // FIX R21
    var def = { alarms: [], lead: DEFAULT_LEAD, fired: {}, snoozes: [] };
    try {
      var d = JSON.parse(storage.getItem(STORAGE_KEY));
      if (!d || typeof d !== 'object') return def;
      var okA = function (a) { return a && typeof a.id === 'number' && typeof a.label === 'string' &&
        !isNaN(P.toMinutes(a.time)) && Array.isArray(a.days) && a.days.every(function (x) { return x >= 0 && x <= 6; }); };
      var okZ = function (z) { return z && typeof z.at === 'number' && typeof z.text === 'string'; };
      return {
        alarms: Array.isArray(d.alarms) ? d.alarms.filter(okA) : [],
        lead: LEADS.indexOf(d.lead) >= 0 ? d.lead : DEFAULT_LEAD,
        fired: d.fired && typeof d.fired === 'object' && !Array.isArray(d.fired) ? d.fired : {},
        snoozes: Array.isArray(d.snoozes) ? d.snoozes.filter(okZ) : []
      };
    } catch (e) { return def; }
  }
  function saveReminders(storage, data) { storage.setItem(STORAGE_KEY, JSON.stringify(data)); }

  var api = { LEADS: LEADS, addAlarm: addAlarm, deleteAlarm: deleteAlarm, toggleAlarm: toggleAlarm,
    computeTriggers: computeTriggers, dueReminders: dueReminders, makeSnooze: makeSnooze,
    splitSnoozes: splitSnoozes, pruneFired: pruneFired, renderAlarmHtml: renderAlarmHtml,
    loadReminders: loadReminders, saveReminders: saveReminders };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Reminder = api;
})(typeof window !== 'undefined' ? window : this);
