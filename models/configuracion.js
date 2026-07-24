const pool = require('../config/db');

const Configuracion = {
  async getAll() {
    const result = await pool.query('SELECT clave, valor FROM configuracion ORDER BY id');
    const map = {};
    for (const row of result.rows) {
      map[row.clave] = row.valor;
    }
    return map;
  },

  async update(clave, valor) {
    await pool.query(
      `INSERT INTO configuracion (clave, valor, actualizado_en)
       VALUES ($1, $2, NOW())
       ON CONFLICT (clave)
       DO UPDATE SET valor = EXCLUDED.valor, actualizado_en = NOW()`,
      [clave, valor]
    );
  },

  async bulkUpdate(entries) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const { clave, valor } of entries) {
        await client.query(
          `INSERT INTO configuracion (clave, valor, actualizado_en)
           VALUES ($1, $2, NOW())
           ON CONFLICT (clave)
           DO UPDATE SET valor = EXCLUDED.valor, actualizado_en = NOW()`,
          [clave, valor]
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
};

module.exports = Configuracion;
