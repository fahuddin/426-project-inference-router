const express = require('express');

const app = express();
const PORT = 3001;

app.use(express.json());

const workerState = {
  workerId: 'worker-001',
  capacity: 100,
  currentLoad: 0,
  health: 'healthy',
  processingCount: 0,
  lastHealthCheck: new Date().toISOString()
};

//Simulate inference processing with latency
function simulateInference(prompt) {
  return new Promise((resolve) => {
    const tokenCount = (prompt.length / 4)
    // 50ms base + 100ms per token
    const processingTime = 50 + (tokenCount * 100); setTimeout(() => {
      // return some simple simulated result
    const results = [
'Information about available resources has been retrieved.',
'Processing complete. Recommended next steps provided.',
'Data analysis finished. Summary prepared for review.',
'Request processed successfully. Results available.',
'Analysis complete. Returning synthesized information.'
      ];

    const result = results[Math.floor(Math.random() * results.length)];
    resolve({
            processingTime,
    result,
            tokenCount
      });
    }, processingTime);});}

// GET /health - Worker health status endpoint
app.get('/health', (req, res) => {
  workerState.lastHealthCheck = new Date().toISOString();
  
  res.json({
workerId: workerState.workerId,
status: workerState.health,
currentLoad: workerState.currentLoad,
capacity: workerState.capacity,
processingCount: workerState.processingCount,
timestamp: workerState.lastHealthCheck
  });
});

app.post('/process', async (req, res) => {
    const { prompt } = req.body;
    // Validate request
    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
    return res.status(400).json({
      error: 'Invalid request',
      message: 'prompt field is required and must be a non-empty string'
    });
  }
  // Check if at capacity
  if (workerState.currentLoad >= workerState.capacity) {
return res.status(503).json({
        error: 'Worker Overloaded',
      message: 'Worker is at capacity and cannot accept new requests',
      workerId: workerState.workerId,
      currentLoad: workerState.currentLoad,
      capacity: workerState.capacity
    });
  }
  workerState.currentLoad += 10;
  workerState.processingCount += 1;

  try {
    // Simulate inference processing (with latency)
const { processingTime, result, tokenCount } = await simulateInference(prompt);

workerState.currentLoad = Math.max(0, workerState.currentLoad - 10);

    // Return domain-relevant response
    return res.json({
      workerId: workerState.workerId,
      prompt: prompt.substring(0, 100), // Return first 100 chars of prompt
      processingTimeMs: processingTime,
      result: result,
      tokenCount: tokenCount,
      timestamp: new Date().toISOString(),
      capacity: workerState.capacity,
      currentLoad: workerState.currentLoad
    });
  } catch (error) {
    workerState.currentLoad = Math.max(0, workerState.currentLoad - 10);
    console.error('Error during inference:', error.message);
    return res.status(500).json({
error: 'Internal Server Error',
message: 'Failed to process inference request',
workerId: workerState.workerId
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`[model-worker-service] listening on port ${PORT}`);
  console.log(`[model-worker-service] POST /process - simulate inference with latency (50ms base + 100ms per token)`);
  console.log(`[model-worker-service] GET /health - worker state and load information`);
  console.log(`[model-worker-service] Worker capacity: ${workerState.capacity}, Initial load: ${workerState.currentLoad}`);
});
