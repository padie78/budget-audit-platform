export interface ThresholdPolicyDto {
  percentTolerance: number;
  absoluteTolerance: number | null;
  autoApprovalUpTo: number | null;
  currency: string;
}

export interface SupplierDto {
  id: string;
  name: string;
  taxId: string;
  contactEmail: string;
  fidelityScore: number;
  thresholdPolicy: ThresholdPolicyDto;
  createdAt: string;
  updatedAt: string;
}
