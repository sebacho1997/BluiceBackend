const pool = require('./db');

async function initAuthTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      token_hash VARCHAR(64) NOT NULL UNIQUE,
      jwt_id VARCHAR(128) NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      revoked_at TIMESTAMPTZ NULL,
      replaced_by_token_hash VARCHAR(64) NULL
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id
    ON refresh_tokens(user_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at
    ON refresh_tokens(expires_at)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_confirm_tokens (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      token VARCHAR(64) NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_email_confirm_tokens_user_id
    ON email_confirm_tokens(user_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_email_confirm_tokens_token
    ON email_confirm_tokens(token)
  `);

  // Additional indexes for performance
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_usuarios_tipo_usuario ON usuarios(tipo_usuario)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_pedidos_usuario_id ON pedidos(usuario_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos(estado)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_pedidos_id_conductor ON pedidos(id_conductor)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_pedidos_fecha_entrega ON pedidos(fecha_entrega)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_pedidoproducto_pedido_id ON pedidoproducto(pedido_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_pagos_pedido_pedido_id ON pagos_pedido(pedido_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_gastos_dia_conductor ON gastos_dia(id_conductor)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_gastos_dia_fecha ON gastos_dia(DATE(fecha_gasto))`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_contratos_cliente_id ON contratos(cliente_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_contratos_conductor_id ON contratos(conductor_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_consumos_contrato ON consumos_contrato(contrato_id)`);
}

module.exports = initAuthTables;
