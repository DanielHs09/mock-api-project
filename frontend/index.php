<?php
require_once 'config.php';

// Get stats for the dashboard
$info = MockoonDashboard::callAPI('/info');
$stats = $info['status'] === 200 ? $info['data']['counts'] : null;
$environments = MockoonDashboard::getEnvironments();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mock-API Dashboard - API Manager</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Mock API Dashboard</h1>
            <p>Manage your mock API endpoints for testing</p>
        </div>

        <div id="alertsContainer"></div>

        <?php if ($stats): ?>
        <div class="stats">
            <div class="stat-card">
                <div class="stat-number"><?php echo $stats['environments']; ?></div>
                <div class="stat-label">Environments</div>
            </div>
            <div class="stat-card">
                <div class="stat-number"><?php echo $stats['endpoints']; ?></div>
                <div class="stat-label">Endpoints</div>
            </div>
            <div class="stat-card">
                <div class="stat-number"><?php echo $stats['responses']; ?></div>
                <div class="stat-label">Responses</div>
            </div>
            <div class="stat-card">
                <div class="stat-number"><?php echo $stats['request_logs']; ?></div>
                <div class="stat-label">Request Logs</div>
            </div>
        </div>
        <?php endif; ?>

        <div class="dashboard">
            <!-- Sidebar -->
            <div class="sidebar">
                <div class="sidebar-section">
                    <h3>Quick Actions</h3>
                    <button class="btn btn-success" id="refreshAll">🔄 Refresh All</button>
                    <button class="btn btn-warning" id="testAllEndpoints">🧪 Test All Endpoints</button>
                </div>

                <div class="sidebar-section">
                    <h3>Create Endpoint</h3>
                    <form id="createEndpointForm">
                        <div class="form-group">
                            <label>Path:</label>
                            <input type="text" name="path" class="form-control" placeholder="/devices/switch_001/control" required>
                        </div>
                        <div class="form-group">
                            <label>Method:</label>
                            <select name="method" class="form-control" required>
                                <option value="GET">GET</option>
                                <option value="POST">POST</option>
                                <option value="PUT">PUT</option>
                                <option value="DELETE">DELETE</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Name:</label>
                            <input type="text" name="name" class="form-control" placeholder="Control Living Room Switch" required>
                        </div>
                        <div class="form-group">
                            <label>Status Code:</label>
                            <input type="number" name="status_code" class="form-control" value="200" required>
                        </div>
                        <button type="submit" class="btn btn-success">Create Endpoint</button>
                    </form>
                </div>

                <div class="sidebar-section">
                    <h3>Test Endpoint</h3>
                    <form id="testEndpointForm">
                        <div class="form-group">
                            <label>Path:</label>
                            <input type="text" name="test_path" class="form-control" placeholder="/devices" required>
                        </div>
                        <div class="form-group">
                            <label>Method:</label>
                            <select name="test_method" class="form-control" required>
                                <option value="GET">GET</option>
                                <option value="POST">POST</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Request Data (JSON):</label>
                            <textarea name="test_data" class="form-control json-editor" placeholder='{"action": "off"}'></textarea>
                        </div>
                        <button type="submit" class="btn btn-warning">Test Endpoint</button>
                    </form>
                </div>
            </div>

            <!-- Main Content -->
            <div class="main-content">
                <!-- Environments -->
                <div class="card">
                    <h2>📁 Environments</h2>
                    <div class="environment-list" id="environmentsList">
                        <?php if ($environments['status'] === 200 && !empty($environments['data'])): ?>
                            <?php foreach ($environments['data'] as $env): ?>
                                <div class="environment-item" onclick="dashboard.selectEnvironment(<?php echo $env['id']; ?>)">
                                    <h4><?php echo htmlspecialchars($env['name']); ?></h4>
                                    <p>Port: <?php echo $env['port']; ?> | Prefix: <?php echo $env['endpoint_prefix']; ?></p>
                                    <div class="action-buttons">
                                        <button class="btn btn-warning" onclick="event.stopPropagation(); dashboard.deleteEnvironment(<?php echo $env['id']; ?>)">Delete</button>
                                    </div>
                                </div>
                            <?php endforeach; ?>
                        <?php else: ?>
                            <p>No environments found</p>
                        <?php endif; ?>
                    </div>
                </div>

                <!-- Endpoints -->
                <div class="card">
                    <h2>🔌 Endpoints</h2>
                    <div class="endpoint-list" id="endpointsList">
                        Select an environment to view endpoints
                    </div>
                </div>

                <!-- Responses -->
                <div class="card" id="responsesSection" style="display: none;">
                    <h2>📄 Responses</h2>
                    <form id="createResponseForm">
                        <div class="form-group">
                            <label>Response Name:</label>
                            <input type="text" name="name" class="form-control" placeholder="Switch Control Response" required>
                        </div>
                        <div class="form-group">
                            <label>Status Code:</label>
                            <input type="number" name="status_code" class="form-control" value="200" required>
                        </div>
                        <div class="form-group">
                            <label>Response Body (JSON):</label>
                            <textarea name="body" class="form-control json-editor" placeholder='{"success": true, "device_id": "switch_001"}' required></textarea>
                        </div>
                        <button type="submit" class="btn btn-success">Create Response</button>
                    </form>
                    
                    <div class="response-list" id="responsesList" style="margin-top: 2rem;">
                    </div>
                </div>

                <!-- Test Results -->
                <div class="card">
                    <h2>🧪 Test Results</h2>
                    <div id="testResult">
                        Test an endpoint to see results here
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script src="script.js"></script>
</body>
</html>
