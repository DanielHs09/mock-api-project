<?php
class MockoonDashboard {
    const API_BASE_URL = 'http://localhost:3000/api';
    
    // Database connection for complex queries
    private static function getDB() {
        static $db = null;
        if ($db === null) {
            $host = getenv('PG_HOST') ?: 'localhost';
            $dbname = getenv('PG_DATABASE') ?: 'zone_controller_db';
            $user = getenv('PG_USER') ?: 'zone_api_user';
            $password = getenv('PG_PASSWORD') ?: '12345';
            $port = getenv('PG_PORT') ?: 5432;
            
            try {
                $db = new PDO(
                    "pgsql:host=$host;port=$port;dbname=$dbname",
                    $user,
                    $password
                );
                $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            } catch (PDOException $e) {
                error_log("Database connection failed: " . $e->getMessage());
                return null;
            }
        }
        return $db;
    }
    
    // For basic CRUD operations, use the API
    public static function callAPI($endpoint, $method = 'GET', $data = null) {
        $url = self::API_BASE_URL . $endpoint;
        $ch = curl_init();
        
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        
        if ($data) {
            $jsonData = json_encode($data);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $jsonData);
            curl_setopt($ch, CURLOPT_HTTPHEADER, array(
                'Content-Type: application/json',
                'Content-Length: ' . strlen($jsonData)
            ));
        } else {
            curl_setopt($ch, CURLOPT_HTTPHEADER, array(
                'Content-Type: application/json'
            ));
        }
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        return array(
            'status' => $httpCode,
            'data' => json_decode($response, true)
        );
    }
    
    // Use API for basic operations
    public static function getEnvironments() {
        return self::callAPI('/environments');
    }
    
    public static function getEndpoints($environmentId) {
        return self::callAPI("/environments/$environmentId/endpoints");
    }
    
    public static function getResponses($endpointId) {
        return self::callAPI("/endpoints/$endpointId/responses");
    }
    
    // Use direct DB for complex analytics (better performance)
    public static function getRecentLogs($environmentId = 1, $limit = 100) {
        $db = self::getDB();
        if (!$db) {
            return array('status' => 500, 'data' => array());
        }
        
        try {
            $stmt = $db->prepare("
                SELECT * FROM request_logs 
                WHERE environment_id = ? 
                ORDER BY timestamp DESC 
                LIMIT ?
            ");
            $stmt->execute(array($environmentId, $limit));
            $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            return array(
                'status' => 200,
                'data' => $logs
            );
        } catch (PDOException $e) {
            error_log("Database error in getRecentLogs: " . $e->getMessage());
            return array('status' => 500, 'data' => array());
        }
    }
    
    public static function getEndpointHealth($endpointId) {
        $db = self::getDB();
        if (!$db) {
            return array('health' => 'unknown', 'response_time' => 0, 'error_rate' => 0, 'total_requests' => 0);
        }
        
        try {
            $stmt = $db->prepare("
                SELECT response_status, latency, timestamp 
                FROM request_logs 
                WHERE endpoint_id = ? 
                ORDER BY timestamp DESC 
                LIMIT 50
            ");
            $stmt->execute(array($endpointId));
            $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            return self::calculateHealthMetrics($logs);
        } catch (PDOException $e) {
            error_log("Database error in getEndpointHealth: " . $e->getMessage());
            return array('health' => 'unknown', 'response_time' => 0, 'error_rate' => 0, 'total_requests' => 0);
        }
    }
    
    public static function getSystemStats() {
        $db = self::getDB();
        if (!$db) {
            return array(
                'total_requests' => 0,
                'error_count' => 0,
                'error_rate' => 0,
                'active_endpoints' => 0,
                'used_endpoints' => 0,
                'requests_per_minute' => 0
            );
        }
        
        try {
            // Total requests
            $stmt = $db->query("SELECT COUNT(*) as total FROM request_logs");
            $totalRequests = $stmt->fetchColumn();
            
            // Error count
            $stmt = $db->query("SELECT COUNT(*) as errors FROM request_logs WHERE response_status >= 400");
            $errorCount = $stmt->fetchColumn();
            
            // Active endpoints from logs
            $stmt = $db->query("SELECT COUNT(DISTINCT endpoint_id) as active FROM request_logs WHERE endpoint_id IS NOT NULL");
            $usedEndpoints = $stmt->fetchColumn();
            
            // All endpoints from API
            $endpointsResult = self::getEndpoints(1);
            $activeEndpoints = ($endpointsResult['status'] === 200 && isset($endpointsResult['data'])) ? count($endpointsResult['data']) : 0;
            
            // Requests per minute
            $stmt = $db->query("
                SELECT COUNT(*) as count 
                FROM request_logs 
                WHERE timestamp >= NOW() - INTERVAL '1 minute'
            ");
            $rpm = $stmt->fetchColumn();
            
            $errorRate = $totalRequests > 0 ? round(($errorCount / $totalRequests) * 100, 1) : 0;
            
            return array(
                'total_requests' => $totalRequests,
                'error_count' => $errorCount,
                'error_rate' => $errorRate,
                'active_endpoints' => $activeEndpoints,
                'used_endpoints' => $usedEndpoints,
                'requests_per_minute' => $rpm
            );
        } catch (PDOException $e) {
            error_log("Database error in getSystemStats: " . $e->getMessage());
            return array(
                'total_requests' => 0,
                'error_count' => 0,
                'error_rate' => 0,
                'active_endpoints' => 0,
                'used_endpoints' => 0,
                'requests_per_minute' => 0
            );
        }
    }
    
    private static function calculateHealthMetrics($logs) {
        if (empty($logs)) {
            return array('health' => 'unknown', 'response_time' => 0, 'error_rate' => 0, 'total_requests' => 0);
        }
        
        $totalRequests = count($logs);
        $errorCount = 0;
        $totalResponseTime = 0;
        $validResponseTimes = 0;
        
        foreach ($logs as $log) {
            if ($log['response_status'] >= 400) {
                $errorCount++;
            }
            if (isset($log['latency']) && $log['latency'] > 0) {
                $totalResponseTime += $log['latency'];
                $validResponseTimes++;
            }
        }
        
        $errorRate = $totalRequests > 0 ? ($errorCount / $totalRequests) * 100 : 0;
        $avgResponseTime = $validResponseTimes > 0 ? $totalResponseTime / $validResponseTimes : 0;
        
        // Determine health status
        if ($errorRate > 20) {
            $health = 'error';
        } else if ($errorRate > 5) {
            $health = 'degraded';
        } else {
            $health = 'healthy';
        }
        
        return array(
            'health' => $health,
            'response_time' => round($avgResponseTime),
            'error_rate' => round($errorRate, 1),
            'total_requests' => $totalRequests,
            'last_activity' => !empty($logs) ? $logs[0]['timestamp'] : null
        );
    }
    
    // Keep the existing API methods for CRUD operations
    public static function createEndpoint($environmentId, $data) {
        return self::callAPI("/environments/$environmentId/endpoints", 'POST', $data);
    }
    
    public static function createResponse($endpointId, $data) {
        return self::callAPI("/endpoints/$endpointId/responses", 'POST', $data);
    }
    
    public static function deleteEndpoint($endpointId) {
        return self::callAPI("/endpoints/$endpointId", 'DELETE');
    }
    
    public static function deleteResponse($responseId) {
        return self::callAPI("/responses/$responseId", 'DELETE');
    }
    
    public static function testEndpoint($environmentId, $path, $method = 'GET', $data = null) {
        $url = self::API_BASE_URL . "/mock/$environmentId$path";
        $ch = curl_init();
        
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        
        if ($data && in_array($method, array('POST', 'PUT', 'PATCH'))) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
            curl_setopt($ch, CURLOPT_HTTPHEADER, array(
                'Content-Type: application/json'
            ));
        }
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        return array(
            'status' => $httpCode,
            'data' => json_decode($response, true) ?: $response
        );
    }
}
?>
