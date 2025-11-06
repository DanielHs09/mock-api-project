const db = require('../config/database');

class Environment {
  static async findAll() {
    const result = await db.query(`
      SELECT * FROM environments 
      WHERE is_active = true 
      ORDER BY created_at DESC
    `);
    return result.rows;
  }

  static async findById(id) {
    const result = await db.query('SELECT * FROM environments WHERE id = $1', [id]);
    return result.rows[0];
  }

  static async findByUuid(uuid) {
    const result = await db.query('SELECT * FROM environments WHERE uuid = $1', [uuid]);
    return result.rows[0];
  }

  static async create(environmentData) {
    const { name, port, endpoint_prefix, latency, cors_enabled, https_enabled, metadata } = environmentData;
    
    const result = await db.query(`
      INSERT INTO environments 
      (name, port, endpoint_prefix, latency, cors_enabled, https_enabled, metadata) 
      VALUES ($1, $2, $3, $4, $5, $6, $7) 
      RETURNING *
    `, [name, port, endpoint_prefix, latency, cors_enabled, https_enabled, metadata]);
    
    return result.rows[0];
  }

  static async update(id, environmentData) {
    const { name, port, endpoint_prefix, latency, cors_enabled, https_enabled, metadata, is_active } = environmentData;
    
    const result = await db.query(`
      UPDATE environments 
      SET name = $1, port = $2, endpoint_prefix = $3, latency = $4, 
          cors_enabled = $5, https_enabled = $6, metadata = $7, is_active = $8,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $9 
      RETURNING *
    `, [name, port, endpoint_prefix, latency, cors_enabled, https_enabled, metadata, is_active, id]);
    
    return result.rows[0];
  }

  static async delete(id) {
    const result = await db.query('DELETE FROM environments WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  }
}

module.exports = Environment;
