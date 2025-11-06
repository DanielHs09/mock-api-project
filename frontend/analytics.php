<?php
// Simple analytics.php that uses the standalone API
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Analytics - Standalone Dashboard</title>
    <link rel="stylesheet" href="styles.css">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📈 API Analytics - Standalone</h1>
            <p>Using separate analytics API - won't break your main app</p>
        </div>

        <div class="refresh-info">
            🔄 Auto-refreshes every 30 seconds | 
            <span id="lastRefresh">Loading...</span>
        </div>

        <!-- Metrics will be loaded by JavaScript -->
        <div class="metrics-grid" id="metricsGrid">
            <div class="loading">Loading metrics...</div>
        </div>

        <!-- Charts Section -->
        <div class="chart-row">
            <div class="chart-container">
                <div class="chart-title">📤 Requests by HTTP Method</div>
                <canvas id="methodsChart" width="400" height="200"></canvas>
            </div>
            <div class="chart-container">
                <div class="chart-title">📊 Response Status Codes</div>
                <canvas id="statusChart" width="400" height="200"></canvas>
            </div>
        </div>

        <div class="analytics-grid">
            <div>
                <div class="chart-container">
                    <div class="chart-title">🔝 Most Active Endpoints</div>
                    <div id="endpointsList">Loading...</div>
                </div>
                <div class="chart-container">
                    <div class="chart-title">📅 Request Timeline</div>
                    <canvas id="timelineChart" width="400" height="200"></canvas>
                </div>
            </div>
            <div>
                <div class="chart-container">
                    <div class="chart-title">⚡ Performance</div>
                    <div id="performanceMetrics">Loading...</div>
                </div>
                <div class="chart-container">
                    <div class="chart-title">❌ Top Errors</div>
                    <div id="errorEndpointsList">Loading...</div>
                </div>
            </div>
        </div>
    </div>

    <script src="js/analytics-standalone.js"></script>
</body>
</html>
