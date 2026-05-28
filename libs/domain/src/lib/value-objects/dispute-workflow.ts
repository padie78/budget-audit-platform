/* =============================================================================
 * Dispute Workflow — estado/historial del workflow de disputa generado por AI.
 *
 * Vive dentro de `ai_analysis` del item AUDIT y es el "Source of Truth" del
 * proceso de disputa. La generación del email vive en `DisputeEmail` (otro VO).
 * ============================================================================= */

export type DisputeWorkflowStatus =
  | 'PENDING_REVIEW'
  | 'IN_REVIEW'
  | 'APPROVED_TO_SEND'
  | 'SENT'
  | 'RESOLVED'
  | 'ESCALATED'
  | 'DISMISSED';

export interface DisputeWorkflowHistoryEntry {
  timestamp: Date;
  action: string;
  user: string;
  note?: string;
}

export interface DisputeWorkflowProps {
  status: DisputeWorkflowStatus;
  /** Pointer S3 al draft de email generado por el AI. */
  generatedEmailDraftS3: string | null;
  history: ReadonlyArray<DisputeWorkflowHistoryEntry>;
  /** Departamento o usuario asignado. */
  assignedTo: string | null;
}

export class DisputeWorkflow {
  private constructor(private readonly props: DisputeWorkflowProps) {}

  static of(props: DisputeWorkflowProps): DisputeWorkflow {
    return new DisputeWorkflow(props);
  }

  static initialize(params: {
    assignedTo?: string | null;
    triggeredBy?: string;
    at?: Date;
  }): DisputeWorkflow {
    const at = params.at ?? new Date();
    return new DisputeWorkflow({
      status: 'PENDING_REVIEW',
      generatedEmailDraftS3: null,
      history: [
        {
          timestamp: at,
          action: 'SYSTEM_FLAGGED',
          user: params.triggeredBy ?? 'AI_ENGINE',
        },
      ],
      assignedTo: params.assignedTo ?? null,
    });
  }

  /** Devuelve un nuevo VO con la transición de estado registrada. */
  transition(params: {
    nextStatus: DisputeWorkflowStatus;
    user: string;
    note?: string;
    at?: Date;
  }): DisputeWorkflow {
    const at = params.at ?? new Date();
    return new DisputeWorkflow({
      ...this.props,
      status: params.nextStatus,
      history: [
        ...this.props.history,
        {
          timestamp: at,
          action: `STATUS_CHANGED_TO_${params.nextStatus}`,
          user: params.user,
          note: params.note,
        },
      ],
    });
  }

  attachDraft(s3Pointer: string): DisputeWorkflow {
    return new DisputeWorkflow({
      ...this.props,
      generatedEmailDraftS3: s3Pointer,
    });
  }

  get status(): DisputeWorkflowStatus { return this.props.status; }
  get generatedEmailDraftS3(): string | null {
    return this.props.generatedEmailDraftS3;
  }
  get history(): ReadonlyArray<DisputeWorkflowHistoryEntry> {
    return this.props.history;
  }
  get assignedTo(): string | null { return this.props.assignedTo; }
}
