export interface Subcontractor {
  id: string;
  companyName: string;
  tradeType: string;
}

export interface Contract {
  id: string;
  contractNumber: string;
  title: string;
  contractType: string;
  status: string;
  originalValue: number;
  currentValue: number;
  retainagePercent: number;
  effectiveDate: string;
  completionDate: string;
  subcontractor: {
    companyName: string;
    tradeType: string;
  };
  _count: {
    insuranceCerts: number;
    changeOrders: number;
    payments: number;
  };
  totalApprovedCOs: number;
  totalPaid: number;
  totalRetainage: number;
  aiExtracted: boolean;
  aiConfidence?: number;
}

export interface ContractStats {
  totalContracts: number;
  activeContracts: number;
  totalOriginalValue: number;
  totalCurrentValue: number;
  totalApprovedCOs: number;
  totalPaid: number;
  totalRetainage: number;
  balanceRemaining: number;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  documentCount: number;
  ownerId: string;
}

export interface ManualData {
  title: string;
  contractType: string;
  originalValue: string;
  effectiveDate: string;
  completionDate: string;
  retainagePercent: string;
  scopeOfWork: string;
}

export const CONTRACT_TYPES = [
  { value: 'SUBCONTRACT', label: 'Subcontract' },
  { value: 'PURCHASE_ORDER', label: 'Purchase Order' },
  { value: 'SERVICE_AGREEMENT', label: 'Service Agreement' },
  { value: 'MASTER_AGREEMENT', label: 'Master Agreement' },
  { value: 'TASK_ORDER', label: 'Task Order' },
];

export const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-500/20 text-gray-400',
  PENDING_REVIEW: 'bg-yellow-500/20 text-yellow-400',
  PENDING_APPROVAL: 'bg-orange-500/20 text-orange-400',
  ACTIVE: 'bg-green-500/20 text-green-400',
  SUSPENDED: 'bg-red-500/20 text-red-400',
  COMPLETED: 'bg-blue-500/20 text-blue-400',
  TERMINATED: 'bg-red-500/20 text-red-400',
  EXPIRED: 'bg-gray-500/20 text-gray-400',
};
