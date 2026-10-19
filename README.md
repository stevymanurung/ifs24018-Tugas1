# Study Planner (JavaScript)

Tugas I – 11S3133 Pengembangan Aplikasi Berbasis Web.
Pengatur **jadwal pembelajaran mingguan** dan **tugas** berbasis HTML, CSS, dan JavaScript murni
(tanpa backend, tanpa framework), dikembangkan dengan bantuan AI generatif sebagai asisten pemrograman.

## Fitur
- **Jadwal pembelajaran**: tambah sesi (mata kuliah, hari, jam mulai/selesai, ruang), tampil per hari Senin-Minggu, hapus
- **Validasi jam** (9:00 dan 09:00 sama-sama diterima) dan **deteksi bentrok** (kuliah berurutan boleh)
- **Tugas**: tambah (mata kuliah dan tenggat opsional), centang selesai, hapus, filter Semua/Aktif/Selesai
- **Penanda terlambat** (merah)
- **Ringkasan "Hari ini"**: jadwal hari ini dan tugas 7 hari ke depan
- **Alarm pengingat**: alarm kustom (nama, jam, hari), pengingat 5/10/15/30 menit sebelum kuliah, pengingat tugas pada jam tertentu di tanggal tenggat; bunyi + layar dering + notifikasi browser; tunda 5 menit atau matikan
- Data tersimpan di `localStorage` (tidak hilang saat halaman dimuat ulang)

## Prasyarat
- Browser modern (Chrome, Edge, Firefox)
- Node.js 18+ (hanya untuk pengujian dan server lokal)

## Inisialisasi dan Menjalankan

```bash
git clone https://github.com/<username>/study-planner.git
cd study-planner
```

**Menjalankan aplikasi** (pilih salah satu)
- Buka `index.html` langsung di browser
- VS Code: pasang ekstensi *Live Server*, klik kanan `index.html`, pilih *Open with Live Server*
- Terminal: `npm start`, lalu buka alamat yang ditampilkan

**Menjalankan pengujian**
```bash
npm test         # 40 tes terhadap versi 2 (18 jadwal/tugas + 22 pengingat): semua lulus
npm run test:v1  # tes yang sama terhadap draf awal AI: 25 gagal (bukti bug)
```

## Konfigurasi
Tidak ada dependensi (`npm install` tidak diperlukan).

| Berkas | Fungsi |
|---|---|
| `package.json` | Skrip `start`, `test`, `test:v1` |
| `test/v1.test.js`, `test/reminder-v1.test.js` | Mengarahkan tes yang sama ke draf awal AI (berjalan di Windows/macOS/Linux) |
| `.gitignore` | Mengabaikan `node_modules` dan berkas sistem |

## Struktur Proyek
```
index.html              halaman utama
style.css               gaya tampilan
src/planner.js          logika jadwal dan tugas (murni, dapat diuji tanpa browser)
src/reminder.js         logika alarm/pengingat (murni, dapat diuji tanpa browser)
src/app.js              penghubung logika dengan DOM
test/planner.test.js    18 pengujian jadwal dan tugas (node:test)
test/reminder.test.js   22 pengujian pengingat
test/v1.test.js, test/reminder-v1.test.js   tes yang sama untuk draf awal AI
docs/v1-ai-draft/       draf awal dari AI (bukti proses)
docs/images/            screenshot aplikasi dan hasil tes
docs/*.txt              output mentah pengujian
docs/Proposal_Study_Planner.docx   dokumen proposal
```

## Ringkasan Proses
1. Analisis kebutuhan dan kasus tepi (jam, bentrok, hari, zona waktu, penyimpanan)
2. Rancangan arsitektur dua lapis (logika dan antarmuka) bersama AI
3. Draf kode versi 1 dari AI
4. Review manual + 18 tes: versi 1 gagal 11 tes (8 kelompok bug)
5. Perbaikan menjadi versi 2: 18 dari 18 tes lulus; antarmuka diuji di browser
6. Iterasi 2 (alarm): draf AI gagal 14 dari 22 tes; setelah perbaikan 22 dari 22 lulus; dua masalah tampilan ditemukan lewat uji browser dengan jam simulasi

Detail prompt beserta alasannya, analisis tiap bug, dan keputusan teknis ada di proposal (folder `docs/`).

## Catatan Penting tentang Alarm
Alarm hanya berbunyi **selama halaman ini terbuka** di browser (tab boleh di latar belakang). Browser tidak
mengizinkan halaman yang sudah ditutup membunyikan alarm tanpa server dan push notification.
Setelah halaman dimuat ulang, bunyi aktif kembali pada klik pertama di halaman (aturan autoplay browser).
Untuk notifikasi browser, klik **Aktifkan pengingat** dan izinkan notifikasi.
