const express = require('express');
const http = require('http');

const app = express();
const PORT = Number(process.env.PORT ?? 3000);
const WORKER_HOST = process.env.WORKER_HOST ?? 'model-worker';
const WORKER_PORT = Number(process.env.WORKER_PORT ?? 3001);
const SERVICE_NAME = 'api-gateway-service';

app.use(express.json({ limit: '32kb' }));

const generateIdempotencyKey = () =>
  `req-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

const simulateGatewayLatency = (prompt) => {
  const latencyMs = 80 + Math.min(Math.floor(prompt.length / 2), 120);

  return new Promise((resolve) => {
    setTimeout(() => resolve(latencyMs), latencyMs);
  });
};

const forwardToWorker = (prompt) =>
  new Promise((resolve, reject) => {
    const postData = JSON.stringify({ prompt });
    const workerRequest = http.request(
      {
        hostname: WORKER_HOST,
        port: WORKER_PORT,
        path: '/process',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 5000
      },
      (workerResponse) => {
        let data = '';

        workerResponse.on('data', (chunk) => {
          data += chunk;
        });

        workerResponse.on('end', () => {
          try {
            const body = JSON.parse(data);

            if (workerResponse.statusCode < 200 || workerResponse.statusCode >= 300) {
              reject(new Error(body.message ?? `Worker returned HTTP ${workerResponse.statusCode}`));
              return;
            }

            resolve(body);
          } catch (error) {
            reject(new Error(`Failed to parse worker response: ${error.message}`));
          }
        });
      }
    );

    workerRequest.on('timeout', () => {
      workerRequest.destroy(new Error('Model worker request timed out'));
    });
    workerRequest.on('error', reject);
    workerRequest.write(postData);
    workerRequest.end();
  });

app.get('/status', (_request, response) => {
  response.json({
    service: SERVICE_NAME,
    status: 'healthy',
    role: 'public-resource inference entry point',
    community: 'public libraries and nonprofit resource centers',
    routingTarget: `${WORKER_HOST}:${WORKER_PORT}`,
    timestamp: new Date().toISOString()
  });
});

const handleInference = async (request, response) => {
  const prompt = typeof request.body.prompt === 'string' ? request.body.prompt.trim() : '';

  if (!prompt) {
    response.status(400).json({
      error: 'Invalid request',
      message: 'prompt must be a non-empty string'
    });
    return;
  }

  const idempotencyKey =
    request.headers['idempotency-key'] || generateIdempotencyKey();
  const startedAt = Date.now();
  const gatewayLatencyMs = await simulateGatewayLatency(prompt);

  try {
    const workerResponse = await forwardToWorker(prompt);

    response.json({
      idempotencyKey,
      service: SERVICE_NAME,
      communityUseCase: 'public-library resource navigation',
      gatewayLatencyMs,
      totalLatencyMs: Date.now() - startedAt,
      routing: {
        strategy: 'single-worker simulation',
        targetService: 'model-worker-service',
        workerId: workerResponse.workerId
      },
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
    console.error(`[${SERVICE_NAME}] Worker request failed: ${error.message}`);
    response.status(503).json({
      idempotencyKey,
      service: SERVICE_NAME,
      error: 'Service Unavailable',
      message: 'Model worker service is currently unavailable',
      timestamp: new Date().toISOString()
    });
  }
};

app.post(['/inference', '/v1/inference'], handleInference);

app.use((_request, response) => {
  response.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`[${SERVICE_NAME}] listening on port ${PORT}`);
  console.log(`[${SERVICE_NAME}] POST /inference or /v1/inference`);
  console.log(`[${SERVICE_NAME}] GET /status`);
});
