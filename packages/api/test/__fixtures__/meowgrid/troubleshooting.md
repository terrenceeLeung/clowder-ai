# MeowGrid Troubleshooting Guide

## Error Codes

### ERR_FURBALL_001: Circular Dependency Detected

**Symptom:** Tasks hang indefinitely, worker utilization drops to 0%.
**Cause:** Two or more tasks have circular dependencies (A depends on B, B depends on A).
**Fix:** Run `meowctl diagnose furball` to identify the cycle. Cancel one task in the cycle to break the deadlock. Enable `deadlock_detection=true` for automatic prevention.

### ERR_NAPQUEUE_002: Queue Write Failure

**Symptom:** Task submissions fail with "write error" message.
**Cause:** NapQueue storage is full or the SSD has I/O errors.
**Fix:** Check disk space with `df -h /var/meowgrid/napqueue`. If full, prune old completed tasks: `meowctl task prune --completed --older-than 7d`. If I/O errors, check SSD health with `smartctl`.

### ERR_HEARTBEAT_003: Worker Heartbeat Timeout

**Symptom:** PawWorker marked as offline despite being running.
**Cause:** Network partition or high system load delaying heartbeat responses.
**Fix:** Check network connectivity between worker and coordinator. If load is the issue, increase `heartbeat_timeout` from default 9s to 15s in `meowgrid.toml`.

### ERR_RAFT_004: Split Brain Detected

**Symptom:** Two coordinators both claim leadership.
**Cause:** Network partition lasting longer than the election timeout.
**Fix:** Immediately stop one coordinator. Run `meowctl cluster reconcile` after network is restored. Increase `election_timeout` if partitions are frequent.

## Log Analysis

### Coordinator Logs

Location: `/var/log/meowgrid/coordinator.log`

Key log patterns:
- `[RAFT] leader elected` — successful leader election
- `[RAFT] term changed` — potential split-brain, investigate
- `[HEALTH] worker lost` — PawWorker missed heartbeats
- `[QUEUE] rebalance triggered` — task redistribution in progress

### PawWorker Logs

Location: `/var/log/meowgrid/worker.log`

Key log patterns:
- `[TASK] execution failed` — task error, check task-specific logs
- `[SANDBOX] cgroup limit exceeded` — task used too much CPU/memory
- `[HEARTBEAT] send failed` — network issue to coordinator
