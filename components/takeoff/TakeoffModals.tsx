'use client';

import type { MaterialTakeoff, TakeoffLineItem } from '@/types/takeoff';
import { TakeoffLineItemEditModal } from '../takeoff-line-item-edit-modal';
import { TakeoffAddItemModal } from '../takeoff-add-item-modal';
import { UnitPriceManager } from '../unit-price-manager';
import { TakeoffBudgetSyncModal } from '../takeoff-budget-sync-modal';
import { TakeoffAggregationModal } from '../takeoff-aggregation-modal';
import { TakeoffQADashboard } from '../takeoff-qa-dashboard';
import { TakeoffLaborPlanning } from '../takeoff-labor-planning';
import TakeoffLearningPanel from '../takeoff-learning-panel';
import { PriceUpdateModal } from '../price-update-modal';

interface TakeoffModalsProps {
  takeoff: MaterialTakeoff | null;
  projectSlug: string;
  editingItem: TakeoffLineItem | null;
  showEditModal: boolean;
  onCloseEditModal: () => void;
  onItemUpdate: (item: TakeoffLineItem) => void;
  showAddModal: boolean;
  onCloseAddModal: () => void;
  onAddItem: (item: Partial<TakeoffLineItem>) => Promise<void>;
  addingItem: boolean;
  showPriceManager: boolean;
  onClosePriceManager: () => void;
  onPricesUpdated: () => void;
  showBudgetSync: boolean;
  onCloseBudgetSync: () => void;
  onSyncComplete: () => void;
  showAggregation: boolean;
  onCloseAggregation: () => void;
  onAggregationCreated: () => void;
  showQA: boolean;
  onCloseQA: () => void;
  onRefresh: () => void;
  showLaborPlanning: boolean;
  onCloseLaborPlanning: () => void;
  showLearning: boolean;
  onCloseLearning: () => void;
  showPriceUpdate: boolean;
  onClosePriceUpdate: () => void;
}

/**
 * Component that manages all takeoff-related modals
 */
export function TakeoffModals({
  takeoff,
  projectSlug,
  editingItem,
  showEditModal,
  onCloseEditModal,
  onItemUpdate,
  showAddModal,
  onCloseAddModal,
  onAddItem,
  addingItem,
  showPriceManager,
  onClosePriceManager,
  onPricesUpdated,
  showBudgetSync,
  onCloseBudgetSync,
  onSyncComplete,
  showAggregation,
  onCloseAggregation,
  onAggregationCreated,
  showQA,
  onCloseQA,
  onRefresh,
  showLaborPlanning,
  onCloseLaborPlanning,
  showLearning,
  onCloseLearning,
  showPriceUpdate,
  onClosePriceUpdate,
}: TakeoffModalsProps) {
  return (
    <>
      {/* Edit Item Modal */}
      {editingItem && takeoff && (
        <TakeoffLineItemEditModal
          open={showEditModal}
          onClose={onCloseEditModal}
          item={editingItem}
          takeoffId={takeoff.id}
          onSave={onItemUpdate}
        />
      )}

      {/* Add Item Modal */}
      {takeoff && (
        <TakeoffAddItemModal
          open={showAddModal}
          onClose={onCloseAddModal}
          onSave={onAddItem}
          saving={addingItem}
        />
      )}

      {/* Unit Price Manager Modal */}
      {showPriceManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
          <div className="w-full max-w-4xl mx-4">
            <UnitPriceManager
              projectSlug={projectSlug}
              onClose={onClosePriceManager}
              onPricesUpdated={onPricesUpdated}
            />
          </div>
        </div>
      )}

      {/* Budget Sync Modal */}
      {takeoff && (
        <TakeoffBudgetSyncModal
          isOpen={showBudgetSync}
          onClose={onCloseBudgetSync}
          takeoffId={takeoff.id}
          takeoffName={takeoff.name}
          projectSlug={projectSlug}
          onSyncComplete={onSyncComplete}
        />
      )}

      {/* Aggregation Modal */}
      <TakeoffAggregationModal
        isOpen={showAggregation}
        onClose={onCloseAggregation}
        projectSlug={projectSlug}
        onAggregationCreated={onAggregationCreated}
      />

      {/* QA Dashboard */}
      {takeoff && (
        <TakeoffQADashboard
          isOpen={showQA}
          onClose={onCloseQA}
          takeoffId={takeoff.id}
          takeoffName={takeoff.name}
          onRefresh={onRefresh}
        />
      )}

      {/* Labor Planning */}
      {takeoff && (
        <TakeoffLaborPlanning
          isOpen={showLaborPlanning}
          onClose={onCloseLaborPlanning}
          takeoffId={takeoff.id}
          takeoffName={takeoff.name}
        />
      )}

      {/* Learning Panel */}
      {takeoff && showLearning && (
        <TakeoffLearningPanel
          takeoffId={takeoff.id}
          takeoffName={takeoff.name}
          onClose={onCloseLearning}
        />
      )}

      {/* Price Update Modal */}
      <PriceUpdateModal
        isOpen={showPriceUpdate}
        onClose={onClosePriceUpdate}
        projectSlug={projectSlug}
        onPricesUpdated={onPricesUpdated}
      />
    </>
  );
}
