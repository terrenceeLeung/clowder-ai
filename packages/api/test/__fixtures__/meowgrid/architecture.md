# MeowGrid Architecture Overview

MeowGrid is a distributed task scheduling engine optimized for high-throughput workloads with automatic failover and horizontal scaling.

## Core Components

### Whisker Coordinator

The Whisker Coordinator is the control plane of MeowGrid. It manages:
- Task queue distribution across PawWorker nodes
- Health monitoring via heartbeat protocol (every 3 seconds)
- Automatic rebalancing when nodes join or leave the cluster

The Coordinator runs as a single leader with hot standby. Leader election uses the Raft consensus protocol with a 500ms election timeout.

### PawWorker

PawWorker nodes are the execution units. Each PawWorker:
- Pulls tasks from the NapQueue assigned to it
- Executes tasks in isolated sandboxes (cgroup v2)
- Reports completion status back to the Whisker Coordinator
- Can handle up to 1000 concurrent tasks per node

### NapQueue

NapQueue is MeowGrid's persistent task queue built on a log-structured storage engine. Features:
- At-least-once delivery guarantee
- Priority-based scheduling (4 levels: critical, high, normal, low)
- Delayed task support with millisecond precision
- Automatic dead-letter routing after 3 failed attempts
