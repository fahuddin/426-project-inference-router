# Sprint 3 Load-Test Baseline

## Test Configuration

The baseline was run on August 2, 2026 with the complete Docker Compose stack:
the API gateway, Caddy, two model-worker replicas, Redis, and the worker
sidecar. The k6 script sent requests to `POST /v1/inference` with **10 virtual
users for 30 seconds**. Seventy percent of iterations selected from four common
public-resource prompts, while thirty percent used unique prompts. This mix was
chosen to exercise both shared-cache hits and misses under concurrent load.

Command used:

```bash
docker compose --profile load-test run --rm k6
```

## Results

| Metric | Baseline result |
| --- | ---: |
| Requests completed | 330 |
| Request rate | 10.49 requests/second |
| Error rate | 0.00% |
| p50 latency | 493.93 ms |
| p95 latency | 2.03 s |
| p99 latency | 2.31 s |
| Cache hits | 220 (66.7%) |
| Cache misses | 110 (33.3%) |

All 1,320 k6 checks passed. Responses identified either `worker-001` or
`worker-002`, reported `cacheStatus` as `hit` or `miss`, and contained a
domain-relevant synthetic result. A separate failover check stopped
`model-worker-1`; the gateway continued returning HTTP 200 responses from
`worker-002`.

## SLO Comparison

The `api-gateway-service`, owned by georgesalomon for Sprint 2 and exercised as
the entry point in this test, has a p95 latency SLO of **2,500 ms** for
`POST /v1/inference`. The measured p95 was **2.03 seconds (2,030 ms)**, so the
gateway latency SLO was met with approximately 470 ms of margin. Its reliability
SLO requires at least **99.0%** successful valid requests. All 330 requests
succeeded and the measured error rate was 0.00%, so the observed success rate
was **100%** and the reliability SLO was also met.

The `model-worker-service` latency SLO is **2,000 ms at p95**. The current k6
measurement is end-to-end through the gateway rather than an isolated worker
measurement, but its p95 of 2,030 ms is 30 ms above that threshold. Therefore,
this baseline does not demonstrate that the worker latency SLO is met. The
worker reliability target is at least 98.0%; the end-to-end run completed every
request successfully, providing evidence that the worker path met that target
during this test.

## Interpretation

The p50 of 493.93 ms reflects the benefit of Redis: cache hits avoided simulated
inference and frequently completed inside the gateway's own latency range. The
p95 and p99 values are much higher because cache misses performed the full
synthetic computation, making miss processing the current bottleneck. Caddy
distributed requests across both workers and service continued after one
replica stopped, so replica availability was not the limiting factor.

The next improvement should reduce duplicate computation when concurrent
requests miss on the same key, for example with request coalescing or a short
Redis lock. Increasing the common-prompt hit rate would lower tail latency, but
forcing an unrealistically high hit rate would hide the actual miss cost. Later
load tests should retain a mixed workload and compare p50, p95, p99, throughput,
error rate, and cache hit rate against this baseline.
