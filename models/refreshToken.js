const pool = require('../config/db');

const RefreshToken = {
  async create({ userId, tokenHash, jwtId, expiresAt }) {
    const result = await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, jwt_id, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, tokenHash, jwtId, expiresAt]
    );

    return result.rows[0];
  },

  async findActiveByTokenHash(tokenHash) {
    const result = await pool.query(
      `SELECT *
       FROM refresh_tokens
       WHERE token_hash = $1
         AND revoked_at IS NULL
         AND expires_at > NOW()
       LIMIT 1`,
      [tokenHash]
    );

    return result.rows[0];
  },

  async revokeByTokenHash(tokenHash, replacedByTokenHash = null) {
    const result = await pool.query(
      `UPDATE refresh_tokens
       SET revoked_at = NOW(),
           replaced_by_token_hash = COALESCE($2, replaced_by_token_hash)
       WHERE token_hash = $1
         AND revoked_at IS NULL
       RETURNING *`,
      [tokenHash, replacedByTokenHash]
    );

    return result.rows[0];
  },

  async revokeAllByUserId(userId) {
    await pool.query(
      `UPDATE refresh_tokens
       SET revoked_at = NOW()
       WHERE user_id = $1
         AND revoked_at IS NULL`,
      [userId]
    );
  },

  async deleteExpired() {
    await pool.query(
      `DELETE FROM refresh_tokens
       WHERE expires_at <= NOW()`
    );
  }
};

module.exports = RefreshToken;
