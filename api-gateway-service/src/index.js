const express = require('express');
const http = require('http');

const app = express();
const PORT = 3000;
app.use(express.json());

// generate a simple idempotency key
function generateIdempotencyKey() {
  return `req-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

//status 
app.get('/status', (req, res) => {
  res.json({
status: 'ok', timestamp: new Date().toISOString(),service: 'api-gateway-service'
  });});

//inference 
app.post('/inference', async (req, res) => {

  const key = req.headers["idempotency-key"];
  if (!key) {
    return res
      .status(400)
      .json({ error: "Idempotency-Key header is required" });
  } const { prompt } = req.body;

  // Validate request
  if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
    return res.status(400).json({error: 'Invalid request', message: 'prompt field is required and must be string'
    });
  }
  try {
    // forward to model-worker service
    const workerResponse = await forwardToWorker(prompt);
    // Return worker response with idempotency key
    return res.json({
       key,
  workerId: workerResponse.workerId,
  prompt: workerResponse.prompt,
  processingTimeMs: workerResponse.processingTimeMs,
  result: workerResponse.result,
  tokenCount: workerResponse.tokenCount,
  timestamp: workerResponse.timestamp,
  capacity: workerResponse.capacity,
  currentLoad: workerResponse.currentLoad
    });
  } catch (error) {
    console.error('Error forwarding request to worker:', error.message);
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'Model worker service is currently unavailable',
      timestamp: new Date().toISOString()
    });
  }
});

// Forward inference request to model-worker service
function forwardToWorker(prompt) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ prompt });
const options = {
      hostname: 'model-worker',
      port: 3001,
      path: '/process',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(new Error('Failed to parse worker response'));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`[api-gateway-service] listening on port ${PORT}`);
  console.log(`[api-gateway-service] POST /inference - forward inference request to model-worker`);
  console.log(`[api-gateway-service] GET /status - gateway health status`);
});
