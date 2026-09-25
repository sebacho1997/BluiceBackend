const pool = require('../config/db');

// El número visible (numero_recibo) se autogenera por (tipo, mes): el
// siguiente disponible del mes comienza en 1 y avanza de a uno. Se usa un
// advisory lock transaccional para evitar colisiones entre pedidos/entregas
// simultáneos del mismo tipo.
async function obtenerSiguienteNumero(client, tabla, tipo, mes) {
  await client.query(
    `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
    [`recibo:${tabla}:${tipo}:${mes}`]
  );
  const res = await client.query(
    `SELECT COALESCE(MAX(
       CASE WHEN numero_recibo ~ '^[0-9]+$' THEN numero_recibo::int END
     ), 0) + 1 AS sig
     FROM ${tabla}
     WHERE tipo = $1 AND to_char(created_at, 'YYYY-MM') = $2`,
    [tipo, mes]
  );
  return Number(res.rows[0].sig);
}

// Reserva el número creando la fila del recibo ANTES de imprimir. Para
// pedidos se inserta en recibos_impresos (pedido_id NOT NULL cumple). Para
// garantías/movimientos se inserta en recibos_movimiento.
async function crearRecibo({
  tabla,
  pedido_id = null,
  id_movimiento = null,
  numero_recibo,
  tipo,
  datos_recibo = null,
  client = pool,
}) {
  // Re-sincroniza la secuencia de la PK con el MAX(id) actual. La tabla ya
  // existe en producción con datos cargados (ids altos) y su secuencia puede
  // quedar baja; si no se ajusta, el INSERT colisiona con una llave existente.
  const seqRes = await client.query(
    `SELECT pg_get_serial_sequence($1, 'id') AS seq_name,
            (SELECT MAX(id) FROM ${tabla}) AS max_id`,
    [tabla]
  );
  const seqName = seqRes.rows[0]?.seq_name;
  const maxId = seqRes.rows[0]?.max_id;
  if (seqName && maxId != null) {
    await client.query(`SELECT setval($1, $2, true)`, [seqName, maxId]);
  }

  if (tabla === 'recibos_impresos') {
    const res = await client.query(
      `INSERT INTO recibos_impresos (pedido_id, numero_recibo, tipo, datos_recibo)
       VALUES ($1, $2, $3, $4::jsonb)
       RETURNING *`,
      [pedido_id, numero_recibo, tipo,
       datos_recibo ? JSON.stringify(datos_recibo) : null]
    );
    return res.rows[0];
  }
  const res = await client.query(
    `INSERT INTO recibos_movimiento (id_movimiento, numero_recibo, tipo, datos_recibo)
     VALUES ($1, $2, $3, $4::jsonb)
     RETURNING *`,
    [id_movimiento, numero_recibo, tipo,
     datos_recibo ? JSON.stringify(datos_recibo) : null]
  );
  return res.rows[0];
}

// Actualiza los datos del recibo ya reservado (impresión). Si la fila aún
// no existe (flujo legacy, número ingresado a mano) la crea.
async function actualizarDatosRecibo({ tabla, numero_recibo, tipo, datos_recibo, pedido_id = null, id_movimiento = null }) {
  const datos = datos_recibo ? JSON.stringify(datos_recibo) : null;
  const mes = _mesActual();

  const upd = await pool.query(
    `UPDATE ${tabla}
     SET datos_recibo = $1
     WHERE numero_recibo = $2 AND tipo = $3
       AND to_char(created_at, 'YYYY-MM') = $4
     RETURNING *`,
    [datos, numero_recibo, tipo, mes]
  );

  if (upd.rows.length > 0) {
    return upd.rows[0];
  }

  return crearRecibo({
    tabla,
    pedido_id,
    id_movimiento,
    numero_recibo,
    tipo,
    datos_recibo,
  });
}

// Lista recibos de ambas tablas (pedidos y movimientos/garantías) con el
// conductor y cliente asociados, aplicando filtros opcionales.
async function listarRecibos({
  tipo = null,
  mes = null,
  busqueda = null,
  conductor_id = null,
  limite = 1000,
}) {
  const condiciones = [];
  const params = [];
  let i = 1;

  if (tipo) {
    condiciones.push(`tipo = $${i++}`);
    params.push(String(tipo).toLowerCase());
  }
  if (mes) {
    condiciones.push(`to_char(created_at, 'YYYY-MM') = $${i++}`);
    params.push(mes);
  }
  if (conductor_id) {
    condiciones.push(`conductor_id::text = $${i++}`);
    params.push(String(conductor_id));
  }
  if (busqueda && String(busqueda).trim()) {
    const p = `%${String(busqueda).trim()}%`;
    condiciones.push(`(
      numero_recibo ILIKE $${i} OR
      datos_recibo->>'cliente_nombre' ILIKE $${i} OR
      datos_recibo->>'telefono' ILIKE $${i}
    )`);
    params.push(p);
    i++;
  }

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  params.push(Number(limite) || 1000);

  const res = await pool.query(
    `SELECT * FROM (
       SELECT 'pedido' AS origen, ri.id, ri.pedido_id AS referencia_id,
              ri.numero_recibo, ri.tipo, ri.created_at, ri.datos_recibo,
              p.id_conductor AS conductor_id, c.nombre AS conductor_nombre
       FROM recibos_impresos ri
       LEFT JOIN pedidos p ON p.id = ri.pedido_id
       LEFT JOIN usuarios c ON c.id = p.id_conductor
       UNION ALL
       SELECT 'movimiento' AS origen, rm.id, rm.id_movimiento AS referencia_id,
              rm.numero_recibo, rm.tipo, rm.created_at, rm.datos_recibo,
              m.id_conductor AS conductor_id, c.nombre AS conductor_nombre
       FROM recibos_movimiento rm
       LEFT JOIN movimiento_equipos m ON m.id = rm.id_movimiento
       LEFT JOIN usuarios c ON c.id = m.id_conductor
     ) t
     ${where}
     ORDER BY t.created_at DESC
     LIMIT $${i}`,
    params
  );
  return res.rows;
}

function _mesActual() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${m}`;
}

module.exports = {
  obtenerSiguienteNumero,
  crearRecibo,
  actualizarDatosRecibo,
  listarRecibos,
  mesActual: _mesActual,
};