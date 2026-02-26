'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  FileText,
  Shield,
  AlertTriangle,
  Clock,
  Loader2,
  MoreHorizontal,
  TrendingUp,
} from 'lucide-react';
import { STATUS_COLORS } from './types';

interface ContractDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detailLoading: boolean;
  selectedContract: any;
  onChangeOrderAction: (co: any, action: string) => void;
  onPreviewBudgetImpact: (co: any) => void;
  formatCurrency: (value: number) => string;
  formatDate: (dateString: string) => string;
}

export function ContractDetailDialog({
  open,
  onOpenChange,
  detailLoading,
  selectedContract,
  onChangeOrderAction,
  onPreviewBudgetImpact,
  formatCurrency,
  formatDate,
}: ContractDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-dark-card border-gray-700 text-white max-w-4xl max-h-[90vh] overflow-y-auto">
        {detailLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          </div>
        ) : selectedContract ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">{selectedContract.contract.title}</DialogTitle>
              <DialogDescription className="text-gray-400">
                {selectedContract.contract.contractNumber} •{' '}
                {selectedContract.contract.subcontractor.companyName}
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="overview" className="mt-4">
              <TabsList className="bg-dark-surface">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="insurance">
                  Insurance ({selectedContract.contract.insuranceCerts?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="changeOrders">
                  Change Orders ({selectedContract.contract.changeOrders?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="payments">
                  Payments ({selectedContract.contract.payments?.length || 0})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4 space-y-4">
                {/* Financials */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-dark-surface rounded-lg p-4">
                    <p className="text-gray-400 text-sm">Original Value</p>
                    <p className="text-white text-xl font-bold">
                      {formatCurrency(selectedContract.financials.originalValue)}
                    </p>
                  </div>
                  <div className="bg-dark-surface rounded-lg p-4">
                    <p className="text-gray-400 text-sm">Approved COs</p>
                    <p className="text-purple-400 text-xl font-bold">
                      +{formatCurrency(selectedContract.financials.approvedCOs)}
                    </p>
                  </div>
                  <div className="bg-dark-surface rounded-lg p-4">
                    <p className="text-gray-400 text-sm">Current Value</p>
                    <p className="text-white text-xl font-bold">
                      {formatCurrency(selectedContract.financials.currentValue)}
                    </p>
                  </div>
                  <div className="bg-dark-surface rounded-lg p-4">
                    <p className="text-gray-400 text-sm">% Complete</p>
                    <p className="text-orange-500 text-xl font-bold">
                      {selectedContract.financials.percentComplete}%
                    </p>
                  </div>
                </div>

                {/* Insurance Compliance */}
                {selectedContract.insuranceCompliance && (
                  <div className="bg-dark-surface rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className="w-5 h-5 text-blue-400" />
                      <h4 className="text-white font-medium">Insurance Compliance</h4>
                      {selectedContract.insuranceCompliance.isCompliant ? (
                        <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400">
                          Compliant
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs rounded-full bg-red-500/20 text-red-400">
                          Issues Found
                        </span>
                      )}
                    </div>
                    {selectedContract.insuranceCompliance.issues.length > 0 && (
                      <ul className="space-y-1">
                        {selectedContract.insuranceCompliance.issues.map((issue: string, i: number) => (
                          <li key={i} className="text-red-400 text-sm flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            {issue}
                          </li>
                        ))}
                      </ul>
                    )}
                    {selectedContract.insuranceCompliance.warnings.length > 0 && (
                      <ul className="space-y-1 mt-2">
                        {selectedContract.insuranceCompliance.warnings.map((warning: string, i: number) => (
                          <li key={i} className="text-yellow-400 text-sm flex items-start gap-2">
                            <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            {warning}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Scope of Work */}
                {selectedContract.contract.scopeOfWork && (
                  <div className="bg-dark-surface rounded-lg p-4">
                    <h4 className="text-white font-medium mb-2">Scope of Work</h4>
                    <p className="text-gray-300 text-sm whitespace-pre-wrap">
                      {selectedContract.contract.scopeOfWork}
                    </p>
                  </div>
                )}

                {/* View PDF */}
                {selectedContract.contract.fileUrl && (
                  <Button
                    onClick={() => window.open(selectedContract.contract.fileUrl, '_blank')}
                    variant="outline"
                    className="w-full border-gray-600 text-gray-300 hover:bg-dark-surface"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    View Contract PDF
                  </Button>
                )}
              </TabsContent>

              <TabsContent value="insurance" className="mt-4">
                {selectedContract.contract.insuranceCerts?.length > 0 ? (
                  <div className="space-y-3">
                    {selectedContract.contract.insuranceCerts.map((cert: any) => (
                      <div key={cert.id} className="bg-dark-surface rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-white font-medium">{cert.certType.replace('_', ' ')}</p>
                            <p className="text-gray-400 text-sm">{cert.insurer}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-white">{formatCurrency(cert.coverageAmount)}</p>
                            <p
                              className={`text-sm ${
                                new Date(cert.expirationDate) < new Date()
                                  ? 'text-red-400'
                                  : 'text-gray-400'
                              }`}
                            >
                              Expires: {formatDate(cert.expirationDate)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    No insurance certificates uploaded yet
                  </div>
                )}
              </TabsContent>

              <TabsContent value="changeOrders" className="mt-4">
                {selectedContract.contract.changeOrders?.length > 0 ? (
                  <div className="space-y-3">
                    {selectedContract.contract.changeOrders.map((co: any) => (
                      <div key={co.id} className="bg-dark-surface rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-white font-medium">
                                {co.coNumber}: {co.title}
                              </p>
                              <span
                                className={`px-2 py-0.5 text-xs rounded-full ${STATUS_COLORS[co.status]}`}
                              >
                                {co.status}
                              </span>
                            </div>
                            <p className="text-gray-400 text-sm">{co.reason.replace('_', ' ')}</p>
                            {co.daysAdded > 0 && (
                              <p className="text-yellow-400 text-sm mt-1">
                                +{co.daysAdded} days schedule impact
                              </p>
                            )}
                          </div>
                          <div className="text-right mr-4">
                            <p className="text-white">{formatCurrency(co.originalAmount)}</p>
                            {co.approvedAmount && (
                              <p className="text-green-400 text-sm">
                                Approved: {formatCurrency(co.approvedAmount)}
                              </p>
                            )}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-gray-400 hover:text-white"
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-dark-card border-gray-600">
                              {co.status === 'DRAFT' && (
                                <DropdownMenuItem
                                  onClick={() => onChangeOrderAction(co, 'submit')}
                                  className="text-gray-200 hover:bg-dark-surface"
                                >
                                  Submit for Review
                                </DropdownMenuItem>
                              )}
                              {co.status === 'SUBMITTED' && (
                                <DropdownMenuItem
                                  onClick={() => onChangeOrderAction(co, 'review')}
                                  className="text-gray-200 hover:bg-dark-surface"
                                >
                                  Mark Under Review
                                </DropdownMenuItem>
                              )}
                              {(co.status === 'SUBMITTED' || co.status === 'UNDER_REVIEW') && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => onPreviewBudgetImpact(co)}
                                    className="text-green-400 hover:bg-dark-surface"
                                  >
                                    <TrendingUp className="w-4 h-4 mr-2" />
                                    Preview Budget Impact &amp; Approve
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator className="bg-gray-600" />
                                  <DropdownMenuItem
                                    onClick={() => onChangeOrderAction(co, 'reject')}
                                    className="text-red-400 hover:bg-dark-surface"
                                  >
                                    Reject
                                  </DropdownMenuItem>
                                </>
                              )}
                              {co.status === 'APPROVED' && (
                                <DropdownMenuItem
                                  onClick={() => onChangeOrderAction(co, 'void')}
                                  className="text-red-400 hover:bg-dark-surface"
                                >
                                  Void Change Order
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">No change orders yet</div>
                )}
              </TabsContent>

              <TabsContent value="payments" className="mt-4">
                {selectedContract.contract.payments?.length > 0 ? (
                  <div className="space-y-3">
                    {selectedContract.contract.payments.map((payment: any) => (
                      <div key={payment.id} className="bg-dark-surface rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-white font-medium">
                              Payment #{payment.paymentNumber}
                            </p>
                            <p className="text-gray-400 text-sm">
                              {payment.invoiceNumber && `Invoice: ${payment.invoiceNumber}`}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-white">{formatCurrency(payment.currentPayment)}</p>
                            <span
                              className={`px-2 py-0.5 text-xs rounded-full ${
                                STATUS_COLORS[payment.status] || 'bg-gray-500/20 text-gray-400'
                              }`}
                            >
                              {payment.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">No payments recorded yet</div>
                )}
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
