# Project Description

## Domain

Inference Router is a simulated distributed web system that accepts synthetic
language-model prompts and routes them to replicated mock inference workers. It
models an AI information service used by public libraries and nonprofit
community-resource organizations. Librarians and resource navigators could use
such a service to help patrons find understandable information about local food,
housing, education, and public-benefit resources. The project does not process
real personal data or call a real language model; prompt content, processing
time, worker capacity, and failures are all simulated so the team can study the
system safely.

## Scalability Problem

Inference requests have variable processing costs because long prompts and
large simulated key-value caches occupy a worker longer than short requests. A
traffic spike after a local emergency, benefits deadline, or public
announcement can therefore create long queues and head-of-line blocking if all
requests are sent to one worker. The system must accept concurrent requests,
track worker load, and distribute work so that one slow request does not delay
every user.

The router must also respond when a worker becomes slow, crashes, or fails a
health check. It needs a current view of worker availability, must avoid sending
new work to an unhealthy node, and should retry eligible requests on another
worker without processing the same logical request twice. If every worker is
unavailable, the gateway must return a clear failure instead of allowing
requests to wait indefinitely. These conditions make latency, health
coordination, idempotency, and failover central design concerns rather than
optional optimizations.

## Computing for the Common Good

The primary beneficiaries are public-library patrons and clients of nonprofit
resource centers, especially people who rely on shared computers, limited
mobile data, or staff assistance to reach online services. Fast and reliable
responses help librarians and resource navigators serve more people and reduce
the time clients spend waiting for basic resource information.

When the system is slow or unavailable, a patron may abandon the session, lose
access when a public computer reservation ends, or leave without information
about food, housing, education, or benefit programs. These harms fall most
heavily on people with limited connectivity, time, transportation, or access to
other support. The project therefore treats bounded response time, explicit
failure behavior, and recovery from worker failure as requirements tied to the
community being served.
