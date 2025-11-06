const { pool } = require('../config/database');
require('dotenv').config();

const cleanInit = async () => {
  try {
    console.log('🧹 Creating completely clean database...');

    // Drop and recreate tables
    await pool.query('DROP TABLE IF EXISTS request_logs, responses, endpoints, environments, settings CASCADE;');

    // Recreate tables with NO sample data
    await pool.query(`
      CREATE TABLE environments (
        id SERIAL PRIMARY KEY,
        uuid UUID DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        port INTEGER UNIQUE,
        endpoint_prefix VARCHAR(100) DEFAULT '',
        latency INTEGER DEFAULT 0,
        cors_enabled BOOLEAN DEFAULT true,
        https_enabled BOOLEAN DEFAULT false,
        tls_cert_path TEXT,
        tls_key_path TEXT,
        metadata JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE endpoints (
        id SERIAL PRIMARY KEY,
        uuid UUID DEFAULT gen_random_uuid(),
        environment_id INTEGER REFERENCES environments(id) ON DELETE CASCADE,
        path VARCHAR(500) NOT NULL,
        method VARCHAR(10) NOT NULL CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD')),
        name VARCHAR(255),
        description TEXT,
        status_code INTEGER DEFAULT 200,
        response_headers JSONB DEFAULT '{"Content-Type": "application/json"}',
        is_active BOOLEAN DEFAULT true,
        order_index INTEGER DEFAULT 0,
        rules JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(environment_id, path, method)
      )
    `);

    await pool.query(`
      CREATE TABLE responses (
        id SERIAL PRIMARY KEY,
        uuid UUID DEFAULT gen_random_uuid(),
        endpoint_id INTEGER REFERENCES endpoints(id) ON DELETE CASCADE,
        name VARCHAR(255),
        status_code INTEGER DEFAULT 200,
        body TEXT,
        headers JSONB DEFAULT '{}',
        latency INTEGER DEFAULT 0,
        file_path TEXT,
        body_type VARCHAR(20) DEFAULT 'json' CHECK (body_type IN ('json', 'text', 'xml', 'html', 'binary')),
        rules JSONB DEFAULT '[]',
        is_default BOOLEAN DEFAULT false,
        probability INTEGER DEFAULT 100,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE request_logs (
        id SERIAL PRIMARY KEY,
        environment_id INTEGER REFERENCES environments(id) ON DELETE CASCADE,
        endpoint_id INTEGER REFERENCES endpoints(id) ON DELETE SET NULL,
        method VARCHAR(10),
        path VARCHAR(500),
        request_headers JSONB,
        request_body TEXT,
        request_query JSONB,
        request_params JSONB,
        response_status INTEGER,
        response_headers JSONB,
        response_body TEXT,
        latency INTEGER,
        ip_address INET,
        user_agent TEXT,
        log_type VARCHAR(20) DEFAULT 'mock',  -- **NEW COLUMN ADDED HERE**
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE settings (
        id SERIAL PRIMARY KEY,
        key VARCHAR(255) UNIQUE NOT NULL,
        value JSONB,
        description TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_endpoints_environment ON endpoints(environment_id);
      CREATE INDEX IF NOT EXISTS idx_endpoints_path_method ON endpoints(path, method);
      CREATE INDEX IF NOT EXISTS idx_responses_endpoint ON responses(endpoint_id);
      CREATE INDEX IF NOT EXISTS idx_request_logs_timestamp ON request_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_request_logs_environment ON request_logs(environment_id);
    `);

    // Create ONE clean environment with NO sample endpoints
    await pool.query(`
      INSERT INTO environments (name, port, endpoint_prefix) 
      VALUES ('Production Environment', 3000, 'api')
    `);

    console.log('✅ Completely clean database ready! Zero fake data inserted.');
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

cleanInit();
