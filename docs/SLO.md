# Service Level Objectives

These initial targets apply during a ten-minute k6 test with 100 concurrent
synthetic clients and at least two healthy model-worker instances. Invalid
client requests are excluded from reliability calculations. Percentiles and
success rates will be measured from Prometheus metrics and k6 results.

## `inference-router-service` (owner: georgesalomon)

- **Latency SLO:** `POST /route` must return a worker selection within **200 ms at the 95th percentile (p95)**. A slower decision adds waiting time before inference begins and may cause a library patron's session to time out.
- **Reliability SLO:** `POST /route` must successfully select a healthy worker for at least **99.5%** of valid requests while at least one healthy worker has capacity. Routing is safe to retry with **at-least-once delivery** because the request ID is idempotent; repeated routing attempts must not create more than one accepted inference job.

## `model-worker-service` (owner: fahuddin)

- **Latency SLO:** `POST /infer` must return a simulated inference result within **2,000 ms at the 95th percentile (p95)**. Beyond this threshold, librarians and resource navigators keep clients waiting and can serve fewer people.
- **Reliability SLO:** `POST /infer` must return a successful result for at least **98.0%** of accepted requests, including the configured scripted-failure test. Delivery attempts may be **at least once**, but the worker must deduplicate by request ID so that the logical inference is completed **at most once**; duplicate work would waste capacity and increase queueing for other users.

## `api-gateway-service` (shared)

- **Latency SLO:** `POST /v1/inference` must return the complete inference response within **2,500 ms at the 95th percentile (p95)**. This is the user-visible limit: exceeding it can cause clients on shared computers or limited connections to abandon the request.
- **Reliability SLO:** `POST /v1/inference` must return a successful response for at least **99.0%** of valid requests while at least one worker remains healthy. A client may retry with **at-least-once delivery**, but the gateway must preserve the idempotency key so retries produce **at most one** logical inference job and one stable result.

If no worker is healthy, the gateway should return `503 Service Unavailable`
within the latency threshold rather than wait indefinitely. That response is an
expected availability signal, but it still counts against the end-to-end
reliability target because the user did not receive the requested result.
