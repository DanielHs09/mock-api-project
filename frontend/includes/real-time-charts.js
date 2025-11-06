// Real-time chart utilities for monitoring dashboard
class RealTimeCharts {
    static createStatusChart(canvasId, data) {
        return new Chart(document.getElementById(canvasId), {
            type: 'doughnut',
            data: {
                labels: ['Online', 'Offline', 'Error'],
                datasets: [{
                    data: data,
                    backgroundColor: ['#00b894', '#ff6b6b', '#fdcb6e']
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

    static createActivityChart(canvasId, timelineData) {
        return new Chart(document.getElementById(canvasId), {
            type: 'line',
            data: {
                labels: timelineData.labels,
                datasets: [{
                    label: 'API Activity',
                    data: timelineData.values,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
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
}
