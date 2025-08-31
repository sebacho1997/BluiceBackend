const fs = require('fs');
const pool = require('./db');

// Ruta a tu archivo de backup
const backupFile = './backup.sql';

async function restoreBackup() {
  try {
    // Leer todo el archivo SQL
    const sql = fs.readFileSync(backupFile, 'utf8');

    // Dividir el SQL por ';' para ejecutar cada query
    const queries = sql.split(';').map(q => q.trim()).filter(q => q.length);

    for (const query of queries) {
      await pool.query(query);
    }

    console.log('Backup restaurado correctamente.');
    process.exit(0);
  } catch (err) {
    console.error('Error restaurando el backup:', err);
    process.exit(1);
  }
}

restoreBackup();
