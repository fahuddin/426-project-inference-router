import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';

const cacheHits = new Counter('cache_hits');
const cacheMisses = new Counter('cache_misses');
const validInferenceResponses = new Rate('valid_inference_responses');

export const options = {
  vus: 10,
  duration: '30s',
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2500'],
    valid_inference_responses: ['rate>0.99']
  }
};

const baseUrl = __ENV.BASE_URL ?? 'http://localhost:3000';
const commonPrompts = [
  'What food assistance resources are available near a public library?',
  'Where can a family find temporary housing support?',
  'What education programs are available for adult learners?',
  'How can a resident learn about public benefit programs?'
];

export default function () {
  const useCommonPrompt = Math.random() < 0.7;
  const prompt = useCommonPrompt
    ? commonPrompts[Math.floor(Math.random() * commonPrompts.length)]
    : `Unique community resource request from virtual user ${__VU}, iteration ${__ITER}`;
  const response = http.post(
    `${baseUrl}/v1/inference`,
    JSON.stringify({ prompt }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': `k6-${__VU}-${__ITER}`
      }
    }
  );

  let body = {};
  try {
    body = response.json();
  } catch (_error) {
    body = {};
  }

  const valid = check(response, {
    'status is 200': (result) => result.status === 200,
    'response identifies a worker replica': () =>
      body.workerId === 'worker-001' || body.workerId === 'worker-002',
    'response reports cache path': () =>
      body.cacheStatus === 'hit' || body.cacheStatus === 'miss',
    'response contains domain result': () =>
      typeof body.result === 'string' && body.result.includes('public-service resource navigator')
  });

  validInferenceResponses.add(valid);
  if (body.cacheStatus === 'hit') {
    cacheHits.add(1);
  } else if (body.cacheStatus === 'miss') {
    cacheMisses.add(1);
  }

  sleep(0.1);
}
