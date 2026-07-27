const express = require('express');
const http = require('http');

const app = express();
const PORT = 3002;

// Last observed health state
let lastHealthState = null;

//poll worker health
function pollWorkerHealth() {
  const options = {
hostname: 'model-worker',
port: 3001,
path: '/health',
method: 'GET'
  };

const req = http.request(options, (res) => {
let data = '';
res.on('data', (chunk) => {data += chunk;
});

res.on('end', () => {
try {
lastHealthState = JSON.parse(data);
// Log health check result to stdout (observable behavior)
console.log(`[model-worker-sidecar] Health check: worker=${lastHealthState.workerId}, status=${lastHealthState.status}, load=${lastHealthState.currentLoad}/${lastHealthState.capacity}, processing=${lastHealthState.processingCount}, timestamp=${lastHealthState.timestamp}`);
} catch (error) {
console.error(`[model-worker-sidecar] Failed to parse health response: ${error.message}`);
}
});
});

  req.on('error', (error) => {
    console.error(`[model-worker-sidecar] Health check error: ${error.message}`);
  });

  req.end();
}

// GET status 
app.get('/status', (req, res) => {
  if (lastHealthState) {
    return res.json({
      sidecar: 'model-worker-sidecar',
      lastObservedWorkerHealth: lastHealthState,
      timestamp: new Date().toISOString()
    });
  } else {
    return res.json({
      sidecar: 'model-worker-sidecar',
      status: 'initializing',
      message: 'No health checks performed yet',
      timestamp: new Date().toISOString()
    });
  }
});

// Start health polling every 5 seconds
const healthCheckInterval = setInterval(() => {
  pollWorkerHealth();
}, 5000);

// Perform initial health check on startup
setTimeout(() => {
  console.log('[model-worker-sidecar] Starting health monitoring...');
  pollWorkerHealth();
}, 1000);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[model-worker-sidecar] Shutting down gracefully...');
  clearInterval(healthCheckInterval);
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[model-worker-sidecar] Interrupted, shutting down...');
  clearInterval(healthCheckInterval);
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`[model-worker-sidecar] listening on port ${PORT}`);
  console.log(`[model-worker-sidecar] GET /status - return last observed worker health state`);
  console.log(`[model-worker-sidecar] Health checks run every 5 seconds`);
});
