// VERSI 1 - DRAF AWAL DARI AI (disimpan apa adanya sebagai bukti proses).
// Berisi beberapa kelemahan yang ditemukan lewat pengujian (lihat proposal Bab 6).

var DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

function addSession(sessions, input) {
  if (input.end <= input.start) throw new Error('Jam selesai harus setelah jam mulai');
  var item = { id: sessions.length + 1, course: input.course, day: Number(input.day),
    start: input.start, end: input.end, room: input.room || '' };
  var clash = sessions.find(function (x) {
    return x.day === item.day && x.start <= item.end && item.start <= x.end;
  });
  if (clash) throw new Error('Bentrok dengan ' + clash.course);
  return sessions.concat([item]);
}

function deleteSession(sessions, id) {
  return sessions.filter(function (s) { return s.id !== id; });
}

function sortSessions(sessions) {
  return sessions.slice().sort(function (a, b) {
    return a.day - b.day || (a.start < b.start ? -1 : a.start > b.start ? 1 : 0);
  });
}

function sessionsForDate(sessions, date) {
  var d = date.getDay();
  return sortSessions(sessions.filter(function (s) { return s.day === d; }));
}

function addTask(tasks, input) {
  return tasks.concat([{ id: tasks.length + 1, title: input.title, course: input.course || '',
    dueDate: input.dueDate || '', done: false }]);
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

function isOverdue(task, now) {
  if (!task.dueDate || task.done) return false;
  return new Date(task.dueDate) < (now || new Date());
}

function upcomingTasks(tasks, now, days) {
  var limit = new Date((now || new Date()).getTime() + (days || 7) * 86400000);
  return tasks.filter(function (t) {
    return !t.done && t.dueDate && new Date(t.dueDate) >= (now || new Date()) && new Date(t.dueDate) <= limit;
  }).sort(function (a, b) { return new Date(a.dueDate) - new Date(b.dueDate); });
}

function renderSessionHtml(s) {
  return '<li data-id="' + s.id + '"><b>' + s.start + '-' + s.end + '</b> ' + s.course + ' ' + s.room + '</li>';
}

function renderTaskHtml(t) {
  return '<li data-id="' + t.id + '">' + t.title + ' ' + t.course + '</li>';
}

function loadData(storage) {
  var d = JSON.parse(storage.getItem('planner'));
  return { sessions: d.sessions || [], tasks: d.tasks || [] };
}

function saveData(storage, data) {
  storage.setItem('planner', JSON.stringify(data));
}

module.exports = { DAYS, addSession, deleteSession, sortSessions, sessionsForDate, addTask, toggleTask,
  deleteTask, filterTasks, isOverdue, upcomingTasks, renderSessionHtml, renderTaskHtml, loadData, saveData };
