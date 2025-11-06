class AnalyticsDashboard {
    constructor() {
        this.charts = {};
        this.analyticsData = {};
        this.init();
    }

    init() {
        this.loadRealAnalyticsData();
        // Refresh every 30 seconds
        setInterval(() => this.loadRealAnalyticsData(), 30000);
    }

    async loadRealAnalyticsData() {
        try {
            console.log('📊 Loading real analytics data from database...');
            
            const response = await fetch('api.php?action=get_analytics');
            const result = await response.json();
            
            if (result.success) {
                this.analyticsData = result.data;
                this.updateAllCharts();
                this.updateMetricsDisplay();
            } else {
                console.error('Failed to load analytics:', result.error);
                this.showError('Failed to load analytics data');
            }
        } catch (error) {
            console.error('Error loading analytics:', error);
            this.showError('Network error loading analytics');
        }
    }

    updateAllCharts() {
        this.createMethodsChart();
        this.createStatusCodesChart();
        this.createTimelineChart();
        this.createHourlyChart();
        this.updateEndpointsList();
        this.updateErrorEndpointsList();
        this.updatePerformanceMetrics();
    }

    createMethodsChart() {
        if (!this.analyticsData.methods || this.analyticsData.methods.length === 0) return;

        const ctx = document.getElementById('methodsChart');
        if (!ctx) return;

        // Destroy existing chart
        if (this.charts.methods) {
            this.charts.methods.destroy();
        }

        this.charts.methods = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: this.analyticsData.methods.map(m => m.method),
                datasets: [{
                    data: this.analyticsData.methods.map(m => m.count),
                    backgroundColor: ['#667eea', '#00b894', '#fdcb6e', '#ff6b6b', '#a0a0c0', '#74b9ff']
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { 
                        position: 'bottom',
                        labels: { color: '#ffffff' }
                    },
                    title: {
                        display: true,
                        text: 'Requests by HTTP Method',
                        color: '#667eea',
                        font: { size: 14 }
                    }
                }
            }
        });
    }

    createStatusCodesChart() {
        if (!this.analyticsData.status_codes || this.analyticsData.status_codes.length === 0) return;

        const ctx = document.getElementById('statusChart');
        if (!ctx) return;

        if (this.charts.status) {
            this.charts.status.destroy();
        }

        this.charts.status = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: this.analyticsData.status_codes.map(s => s.response_status),
                datasets: [{
                    label: 'Requests',
                    data: this.analyticsData.status_codes.map(s => s.count),
                    backgroundColor: this.analyticsData.status_codes.map(s => 
                        s.response_status >= 400 ? '#ff6b6b' : 
                        s.response_status >= 300 ? '#fdcb6e' : '#00b894'
                    ),
                    borderColor: '#1a1a2e',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { 
                        beginAtZero: true,
                        ticks: { color: '#a0a0c0' },
                        grid: { color: '#2d2d4d' }
                    },
                    x: {
                        ticks: { color: '#a0a0c0' },
                        grid: { color: '#2d2d4d' }
                    }
                },
                plugins: {
                    legend: { 
                        display: false 
                    },
                    title: {
                        display: true,
                        text: 'Response Status Codes',
                        color: '#667eea',
                        font: { size: 14 }
                    }
                }
            }
        });
    }

    createTimelineChart() {
        if (!this.analyticsData.daily_timeline || this.analyticsData.daily_timeline.length === 0) return;

        const ctx = document.getElementById('timelineChart');
        if (!ctx) return;

        if (this.charts.timeline) {
            this.charts.timeline.destroy();
        }

        const timelineData = [...this.analyticsData.daily_timeline].reverse();

        this.charts.timeline = new Chart(ctx, {
            type: 'line',
            data: {
                labels: timelineData.map(d => {
                    const date = new Date(d.date);
                    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                }),
                datasets: [{
                    label: 'Daily Requests',
                    data: timelineData.map(d => d.daily_requests),
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#667eea',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { 
                        beginAtZero: true,
                        ticks: { color: '#a0a0c0' },
                        grid: { color: '#2d2d4d' }
                    },
                    x: {
                        ticks: { color: '#a0a0c0' },
                        grid: { color: '#2d2d4d' }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Request Timeline (Last 30 Days)',
                        color: '#667eea',
                        font: { size: 14 }
                    }
                }
            }
        });
    }

    createHourlyChart() {
        if (!this.analyticsData.hourly_usage || this.analyticsData.hourly_usage.length === 0) return;

        const ctx = document.getElementById('hourlyChart');
        if (!ctx) return;

        if (this.charts.hourly) {
            this.charts.hourly.destroy();
        }

        this.charts.hourly = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: this.analyticsData.hourly_usage.map(h => h.hour),
                datasets: [{
                    label: 'Requests per Hour',
                    data: this.analyticsData.hourly_usage.map(h => h.request_count),
                    backgroundColor: '#667eea',
                    borderColor: '#1a1a2e',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { 
                        beginAtZero: true,
                        ticks: { color: '#a0a0c0' },
                        grid: { color: '#2d2d4d' }
                    },
                    x: {
                        ticks: { 
                            color: '#a0a0c0',
                            maxRotation: 0
                        },
                        grid: { color: '#2d2d4d' }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Hourly Usage Pattern',
                        color: '#667eea',
                        font: { size: 14 }
                    }
                }
            }
        });
    }

    updateEndpointsList() {
        const container = document.getElementById('endpointsList');
        if (!container || !this.analyticsData.endpoint_usage) return;

        if (this.analyticsData.endpoint_usage.length === 0) {
            container.innerHTML = '<div class="no-data-message">No endpoint usage data</div>';
            return;
        }

        const maxRequests = Math.max(...this.analyticsData.endpoint_usage.map(e => e.request_count));

        container.innerHTML = this.analyticsData.endpoint_usage.map(endpoint => {
            const percentage = maxRequests > 0 ? (endpoint.request_count / maxRequests) * 100 : 0;
            return `
                <div class="data-item">
                    <span style="flex: 1; overflow: hidden; text-overflow: ellipsis;" title="${this.escapeHtml(endpoint.endpoint_name)}">
                        ${this.escapeHtml(endpoint.endpoint_name)}
                    </span>
                    <span style="margin-left: 1rem; font-weight: bold;">
                        ${this.formatNumber(endpoint.request_count)}
                    </span>
                </div>
                <div class="data-bar" style="width: ${percentage}%"></div>
            `;
        }).join('');
    }

    updateErrorEndpointsList() {
        const container = document.getElementById('errorEndpointsList');
        if (!container || !this.analyticsData.error_endpoints) return;

        if (this.analyticsData.error_endpoints.length === 0) {
            container.innerHTML = '<div class="no-data-message">No errors recorded</div>';
            return;
        }

        container.innerHTML = this.analyticsData.error_endpoints.map(endpoint => {
            return `
                <div class="data-item" style="border-left: 4px solid #ff6b6b;">
                    <span style="flex: 1; overflow: hidden; text-overflow: ellipsis;" title="${this.escapeHtml(endpoint.endpoint_name)}">
                        ${this.escapeHtml(endpoint.endpoint_name)}
                    </span>
                    <span style="margin-left: 1rem; font-weight: bold; color: #ff6b6b;">
                        ${this.formatNumber(endpoint.error_count)}
                    </span>
                </div>
            `;
        }).join('');
    }

    updatePerformanceMetrics() {
        if (!this.analyticsData.performance) return;

        const perf = this.analyticsData.performance;
        
        // Update performance metrics display if elements exist
        const elements = {
            'avgLatency': perf.avg_latency ? Math.round(perf.avg_latency) + 'ms' : 'N/A',
            'minLatency': perf.min_latency ? Math.round(perf.min_latency) + 'ms' : 'N/A',
            'maxLatency': perf.max_latency ? Math.round(perf.max_latency) + 'ms' : 'N/A',
            'p95Latency': perf.p95_latency ? Math.round(perf.p95_latency) + 'ms' : 'N/A'
        };

        Object.keys(elements).forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = elements[id];
            }
        });
    }

    updateMetricsDisplay() {
        if (!this.analyticsData) return;

        // Update main metrics cards
        const metrics = {
            'totalRequests': this.formatNumber(this.analyticsData.total_requests || 0),
            'errorCount': this.formatNumber(this.analyticsData.error_count || 0),
            'errorRate': (this.analyticsData.error_rate || 0) + '%',
            'successRate': (this.analyticsData.success_rate || 0) + '%',
            'activeEndpoints': this.formatNumber(this.analyticsData.endpoint_usage?.length || 0),
            'successCount': this.formatNumber(this.analyticsData.success_count || 0),
            'methodsCount': this.formatNumber(this.analyticsData.methods?.length || 0)
        };

        Object.keys(metrics).forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = metrics[id];
            }
        });

        // Update last refresh time
        const refreshElement = document.getElementById('lastRefresh');
        if (refreshElement) {
            refreshElement.textContent = new Date().toLocaleTimeString();
        }
    }

    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    escapeHtml(unsafe) {
        if (unsafe === null || unsafe === undefined) return '';
        return unsafe.toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    showError(message) {
        // Create or update error display
        let errorDiv = document.getElementById('analyticsError');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.id = 'analyticsError';
            errorDiv.className = 'alert alert-error';
            errorDiv.style.position = 'fixed';
            errorDiv.style.top = '20px';
            errorDiv.style.right = '20px';
            errorDiv.style.zIndex = '1000';
            document.body.appendChild(errorDiv);
        }
        
        errorDiv.textContent = message;
        
        setTimeout(() => {
            if (errorDiv && errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 5000);
    }

    // Public method to manually refresh data
    refresh() {
        this.loadRealAnalyticsData();
    }

    // Clean up charts when needed
    destroy() {
        Object.values(this.charts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
        this.charts = {};
    }
}

// Initialize analytics dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.analyticsDashboard = new AnalyticsDashboard();
});

// Export for module usage if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AnalyticsDashboard;
}
