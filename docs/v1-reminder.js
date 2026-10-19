// VERSI 1 - DRAF AWAL PENGINGAT DARI AI (disimpan apa adanya sebagai bukti proses).

function ymd(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function toMin(t) {
  var p = t.split(':');
  return Number(p[0]) * 60 + Number(p[1]);
}

function addAlarm(alarms, input) {
  return alarms.concat([{ id: alarms.length + 1, label: input.label, time: input.time,
    days: input.days, enabled: true }]);
}
function deleteAlarm(alarms, id) { return alarms.filter(function (a) { return a.id !== id; }); }
function toggleAlarm(alarms, id) {
  return alarms.map(function (a) { return a.id === id ? Object.assign({}, a, { enabled: !a.enabled }) : a; });
}

// Dipanggil setiap 15 detik oleh antarmuka
function dueReminders(state, now, fired) {
  var out = [];
  var nowMin = now.getHours() * 60 + now.getMinutes();
  var day = now.getDay();
  state.alarms.forEach(function (a) {
    if (a.enabled && a.days.indexOf(day) >= 0 && toMin(a.time) === nowMin && !fired['a' + a.id]) {
      out.push({ key: 'a' + a.id, title: a.label, text: 'Waktunya ' + a.label });
    }
  });
  if (state.lead > 0) {
    state.sessions.forEach(function (s) {
      if (s.day === day && toMin(s.start) - state.lead === nowMin && !fired['s' + s.id]) {
        out.push({ key: 's' + s.id, title: 'Kuliah segera dimulai', text: s.course + ' mulai ' + s.start });
      }
    });
  }
  state.tasks.forEach(function (t) {
    if (!t.done && t.dueDate === ymd(now) && t.remindAt === String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0') && !fired['t' + t.id]) {
      out.push({ key: 't' + t.id, title: 'Tugas jatuh tempo', text: t.title });
    }
  });
  return out;
}

function makeSnooze(reminder, now, minutes) {
  return { key: reminder.key, title: reminder.title, text: reminder.text, at: now.getTime() + minutes * 60000 };
}
function splitSnoozes(snoozes, nowMs) {
  return { due: snoozes.filter(function (s) { return s.at < nowMs; }),
           pending: snoozes.filter(function (s) { return s.at >= nowMs; }) };
}
function pruneFired(fired) { return fired; }

function renderAlarmHtml(a) {
  return '<li data-id="' + a.id + '">' + a.time + ' ' + a.label + '</li>';
}

function loadReminders(storage) {
  return JSON.parse(storage.getItem('planner-reminders'));
}
function saveReminders(storage, data) {
  storage.setItem('planner-reminders', JSON.stringify(data));
}

module.exports = { addAlarm, deleteAlarm, toggleAlarm, dueReminders, makeSnooze, splitSnoozes,
  pruneFired, renderAlarmHtml, loadReminders, saveReminders };
