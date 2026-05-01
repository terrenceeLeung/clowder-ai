// F179: Governance State Machine — knowledge lifecycle (KD-4, KD-15)

import type Database from 'better-sqlite3';

export type GovernanceStatus =
  | 'ingested' | 'normalized' | 'needs_review'
  | 'approved' | 'active' | 'stale' | 'retired' | 'failed';

const VALID_TRANSITIONS: Record<GovernanceStatus, readonly GovernanceStatus[]> = {
  ingested: ['normalized', 'failed'],
  normalized: ['needs_review', 'approved'],
  needs_review: ['approved', 'retired'],
  approved: ['active'],
  active: ['stale', 'retired'],
  stale: ['retired'],
  retired: [],
  failed: ['ingested'],
};

export class GovernanceStateMachine {
  private readonly autoApproveThreshold: number;

  constructor(
    private readonly db: Database.Database,
    opts?: { autoApproveThreshold?: number },
  ) {
    this.autoApproveThreshold = opts?.autoApproveThreshold ?? 0.8;
  }

  transition(anchor: string, to: GovernanceStatus): void {
    const current = this.getStatus(anchor);
    if (current === null) {
      throw new Error(`Document "${anchor}" not found`);
    }
    const allowed = VALID_TRANSITIONS[current];
    if (!allowed.includes(to)) {
      throw new Error(`Invalid transition: ${current} → ${to} for "${anchor}"`);
    }
    this.db.prepare('UPDATE evidence_docs SET governance_status = ? WHERE anchor = ?')
      .run(to, anchor);
  }

  getStatus(anchor: string): GovernanceStatus | null {
    const row = this.db.prepare(
      'SELECT governance_status FROM evidence_docs WHERE anchor = ?'
    ).get(anchor) as { governance_status: string | null } | undefined;
    if (!row || row.governance_status === null) return null;
    return row.governance_status as GovernanceStatus;
  }

  listByStatus(status: GovernanceStatus, packId?: string): string[] {
    if (packId) {
      return (this.db.prepare(
        'SELECT anchor FROM evidence_docs WHERE governance_status = ? AND pack_id = ?'
      ).all(status, packId) as Array<{ anchor: string }>).map((r) => r.anchor);
    }
    return (this.db.prepare(
      'SELECT anchor FROM evidence_docs WHERE governance_status = ?'
    ).all(status) as Array<{ anchor: string }>).map((r) => r.anchor);
  }

  autoRoute(anchor: string, confidence: number): GovernanceStatus {
    const target: GovernanceStatus = confidence >= this.autoApproveThreshold
      ? 'approved'
      : 'needs_review';
    this.transition(anchor, target);
    return target;
  }
}
