class MockoonDashboard {
    constructor() {
        this.currentEnvironment = null;
        this.currentEndpoint = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadEnvironments();
    }

    bindEvents() {
        // Form submissions
        document.getElementById('createEndpointForm')?.addEventListener('submit', (e) => this.handleCreateEndpoint(e));
        document.getElementById('createResponseForm')?.addEventListener('submit', (e) => this.handleCreateResponse(e));
        document.getElementById('testEndpointForm')?.addEventListener('submit', (e) => this.handleTestEndpoint(e));
        
        // Quick actions
        document.getElementById('refreshAll')?.addEventListener('click', () => this.loadEnvironments());
    }

    async apiCall(url, options = {}) {
        try {
            const response = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });
            
            const text = await response.text();
            let data;
            
            try {
                data = JSON.parse(text);
            } catch (e) {
                throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
            }
            
            if (!response.ok) {
                throw new Error(data.error || `HTTP ${response.status}`);
            }
            
            return data;
        } catch (error) {
            console.error('API Call failed:', error);
            throw error;
        }
    }

    async loadEnvironments() {
        try {
            const data = await this.apiCall('api.php?action=get_environments');
            
            if (data.success) {
                this.displayEnvironments(data.environments);
                if (data.environments.length > 0) {
                    this.selectEnvironment(data.environments[0].id);
                }
            } else {
                this.showAlert('Failed to load environments: ' + (data.error || 'Unknown error'), 'error');
            }
        } catch (error) {
            this.showAlert('Error loading environments: ' + error.message, 'error');
        }
    }

    displayEnvironments(environments) {
        const container = document.getElementById('environmentsList');
        if (!container) return;
        
        container.innerHTML = environments.map(env => `
            <div class="environment-item" onclick="dashboard.selectEnvironment(${env.id})">
                <h4>${this.escapeHtml(env.name)}</h4>
                <p>Port: ${env.port} | Prefix: ${this.escapeHtml(env.endpoint_prefix)}</p>
                <div class="action-buttons">
                    <button class="btn btn-warning" onclick="event.stopPropagation(); dashboard.deleteEnvironment(${env.id})">Delete</button>
                </div>
            </div>
        `).join('');
    }

    async selectEnvironment(environmentId) {
        this.currentEnvironment = environmentId;
        
        // Update UI
        document.querySelectorAll('.environment-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Find and activate the clicked environment
        const items = document.querySelectorAll('.environment-item');
        for (let item of items) {
            if (item.querySelector('button')?.onclick?.toString().includes(environmentId)) {
                item.classList.add('active');
                break;
            }
        }
        
        await this.loadEndpoints(environmentId);
    }

    async loadEndpoints(environmentId) {
        try {
            const data = await this.apiCall(`api.php?action=get_endpoints&environment_id=${environmentId}`);
            
            if (data.success) {
                this.displayEndpoints(data.endpoints);
            } else {
                this.showAlert('Failed to load endpoints: ' + (data.error || 'Unknown error'), 'error');
            }
        } catch (error) {
            this.showAlert('Error loading endpoints: ' + error.message, 'error');
        }
    }

    displayEndpoints(endpoints) {
        const container = document.getElementById('endpointsList');
        if (!container) return;
        
        container.innerHTML = endpoints.map(endpoint => `
            <div class="endpoint-item">
                <div class="endpoint-header">
                    <span class="endpoint-method method-${endpoint.method.toLowerCase()}">${endpoint.method}</span>
                    <strong>${this.escapeHtml(endpoint.path)}</strong>
                </div>
                <p>${this.escapeHtml(endpoint.name)}</p>
                <div class="action-buttons">
                    <button class="btn btn-success" onclick="dashboard.viewResponses(${endpoint.id})">Responses</button>
                    <button class="btn btn-warning" onclick="dashboard.testSpecificEndpoint(${endpoint.id})">Test</button>
                    <button class="btn btn-danger" onclick="dashboard.deleteEndpoint(${endpoint.id})">Delete</button>
                </div>
            </div>
        `).join('');
    }

    async viewResponses(endpointId) {
        this.currentEndpoint = endpointId;
        try {
            const data = await this.apiCall(`api.php?action=get_responses&endpoint_id=${endpointId}`);
            
            if (data.success) {
                this.displayResponses(data.responses);
            } else {
                this.showAlert('Failed to load responses: ' + (data.error || 'Unknown error'), 'error');
            }
        } catch (error) {
            this.showAlert('Error loading responses: ' + error.message, 'error');
        }
    }

    displayResponses(responses) {
        const container = document.getElementById('responsesList');
        const section = document.getElementById('responsesSection');
        
        if (!container || !section) return;
        
        container.innerHTML = responses.map(resp => `
            <div class="response-item">
                <h4>${this.escapeHtml(resp.name)} (${resp.status_code})</h4>
                <pre class="code-block">${this.escapeHtml(JSON.stringify(JSON.parse(resp.body), null, 2))}</pre>
                <div class="action-buttons">
                    <button class="btn btn-danger" onclick="dashboard.deleteResponse(${resp.id})">Delete</button>
                </div>
            </div>
        `).join('');
        
        // Show responses section
        section.style.display = 'block';
    }

    async handleCreateEndpoint(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        const data = {
            path: formData.get('path'),
            method: formData.get('method'),
            name: formData.get('name'),
            status_code: parseInt(formData.get('status_code'))
        };

        try {
            const result = await this.apiCall(`api.php?action=create_endpoint&environment_id=${this.currentEnvironment}`, {
                method: 'POST',
                body: JSON.stringify(data)
            });
            
            if (result.success) {
                this.showAlert('Endpoint created successfully!', 'success');
                this.loadEndpoints(this.currentEnvironment);
                e.target.reset();
            } else {
                this.showAlert('Error creating endpoint: ' + (result.error || 'Unknown error'), 'error');
            }
        } catch (error) {
            this.showAlert('Error creating endpoint: ' + error.message, 'error');
        }
    }

    async handleCreateResponse(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        const data = {
            name: formData.get('name'),
            status_code: parseInt(formData.get('status_code')),
            body: formData.get('body'),
            headers: { 'Content-Type': 'application/json' },
            is_default: true
        };

        try {
            const result = await this.apiCall(`api.php?action=create_response&endpoint_id=${this.currentEndpoint}`, {
                method: 'POST',
                body: JSON.stringify(data)
            });
            
            if (result.success) {
                this.showAlert('Response created successfully!', 'success');
                this.viewResponses(this.currentEndpoint);
                e.target.reset();
            } else {
                this.showAlert('Error creating response: ' + (result.error || 'Unknown error'), 'error');
            }
        } catch (error) {
            this.showAlert('Error creating response: ' + error.message, 'error');
        }
    }

    async handleTestEndpoint(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        const testData = {
            environment_id: this.currentEnvironment,
            path: formData.get('test_path'),
            method: formData.get('test_method'),
            data: formData.get('test_data') ? JSON.parse(formData.get('test_data')) : null
        };

        try {
            const result = await this.apiCall('api.php?action=test_endpoint', {
                method: 'POST',
                body: JSON.stringify(testData)
            });
            
            this.displayTestResult(result);
        } catch (error) {
            this.showAlert('Error testing endpoint: ' + error.message, 'error');
        }
    }

    displayTestResult(result) {
        const container = document.getElementById('testResult');
        if (!container) return;
        
        container.innerHTML = `
            <div class="test-result ${result.status >= 400 ? 'error' : ''}">
                <h4>Test Result (Status: ${result.status})</h4>
                <pre class="code-block">${this.escapeHtml(JSON.stringify(result.data, null, 2))}</pre>
            </div>
        `;
    }

    async deleteEndpoint(endpointId) {
        if (confirm('Are you sure you want to delete this endpoint?')) {
            try {
                const result = await this.apiCall(`api.php?action=delete_endpoint&endpoint_id=${endpointId}`, {
                    method: 'DELETE'
                });
                
                if (result.success) {
                    this.showAlert('Endpoint deleted successfully!', 'success');
                    this.loadEndpoints(this.currentEnvironment);
                } else {
                    this.showAlert('Error deleting endpoint: ' + (result.error || 'Unknown error'), 'error');
                }
            } catch (error) {
                this.showAlert('Error deleting endpoint: ' + error.message, 'error');
            }
        }
    }

    async deleteResponse(responseId) {
        if (confirm('Are you sure you want to delete this response?')) {
            try {
                const result = await this.apiCall(`api.php?action=delete_response&response_id=${responseId}`, {
                    method: 'DELETE'
                });
                
                if (result.success) {
                    this.showAlert('Response deleted successfully!', 'success');
                    this.viewResponses(this.currentEndpoint);
                } else {
                    this.showAlert('Error deleting response: ' + (result.error || 'Unknown error'), 'error');
                }
            } catch (error) {
                this.showAlert('Error deleting response: ' + error.message, 'error');
            }
        }
    }

    testSpecificEndpoint(endpointId) {
        // Find the endpoint path and pre-fill the test form
        const endpointItem = document.querySelector(`.endpoint-item button[onclick*="${endpointId}"]`)?.closest('.endpoint-item');
        if (endpointItem) {
            const path = endpointItem.querySelector('strong').textContent;
            const method = endpointItem.querySelector('.endpoint-method').textContent;
            
            document.querySelector('input[name="test_path"]').value = path;
            document.querySelector('select[name="test_method"]').value = method;
            
            this.showAlert(`Test form pre-filled for ${method} ${path}`, 'success');
        }
    }

    showAlert(message, type) {
        const alertsContainer = document.getElementById('alertsContainer');
        if (!alertsContainer) return;
        
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        alertDiv.textContent = message;
        
        alertsContainer.appendChild(alertDiv);
        
        setTimeout(() => {
            alertDiv.remove();
        }, 5000);
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
}

// Initialize dashboard when page loads
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new MockoonDashboard();
});
