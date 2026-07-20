## Services

* **api-gateway-service** 
* Receives user prompts through one API endpoint and forwards each request to the available coordinator service.

* **coordinator-service** 
* Chooses the best available inference worker based on queue length, workload, service health.

* **inference-worker-service** 
* Simulates running an LLM request, returns a generated response with a delayed based on the workload and reports its current workload such number of queued requests, maximum number of requests it can handle at a time.
