# MeowGrid Operations Manual

This manual covers deployment, monitoring, scaling, and disaster recovery procedures for MeowGrid clusters.

## Deployment

### Prerequisites

- Linux kernel 5.10+ with cgroup v2 enabled
- At least 3 nodes for high availability (1 Coordinator + 2 PawWorkers)
- NapQueue requires SSD storage with at least 100GB free space
- Network latency between nodes must be under 10ms

### Initial Setup

1. Install MeowGrid binary on all nodes
2. Configure `meowgrid.toml` with cluster seed addresses
3. Start the Whisker Coordinator on the designated leader node
4. Start PawWorker processes on execution nodes
5. Verify cluster health with `meowctl cluster status`

## Monitoring

### Key Metrics

Monitor these metrics for cluster health:
- `meowgrid_queue_depth` — tasks waiting in NapQueue (alert if > 10000)
- `meowgrid_worker_utilization` — PawWorker CPU usage (alert if > 85% sustained)
- `meowgrid_coordinator_heartbeat_lag` — time since last heartbeat (alert if > 10s)
- `meowgrid_task_completion_rate` — tasks completed per second
- `meowgrid_dead_letter_count` — failed tasks routed to dead-letter queue

### Dashboard Setup

MeowGrid exports Prometheus metrics on port 9191. Configure Grafana dashboards using the provided templates in `/etc/meowgrid/dashboards/`.

## Scaling

### Horizontal Scaling (Adding PawWorkers)

To add a new PawWorker to an existing cluster:
1. Install MeowGrid on the new node
2. Configure `meowgrid.toml` with existing cluster seed addresses
3. Start the PawWorker process: `meowctl worker start`
4. The Whisker Coordinator automatically detects the new node within 10 seconds
5. Task rebalancing begins immediately — no manual intervention needed

### Vertical Scaling

Increase PawWorker capacity by adjusting `max_concurrent_tasks` in the configuration. Default is 1000, maximum is 5000 per node depending on task complexity.

## Disaster Recovery

### Coordinator Failover

If the Whisker Coordinator fails:
1. The hot standby automatically promotes within 2 seconds (Raft election)
2. In-flight tasks are NOT lost — PawWorkers retain their assigned tasks
3. New task submissions queue in NapQueue until the new leader is ready
4. Verify failover with `meowctl coordinator status`

### PawWorker Recovery

If a PawWorker goes down:
1. The Coordinator detects failure within 9 seconds (3 missed heartbeats)
2. Tasks assigned to the failed worker are re-queued automatically
3. Other PawWorkers pick up the re-queued tasks
4. No data loss occurs — task state is persisted in NapQueue

### Full Cluster Recovery

For catastrophic failures affecting all nodes:
1. Restore NapQueue data from the latest snapshot (taken every 6 hours)
2. Start Whisker Coordinator first, then PawWorkers
3. Run `meowctl cluster reconcile` to rebuild task assignments
4. Tasks that were in-flight during the failure will be re-executed (at-least-once)

### FurBall Deadlock Recovery

A FurBall Deadlock occurs when circular task dependencies cause all PawWorkers to block. To recover:
1. Identify the deadlock: `meowctl diagnose furball`
2. Restart the Whisker Coordinator: `meowctl coordinator restart --force`
3. Flush the NapQueue buffer: `meowctl queue flush --dead-letter`
4. Re-submit affected tasks with dependency graph analysis: `meowctl task resubmit --analyze-deps`
5. Enable deadlock detection for future prevention: `meowctl config set deadlock_detection=true`
