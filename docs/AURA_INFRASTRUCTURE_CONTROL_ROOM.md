# AURA Infrastructure Control Room

## Scope

The Infrastructure Control Room at `/cluster` belongs to the **AURA base project**, not AURA OS. Its purpose is to keep one stable Main Core while making additional owner-authorized servers available as optional **Project Arms** for future project capacity.

It is not a cloud dashboard, a remote-control plane, a k3s installer or a claim that a real cluster already exists.

## Operating model

### Main Core

The **Main Core** is the stable server carrying the base AURA project: API/registry, administrator control surface and primary state/backup responsibility. It is marked `MAIN_CORE_PROTECTED` only after an explicit local administrator record. Registering, pooling or removing Project Arms never restarts, migrates, demotes, replaces or changes the Main Core.

### Project Arms

A **Project Arm** is a separately owned, authorized server registered with:

- a local inventory/host reference (not a credential)
- one intended role: `compute`, `media`, `research`, `automation`, `ai_local` or `archive`
- operator-entered declared cores, memory and storage
- declared interface contracts: `aura_api`, `mcp`, `queue`, `storage_manifest` and/or `metrics`
- a local project boundary note

A newly registered arm is `DECLARED` and `NOT_CONNECTED_NOT_PROBED`. Declaring an arm into the planning pool yields `POOL_DECLARED_NOT_CONNECTED`; it does **not** allocate work, open a network connection, probe a host or create a real compute pool.

## Safety and truth boundary

The Control Room deliberately does not accept or store:

- SSH private keys, passwords, API keys, tokens, kubeconfigs or k3s join tokens
- customer data, project media or runtime data
- arbitrary shell commands or remote provisioning payloads

It never performs SSH, port scans, agent installation, firewall changes, deployment, Kubernetes creation, workload scheduling, migration, rollback or restart. It produces local inventory and a connection manifest only.

A `declared_capacity` value is operator-entered planning data. It must never be presented as measured live capacity, available compute, HA, active cluster state or workload throughput.

## APIs

```text
GET  /api/cluster/status
GET  /api/cluster/preflight
GET  /api/cluster/handoff
POST /api/cluster/core
POST /api/cluster/arms
POST /api/cluster/arms/:id/pool
POST /api/cluster/arms/:id/remove
```

All mutations require an `approved_by` name and an `admin_authorization` note. Protecting the Main Core additionally requires `confirm: "PROTECT_MAIN_CORE"`; removing a local Project Arm inventory record requires `confirm: "REMOVE_PROJECT_ARM"`.

## Connection sequence for a real future cluster

1. Stabilize and back up the Main Core first.
2. Record only servers the owner controls and has authorized.
3. Decide the topology deliberately. A real highly available control plane usually needs an odd quorum, commonly three control-plane nodes; it is not equivalent to a generic four-server script.
4. Store credentials outside AURA in a dedicated secret manager.
5. Review network segmentation, private API access, ingress/TLS, RBAC, backup/restore and incident/rollback plan.
6. Generate and review deployment tooling separately. Execute it on owner-controlled infrastructure only after a human approval.
7. Attach measured, authenticated telemetry only through an explicit future agent/metrics integration. Until then, keep the Control Room labels as declared/local planning state.

## Relationship to AURA Admin Copilot

The Admin Copilot may later summarize Control Room information only once a compact, authorized telemetry contract exists. It must keep the same no-action boundary: advising an operator is not server control, provisioning or approval.
