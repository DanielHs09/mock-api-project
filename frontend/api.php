<?php
require_once 'config.php';

// Set headers
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

function sendJSON($data, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode($data);
    exit;
}

try {
    $method = $_SERVER['REQUEST_METHOD'];
    $action = $_GET['action'] ?? '';
    
    if ($method === 'GET') {
        switch ($action) {
            case 'get_environments':
                $result = MockoonDashboard::getEnvironments();
                sendJSON([
                    'success' => $result['status'] === 200, 
                    'environments' => $result['data'] ?? []
                ]);
                break;
                
            case 'get_endpoints':
                $environmentId = $_GET['environment_id'] ?? '';
                if (!$environmentId) {
                    sendJSON(['success' => false, 'error' => 'environment_id required'], 400);
                }
                $result = MockoonDashboard::getEndpoints($environmentId);
                sendJSON([
                    'success' => $result['status'] === 200,
                    'endpoints' => $result['data'] ?? []
                ]);
                break;
                
            case 'get_responses':
                $endpointId = $_GET['endpoint_id'] ?? '';
                if (!$endpointId) {
                    sendJSON(['success' => false, 'error' => 'endpoint_id required'], 400);
                }
                $result = MockoonDashboard::getResponses($endpointId);
                sendJSON([
                    'success' => $result['status'] === 200,
                    'responses' => $result['data'] ?? []
                ]);
                break;

            case 'get_endpoint_health':
                $endpointId = $_GET['endpoint_id'] ?? '';
                if (!$endpointId) {
                    sendJSON(['success' => false, 'error' => 'endpoint_id required'], 400);
                }
                $health = MockoonDashboard::getEndpointHealth($endpointId);
                sendJSON([
                    'success' => true,
                    'health' => $health
                ]);
                break;

            case 'get_recent_logs':
                $environmentId = $_GET['environment_id'] ?? 1;
                $limit = $_GET['limit'] ?? 50;
                $result = MockoonDashboard::getRecentLogs($environmentId, $limit);
                sendJSON([
                    'success' => $result['status'] === 200,
                    'logs' => $result['data'] ?? []
                ]);
                break;

            // NEW ANALYTICS ENDPOINT
            case 'get_analytics':
                $analyticsData = MockoonDashboard::getAnalyticsData();
                if (isset($analyticsData['error'])) {
                    sendJSON(['success' => false, 'error' => $analyticsData['error']], 500);
                } else {
                    sendJSON(['success' => true, 'data' => $analyticsData]);
                }
                break;
                
            default:
                sendJSON(['error' => 'Invalid action'], 400);
        }
    }
    
    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        
        switch ($action) {
            case 'create_endpoint':
                $environmentId = $_GET['environment_id'] ?? '';
                if (!$environmentId) {
                    sendJSON(['success' => false, 'error' => 'environment_id required'], 400);
                }
                $result = MockoonDashboard::createEndpoint($environmentId, $input);
                sendJSON([
                    'success' => $result['status'] === 201,
                    'data' => $result['data'] ?? [],
                    'error' => $result['status'] !== 201 ? ($result['data']['error'] ?? 'Unknown error') : null
                ]);
                break;
                
            case 'create_response':
                $endpointId = $_GET['endpoint_id'] ?? '';
                if (!$endpointId) {
                    sendJSON(['success' => false, 'error' => 'endpoint_id required'], 400);
                }
                $result = MockoonDashboard::createResponse($endpointId, $input);
                sendJSON([
                    'success' => $result['status'] === 201,
                    'data' => $result['data'] ?? [],
                    'error' => $result['status'] !== 201 ? ($result['data']['error'] ?? 'Unknown error') : null
                ]);
                break;
                
            case 'test_endpoint':
                $environmentId = $input['environment_id'] ?? '';
                $path = $input['path'] ?? '';
                $method = $input['method'] ?? 'GET';
                
                if (!$environmentId || !$path) {
                    sendJSON(['success' => false, 'error' => 'environment_id and path required'], 400);
                }
                
                $result = MockoonDashboard::testEndpoint(
                    $environmentId,
                    $path,
                    $method,
                    $input['data'] ?? null
                );
                sendJSON($result);
                break;
                
            default:
                sendJSON(['error' => 'Invalid action'], 400);
        }
    }
    
    if ($method === 'DELETE') {
        switch ($action) {
            case 'delete_endpoint':
                $endpointId = $_GET['endpoint_id'] ?? '';
                if (!$endpointId) {
                    sendJSON(['success' => false, 'error' => 'endpoint_id required'], 400);
                }
                $result = MockoonDashboard::deleteEndpoint($endpointId);
                sendJSON([
                    'success' => $result['status'] === 200,
                    'data' => $result['data'] ?? []
                ]);
                break;
                
            case 'delete_response':
                $responseId = $_GET['response_id'] ?? '';
                if (!$responseId) {
                    sendJSON(['success' => false, 'error' => 'response_id required'], 400);
                }
                $result = MockoonDashboard::deleteResponse($responseId);
                sendJSON([
                    'success' => $result['status'] === 200,
                    'data' => $result['data'] ?? []
                ]);
                break;
                
            default:
                sendJSON(['error' => 'Invalid action'], 400);
        }
    }
    
    sendJSON(['error' => 'Method not allowed'], 405);
    
} catch (Exception $e) {
    error_log("API Error: " . $e->getMessage());
    sendJSON(['error' => 'Server error: ' . $e->getMessage()], 500);
}
?>
