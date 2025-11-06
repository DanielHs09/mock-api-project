const express = require('express');
const router = express.Router();
const Environment = require('../models/Environment');
const Endpoint = require('../models/Endpoint');
const Response = require('../models/Response');
const DynamicRouter = require('../middleware/dynamicRouter');

// Helper function to log API requests
const logApiRequest = async (req, res, responseData, environmentId = null, endpointId = null) => {
  try {
    const db = require('../config/database');
    const startTime = Date.now();
    
    // Store the original send function
    const originalSend = res.send;
    
    // Override the send function to capture response data
    res.send = function(data) {
      // Restore original send function
      res.send = originalSend;
      
      // Call original send function
      const result = originalSend.call(this, data);
      
      // Log after response is sent
      const latency = Date.now() - startTime;
      
      // Extract response info
      const responseStatus = res.statusCode;
      const responseHeaders = res.getHeaders();
      let responseBody = data;
      
      // Ensure responseBody is a string for storage
      if (typeof responseBody !== 'string') {
        try {
          responseBody = JSON.stringify(responseBody);
        } catch (e) {
          responseBody = String(responseBody);
        }
      }
      
      // Log to database (don't await to avoid blocking response)
      db.query(`
        INSERT INTO request_logs 
        (environment_id, endpoint_id, method, path, request_headers, request_body, 
         response_status, response_headers, response_body, latency, ip_address, user_agent, log_type)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        environmentId, 
        endpointId, 
        req.method, 
        req.path, 
        req.headers, 
        JSON.stringify(req.body), 
        responseStatus, 
        responseHeaders, 
        responseBody, 
        latency, 
        req.ip, 
        req.get('User-Agent'),
        'api' // Mark as API request log
      ]).catch(err => {
        console.error('Failed to log API request:', err);
      });
      
      return result;
    };
    
  } catch (error) {
    console.error('Error setting up request logging:', error);
  }
};

// Apply logging middleware to all API routes EXCEPT mock routes
router.use('*', (req, res, next) => {
  // Skip logging for mock routes (they're already logged by DynamicRouter)
  if (req.path.startsWith('/mock/')) {
    return next();
  }
  logApiRequest(req, res, null, null, null);
  next();
});

// Environment routes
router.get('/environments', async (req, res) => {
  try {
    const environments = await Environment.findAll();
    res.json(environments);
  } catch (error) {
    console.error('Error fetching environments:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/environments/:id', async (req, res) => {
  try {
    const environment = await Environment.findById(req.params.id);
    if (!environment) {
      return res.status(404).json({ error: 'Environment not found' });
    }
    res.json(environment);
  } catch (error) {
    console.error('Error fetching environment:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/environments', async (req, res) => {
  try {
    const { name, port, endpoint_prefix, latency, cors_enabled, https_enabled, metadata } = req.body;
    
    if (!name || !port) {
      return res.status(400).json({ error: 'Name and port are required' });
    }

    const environment = await Environment.create({
      name,
      port,
      endpoint_prefix: endpoint_prefix || '',
      latency: latency || 0,
      cors_enabled: cors_enabled !== undefined ? cors_enabled : true,
      https_enabled: https_enabled || false,
      metadata: metadata || {}
    });
    
    res.status(201).json(environment);
  } catch (error) {
    console.error('Error creating environment:', error);
    if (error.code === '23505') { // Unique violation
      res.status(400).json({ error: 'Port already in use' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

router.put('/environments/:id', async (req, res) => {
  try {
    const environment = await Environment.update(req.params.id, req.body);
    if (!environment) {
      return res.status(404).json({ error: 'Environment not found' });
    }
    res.json(environment);
  } catch (error) {
    console.error('Error updating environment:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/environments/:id', async (req, res) => {
  try {
    const environment = await Environment.delete(req.params.id);
    if (!environment) {
      return res.status(404).json({ error: 'Environment not found' });
    }
    res.json({ message: 'Environment deleted successfully', environment });
  } catch (error) {
    console.error('Error deleting environment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint routes
router.get('/environments/:environmentId/endpoints', async (req, res) => {
  try {
    const endpoints = await Endpoint.findByEnvironment(req.params.environmentId);
    res.json(endpoints);
  } catch (error) {
    console.error('Error fetching endpoints:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/endpoints/:id', async (req, res) => {
  try {
    const endpoint = await Endpoint.findById(req.params.id);
    if (!endpoint) {
      return res.status(404).json({ error: 'Endpoint not found' });
    }
    res.json(endpoint);
  } catch (error) {
    console.error('Error fetching endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/environments/:environmentId/endpoints', async (req, res) => {
  try {
    const { path, method, name, description, status_code, response_headers, rules } = req.body;
    
    if (!path || !method) {
      return res.status(400).json({ error: 'Path and method are required' });
    }

    const endpointData = { 
      environment_id: req.params.environmentId,
      path,
      method: method.toUpperCase(),
      name: name || `${method} ${path}`,
      description: description || '',
      status_code: status_code || 200,
      response_headers: response_headers || { 'Content-Type': 'application/json' },
      rules: rules || []
    };
    
    const endpoint = await Endpoint.create(endpointData);
    res.status(201).json(endpoint);
  } catch (error) {
    console.error('Error creating endpoint:', error);
    if (error.code === '23505') { // Unique violation
      res.status(400).json({ error: 'Endpoint with this path and method already exists in this environment' });
    } else if (error.code === '23514') { // Check constraint violation
      res.status(400).json({ error: 'Invalid HTTP method' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

router.put('/endpoints/:id', async (req, res) => {
  try {
    const endpoint = await Endpoint.update(req.params.id, req.body);
    if (!endpoint) {
      return res.status(404).json({ error: 'Endpoint not found' });
    }
    res.json(endpoint);
  } catch (error) {
    console.error('Error updating endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/endpoints/:id', async (req, res) => {
  try {
    const endpoint = await Endpoint.delete(req.params.id);
    if (!endpoint) {
      return res.status(404).json({ error: 'Endpoint not found' });
    }
    res.json({ message: 'Endpoint deleted successfully', endpoint });
  } catch (error) {
    console.error('Error deleting endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// Response routes
router.get('/endpoints/:endpointId/responses', async (req, res) => {
  try {
    const responses = await Response.findByEndpoint(req.params.endpointId);
    res.json(responses);
  } catch (error) {
    console.error('Error fetching responses:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/responses/:id', async (req, res) => {
  try {
    const response = await Response.findById(req.params.id);
    if (!response) {
      return res.status(404).json({ error: 'Response not found' });
    }
    res.json(response);
  } catch (error) {
    console.error('Error fetching response:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/endpoints/:endpointId/responses', async (req, res) => {
  try {
    const { name, status_code, body, headers, latency, file_path, body_type, rules, is_default, probability } = req.body;
    
    if (!name || status_code === undefined) {
      return res.status(400).json({ error: 'Name and status_code are required' });
    }

    const responseData = {
      endpoint_id: req.params.endpointId,
      name,
      status_code: status_code || 200,
      body: body || '',
      headers: headers || {},
      latency: latency || 0,
      file_path: file_path || null,
      body_type: body_type || 'json',
      rules: rules || [],
      is_default: is_default || false,
      probability: probability || 100
    };
    
    const response = await Response.create(responseData);
    res.status(201).json(response);
  } catch (error) {
    console.error('Error creating response:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/responses/:id', async (req, res) => {
  try {
    const response = await Response.update(req.params.id, req.body);
    if (!response) {
      return res.status(404).json({ error: 'Response not found' });
    }
    res.json(response);
  } catch (error) {
    console.error('Error updating response:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/responses/:id', async (req, res) => {
  try {
    const response = await Response.delete(req.params.id);
    if (!response) {
      return res.status(404).json({ error: 'Response not found' });
    }
    res.json({ message: 'Response deleted successfully', response });
  } catch (error) {
    console.error('Error deleting response:', error);
    res.status(500).json({ error: error.message });
  }
});

// Request logs routes
router.get('/environments/:environmentId/logs', async (req, res) => {
  try {
    const db = require('../config/database');
    const { limit = 100, offset = 0 } = req.query;
    
    const result = await db.query(`
      SELECT * FROM request_logs 
      WHERE environment_id = $1 
      ORDER BY timestamp DESC 
      LIMIT $2 OFFSET $3
    `, [req.params.environmentId, parseInt(limit), parseInt(offset)]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/logs/:id', async (req, res) => {
  try {
    const db = require('../config/database');
    const result = await db.query('SELECT * FROM request_logs WHERE id = $1', [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Log not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching log:', error);
    res.status(500).json({ error: error.message });
  }
});

// Settings routes
router.get('/settings', async (req, res) => {
  try {
    const db = require('../config/database');
    const result = await db.query('SELECT * FROM settings ORDER BY key');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/settings/:key', async (req, res) => {
  try {
    const db = require('../config/database');
    const result = await db.query('SELECT * FROM settings WHERE key = $1', [req.params.key]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Setting not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching setting:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/settings', async (req, res) => {
  try {
    const { key, value, description } = req.body;
    
    if (!key || value === undefined) {
      return res.status(400).json({ error: 'Key and value are required' });
    }

    const db = require('../config/database');
    const result = await db.query(`
      INSERT INTO settings (key, value, description) 
      VALUES ($1, $2, $3) 
      ON CONFLICT (key) DO UPDATE SET 
        value = EXCLUDED.value, 
        description = EXCLUDED.description,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [key, value, description || '']);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating/updating setting:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check and info routes
router.get('/health', async (req, res) => {
  try {
    const db = require('../config/database');
    // Test database connection
    await db.query('SELECT 1');
    
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      database: 'Connected',
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      database: 'Disconnected',
      error: error.message
    });
  }
});

router.get('/info', async (req, res) => {
  try {
    const db = require('../config/database');
    
    // Get counts for dashboard
    const envCount = await db.query('SELECT COUNT(*) FROM environments WHERE is_active = true');
    const endpointCount = await db.query('SELECT COUNT(*) FROM endpoints WHERE is_active = true');
    const responseCount = await db.query('SELECT COUNT(*) FROM responses');
    const logCount = await db.query('SELECT COUNT(*) FROM request_logs');
    
    res.json({
      version: '1.0.0',
      counts: {
        environments: parseInt(envCount.rows[0].count),
        endpoints: parseInt(endpointCount.rows[0].count),
        responses: parseInt(responseCount.rows[0].count),
        request_logs: parseInt(logCount.rows[0].count)
      },
      server: {
        node_version: process.version,
        platform: process.platform,
        uptime: process.uptime()
      }
    });
  } catch (error) {
    console.error('Error fetching info:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test route to verify routing is working
router.get('/test-route/:environmentId/*', (req, res) => {
  res.json({
    message: 'Test route working',
    environmentId: req.params.environmentId,
    path: req.path,
    originalUrl: req.originalUrl,
    params: req.params,
    query: req.query
  });
});

// Dynamic mock API routing - This catches all methods for mock endpoints
// IMPORTANT: This must be the last route to avoid catching other routes
router.all('/mock/:environmentId/*', DynamicRouter.handleRequest);

// 404 handler for API routes
router.use('*', (req, res) => {
  res.status(404).json({
    error: 'API route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    available_routes: [
      'GET    /api/environments',
      'POST   /api/environments',
      'GET    /api/environments/:id',
      'PUT    /api/environments/:id',
      'DELETE /api/environments/:id',
      'GET    /api/environments/:id/endpoints',
      'POST   /api/environments/:id/endpoints',
      'GET    /api/endpoints/:id',
      'PUT    /api/endpoints/:id',
      'DELETE /api/endpoints/:id',
      'GET    /api/endpoints/:id/responses',
      'POST   /api/endpoints/:id/responses',
      'GET    /api/responses/:id',
      'PUT    /api/responses/:id',
      'DELETE /api/responses/:id',
      'GET    /api/environments/:id/logs',
      'GET    /api/logs/:id',
      'GET    /api/settings',
      'POST   /api/settings',
      'GET    /api/health',
      'GET    /api/info',
      'ALL    /api/mock/:environmentId/*'
    ]
  });
});

module.exports = router;
