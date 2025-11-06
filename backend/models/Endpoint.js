const db = require('../config/database');

class Endpoint {
  static async findByEnvironment(environmentId) {
    const result = await db.query(`
      SELECT e.*, COUNT(r.id) as response_count 
      FROM endpoints e 
      LEFT JOIN responses r ON e.id = r.endpoint_id 
      WHERE e.environment_id = $1 AND e.is_active = true 
      GROUP BY e.id 
      ORDER BY e.order_index, e.created_at
    `, [environmentId]);
    return result.rows;
  }

  static async findById(id) {
    const result = await db.query('SELECT * FROM endpoints WHERE id = $1', [id]);
    return result.rows[0];
  }

  static async findByPathAndMethod(environmentId, path, method) {
    const result = await db.query(`
      SELECT * FROM endpoints 
      WHERE environment_id = $1 AND path = $2 AND method = $3 AND is_active = true
    `, [environmentId, path, method]);
    return result.rows[0];
  }

  static async create(endpointData) {
    const { environment_id, path, method, name, description, status_code, response_headers, rules } = endpointData;
    
    const result = await db.query(`
      INSERT INTO endpoints 
      (environment_id, path, method, name, description, status_code, response_headers, rules) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
      RETURNING *
    `, [environment_id, path, method, name, description, status_code, response_headers, rules]);
    
    return result.rows[0];
  }

  static async update(id, endpointData) {
    const { path, method, name, description, status_code, response_headers, rules, is_active, order_index } = endpointData;
    
    const result = await db.query(`
      UPDATE endpoints 
      SET path = $1, method = $2, name = $3, description = $4, status_code = $5, 
          response_headers = $6, rules = $7, is_active = $8, order_index = $9,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $10 
      RETURNING *
    `, [path, method, name, description, status_code, response_headers, rules, is_active, order_index, id]);
    
    return result.rows[0];
  }

  static async delete(id) {
    const result = await db.query('DELETE FROM endpoints WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  }
}

module.exports = Endpoint;
