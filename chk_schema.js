const {Pool}=require('pg');
require('dotenv').config();
const pool=new Pool({user:process.env.DB_USER,host:process.env.DB_HOST,password:process.env.DB_PASSWORD,port:Number(process.env.DB_PORT),database:process.env.DB_NAME});
(async()=>{
  const c=await pool.connect();
  try{
    await c.query('BEGIN');
    // Borrar solo lo que mi script de test creó: resta 127 (y 156 fue creado por ti antes).
    const d1=await c.query('DELETE FROM inventario_conductor_detalle_resta WHERE inventario_id=127');
    const d2=await c.query('DELETE FROM inventario_conductor_resta WHERE id=127');
    console.log('detalle_resta borrados:', d1.rowCount, '| resta 127 borrado:', d2.rowCount);
    await c.query('COMMIT');
  }catch(e){ await c.query('ROLLBACK'); console.error(e.message);}
  finally{c.release();}
  const q=async(s)=>{ const r=await pool.query(s); return r.rows; };
  console.log('=== resta quedo ==='); for(const r of await q(`SELECT * FROM inventario_conductor_resta ORDER BY id`)) console.log(JSON.stringify(r));
  console.log('=== principal quedo ==='); for(const r of await q(`SELECT * FROM inventario_conductor ORDER BY id`)) console.log(JSON.stringify(r));
  await pool.end();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});