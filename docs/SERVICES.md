# Initial Service List

The two-person team targets three custom services: one owned service per member
and one shared entry point.

- `inference-router-service` (owner: georgesalomon): Tracks mock worker health and load, selects an available worker for each request, and fails over when the selected worker is unavailable.
- `model-worker-service` (owner: fahuddin): Simulates language-model inference with configurable processing latency, capacity limits, health state, and scripted failures.
- `api-gateway-service` (shared): Validates incoming inference requests, assigns or accepts an idempotency key, forwards each request to the router, and returns a consistent response to the client.

Replicated instances of `model-worker-service` are nodes of the same custom
service rather than additional services. Caddy, Redis, Prometheus, and Grafana
may be added later as infrastructure and are not included in this count.
