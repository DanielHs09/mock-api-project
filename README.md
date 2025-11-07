🚀 Mock-API ManagerThe Mock-API Manager is a self-hosted, full-featured tool designed to create, manage, and monitor mock API endpoints for your development and testing needs. It provides a clean web interface to dynamically configure mock responses, latency, status codes, and track real-time usage and errors.

✨ FeaturesFull CRUD API: Manage Environments, Endpoints, and Responses via a dedicated REST API.Dynamic Mocking: Serves mock API requests based on configured rules, paths, and methods.PostgreSQL Database: Robust and scalable data persistence for configurations and request logs.Real-time Monitoring: Dedicated dashboard to view request statistics, error rates, average latency, and recent activity logs.Security & Efficiency: Built with modern Node.js/Express best practices, including Helmet for security and non-blocking database logging.

⚙️ Installation and Setup: This application uses a separate Backend (Node.js) and Frontend (PHP/JavaScript). They must be deployed to different locations to function correctly.

1. Prerequisites You must have the following installed on your server:Node.js (LTS recommended): For running the backend API server. 

PostgreSQL: The database used for storing all application data and logs.PHP (with a web server like Apache or Nginx): For serving the frontend dashboard files.

2. Directory Structure Assuming you have a backend and frontend.

3. Deployment Steps

A. Frontend Setup The fronend should be placed in a directory /var/www/html. Move Files: Move the contents of the frontend/ folder to /var/www/html.


B. Backend Setup (Node.js API)The backend should be placed in a directory with restricted access and then run as a persistent service (e.g., using pm2 or systemd).Move Files: Move the contents of the backend/ folder to a secure, non-web-accessible location, such as your user's home directory.Bash# Example: Move the backend folder to your home directory

mv mock-api-project/backend ~/mock-api-manager-backend

cd ~/mock-api-manager-backend

Install Dependencies:

npm install

Configure Environment:Create a .env file in the ~/mock-api-manager-backend directory with your database and server settings.Code snippet# Example .env file - REQUIRED
PORT=3000
NODE_ENV=development
CORS_ORIGIN=*
LOG_LEVEL=combined

# POSTGRESQL DATABASE CONFIGURATION
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mock_api_db
DB_USER=your_postgres_user
DB_PASSWORD=your_secure_password

Initialize Database: Crucially: You must run the init.DB script (mentioned in the original prompt) to create the necessary tables (environments, endpoints, responses, request_logs, etc.).

Run the Server: Start the Node.js server or npm start. For production, use a process manager:Bash# For development:
node server.js

# For production (using pm2):
pm2 start server.js --name mock-api-manager
B. Frontend Setup (PHP Dashboard)The frontend contains the static HTML, CSS, PHP logic, and script.js that must be served by a web server (like Apache or Nginx).Move Files: Copy the contents of the frontend/ folder into your web server's document root.Bash# Example for an Apache/Ubuntu setup:
cp -r mock-api-project/frontend/* /var/www/html/mock-api/

Configure config.php:You need to ensure the PHP file in the frontend can communicate with the backend API.Edit the config.php (or equivalent configuration file in the frontend) to point to the correct backend API address (e.g., http://localhost:3000/api).4. UsageAfter both components are running:Open your browser and navigate to the Frontend URL (e.g., http://yourserver.com/mock-api/index.php).Use the Dashboard to create new Environments, Endpoints, and Responses.Test your mock APIs by making requests to the Mock API URL:http://[Backend IP or Host]:[PORT]/mock/:environmentId/*Monitor traffic on the Monitoring Page (e.g., http://yourserver.com/mock-api/monitoring.php).
