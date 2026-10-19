// Lapisan antarmuka: menghubungkan Planner (logika) dengan DOM.
(function () {
  'use strict';
  var P = window.Planner;
  var R = window.Reminder;
  var $ = function (id) { return document.getElementById(id); };
  var data = P.loadData(window.localStorage);
  var filter = 'all';
  var rem = R.loadReminders(window.localStorage);
  var ringing = [];      // pengingat yang sedang berdering
  var ringTimer = null, autoStop = null;
  var audioCtx = null;

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  function commit(next) {
    data = next;
    P.saveData(window.localStorage, data);
    render();
  }
  function showError(id, msg) { $(id).textContent = msg || ''; }

  function renderToday(now) {
    var d = P.dayIndex(now);
    $('today-title').textContent = 'Hari ini: ' + P.DAYS[d] + ', ' + now.getDate() + ' ' + MONTHS[now.getMonth()] + ' ' + now.getFullYear();
    var cls = P.sessionsForDate(data.sessions, now);
    $('today-classes').innerHTML = cls.length
      ? cls.map(function (s) { return '<li><b>' + P.escapeHtml(s.start) + ' - ' + P.escapeHtml(s.end) + '</b> ' + P.escapeHtml(s.course) + '</li>'; }).join('')
      : '<li class="muted">Tidak ada jadwal hari ini.</li>';
    var up = P.upcomingTasks(data.tasks, now, 7);
    $('today-tasks').innerHTML = up.length
      ? up.map(function (t) { return '<li><b>' + P.escapeHtml(t.dueDate) + '</b> ' + P.escapeHtml(t.title) + '</li>'; }).join('')
      : '<li class="muted">Tidak ada tugas dalam 7 hari ke depan.</li>';
  }

  function renderSchedule() {
    var sorted = P.sortSessions(data.sessions);
    $('schedule').innerHTML = P.DAYS.map(function (name, i) {
      var items = sorted.filter(function (s) { return s.day === i; });
      return '<section class="day"><h3>' + name + '</h3><ul>' +
        (items.length ? items.map(P.renderSessionHtml).join('') : '<li class="muted">Kosong</li>') + '</ul></section>';
    }).join('');
  }

  function renderTasks(now) {
    var vis = P.filterTasks(data.tasks, filter);
    $('task-list').innerHTML = vis.map(function (t) { return P.renderTaskHtml(t, now); }).join('');
    $('task-empty').hidden = vis.length !== 0;
    var left = data.tasks.filter(function (t) { return !t.done; }).length;
    $('task-count').textContent = left + ' tugas belum selesai dari ' + data.tasks.length;
    document.querySelectorAll('.filters button').forEach(function (b) {
      b.classList.toggle('active', b.dataset.filter === filter);
    });
    $('course-options').innerHTML = Array.from(new Set(data.sessions.map(function (s) { return s.course; })))
      .map(function (c) { return '<option value="' + P.escapeHtml(c) + '">'; }).join('');
  }

  function renderAlarms() {
    $('alarm-list').innerHTML = rem.alarms.map(R.renderAlarmHtml).join('');
    $('alarm-empty').hidden = rem.alarms.length !== 0;
    $('lead').value = String(rem.lead);
  }

  function render() {
    var now = new Date();
    renderToday(now); renderSchedule(); renderTasks(now); renderAlarms();
  }

  $('session-form').addEventListener('submit', function (e) {
    e.preventDefault();
    try {
      var sessions = P.addSession(data.sessions, {
        course: $('s-course').value, day: $('s-day').value,
        start: $('s-start').value, end: $('s-end').value, room: $('s-room').value });
      commit({ sessions: sessions, tasks: data.tasks });
      showError('s-error', '');
      $('session-form').reset(); $('s-course').focus();
    } catch (err) { showError('s-error', err.message); }
  });

  $('task-form').addEventListener('submit', function (e) {
    e.preventDefault();
    try {
      commit({ sessions: data.sessions, tasks: P.addTask(data.tasks, {
        title: $('t-title').value, course: $('t-course').value, dueDate: $('t-due').value, remindAt: $('t-remind').value }) });
      showError('t-error', '');
      $('task-form').reset(); $('t-title').focus();
    } catch (err) { showError('t-error', err.message); }
  });

  // Event delegation: satu pendengar untuk seluruh item yang dibuat dinamis
  $('schedule').addEventListener('click', function (e) {
    var li = e.target.closest('li');
    if (li && e.target.classList.contains('delete'))
      commit({ sessions: P.deleteSession(data.sessions, Number(li.dataset.id)), tasks: data.tasks });
  });
  $('task-list').addEventListener('click', function (e) {
    var li = e.target.closest('li');
    if (!li) return;
    var id = Number(li.dataset.id);
    if (e.target.classList.contains('delete')) commit({ sessions: data.sessions, tasks: P.deleteTask(data.tasks, id) });
    else if (e.target.classList.contains('toggle')) commit({ sessions: data.sessions, tasks: P.toggleTask(data.tasks, id) });
  });
  document.querySelectorAll('.filters button').forEach(function (b) {
    b.addEventListener('click', function () { filter = b.dataset.filter; render(); });
  });

  render();

  // ---------- Pengingat / alarm ----------
  function saveRem() { R.saveReminders(window.localStorage, rem); }

  function setStatus() {
    var perm = (typeof Notification !== 'undefined') ? Notification.permission : 'unsupported';
    var msg = 'Bunyi alarm: ' + (audioCtx ? 'aktif' : 'belum diaktifkan (klik "Aktifkan pengingat")') +
      '. Notifikasi browser: ' + (perm === 'granted' ? 'aktif' : perm === 'denied' ? 'diblokir di pengaturan browser' :
      perm === 'unsupported' ? 'tidak didukung' : 'belum diizinkan') + '.';
    $('rem-status').textContent = msg;
  }

  // Browser melarang suara sebelum ada interaksi pengguna, jadi AudioContext dibuat saat tombol diklik
  function unlockAudio() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC && !audioCtx) audioCtx = new AC();
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) { audioCtx = null; }
  }
  function beep() {
    if (!audioCtx) return;
    try {
      var t = audioCtx.currentTime;
      [0, 0.22].forEach(function (off) {
        var o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = 'square'; o.frequency.value = 880;
        g.gain.setValueAtTime(0.0001, t + off);
        g.gain.exponentialRampToValueAtTime(0.25, t + off + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + off + 0.18);
        o.connect(g); g.connect(audioCtx.destination);
        o.start(t + off); o.stop(t + off + 0.2);
      });
    } catch (e) { /* abaikan */ }
  }
  function startRingSound() {
    if (ringTimer) return;
    beep(); ringTimer = setInterval(beep, 900);
    autoStop = setTimeout(stopRingSound, 60000);           // berhenti sendiri setelah 60 detik
  }
  function stopRingSound() {
    clearInterval(ringTimer); ringTimer = null; clearTimeout(autoStop); autoStop = null;
  }

  function showRing() {
    $('ring-list').innerHTML = ringing.map(function (r) {
      return '<li><b>' + P.escapeHtml(r.title) + '</b><br>' + P.escapeHtml(r.text) + '</li>';
    }).join('');
    $('ring').hidden = false;
    document.title = '\u23F0 Pengingat! - Study Planner';
    $('dismiss-btn').focus();
    startRingSound();
  }
  function closeRing() {
    $('ring').hidden = true; stopRingSound(); ringing = [];
    document.title = 'Study Planner - Jadwal dan Tugas';
  }

  function fire(list) {
    list.forEach(function (r) {
      ringing.push(r);
      try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted')
          new Notification(r.title, { body: r.text });
      } catch (e) { /* notifikasi gagal tidak boleh menghentikan alarm */ }
    });
    if (list.length) showRing();
  }

  function tick() {
    var now = new Date();
    var state = { sessions: data.sessions, tasks: data.tasks, alarms: rem.alarms, lead: rem.lead };
    var due = R.dueReminders(state, now, rem.fired);
    var z = R.splitSnoozes(rem.snoozes, now.getTime());
    var changed = due.length > 0 || z.due.length > 0;
    due.forEach(function (r) { rem.fired[r.key] = now.getTime(); });
    rem.snoozes = z.pending;
    rem.fired = R.pruneFired(rem.fired, now.getTime());
    if (changed) saveRem();
    fire(due.concat(z.due));
    renderToday(now);                       // judul "Hari ini" ikut berganti saat lewat tengah malam
  }

  $('enable-btn').addEventListener('click', function () {
    unlockAudio();
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default')
        Notification.requestPermission().then(setStatus, setStatus);
    } catch (e) { /* abaikan */ }
    setStatus(); beep();
  });
  $('test-btn').addEventListener('click', function () {
    unlockAudio(); setStatus();
    fire([{ key: 'tes', title: 'Tes pengingat', text: 'Jika kamu mendengar bunyi, alarm siap dipakai.' }]);
  });
  $('lead').addEventListener('change', function () { rem.lead = Number($('lead').value); saveRem(); });
  $('dismiss-btn').addEventListener('click', closeRing);
  $('snooze-btn').addEventListener('click', function () {
    var now = new Date();
    ringing.forEach(function (r) { rem.snoozes.push(R.makeSnooze(r, now, 5)); });
    saveRem(); closeRing();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('ring').hidden) closeRing(); });

  $('alarm-form').addEventListener('submit', function (e) {
    e.preventDefault();
    try {
      var days = Array.prototype.map.call(document.querySelectorAll('input[name=a-day]:checked'),
        function (x) { return Number(x.value); });
      rem.alarms = R.addAlarm(rem.alarms, { label: $('a-label').value, time: $('a-time').value, days: days });
      saveRem(); renderAlarms(); showError('a-error', '');
      $('alarm-form').reset(); $('a-label').focus();
      unlockAudio(); setStatus();
    } catch (err) { showError('a-error', err.message); }
  });
  $('alarm-list').addEventListener('click', function (e) {
    var li = e.target.closest('li'); if (!li) return;
    var id = Number(li.dataset.id);
    if (e.target.classList.contains('delete')) rem.alarms = R.deleteAlarm(rem.alarms, id);
    else if (e.target.classList.contains('toggle')) rem.alarms = R.toggleAlarm(rem.alarms, id);
    else return;
    saveRem(); renderAlarms();
  });

  // Browser hanya mengizinkan suara setelah ada interaksi. Setelah reload, interaksi pertama di halaman
  // (klik atau tombol apa pun) otomatis mengaktifkan bunyi agar alarm tidak berbunyi tanpa suara.
  function autoUnlock() {
    unlockAudio(); setStatus();
    document.removeEventListener('pointerdown', autoUnlock);
    document.removeEventListener('keydown', autoUnlock);
  }
  document.addEventListener('pointerdown', autoUnlock);
  document.addEventListener('keydown', autoUnlock);

  setInterval(tick, 15000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) tick(); });
  setStatus();
  tick();
})();
