const pool = require('../config/db');

const User = {
  async getByEmail(email) {
    try {
      const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
      return result.rows[0];
    } catch (error) {
      console.error('Error al obtener usuario por email:', error);
      throw new Error('No se pudo obtener el usuario');
    }
  },

  async create(userData) {
    const { nombre, telefono, email, password, activado, tipo_usuario, email_confirm } = userData;
    try {
      const result = await pool.query(
        'INSERT INTO usuarios (nombre,telefono,email,password,activado,tipo_usuario,email_confirm) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
        [nombre, telefono, email, password, activado, tipo_usuario, email_confirm ?? true]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error al crear usuario en Postgres:', error);
      throw new Error('No se pudo crear el usuario');
    }
  },

  async update(id, userData) {
    const { nombre, telefono, email, password, activado, tipo_usuario, email_confirm } = userData;
    const result = await pool.query(
      `UPDATE usuarios
       SET nombre = $1,
           telefono = $2,
           email = $3,
           password = $4,
           activado = $5,
           tipo_usuario = $6,
           email_confirm = $7
       WHERE id = $8
       RETURNING id, nombre, telefono, email, activado, tipo_usuario, email_confirm`,
      [nombre, telefono, email, password, activado, tipo_usuario, email_confirm, id]
    );
    return result.rows[0];
  },

  async getAll() {
    try {
      const result = await pool.query(
        `SELECT id, nombre, telefono, email, tipo_usuario
         FROM usuarios
         WHERE activado = true
           AND COALESCE(su, false) = false`
      );
      return result.rows;
    } catch (error) {
      console.error('Error al obtener todos los usuarios:', error);
      throw new Error('No se pudieron obtener los usuarios');
    }
  },

  async getById(id) {
    try {
      const result = await pool.query(
        `SELECT id, nombre, telefono, email, tipo_usuario, email_confirm
         FROM usuarios
         WHERE id = $1
           AND activado = true
           AND COALESCE(su, false) = false`,
        [id]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error al obtener usuario por ID:', error);
      throw new Error('No se pudo obtener el usuario');
    }
  },

  async getByIdWithPassword(id) {
    try {
      const result = await pool.query(
        'SELECT * FROM usuarios WHERE id = $1 LIMIT 1',
        [id]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error al obtener usuario completo por ID:', error);
      throw new Error('No se pudo obtener el usuario');
    }
  },

  async getUsersByType(tipoUsuario) {
    const result = await pool.query(
      `SELECT *
       FROM usuarios
       WHERE tipo_usuario = $1
         AND activado = true
         AND COALESCE(su, false) = false`,
      [tipoUsuario]
    );
    return result.rows;
  },

  async deleteById(id) {
    const result = await pool.query(
      'UPDATE usuarios SET activado = false WHERE id = $1 AND activado = true',
      [id]
    );
    return result.rowCount > 0;
  },

  async confirmEmail(userId) {
    const result = await pool.query(
      'UPDATE usuarios SET email_confirm = true WHERE id = $1 RETURNING id, email_confirm',
      [userId]
    );
    return result.rows[0];
  },

  async getEmailConfirmStatus(userId) {
    const result = await pool.query(
      'SELECT email_confirm FROM usuarios WHERE id = $1',
      [userId]
    );
    return result.rows[0]?.email_confirm ?? false;
  }
};

module.exports = User;
