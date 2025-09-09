// models/User.js
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
  const { nombre, telefono, email, password, activado, tipo_usuario } = userData;
  try {
    const result = await pool.query(
      'INSERT INTO usuarios (nombre,telefono,email, password, activado, tipo_usuario) VALUES ($1, $2, $3, $4,$5,$6) RETURNING *',
      [nombre, telefono, email, password, activado, tipo_usuario]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error al crear usuario en Postgres:', error); // 🔹 log real
    throw new Error('No se pudo crear el usuario');
  }
},

  async update(id, userData) {
  const { nombre, telefono, email, password, activado, tipo_usuario } = userData;
  const result = await pool.query(
    `UPDATE usuarios
     SET nombre = $1,
         telefono = $2,
         email = $3,
         password = $4,
         activado = $5,
         tipo_usuario = $6
     WHERE id = $7
     RETURNING id, nombre, telefono, email, activado, tipo_usuario`,
    [nombre, telefono, email, password, activado, tipo_usuario, id]
  );
  return result.rows[0];
},

  async getAll() {
    try {
      const result = await pool.query('SELECT id, nombre,telefono, email, tipo_usuario FROM usuarios');
      return result.rows;
    } catch (error) {
      console.error('Error al obtener todos los usuarios:', error);
      throw new Error('No se pudieron obtener los usuarios');
    }
  },

  async getById(id) {
    try {
      const result = await pool.query('SELECT id, nombre, email, tipo_usuario FROM usuarios WHERE id = $1', [id]);
      return result.rows[0];
    } catch (error) {
      console.error('Error al obtener usuario por ID:', error);
      throw new Error('No se pudo obtener el usuario');
    }
  },
  async getUsersByType(tipoUsuario) {
    const result = await pool.query(
      "SELECT * FROM usuarios WHERE tipo_usuario = $1",
      [tipoUsuario]
    );
    return result.rows;
  },
  async deleteById(id) {
    const result = await pool.query('DELETE FROM usuarios WHERE id = $1', [id]);
    return result.rowCount > 0; // true si se eliminó algo
  }
};

module.exports = User;
