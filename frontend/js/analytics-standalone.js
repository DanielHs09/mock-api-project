// analytics-standalone.js - Complete standalone analytics
class StandaloneAnalytics {
    constructor() {
        this.analyticsData = null;
        this.charts = {};
        this.init();
    }

    init() {
        this.loadAnalyticsData();
        setInterval(() => this.loadAnalyticsData(), 30000);
        setInterval(() => this.updateRefreshTime(), 1000);
    }

    async loadAnalyticsData() {
        try {
            const response = await fetch('analytics-api.php');
            const result = await response.json();
            
            if (result.success) {
                this.analyticsData = result.data;
                this.updateAllDisplays();
            } else {
                this.showError(result.error);
            }
        } catch (error) {
            this.showError('Network error: ' + error.message);
        }
    }

    updateAllDisplays() {
        this.updateMetrics();
        this.updateCharts();
        this.updateLists();
        this.updatePerformance();
    }

    updateMetrics() {
        const metricsGrid = document.getElementById('metricsGrid');
        if (!this.analyticsData) return;

        metricsGrid.innerHTML = `
            <div class="metric-card">
                <div class="stat-number">${this.formatNumber(this.analyticsData.total_requests)}</div>
                <div class="stat-label">Total Requests</div>
            </div>
            <div class="metric-card">
                <div class="stat-number">${this.formatNumber(this.analyticsData.error_count)}</div>
                <div class="stat-label">Total Errors</div>
            </div>
            <div class="metric-card">
                <div class="stat-number">${this.analyticsData.error_rate}%</div>
                <div class="stat-label">Error Rate</div>
            </div>
            <div class="metric-card">
                <div class="stat-number">${this.analyticsData.success_rate}%</div>
                <div class="stat-label">Success Rate</div>
            </div>
        `;
    }

    updateCharts() {
        this.createMethodsChart();
        this.createStatusChart();
        this.createTimelineChart();
        this.createHourlyChart();
    }

    createMethodsChart() {
        const ctx = document.getElementById('methodsChart');
        if (!ctx || !this.analyticsData.methods.length) return;

        if (this.charts.methods) this.charts.methods.destroy();

        this.charts.methods = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: this.analyticsData.methods.map(m => m.method),
                datasets: [{
                    data: this.analyticsData.methods.map(m => m.count),
                    backgroundColor: ['#667eea', '#00b894', '#fdcb6e', '#ff6b6b', '#a0a0c0']
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    }

    createStatusChart() {
        const ctx = document.getElementById('statusChart');
        if (!ctx || !this.analyticsData.status_codes.length) return;

        if (this.charts.status) this.charts.status.destroy();

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
                    )
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }

    createTimelineChart() {
        const ctx = document.getElementById('timelineChart');
        if (!ctx || !this.analyticsData.daily_timeline.length) return;

        if (this.charts.timeline) this.charts.timeline.destroy();

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
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }

    createHourlyChart() {
        const ctx = document.getElementById('hourlyChart');
        if (!ctx || !this.analyticsData.hourly_usage.length) return;

        if (this.charts.hourly) this.charts.hourly.destroy();

        this.charts.hourly = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: this.analyticsData.hourly_usage.map(h => h.hour),
                datasets: [{
                    label: 'Requests per Hour',
                    data: this.analyticsData.hourly_usage.map(h => h.request_count),
                    backgroundColor: '#667eea'
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }

    updateLists() {
        this.updateEndpointsList();
        this.updateErrorEndpointsList();
    }

    updateEndpointsList() {
        const container = document.getElementById('endpointsList');
        if (!container || !this.analyticsData.endpoint_usage.length) {
            container.innerHTML = '<div class="no-data-message">No endpoint data</div>';
            return;
        }

        const maxRequests = Math.max(...this.analyticsData.endpoint_usage.map(e => e.request_count));

        container.innerHTML = this.analyticsData.endpoint_usage.map(endpoint => {
            const percentage = maxRequests > 0 ? (endpoint.request_count / maxRequests) * 100 : 0;
            return `
                <div class="data-item">
                    <span title="${this.escapeHtml(endpoint.endpoint_name)}">
                        ${this.escapeHtml(endpoint.endpoint_name)}
                    </span>
                    <span style="font-weight: bold;">
                        ${this.formatNumber(endpoint.request_count)}
                    </span>
                </div>
                <div class="data-bar" style="width: ${percentage}%"></div>
            `;
        }).join('');
    }

    updateErrorEndpointsList() {
        const container = document.getElementById('errorEndpointsList');
        if (!container) return;

        if (!this.analyticsData.error_endpoints.length) {
            container.innerHTML = '<div class="no-data-message">No errors recorded</div>';
            return;
        }

        container.innerHTML = this.analyticsData.error_endpoints.map(endpoint => {
            return `
                <div class="data-item" style="border-left: 4px solid #ff6b6b;">
                    <span title="${this.escapeHtml(endpoint.endpoint_name)}">
                        ${this.escapeHtml(endpoint.endpoint_name)}
                    </span>
                    <span style="font-weight: bold; color: #ff6b6b;">
                        ${this.formatNumber(endpoint.error_count)}
                    </span>
                </div>
            `;
        }).join('');
    }

    updatePerformance() {
        const container = document.getElementById('performanceMetrics');
        if (!container || !this.analyticsData.performance) return;

        const perf = this.analyticsData.performance;
        container.innerHTML = `
            <div style="display: grid; gap: 1rem;">
                <div style="text-align: center; padding: 1.5rem; background: #252547; border-radius: 8px;">
                    <div style="font-size: 2rem; font-weight: bold; color: #667eea;">
                        ${Math.round(perf.avg_latency)}ms
                    </div>
                    <div style="font-size: 0.9rem; color: #a0a0c0;">Average Response Time</div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                    <div style="text-align: center; padding: 1rem; background: #252547; border-radius: 6px;">
                        <div style="font-size: 1.2rem; font-weight: bold; color: #00b894;">
                            ${Math.round(perf.min_latency)}ms
                        </div>
                        <div style="font-size: 0.8rem;">Fastest</div>
                    </div>
                    <div style="text-align: center; padding: 1rem; background: #252547; border-radius: 6px;">
                        <div style="font-size: 1.2rem; font-weight: bold; color: #ff6b6b;">
                            ${Math.round(perf.max_latency)}ms
                        </div>
                        <div style="font-size: 0.8rem;">Slowest</div>
                    </div>
                </div>
            </div>
        `;
    }

    updateRefreshTime() {
        const element = document.getElementById('lastRefresh');
        if (element) {
            element.textContent = new Date().toLocaleTimeString();
        }
    }

    formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showError(message) {
        console.error('Analytics Error:', message);
        // You can add a visible error display here if needed
        const errorDiv = document.createElement('div');
        errorDiv.className = 'alert alert-error';
        errorDiv.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 1000;';
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        setTimeout(() => errorDiv.remove(), 5000);
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    new StandaloneAnalytics();
});
