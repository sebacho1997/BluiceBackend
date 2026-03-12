require('dotenv').config({ path: 'e:/Proyecto Bluice/Backend/.env' });
const pool = require('e:/Proyecto Bluice/Backend/config/db.js');

async function migrate() {
  try {
    console.log("Adding 'estado' column to 'productos' table...");
    // Add the column if it doesn't exist
    await pool.query(`
      ALTER TABLE productos 
      ADD COLUMN IF NOT EXISTS estado BOOLEAN DEFAULT true;
    `);

    // Update existing nulls to true just in case
    await pool.query(`
      UPDATE productos 
      SET estado = true 
      WHERE estado IS NULL;
    `);

    console.log("Migration successful.");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    pool.end();
  }
}

migrate();
