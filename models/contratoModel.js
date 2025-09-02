const pool = require('../config/db');

const ContratosModel = {
  // === CONTRATOS ===
  async getAllContratos() {
      const result = await pool.query(`
    SELECT c.*, u.nombre as nombre
    FROM contratos c
    JOIN usuarios u ON u.id = c.cliente_id
    WHERE c.estado != 'finalizado'
    ORDER BY c.fecha_inicio DESC
  `);
    return result.rows;
  },

  async getContratoById(id) {
    const result = await pool.query('SELECT * FROM contratos WHERE id = $1', [id]);
    return result.rows[0];
  },

  async createContrato({ cliente_id, monto_total, monto_restante, fecha_inicio, fecha_fin, estado, conductor_id }) {
    const result = await pool.query(
      `INSERT INTO contratos (cliente_id, monto_total, monto_restante, fecha_inicio, fecha_fin, estado, conductor_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [cliente_id, monto_total, monto_restante, fecha_inicio, fecha_fin, 'creado', conductor_id]
    );
    return result.rows[0];
  },
  async asignarConductor(id, conductor_id) {
  const result = await pool.query(
  'UPDATE contratos SET conductor_id=$1, estado=$2 WHERE id=$3 RETURNING *',
  [conductor_id, "asignado", id]
);
  return result.rows[0];
},
  async updateContrato(id, { cliente_id, monto_total, monto_restante, fecha_inicio, fecha_fin, estado, conductor_id }) {
    const result = await pool.query(
      `UPDATE contratos 
       SET cliente_id=$1, monto_total=$2, monto_restante=$3, fecha_inicio=$4, fecha_fin=$5, estado=$6, conductor_id=$7
       WHERE id=$8 RETURNING *`,
      [cliente_id, monto_total, monto_restante, fecha_inicio, fecha_fin, estado, conductor_id, id]
    );
    return result.rows[0];
  },

  async deleteContrato(id) {
    await pool.query('DELETE FROM contratos WHERE id=$1', [id]);
    return { message: 'Contrato eliminado' };
  },

  // === CONSUMOS_CONTRATO ===
  async getConsumosByContrato(contrato_id) {
  const result = await pool.query(`
    SELECT c.*, 
           COALESCE(
             json_agg(
               json_build_object(
                 'id', cd.id,
                 'producto_id', cd.producto_id,
                 'producto_nombre', p.nombre,
                 'cantidad', cd.cantidad
               )
             ) FILTER (WHERE cd.id IS NOT NULL),
           '[]') as detalles
    FROM consumos_contrato c
    LEFT JOIN consumo_detalle cd ON cd.consumo_id = c.id
    LEFT JOIN productos p ON p.idproducto = cd.producto_id
    WHERE c.contrato_id = $1
    GROUP BY c.id
    ORDER BY c.fecha DESC
  `, [contrato_id]);

  return result.rows;
},

  async createConsumo({ contrato_id, monto_consumido, observaciones }) {
    
  const result = await pool.query(
    `INSERT INTO consumos_contrato (contrato_id, monto_consumido, observaciones)
     VALUES ($1, $2, $3) RETURNING *`,
    [contrato_id, monto_consumido, observaciones]
  );

    // restar monto_restante del contrato
    await pool.query(
      `UPDATE contratos SET monto_restante = monto_restante - $1 WHERE id=$2`,
      [monto_consumido, contrato_id]
    );

    return result.rows[0];
  },

  async deleteConsumo(id) {
    await pool.query('DELETE FROM consumos_contrato WHERE id=$1', [id]);
    return { message: 'Consumo eliminado' };
  },

  // === DETALLES DE CONSUMO ===
  async getDetallesByConsumo(consumo_id) {
  const result = await pool.query(
    `SELECT cd.id, cd.consumo_id, cd.producto_id, p.nombre as producto_nombre, cd.cantidad
     FROM consumo_detalle cd
     JOIN productos p ON cd.producto_id = p.idproducto
     WHERE cd.consumo_id = $1`,
    [consumo_id]
  );
  return result.rows;
},

  async createDetalles({ consumo_id, producto_id, cantidad }) {
  const query = `
    INSERT INTO consumo_detalle (consumo_id, producto_id, cantidad)
    VALUES ($1, $2, $3) RETURNING *`;
  const values = [consumo_id, producto_id, cantidad];
  const result = await pool.query(query, values);
  return result.rows[0];
},

  async deleteDetalle(id) {
    await pool.query('DELETE FROM consumo_detalle WHERE id=$1', [id]);
    return { message: 'Detalle eliminado' };
  }
};

module.exports = ContratosModel;
