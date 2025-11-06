<?php
class AnalyticsDashboard {
    const API_BASE_URL = 'http://localhost:3000/api';
    
    // Database connection for analytics only
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
                error_log("Analytics Database connection failed: " . $e->getMessage());
                return null;
            }
        }
        return $db;
    }
    
    // Get all analytics data
    public static function getAnalyticsData() {
        $db = self::getDB();
        if (!$db) {
            return ['error' => 'Database connection failed'];
        }

        try {
            // Total requests
            $stmt = $db->query("SELECT COUNT(*) as total FROM request_logs");
            $total_requests = (int)$stmt->fetchColumn();

            // If no data, return empty structure
            if ($total_requests === 0) {
                return [
                    'total_requests' => 0,
                    'error_count' => 0,
                    'success_count' => 0,
                    'error_rate' => 0,
                    'success_rate' => 0,
                    'methods' => [],
                    'status_codes' => [],
                    'endpoint_usage' => [],
                    'hourly_usage' => [],
                    'daily_timeline' => [],
                    'error_endpoints' => [],
                    'performance' => [
                        'avg_latency' => 0,
                        'max_latency' => 0,
                        'min_latency' => 0,
                        'p95_latency' => 0
                    ]
                ];
            }

            // Error count
            $stmt = $db->query("SELECT COUNT(*) as errors FROM request_logs WHERE response_status >= 400");
            $error_count = (int)$stmt->fetchColumn();
            $success_count = $total_requests - $error_count;

            // Methods distribution
            $stmt = $db->query("
                SELECT method, COUNT(*) as count 
                FROM request_logs 
                WHERE method IS NOT NULL
                GROUP BY method 
                ORDER BY count DESC
            ");
            $methods = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Status codes
            $stmt = $db->query("
                SELECT response_status, COUNT(*) as count 
                FROM request_logs 
                WHERE response_status IS NOT NULL
                GROUP BY response_status 
                ORDER BY response_status
            ");
            $status_codes = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Endpoint usage with names
            $stmt = $db->query("
                SELECT 
                    rl.path,
                    COALESCE(e.name, rl.path) as endpoint_name,
                    COUNT(*) as request_count
                FROM request_logs rl
                LEFT JOIN endpoints e ON rl.endpoint_id = e.id
                WHERE rl.path IS NOT NULL
                GROUP BY rl.path, e.name
                ORDER BY request_count DESC
                LIMIT 15
            ");
            $endpoint_usage = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Hourly usage
            $stmt = $db->query("
                SELECT 
                    TO_CHAR(timestamp, 'HH24:00') as hour,
                    COUNT(*) as request_count
                FROM request_logs 
                WHERE timestamp IS NOT NULL
                GROUP BY TO_CHAR(timestamp, 'HH24:00')
                ORDER BY hour
            ");
            $hourly_usage = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Daily timeline (last 30 days)
            $stmt = $db->query("
                SELECT 
                    DATE(timestamp) as date,
                    COUNT(*) as daily_requests
                FROM request_logs 
                WHERE timestamp >= CURRENT_DATE - INTERVAL '30 days'
                GROUP BY DATE(timestamp)
                ORDER BY date DESC
                LIMIT 30
            ");
            $daily_timeline = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Error endpoints
            $stmt = $db->query("
                SELECT 
                    rl.path,
                    COALESCE(e.name, rl.path) as endpoint_name,
                    COUNT(*) as error_count
                FROM request_logs rl
                LEFT JOIN endpoints e ON rl.endpoint_id = e.id
                WHERE rl.response_status >= 400
                GROUP BY rl.path, e.name
                ORDER BY error_count DESC
                LIMIT 10
            ");
            $error_endpoints = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Performance metrics
            $stmt = $db->query("
                SELECT 
                    COALESCE(AVG(latency), 0) as avg_latency,
                    COALESCE(MAX(latency), 0) as max_latency,
                    COALESCE(MIN(latency), 0) as min_latency,
                    COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency), 0) as p95_latency
                FROM request_logs 
                WHERE latency > 0
            ");
            $performance = $stmt->fetch(PDO::FETCH_ASSOC);

            return [
                'total_requests' => $total_requests,
                'error_count' => $error_count,
                'success_count' => $success_count,
                'error_rate' => round(($error_count / $total_requests) * 100, 1),
                'success_rate' => round(($success_count / $total_requests) * 100, 1),
                'methods' => $methods,
                'status_codes' => $status_codes,
                'endpoint_usage' => $endpoint_usage,
                'hourly_usage' => $hourly_usage,
                'daily_timeline' => $daily_timeline,
                'error_endpoints' => $error_endpoints,
                'performance' => $performance,
                'data_freshness' => date('Y-m-d H:i:s')
            ];

        } catch (PDOException $e) {
            error_log("Analytics database error: " . $e->getMessage());
            return ['error' => 'Database query failed: ' . $e->getMessage()];
        }
    }
}
?>
