# MeowGrid FAQ

## General

### What is MeowGrid?

MeowGrid is a distributed task scheduling engine designed for high-throughput workloads. It consists of a Whisker Coordinator (control plane), PawWorker nodes (execution), and NapQueue (persistent task queue).

### What task types does MeowGrid support?

MeowGrid supports any task that can be packaged as a container image or a shell command. Tasks are executed in isolated cgroup v2 sandboxes on PawWorker nodes.

## Operations

### How do I handle a FurBall Deadlock?

A FurBall Deadlock occurs when circular task dependencies block all PawWorkers. Run `meowctl diagnose furball` to identify it, then restart the Whisker Coordinator and flush the NapQueue buffer. Enable `deadlock_detection=true` to prevent future occurrences.

### What happens when NapQueue is full?

When NapQueue reaches capacity (configurable via `max_queue_size`, default 1 million tasks), new submissions are rejected with error code `QUEUE_FULL`. Solutions:
1. Add more PawWorker nodes to increase processing throughput
2. Increase `max_queue_size` if storage allows
3. Review and cancel stale tasks with `meowctl task prune --older-than 24h`

### How do I upgrade MeowGrid without downtime?

Use rolling upgrade: update PawWorkers one at a time (they drain gracefully in 30 seconds), then update the hot standby Coordinator, trigger a failover, and update the original leader.

## Troubleshooting

### Why are tasks stuck in PENDING state?

Common causes:
1. All PawWorkers are at capacity — check `meowgrid_worker_utilization`
2. Task has unmet dependencies — check with `meowctl task deps <task_id>`
3. NapQueue partition is unhealthy — run `meowctl queue health`

### Why is the Coordinator unreachable?

Check network connectivity between nodes. The Coordinator listens on port 7777 by default. Verify with `meowctl ping coordinator`. If the leader failed, check if Raft election completed on the standby node.
