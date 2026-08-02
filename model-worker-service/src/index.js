const crypto = require('crypto');
const os = require('os');
const express = require('express');
const { createClient } = require('redis');

const app = express();
const PORT = Number(process.env.PORT ?? 3001);
const WORKER_ID = process.env.WORKER_ID ?? os.hostname();
const REDIS_URL = process.env.REDIS_URL ?? 'redis://redis:6379';
const CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS ?? 120);
const MAX_CONCURRENT_REQUESTS = Number(process.env.MAX_CONCURRENT_REQUESTS ?? 10);

const workerState = {
  workerId: WORKER_ID,
  hostname: os.hostname(),
  capacity: MAX_CONCURRENT_REQUESTS,
  currentLoad: 0,
  health: 'healthy',
  processingCount: 0,
  cacheHits: 0,
  cacheMisses: 0,
  lastHealthCheck: new Date().toISOString()
};

const redisClient = createClient({ url: REDIS_URL });
let redisConnected = false;

redisClient.on('error', (error) => {
  redisConnected = false;
  console.error(`[model-worker-service:${WORKER_ID}] Redis error: ${error.message}`);
});
redisClient.on('ready', () => {
  redisConnected = true;
});

app.use(express.json({ limit: '32kb' }));

const delay = (milliseconds) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const cacheKeyFor = (prompt) => {
  const normalizedPrompt = prompt.trim().toLowerCase();
  const digest = crypto.createHash('sha256').update(normalizedPrompt).digest('hex');
  return `inference:${digest}`;
};

const topicForPrompt = (prompt) => {
  const normalizedPrompt = prompt.toLowerCase();
  const topics = ['food', 'housing', 'education', 'benefits'];
  return topics.find((topic) => normalizedPrompt.includes(topic)) ?? 'community-resources';
};

const simulateInference = async (prompt) => {
  const tokenCount = Math.ceil(prompt.length / 4);
  const processingTimeMs = 250 + Math.min(tokenCount * 55, 1250);
  const topic = topicForPrompt(prompt);

  await delay(processingTimeMs);

  return {
    prompt: prompt.substring(0, 100),
    result: `Synthetic ${topic} information prepared for a public-service resource navigator.`,
    topic,
    tokenCount,
    computedLatencyMs: processingTimeMs,
    generatedAt: new Date().toISOString(),
    notice: 'Simulation only; no real model or personal data was used.'
  };
};

app.get('/health', (_request, response) => {
  workerState.lastHealthCheck = new Date().toISOString();

  response.json({
    ...workerState,
    status: workerState.health,
    redisConnected,
    timestamp: workerState.lastHealthCheck
  });
});

app.get('/cache-stats', (_request, response) => {
  const cacheRequests = workerState.cacheHits + workerState.cacheMisses;

  response.json({
    workerId: WORKER_ID,
    cacheHits: workerState.cacheHits,
    cacheMisses: workerState.cacheMisses,
    cacheHitRate: cacheRequests === 0 ? 0 : workerState.cacheHits / cacheRequests,
    redisConnected,
    cacheTtlSeconds: CACHE_TTL_SECONDS
  });
});

app.post('/process', async (request, response) => {
  const prompt = typeof request.body.prompt === 'string' ? request.body.prompt.trim() : '';

  if (!prompt) {
    response.status(400).json({
      error: 'Invalid request',
      message: 'prompt must be a non-empty string'
    });
    return;
  }

  const requestStartedAt = Date.now();
  const cacheKey = cacheKeyFor(prompt);

  if (redisConnected) {
    try {
      const cachedValue = await redisClient.get(cacheKey);

      if (cachedValue) {
        workerState.cacheHits += 1;
        const cachedInference = JSON.parse(cachedValue);
        const processingTimeMs = Date.now() - requestStartedAt;
        console.log(
          `[model-worker-service:${WORKER_ID}] cache=hit key=${cacheKey} latencyMs=${processingTimeMs}`
        );

        response.json({
          workerId: WORKER_ID,
          servedBy: os.hostname(),
          cacheStatus: 'hit',
          cacheKey,
          processingTimeMs,
          ...cachedInference,
          capacity: workerState.capacity,
          currentLoad: workerState.currentLoad,
          timestamp: new Date().toISOString()
        });
        return;
      }
    } catch (error) {
      console.error(`[model-worker-service:${WORKER_ID}] Cache read failed: ${error.message}`);
    }
  }

  if (workerState.currentLoad >= workerState.capacity) {
    response.status(503).json({
      error: 'Worker Overloaded',
      message: 'Worker is at capacity and cannot accept new requests',
      workerId: WORKER_ID,
      currentLoad: workerState.currentLoad,
      capacity: workerState.capacity
    });
    return;
  }

  workerState.cacheMisses += 1;
  workerState.currentLoad += 1;
  workerState.processingCount += 1;

  try {
    const inference = await simulateInference(prompt);

    if (redisConnected) {
      await redisClient.setEx(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(inference));
    }

    const processingTimeMs = Date.now() - requestStartedAt;
    console.log(
      `[model-worker-service:${WORKER_ID}] cache=miss key=${cacheKey} latencyMs=${processingTimeMs}`
    );

    response.json({
      workerId: WORKER_ID,
      servedBy: os.hostname(),
      cacheStatus: 'miss',
      cacheKey,
      processingTimeMs,
      ...inference,
      capacity: workerState.capacity,
      currentLoad: Math.max(0, workerState.currentLoad - 1),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`[model-worker-service:${WORKER_ID}] Inference failed: ${error.message}`);
    response.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to process inference request',
      workerId: WORKER_ID
    });
  } finally {
    workerState.currentLoad = Math.max(0, workerState.currentLoad - 1);
  }
});

const start = async () => {
  try {
    await redisClient.connect();
    redisConnected = true;
    console.log(`[model-worker-service:${WORKER_ID}] Connected to Redis`);
  } catch (error) {
    console.error(`[model-worker-service:${WORKER_ID}] Starting without Redis: ${error.message}`);
  }

  app.listen(PORT, () => {
    console.log(`[model-worker-service:${WORKER_ID}] listening on port ${PORT}`);
  });
};

const shutdown = async () => {
  if (redisClient.isOpen) {
    await redisClient.quit();
  }
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();
