// Menjalankan tes yang sama terhadap draf awal AI (versi 1).
// Dibuat sebagai berkas JS agar berjalan sama di Windows, macOS, dan Linux
// (sintaks VAR=nilai perintah tidak didukung PowerShell/CMD).
process.env.PLANNER_MODULE = '../docs/v1-ai-draft/planner.js';
require('./planner.test.js');
