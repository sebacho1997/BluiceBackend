const pool = require('../config/db');

const Direccion = {
  async create({ usuario_id, direccion, latitud, longitud, info_extra }) {
  const result = await pool.query(
    `INSERT INTO direcciones (id_usuario, direccion, latitud, longitud, info_extra)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [usuario_id, direccion, latitud, longitud, info_extra]
  );
  return result.rows[0];
},

  async getById(id) {
    const result = await pool.query('SELECT * FROM direcciones WHERE id = $1', [id]);
    return result.rows[0];
  },

  async getByUserId(usuario_id) {
    const result = await pool.query('SELECT * FROM direcciones WHERE id_usuario = $1', [usuario_id]);
    return result.rows;
  },

  async update(id, { direccion, latitud, longitud, info_extra }) {
    const result = await pool.query(
      `UPDATE direcciones 
       SET direccion = $1, latitud = $2, longitud = $3, info_extra = $4 
       WHERE id = $5 RETURNING *`,
      [direccion, latitud, longitud, info_extra, id]
    );
    return result.rows[0];
  },

  async delete(id) {
    const result = await pool.query('DELETE FROM direcciones WHERE id = $1', [id]);
    return result.rowCount > 0;
  }
};

module.exports = Direccion;
