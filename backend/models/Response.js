const db = require('../config/database');

class Response {
  static async findByEndpoint(endpointId) {
    const result = await db.query(`
      SELECT * FROM responses 
      WHERE endpoint_id = $1 
      ORDER BY is_default DESC, probability DESC, created_at
    `, [endpointId]);
    return result.rows;
  }

  static async findById(id) {
    const result = await db.query('SELECT * FROM responses WHERE id = $1', [id]);
    return result.rows[0];
  }

  static async getResponseForRequest(endpointId, requestData = {}) {
    const responses = await this.findByEndpoint(endpointId);
    
    if (responses.length === 0) return null;
    
    // Apply rules logic (simplified - you can expand this)
    for (const response of responses) {
      if (response.rules && response.rules.length > 0) {
        // Implement rule matching logic here
        const matchesRules = this.evaluateRules(response.rules, requestData);
        if (matchesRules) return response;
      }
    }
    
    // Return default response or first one
    const defaultResponse = responses.find(r => r.is_default) || responses[0];
    return defaultResponse;
  }

  static evaluateRules(rules, requestData) {
    // Simplified rule evaluation - expand based on your needs
    return rules.every(rule => {
      // Implement rule logic based on request data
      return true; // Placeholder
    });
  }

  static async create(responseData) {
    const { endpoint_id, name, status_code, body, headers, latency, file_path, body_type, rules, is_default, probability } = responseData;
    
    const result = await db.query(`
      INSERT INTO responses 
      (endpoint_id, name, status_code, body, headers, latency, file_path, body_type, rules, is_default, probability) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
      RETURNING *
    `, [endpoint_id, name, status_code, body, headers, latency, file_path, body_type, rules, is_default, probability]);
    
    return result.rows[0];
  }

  static async update(id, responseData) {
    const { name, status_code, body, headers, latency, file_path, body_type, rules, is_default, probability } = responseData;
    
    const result = await db.query(`
      UPDATE responses 
      SET name = $1, status_code = $2, body = $3, headers = $4, latency = $5, 
          file_path = $6, body_type = $7, rules = $8, is_default = $9, probability = $10,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $11 
      RETURNING *
    `, [name, status_code, body, headers, latency, file_path, body_type, rules, is_default, probability, id]);
    
    return result.rows[0];
  }

  static async delete(id) {
    const result = await db.query('DELETE FROM responses WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  }
}

module.exports = Response;
