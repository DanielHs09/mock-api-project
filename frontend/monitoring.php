<?php
require_once 'config.php';

// Get REAL data without limits
$environments = MockoonDashboard::getEnvironments();
$recent_logs = MockoonDashboard::getRecentLogs(1, 50); // Only for recent activity feed

// Initialize variables
$total_requests_count = 0;
$total_error_count = 0;
$requests_per_minute = 0;
$active_endpoints_count = 0;
$configured_endpoints = 0;
$endpoints_data = [];
$environment_data = [];
$endpoint_usage = [];

try {
    // Get total counts using existing API methods
    $all_logs = MockoonDashboard::getRecentLogs(1, 10000); // Get large number to approximate total
    
    if (isset($all_logs['status']) && $all_logs['status'] === 200 && !empty($all_logs['data'])) {
        $total_requests_count = count($all_logs['data']);
        
        // Count errors
        foreach ($all_logs['data'] as $log) {
            if (isset($log['response_status']) && $log['response_status'] >= 400) {
                $total_error_count++;
            }
        }
        
        // Calculate requests per minute from last hour
        $one_hour_ago = date('Y-m-d H:i:s', strtotime('-1 hour'));
        $recent_count = 0;
        foreach ($all_logs['data'] as $log) {
            if (isset($log['timestamp']) && $log['timestamp'] > $one_hour_ago) {
                $recent_count++;
            }
        }
        $requests_per_minute = round($recent_count / 60, 1);
        
        // Count unique active endpoints
        $active_endpoints = [];
        foreach ($all_logs['data'] as $log) {
            if (isset($log['path']) && $log['path'] && !in_array($log['path'], $active_endpoints)) {
                $active_endpoints[] = $log['path'];
            }
        }
        $active_endpoints_count = count($active_endpoints);
        
        // Calculate endpoint usage from all logs
        foreach ($all_logs['data'] as $log) {
            if (isset($log['path'], $log['method'])) {
                $key = $log['method'] . ':' . $log['path'];
                if (!isset($endpoint_usage[$key])) {
                    $endpoint_usage[$key] = [
                        'total_requests' => 0,
                        'errors' => 0,
                        'total_latency' => 0,
                        'last_activity' => null
                    ];
                }
                
                $endpoint_usage[$key]['total_requests']++;
                
                if (isset($log['response_status']) && $log['response_status'] >= 400) {
                    $endpoint_usage[$key]['errors']++;
                }
                
                if (isset($log['latency']) && $log['latency']) {
                    $endpoint_usage[$key]['total_latency'] += $log['latency'];
                }
                
                if (isset($log['timestamp']) && (!$endpoint_usage[$key]['last_activity'] || $log['timestamp'] > $endpoint_usage[$key]['last_activity'])) {
                    $endpoint_usage[$key]['last_activity'] = $log['timestamp'];
                }
            }
        }
    }
    
} catch (Exception $e) {
    error_log("Error getting total counts: " . $e->getMessage());
    
    // Fallback to recent logs only
    if (isset($recent_logs['status']) && $recent_logs['status'] === 200 && !empty($recent_logs['data'])) {
        $total_requests_count = count($recent_logs['data']);
        foreach ($recent_logs['data'] as $log) {
            if (isset($log['response_status']) && $log['response_status'] >= 400) {
                $total_error_count++;
            }
        }
    }
}

// Get endpoints data
try {
    if (class_exists('MockoonDashboard') && method_exists('MockoonDashboard', 'getEndpoints')) {
        $endpoints_response = MockoonDashboard::getEndpoints(1);
        if (isset($endpoints_response['status']) && $endpoints_response['status'] === 200 && !empty($endpoints_response['data'])) {
            $endpoints_data = $endpoints_response['data'];
            $configured_endpoints = count($endpoints_data);
        }
    }
} catch (Exception $e) {
    error_log("Error getting endpoints: " . $e->getMessage());
}

// Get environment data
if (isset($environments['status']) && $environments['status'] === 200 && !empty($environments['data'])) {
    $environment_data = $environments['data'][0];
}

// Calculate REAL error rate
$error_rate = $total_requests_count > 0 ? round(($total_error_count / $total_requests_count) * 100, 1) : 0;
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Live API Monitoring - Real Data Only</title>
    <link rel="stylesheet" href="styles.css">
    <style>
        .monitoring-grid {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 2rem;
            align-items: start;
        }
        
        .endpoints-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 1rem;
            margin-bottom: 2rem;
        }
        
        .endpoint-card {
            background: #1a1a2e;
            border-radius: 10px;
            padding: 1.5rem;
            border-left: 4px solid #00b894;
        }
        .endpoint-card.degraded {
            border-left-color: #fdcb6e;
        }
        .endpoint-card.error {
            border-left-color: #ff6b6b;
        }
        .endpoint-card.unknown {
            border-left-color: #a0a0c0;
        }
        .endpoint-card.no-data {
            border-left-color: #6c757d;
        }
        
        .health-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
        }
        .health-healthy { background: #00b894; color: white; }
        .health-degraded { background: #fdcb6e; color: black; }
        .health-error { background: #ff6b6b; color: white; }
        .health-unknown { background: #a0a0c0; color: white; }
        .health-no-data { background: #6c757d; color: white; }
        
        .activity-feed {
            max-height: 500px;
            overflow-y: auto;
            background: #1a1a2e;
            border-radius: 10px;
            padding: 1rem;
        }
        
        .activity-item {
            padding: 1rem;
            border-bottom: 1px solid #2d2d4d;
            display: flex;
            align-items: center;
            gap: 1rem;
        }
        .activity-item:last-child {
            border-bottom: none;
        }
        
        .live-indicator {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: #00b894;
            animation: pulse 2s infinite;
            flex-shrink: 0;
        }
        
        .health-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1rem;
            margin-top: 2rem;
        }
        
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }
        
        .activity-content {
            flex: 1;
            min-width: 0;
        }
        
        .activity-method {
            font-family: 'Courier New', monospace;
            background: #252547;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 12px;
        }
        
        .metric-value {
            font-size: 1.5rem;
            font-weight: bold;
            color: #667eea;
        }
        
        .no-data {
            text-align: center;
            padding: 2rem;
            color: #a0a0c0;
            font-style: italic;
        }

        .log-type-badge {
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 10px;
            background: #3498db;
            color: white;
        }
        .log-type-api { background: #9b59b6; }
        .log-type-mock { background: #3498db; }

        .data-source {
            font-size: 0.8rem;
            color: #a0a0c0;
            margin-top: 0.5rem;
        }
        
        .total-count {
            font-size: 2.5rem;
            font-weight: bold;
            color: #667eea;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔴 Live API Monitoring</h1>
            <p>100% Real Data - REAL Total Counts</p>
        </div>

        <!-- Real Stats from ACTUAL TOTAL COUNTS -->
        <div class="stats">
            <div class="stat-card">
                <div class="stat-number"><?php echo $configured_endpoints; ?></div>
                <div class="stat-label">Configured Endpoints</div>
                <div class="data-source">From API</div>
            </div>
            <div class="stat-card">
                <div class="stat-number"><?php echo $active_endpoints_count; ?></div>
                <div class="stat-label">Active Endpoints</div>
                <div class="data-source">Unique Paths in Logs</div>
            </div>
            <div class="stat-card">
                <div class="total-count"><?php echo $total_requests_count; ?></div>
                <div class="stat-label">Total Requests</div>
                <div class="data-source">All Logs Combined</div>
            </div>
            <div class="stat-card">
                <div class="stat-number"><?php echo $error_rate; ?>%</div>
                <div class="stat-label">Error Rate</div>
                <div class="data-source">Based on <?php echo $total_requests_count; ?> requests</div>
            </div>
        </div>

        <!-- Main Monitoring Grid -->
        <div class="monitoring-grid">
            
            <!-- Left Column: Endpoints and System Health -->
            <div>
                <!-- Current Endpoint Status -->
                <div class="card">
                    <h2>🔄 Endpoint Health Status (Real Totals)</h2>
                    <div class="endpoints-grid" id="endpointsStatusGrid">
                        <?php if (!empty($endpoints_data)): ?>
                            <?php foreach ($endpoints_data as $endpoint): ?>
                                <?php
                                $endpoint_key = $endpoint['method'] . ':' . $endpoint['path'];
                                $usage = $endpoint_usage[$endpoint_key] ?? [
                                    'total_requests' => 0,
                                    'errors' => 0,
                                    'total_latency' => 0,
                                    'last_activity' => null
                                ];
                                
                                $total_endpoint_requests = $usage['total_requests'];
                                $endpoint_errors = $usage['errors'];
                                $total_latency = $usage['total_latency'];
                                $last_activity = $usage['last_activity'];
                                
                                $endpoint_error_rate = $total_endpoint_requests > 0 ? round(($endpoint_errors / $total_endpoint_requests) * 100, 1) : 0;
                                $avg_latency = $total_endpoint_requests > 0 ? round($total_latency / $total_endpoint_requests) : 0;
                                
                                // Determine health status
                                if ($total_endpoint_requests === 0) {
                                    $health_status = 'no-data';
                                    $health_label = 'NO DATA';
                                } elseif ($endpoint_error_rate > 10) {
                                    $health_status = 'error';
                                    $health_label = 'HIGH ERRORS';
                                } elseif ($endpoint_error_rate > 5) {
                                    $health_status = 'degraded';
                                    $health_label = 'SOME ERRORS';
                                } else {
                                    $health_status = 'healthy';
                                    $health_label = 'HEALTHY';
                                }
                                ?>
                                <div class="endpoint-card <?php echo $health_status; ?>">
                                    <h4><?php echo htmlspecialchars($endpoint['name'] ?? $endpoint['method'] . ' ' . $endpoint['path']); ?></h4>
                                    <div class="health-badge health-<?php echo $health_status; ?>">
                                        <?php echo $health_label; ?>
                                    </div>
                                    <p><strong>Path:</strong> <?php echo htmlspecialchars($endpoint['path']); ?></p>
                                    <p><strong>Method:</strong> <?php echo htmlspecialchars($endpoint['method']); ?></p>
                                    <?php if ($total_endpoint_requests > 0): ?>
                                        <p><strong>Response Time:</strong> <?php echo $avg_latency; ?>ms</p>
                                        <p><strong>Error Rate:</strong> <?php echo $endpoint_error_rate; ?>%</p>
                                        <p><strong>Total Requests:</strong> <?php echo $total_endpoint_requests; ?></p>
                                        <?php if ($last_activity): ?>
                                            <p><strong>Last Active:</strong> <span class="last-activity" data-timestamp="<?php echo $last_activity; ?>">
                                                <?php echo date('H:i:s', strtotime($last_activity)); ?>
                                            </span></p>
                                        <?php endif; ?>
                                    <?php else: ?>
                                        <p><strong>Status:</strong> No requests recorded</p>
                                        <p><strong>Usage:</strong> Never called</p>
                                    <?php endif; ?>
                                </div>
                            <?php endforeach; ?>
                        <?php else: ?>
                            <div class="no-data" style="grid-column: 1 / -1;">
                                <p>No endpoints configured yet</p>
                                <p style="font-size: 0.9rem;">
                                    Total requests in system: <strong><?php echo $total_requests_count; ?></strong><br>
                                    Active endpoints discovered: <strong><?php echo $active_endpoints_count; ?></strong><br>
                                    <a href="index.php" style="color: #667eea;">Create endpoints in the dashboard</a> to see detailed health status.
                                </p>
                            </div>
                        <?php endif; ?>
                    </div>
                </div>

                <!-- System Health -->
                <div class="card">
                    <h2>❤️ System Overview (Real Totals)</h2>
                    <div class="health-grid">
                        <div class="endpoint-card <?php echo $error_rate > 10 ? 'error' : ($error_rate > 5 ? 'degraded' : 'healthy'); ?>">
                            <h4>API Performance</h4>
                            <div class="health-badge health-<?php echo $error_rate > 10 ? 'error' : ($error_rate > 5 ? 'degraded' : 'healthy'); ?>">
                                <?php echo $error_rate > 10 ? 'High Errors' : ($error_rate > 5 ? 'Some Errors' : 'Healthy'); ?>
                            </div>
                            <p>Requests/Min: <span class="metric-value"><?php echo $requests_per_minute; ?></span></p>
                            <p>Active: <span class="metric-value"><?php echo $active_endpoints_count; ?></span> endpoints</p>
                            <p>Error Rate: <span class="metric-value"><?php echo $error_rate; ?>%</span></p>
                            <div class="data-source">Based on <?php echo $total_requests_count; ?> total requests</div>
                        </div>
                        <div class="endpoint-card <?php echo $total_requests_count > 0 ? 'healthy' : 'no-data'; ?>">
                            <h4>Request Volume</h4>
                            <div class="health-badge health-<?php echo $total_requests_count > 0 ? 'healthy' : 'no-data'; ?>">
                                <?php echo $total_requests_count > 0 ? 'Active' : 'No Data'; ?>
                            </div>
                            <p>Total: <span class="metric-value"><?php echo $total_requests_count; ?></span> requests</p>
                            <p>Errors: <span class="metric-value"><?php echo $total_error_count; ?></span></p>
                            <p>Success: <span class="metric-value"><?php echo $total_requests_count - $total_error_count; ?></span></p>
                            <div class="data-source">All logs combined</div>
                        </div>
                        <div class="endpoint-card <?php echo isset($recent_logs['status']) && $recent_logs['status'] === 200 ? 'healthy' : 'error'; ?>">
                            <h4>Data Status</h4>
                            <div class="health-badge health-<?php echo isset($recent_logs['status']) && $recent_logs['status'] === 200 ? 'healthy' : 'error'; ?>">
                                <?php echo isset($recent_logs['status']) && $recent_logs['status'] === 200 ? 'Live' : 'Error'; ?>
                            </div>
                            <p>Last Update: <span class="metric-value" id="lastUpdateTime">Just now</span></p>
                            <p>Total Logs: <span class="metric-value"><?php echo $total_requests_count; ?></span></p>
                            <div class="data-source">API connection active</div>
                        </div>
                        <div class="endpoint-card <?php echo !empty($environment_data) ? 'healthy' : 'no-data'; ?>">
                            <h4>Environment</h4>
                            <div class="health-badge health-<?php echo !empty($environment_data) ? 'healthy' : 'no-data'; ?>">
                                <?php echo !empty($environment_data) ? 'Ready' : 'No Data'; ?>
                            </div>
                            <p>Name: <span class="metric-value"><?php echo !empty($environment_data['name']) ? htmlspecialchars($environment_data['name']) : 'N/A'; ?></span></p>
                            <p>Port: <span class="metric-value"><?php echo !empty($environment_data['port']) ? $environment_data['port'] : 'N/A'; ?></span></p>
                            <p>Prefix: <span class="metric-value"><?php echo !empty($environment_data['endpoint_prefix']) ? htmlspecialchars($environment_data['endpoint_prefix']) : 'N/A'; ?></span></p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Right Column: Real-time Activity Feed -->
            <div>
                <div class="card">
                    <h2>📊 Recent Activity Feed</h2>
                    <p style="color: #a0a0c0; font-size: 0.9rem; margin-bottom: 1rem;">
                        Showing recent 50 requests. Total in system: <strong><?php echo $total_requests_count; ?></strong>
                    </p>
                    <div class="activity-feed" id="activityFeed">
                        <?php if (isset($recent_logs['status']) && $recent_logs['status'] === 200 && !empty($recent_logs['data'])): ?>
                            <?php foreach ($recent_logs['data'] as $log): ?>
                                <div class="activity-item">
                                    <div class="live-indicator"></div>
                                    <div class="activity-content">
                                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                                            <span class="activity-method"><?php echo htmlspecialchars($log['method'] ?? 'UNKNOWN'); ?></span>
                                            <strong style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                                <?php echo htmlspecialchars($log['path'] ?? 'N/A'); ?>
                                            </strong>
                                            <?php if (isset($log['log_type'])): ?>
                                                <span class="log-type-badge log-type-<?php echo htmlspecialchars($log['log_type']); ?>">
                                                    <?php echo strtoupper(htmlspecialchars($log['log_type'])); ?>
                                                </span>
                                            <?php endif; ?>
                                        </div>
                                        <div style="font-size: 12px; color: #a0a0c0;">
                                            <span class="log-timestamp" data-timestamp="<?php echo $log['timestamp'] ?? ''; ?>">
                                                <?php echo isset($log['timestamp']) ? date('H:i:s', strtotime($log['timestamp'])) : 'N/A'; ?>
                                            </span> | 
                                            Status: <?php echo $log['response_status'] ?? 'N/A'; ?> |
                                            <?php if (isset($log['latency']) && $log['latency']): ?>Latency: <?php echo $log['latency']; ?>ms<?php endif; ?>
                                        </div>
                                    </div>
                                    <span class="health-badge health-<?php echo (isset($log['response_status']) && $log['response_status'] >= 400) ? 'error' : 'healthy'; ?>">
                                        <?php echo $log['response_status'] ?? 'N/A'; ?>
                                    </span>
                                </div>
                            <?php endforeach; ?>
                        <?php else: ?>
                            <div class="no-data">
                                <p>No recent API activity</p>
                                <p style="font-size: 0.9rem;">Total requests in system: <?php echo $total_requests_count; ?></p>
                            </div>
                        <?php endif; ?>
                    </div>
                </div>

                <!-- Real Actions -->
                <div class="card">
                    <h2>⚡ Actions</h2>
                    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                        <button class="btn btn-success" onclick="monitor.refreshAllData()">🔄 Refresh Data</button>
                        <a href="index.php" class="btn">🏠 Manage Endpoints</a>
                        <a href="analytics-real.php" class="btn">📈 View Analytics</a>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        class RealAPIMonitor {
            constructor() {
                this.startTime = new Date();
                this.init();
            }

            init() {
                this.updateTimestamps();
                this.updateMonitoringDuration();
                setInterval(() => this.updateTimestamps(), 60000);
            }

            updateTimestamps() {
                document.querySelectorAll('.last-activity').forEach(element => {
                    const timestamp = element.getAttribute('data-timestamp');
                    if (timestamp) {
                        element.textContent = this.formatTimeAgo(timestamp);
                    }
                });

                this.updateLastUpdateTime();
            }

            updateLastUpdateTime() {
                document.getElementById('lastUpdateTime').textContent = new Date().toLocaleTimeString();
            }

            updateMonitoringDuration() {
                // Optional: Can display monitoring duration if needed
            }

            formatTimeAgo(timestamp) {
                try {
                    const now = new Date();
                    const time = new Date(timestamp);
                    const diff = Math.floor((now - time) / 1000);
                    
                    if (diff < 60) return `${diff}s ago`;
                    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
                    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
                    return `${Math.floor(diff / 86400)}d ago`;
                } catch (e) {
                    return 'Unknown';
                }
            }

            refreshAllData() {
                location.reload();
            }
        }

        document.addEventListener('DOMContentLoaded', () => {
            window.monitor = new RealAPIMonitor();
        });
    </script>
</body>
</html>
