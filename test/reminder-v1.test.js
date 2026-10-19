// Menjalankan tes pengingat terhadap draf awal AI (versi 1); lintas sistem operasi.
process.env.REMINDER_MODULE = '../docs/v1-ai-draft/reminder.js';
require('./reminder.test.js');
