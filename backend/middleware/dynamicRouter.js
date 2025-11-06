const express = require('express');
const db = require('../config/database');
const Endpoint = require('../models/Endpoint');
const Response = require('../models/Response');

class DynamicRouter {
  static async handleRequest(req, res) {
    const startTime = Date.now();
    let environmentId = req.params.environmentId;
    
    try {
      // Extract the actual path from the wildcard parameter
      const fullPath = req.params[0];
      const path = fullPath ? `/${fullPath}` : '/';
      
      // Find the endpoint configuration
      const endpoint = await Endpoint.findByPathAndMethod(environmentId, path, req.method);
      
      if (!endpoint) {
        const latency = Date.now() - startTime;
        
        // Log the 404 request
        await db.query(`
          INSERT INTO request_logs 
          (environment_id, endpoint_id, method, path, request_headers, request_body, 
           response_status, response_headers, response_body, latency, ip_address, user_agent, log_type)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `, [
          environmentId, 
          null, 
          req.method, 
          path, 
          req.headers, 
          JSON.stringify(req.body), 
          404, 
          { 'Content-Type': 'application/json' }, 
          JSON.stringify({ error: 'Endpoint not found' }), 
          latency, 
          req.ip, 
          req.get('User-Agent'),
          'mock' // Mark as mock request log
        ]);
        
        return res.status(404).json({ error: 'Endpoint not found' });
      }
      
      // Find appropriate response - FIXED: Use findByEndpoint instead of selectResponse
      const responses = await Response.findByEndpoint(endpoint.id);
      
      if (!responses || responses.length === 0) {
        const latency = Date.now() - startTime;
        
        // Log the 404 response
        await db.query(`
          INSERT INTO request_logs 
          (environment_id, endpoint_id, method, path, request_headers, request_body, 
           response_status, response_headers, response_body, latency, ip_address, user_agent, log_type)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `, [
          environmentId, 
          endpoint.id, 
          req.method, 
          path, 
          req.headers, 
          JSON.stringify(req.body), 
          404, 
          { 'Content-Type': 'application/json' }, 
          JSON.stringify({ error: 'No response configuration found' }), 
          latency, 
          req.ip, 
          req.get('User-Agent'),
          'mock' // Mark as mock request log
        ]);
        
        return res.status(404).json({ error: 'No response configuration found' });
      }
      
      // Select a response (simple implementation - use first response or add probability logic later)
      const responseConfig = responses[0]; // Simple: use first response
      
      // Apply latency if configured
      if (responseConfig.latency > 0) {
        await new Promise(resolve => setTimeout(resolve, responseConfig.latency));
      }
      
      const totalLatency = Date.now() - startTime;
      
      // Set response headers
      const responseHeaders = {
        'Content-Type': 'application/json',
        ...responseConfig.headers
      };
      
      Object.entries(responseHeaders).forEach(([key, value]) => {
        res.set(key, value);
      });
      
      // Prepare response body
      let responseBody = responseConfig.body;
      if (responseConfig.body_type === 'json' && typeof responseBody === 'string') {
        try {
          responseBody = JSON.parse(responseBody);
        } catch (e) {
          // Keep as string if not valid JSON
        }
      }
      
      // Send response
      res.status(responseConfig.status_code).send(responseBody);
      
      // Log the successful request after sending response
      await db.query(`
        INSERT INTO request_logs 
        (environment_id, endpoint_id, method, path, request_headers, request_body, 
         response_status, response_headers, response_body, latency, ip_address, user_agent, log_type)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        environmentId, 
        endpoint.id, 
        req.method, 
        path, 
        req.headers, 
        JSON.stringify(req.body), 
        responseConfig.status_code, 
        responseHeaders, 
        typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody), 
        totalLatency, 
        req.ip, 
        req.get('User-Agent'),
        'mock' // Mark as mock request log
      ]);
      
    } catch (error) {
      console.error('Error handling mock request:', error);
      const latency = Date.now() - startTime;
      
      // Log the error
      await db.query(`
        INSERT INTO request_logs 
        (environment_id, endpoint_id, method, path, request_headers, request_body, 
         response_status, response_headers, response_body, latency, ip_address, user_agent, log_type)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        environmentId, 
        null, 
        req.method, 
        req.path, 
        req.headers, 
        JSON.stringify(req.body), 
        500, 
        { 'Content-Type': 'application/json' }, 
        JSON.stringify({ error: 'Internal server error' }), 
        latency, 
        req.ip, 
        req.get('User-Agent'),
        'mock' // Mark as mock request log
      ]);
      
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = DynamicRouter;
