'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import {
  Calculator,
  Download,
  X,
  FileText,
  DollarSign,
  Plus,
  AlertTriangle,
  ArrowRightCircle,
  Combine,
  FileStack,
  ShieldCheck,
  HardHat,
  Brain,
  BarChart2,
  RefreshCw,
  Globe
} from 'lucide-react';
import EarthworkCalculator from './earthwork-calculator';
import TakeoffDataChecklist from './takeoff-data-checklist';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { WithTooltip } from '@/components/ui/icon-button';
import { toast } from 'sonner';
import { CSI_DIVISIONS } from '@/lib/csi-divisions';
import { QuickActionMenu, type ActionItem } from '@/components/ui/header-action-menu';

// Import new infrastructure
import type { TakeoffLineItem, MaterialTakeoff, CategorySummary, CostSummary, MEPData, BudgetItem } from '@/types/takeoff';
import { useTakeoffData } from '@/hooks/useTakeoffData';
import { useTakeoffFilters } from '@/hooks/useTakeoffFilters';
import { useTakeoffSelection } from '@/hooks/useTakeoffSelection';
import { getCategorySummaries, getTotalQuantityByUnit, getTotalCost } from '@/lib/takeoff-calculations';
import { getConfidenceColor } from '@/lib/takeoff-formatters';
import { TakeoffFilters } from './takeoff/TakeoffFilters';
import { TakeoffSummary } from './takeoff/TakeoffSummary';
import { TakeoffActions } from './takeoff/TakeoffActions';
import { TakeoffTable } from './takeoff/TakeoffTable';
import { TakeoffModals } from './takeoff/TakeoffModals';

interface MaterialTakeoffManagerProps {
  projectSlug: string;
  onClose?: () => void;
}

export function MaterialTakeoffManager({ projectSlug, onClose }: MaterialTakeoffManagerProps) {
  const { data: session } = useSession() || {};
  
  // Use new hooks for data, filters, and selection
  const {
    takeoffs,
    selectedTakeoff,
    loading,
    fetchTakeoffs,
    selectTakeoff,
    refreshTakeoffs,
    setTakeoffs,
    setSelectedTakeoff,
  } = useTakeoffData(projectSlug);

  const {
    filteredItems,
    searchQuery,
    setSearchQuery,
    filterCategory,
    setFilterCategory,
    filterVerified,
    setFilterVerified,
    viewMode,
    setViewMode,
    availableCategories,
  } = useTakeoffFilters(selectedTakeoff, takeoffs);

  const {
    selectedItems,
    toggleItemSelection,
    selectAllItems,
    clearSelection,
    isSelected,
    selectedCount,
  } = useTakeoffSelection();

  // Local state for UI
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  
  // Edit modal state
  const [editingItem, setEditingItem] = useState<TakeoffLineItem | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Add new item state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [bulkVerifying, setBulkVerifying] = useState(false);
  const [showPriceManager, setShowPriceManager] = useState(false);
  const [showBudgetSync, setShowBudgetSync] = useState(false);
  const [showAggregation, setShowAggregation] = useState(false);
  const [showQA, setShowQA] = useState(false);
  const [showLaborPlanning, setShowLaborPlanning] = useState(false);
  const [showLearning, setShowLearning] = useState(false);
  const [showPriceUpdate, setShowPriceUpdate] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null);
  const [mepData, setMepData] = useState<MEPData | null>(null);
  const [extractingMEP, setExtractingMEP] = useState(false);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [hasBudgetDoc, setHasBudgetDoc] = useState(false);

  useEffect(() => {
    if (projectSlug) {
      fetchTakeoffs();
      fetchMEPData();
      fetchBudgetItems();
    }
  }, [projectSlug]);

  const fetchMEPData = async () => {
    try {
      const response = await fetch(`/api/projects/${projectSlug}/mep-takeoff`);
      if (response.ok) {
        const data = await response.json();
        setMepData(data);
      }
    } catch (error) {
      console.error('Error fetching MEP data:', error);
    }
  };

  // Fetch budget items to populate CSI divisions from budget document
  const fetchBudgetItems = async () => {
    try {
      const response = await fetch(`/api/projects/${projectSlug}/budget/items`);
      if (response.ok) {
        const data = await response.json();
        if (data.items && data.items.length > 0) {
          setBudgetItems(data.items);
          setHasBudgetDoc(true);
          console.log('[Budget] Loaded', data.items.length, 'budget items for CSI view');
        }
      }
    } catch (error) {
      console.error('Error fetching budget items:', error);
    }
  };

  const triggerMEPExtraction = async (type?: string) => {
    try {
      setExtractingMEP(true);
      toast.loading('Extracting MEP data from documents...', { id: 'mep-extract' });
      
      const response = await fetch(`/api/projects/${projectSlug}/mep-takeoff`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('MEP extraction failed');
      }

      const data = await response.json();
      setMepData(data);
      
      toast.dismiss('mep-extract');
      toast.success(`Extracted ${data.itemsCreated || 0} MEP items totaling $${(data.totalCost || 0).toLocaleString()}`);
      
      // Refresh takeoffs to include new MEP takeoff
      await fetchTakeoffs();
    } catch (error) {
      console.error('Error extracting MEP:', error);
      toast.dismiss('mep-extract');
      toast.error('Failed to extract MEP data');
    } finally {
      setExtractingMEP(false);
    }
  };

  const handleChecklistAction = (actionType: string) => {
    switch (actionType) {
      case 'electrical':
      case 'plumbing':
      case 'hvac':
        triggerMEPExtraction(actionType);
        break;
      case 'pricing':
        handleAutoCalculate();
        break;
      case 'earthwork':
        // Show earthwork calculator
        toast.info('Use the Earthwork Calculator in the Analysis menu');
        break;
      case 'structural':
        // Trigger quantity extraction
        toast.info('Processing documents for structural quantities...');
        break;
      default:
        break;
    }
  };

  // Get ALL items from ALL takeoffs (for CSI Division view aggregation)
  // Note: This applies filters across all takeoffs for CSI view
  const getAllTakeoffItems = useMemo((): TakeoffLineItem[] => {
    const allItems: TakeoffLineItem[] = [];
    
    takeoffs.forEach((takeoff) => {
      takeoff.lineItems.forEach((item) => {
        // Apply same filters as filteredItems but across all takeoffs
        // Search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const matchesSearch = 
            item.itemName.toLowerCase().includes(query) ||
            item.description?.toLowerCase().includes(query) ||
            item.category.toLowerCase().includes(query) ||
            item.location?.toLowerCase().includes(query);
          if (!matchesSearch) return;
        }

        // Category filter
        if (filterCategory !== 'all' && item.category !== filterCategory) {
          return;
        }

        // Verified filter
        if (filterVerified === 'verified' && !item.verified) return;
        if (filterVerified === 'unverified' && item.verified) return;

        allItems.push(item);
      });
    });
    
    return allItems;
  }, [takeoffs, searchQuery, filterCategory, filterVerified]);

  // Calculate summaries using utility functions
  const categories = useMemo(() => getCategorySummaries(filteredItems), [filteredItems]);
  const quantityTotals = useMemo(() => getTotalQuantityByUnit(filteredItems), [filteredItems]);
  const totalCost = useMemo(() => getTotalCost(filteredItems), [filteredItems]);

  // Keyword to CSI division mapping - sorted by specificity (longer/more specific first)
  // IMPORTANT: More specific keywords should appear first within each division
  const CSI_KEYWORD_MAP: Array<{ keywords: string[]; division: number }> = [
    // Division 26 - Electrical (high priority - catch electrical items before generic "finish")
    { keywords: ['electrical', 'electric'], division: 26 },
    { keywords: ['switch', 'single pole', 'dimmer', 'three way', '3-way', 'toggle'], division: 26 },
    { keywords: ['outlet', 'receptacle', 'duplex', 'gfci', 'gfi'], division: 26 },
    { keywords: ['lighting', 'light fixture', 'troffer', 'led', 'luminaire', 'sconce', 'pendant'], division: 26 },
    { keywords: ['panel', 'panelboard', 'switchgear', 'disconnect', 'breaker', 'circuit'], division: 26 },
    { keywords: ['conduit', 'emt', 'rigid', 'mc cable', 'romex', 'wire', 'cable', 'wiring'], division: 26 },
    { keywords: ['transformer', 'motor', 'generator', 'ups'], division: 26 },
    { keywords: ['junction box', 'j-box', 'pull box', 'device box'], division: 26 },
    
    // Division 21 - Fire Suppression  
    { keywords: ['fire alarm', 'fire protection', 'sprinkler', 'fire suppression', 'standpipe'], division: 21 },
    { keywords: ['horn', 'strobe', 'horn/strobe', 'smoke detector', 'pull station', 'annunciator'], division: 21 },
    { keywords: ['fire head', 'fire sprinkler head', 'fire pipe'], division: 21 },
    
    // Division 22 - Plumbing
    { keywords: ['plumbing', 'plumb'], division: 22 },
    { keywords: ['piping', 'pipe', 'pvc', 'copper pipe', 'cast iron'], division: 22 },
    { keywords: ['sink', 'lavatory', 'lav', 'basin'], division: 22 },
    { keywords: ['toilet', 'water closet', 'wc', 'urinal', 'bidet'], division: 22 },
    { keywords: ['faucet', 'valve', 'ball valve', 'gate valve', 'check valve'], division: 22 },
    { keywords: ['water heater', 'domestic water', 'hot water', 'cold water'], division: 22 },
    { keywords: ['drain', 'p-trap', 'cleanout', 'floor drain'], division: 22 },
    { keywords: ['shower', 'tub', 'bathtub'], division: 22 },
    
    // Division 23 - HVAC
    { keywords: ['hvac', 'mechanical', 'mech'], division: 23 },
    { keywords: ['ductwork', 'duct', 'flex duct', 'spiral duct'], division: 23 },
    { keywords: ['air handler', 'ahu', 'rtu', 'rooftop unit', 'package unit'], division: 23 },
    { keywords: ['vav', 'variable air volume', 'fan coil', 'fcu'], division: 23 },
    { keywords: ['diffuser', 'grille', 'register', 'return air', 'supply air'], division: 23 },
    { keywords: ['thermostat', 'bms', 'ddc', 'controls'], division: 23 },
    { keywords: ['exhaust fan', 'ventilation', 'makeup air', 'mau'], division: 23 },
    { keywords: ['chiller', 'boiler', 'furnace', 'heat pump', 'mini split'], division: 23 },
    
    // Division 27 - Communications
    { keywords: ['communications', 'comm', 'telecom', 'data'], division: 27 },
    { keywords: ['network', 'cat5', 'cat6', 'fiber', 'ethernet'], division: 27 },
    { keywords: ['audio visual', 'av', 'speaker', 'projector'], division: 27 },
    { keywords: ['intercom', 'paging', 'nurse call'], division: 27 },
    
    // Division 28 - Electronic Safety and Security
    { keywords: ['security', 'access control', 'card reader'], division: 28 },
    { keywords: ['cctv', 'camera', 'surveillance'], division: 28 },
    { keywords: ['intrusion', 'motion sensor', 'door contact'], division: 28 },
    
    // Division 09 - Finishes (after MEP to prevent false matches)
    { keywords: ['flooring', 'floor finish', 'vct', 'lvt', 'vinyl floor', 'carpet', 'tile floor', 'epoxy floor'], division: 9 },
    { keywords: ['ceiling', 'act', 'acoustic ceiling', 'suspended ceiling', 'gypsum ceiling', 'drop ceiling'], division: 9 },
    { keywords: ['wall finish', 'wall covering', 'wallpaper', 'wall tile', 'wainscot'], division: 9 },
    { keywords: ['baseboard', 'cove base', 'rubber base', 'wood base'], division: 9 },
    { keywords: ['drywall', 'gypsum board', 'gyp board', 'sheetrock', 'partition', 'stud'], division: 9 },
    { keywords: ['painting', 'paint', 'primer', 'stain', 'coating'], division: 9 },
    { keywords: ['ceramic', 'porcelain', 'mosaic', 'terrazzo'], division: 9 },
    { keywords: ['finishes', 'finish schedule'], division: 9 },
    
    // Division 03 - Concrete
    { keywords: ['concrete', 'slab', 'footing', 'foundation', 'rebar', 'reinforcing', 'formwork', 'pour'], division: 3 },
    { keywords: ['sog', 'slab on grade', 'grade beam', 'pier', 'spread footing'], division: 3 },
    
    // Division 04 - Masonry
    { keywords: ['masonry', 'cmu', 'block', 'brick', 'mortar', 'grout'], division: 4 },
    { keywords: ['stone', 'veneer', 'limestone', 'granite'], division: 4 },
    
    // Division 05 - Metals
    { keywords: ['structural steel', 'steel beam', 'steel column', 'wide flange'], division: 5 },
    { keywords: ['metal deck', 'deck', 'joist', 'bar joist', 'open web'], division: 5 },
    { keywords: ['railing', 'handrail', 'guardrail', 'bollard'], division: 5 },
    { keywords: ['misc metals', 'miscellaneous metals', 'embed', 'anchor'], division: 5 },
    
    // Division 06 - Wood, Plastics & Composites
    { keywords: ['lumber', 'wood', 'woods & plastics', 'casework', 'millwork'], division: 6 },
    { keywords: ['cabinet', 'countertop', 'counter'], division: 6 },
    { keywords: ['framing', 'plywood', 'osb', 'sheathing'], division: 6 },
    { keywords: ['trim', 'molding', 'crown', 'casing', 'blocking'], division: 6 },
    
    // Division 07 - Thermal & Moisture Protection
    { keywords: ['roofing', 'roof', 'membrane', 'tpo', 'epdm', 'shingle'], division: 7 },
    { keywords: ['insulation', 'batt', 'rigid insulation', 'spray foam'], division: 7 },
    { keywords: ['waterproofing', 'dampproofing', 'flashing'], division: 7 },
    { keywords: ['vapor barrier', 'air barrier', 'weather barrier'], division: 7 },
    { keywords: ['caulk', 'sealant', 'joint sealant', 'expansion joint'], division: 7 },
    
    // Division 08 - Openings
    { keywords: ['doors & windows', 'doors_windows'], division: 8 },
    { keywords: ['door', 'hollow metal', 'hm door', 'wood door', 'aluminum door'], division: 8 },
    { keywords: ['window', 'glazing', 'glass', 'storefront', 'curtain wall'], division: 8 },
    { keywords: ['hardware', 'lockset', 'closer', 'hinge', 'panic'], division: 8 },
    { keywords: ['frame', 'door frame', 'borrowed lite', 'sidelight'], division: 8 },
    
    // Division 10 - Specialties
    { keywords: ['specialties', 'signage', 'sign'], division: 10 },
    { keywords: ['lockers', 'locker'], division: 10 },
    { keywords: ['toilet accessories', 'restroom accessories', 'paper dispenser', 'soap dispenser'], division: 10 },
    { keywords: ['toilet partition', 'bathroom partition'], division: 10 },
    { keywords: ['fire extinguisher', 'extinguisher cabinet'], division: 10 },
    { keywords: ['corner guard', 'wall protection', 'handrail'], division: 10 },
    
    // Division 11 - Equipment
    { keywords: ['equipment', 'appliance', 'kitchen equipment', 'food service'], division: 11 },
    { keywords: ['refrigerator', 'freezer', 'ice machine', 'dishwasher'], division: 11 },
    { keywords: ['oven', 'range', 'cooktop', 'hood'], division: 11 },
    
    // Division 12 - Furnishings
    { keywords: ['furnishings', 'furniture', 'desk', 'chair', 'table'], division: 12 },
    { keywords: ['window treatment', 'blinds', 'shades', 'drapes'], division: 12 },
    
    // Division 31 - Earthwork
    { keywords: ['earthwork', 'sitework', 'site work'], division: 31 },
    { keywords: ['grading', 'excavation', 'backfill', 'compaction'], division: 31 },
    { keywords: ['subgrade', 'aggregate', 'gravel', 'crushed stone'], division: 31 },
    { keywords: ['geotextile', 'erosion', 'silt fence', 'soil', 'fill'], division: 31 },
    
    // Division 32 - Exterior Improvements
    { keywords: ['paving', 'asphalt', 'concrete paving'], division: 32 },
    { keywords: ['curb', 'gutter', 'sidewalk', 'walkway'], division: 32 },
    { keywords: ['landscaping', 'landscape', 'planting'], division: 32 },
    { keywords: ['striping', 'parking', 'pavement marking'], division: 32 },
    { keywords: ['fence', 'fencing', 'gate'], division: 32 },
    { keywords: ['retaining wall', 'site wall'], division: 32 },
    { keywords: ['irrigation', 'sprinkler system', 'lawn'], division: 32 },
    { keywords: ['tree', 'shrub', 'mulch', 'sod', 'seed', 'hardscape'], division: 32 },
    
    // Division 33 - Utilities
    { keywords: ['utilities', 'utility'], division: 33 },
    { keywords: ['storm drain', 'storm sewer', 'stormwater'], division: 33 },
    { keywords: ['sanitary', 'sanitary sewer', 'sewer line'], division: 33 },
    { keywords: ['water main', 'water line', 'water service'], division: 33 },
    { keywords: ['hydrant', 'fire hydrant'], division: 33 },
    { keywords: ['manhole', 'catch basin', 'inlet'], division: 33 },
    { keywords: ['detention', 'retention', 'pond'], division: 33 },
    { keywords: ['gas line', 'natural gas'], division: 33 },
    { keywords: ['ductbank', 'underground electric', 'electrical ductbank'], division: 33 },
    
    // Division 01 - General Requirements (catch-all, should be last)
    { keywords: ['01 - general requirements', 'general requirements'], division: 1 },
    { keywords: ['mobilization', 'demobilization'], division: 1 },
    { keywords: ['temporary', 'temp power', 'temp fence'], division: 1 },
    { keywords: ['supervision', 'overhead', 'general conditions'], division: 1 },
    { keywords: ['permit', 'fee', 'bond', 'insurance'], division: 1 },
  ];

  // Map categories to CSI divisions
  const getCSIDivisionForCategory = (category: string): CSIDivision | undefined => {
    const categoryLower = category.toLowerCase();
    
    // Skip generic "01 - General Requirements" - we'll handle items individually
    if (categoryLower === '01 - general requirements' || categoryLower === 'general requirements') {
      return CSI_DIVISIONS.find(d => d.number === 1);
    }
    
    // Check against keyword map
    for (const mapping of CSI_KEYWORD_MAP) {
      for (const keyword of mapping.keywords) {
        if (categoryLower.includes(keyword)) {
          return CSI_DIVISIONS.find(d => d.number === mapping.division);
        }
      }
    }

    return undefined;
  };

  // Get CSI division for a specific item - always analyzes item name/description first
  const getCSIDivisionForItem = (item: TakeoffLineItem): CSIDivision | undefined => {
    const itemNameLower = (item.itemName || '').toLowerCase();
    const descLower = (item.description || '').toLowerCase();
    const categoryLower = (item.category || '').toLowerCase();
    
    // Combine item name, description, and category for comprehensive matching
    const combined = `${itemNameLower} ${descLower} ${categoryLower}`;
    
    // ALWAYS check item name/description first for more accurate classification
    // This ensures items like "single_pole_switch" go to Electrical even if they're
    // in a generic category
    for (const mapping of CSI_KEYWORD_MAP) {
      for (const keyword of mapping.keywords) {
        if (combined.includes(keyword)) {
          return CSI_DIVISIONS.find(d => d.number === mapping.division);
        }
      }
    }
    
    // If no keyword match found, check category directly
    const categoryMatch = getCSIDivisionForCategory(item.category);
    if (categoryMatch) {
      return categoryMatch;
    }
    
    // Default to General Requirements if nothing matches
    return CSI_DIVISIONS.find(d => d.number === 1);
  };

  // Map budget phaseCode (100, 200, etc.) to CSI division number (1, 2, etc.)
  const budgetPhaseToCSI = (phaseCode: number | null | undefined): number => {
    if (!phaseCode) return 1;
    return Math.floor(phaseCode / 100);
  };

  // Calculate volume/area conversions for construction items
  // - Concrete: LF + dimensions → CY
  // - Excavation/Fill: SF + depth → CY  
  // - Grading: SF → SY
  const calculateConcreteVolume = (item: TakeoffLineItem): { volume: number; unit: string } | null => {
    const itemLower = (item.itemName + ' ' + (item.description || '')).toLowerCase();
    
    // Handle area items - convert SF to SY for paving, grading, etc.
    if (item.unit === 'SF') {
      const isArea = itemLower.includes('paving') || 
                     itemLower.includes('grading') ||
                     itemLower.includes('slab') ||
                     itemLower.includes('floor') ||
                     itemLower.includes('deck');
      
      if (isArea && item.quantity > 100) {
        return { volume: item.quantity / 9, unit: 'SY' };
      }
      
      // Check for depth info for excavation/fill volume calculation
      const depthMatch = itemLower.match(/(\d+(?:\.\d+)?)\s*(?:"|in(?:ch)?|ft|')\s*(?:deep|depth|thick)/i);
      const isEarthwork = itemLower.includes('excavat') || 
                          itemLower.includes('fill') || 
                          itemLower.includes('backfill') ||
                          itemLower.includes('topsoil') ||
                          itemLower.includes('subgrade');
      
      if (depthMatch && isEarthwork) {
        let depthFt = parseFloat(depthMatch[1]);
        if (depthMatch[0].includes('"') || depthMatch[0].toLowerCase().includes('in')) {
          depthFt = depthFt / 12; // Convert inches to feet
        }
        const volumeCY = (item.quantity * depthFt) / 27; // SF * FT / 27 = CY
        return { volume: volumeCY, unit: 'CY' };
      }
    }
    
    // Handle each (EA) items - masonry block count to volume
    if (item.unit === 'EA') {
      const isCMU = itemLower.includes('cmu') || itemLower.includes('block') || itemLower.includes('masonry');
      const sizeMatch = itemLower.match(/(\d+)x(\d+)x(\d+)/);
      if (isCMU && sizeMatch) {
        const l = parseInt(sizeMatch[1]);
        const w = parseInt(sizeMatch[2]);
        const h = parseInt(sizeMatch[3]);
        const volumePerBlock = (l * w * h) / 1728; // CF per block
        const totalCF = volumePerBlock * item.quantity;
        return { volume: totalCF / 27, unit: 'CY' };
      }
    }
    
    // Only process linear feet items below this point
    if (!['LF'].includes(item.unit)) return null;
    const isConcrete = itemLower.includes('concrete') || 
                       itemLower.includes('footing') || 
                       itemLower.includes('slab') ||
                       itemLower.includes('foundation');
    
    if (!isConcrete) return null;
    
    // Look for dimension patterns like "16"x8"", "16'x8'", "16x8"
    const dimPattern = /(\d+\.?\d*)[""'']?\s*x\s*(\d+\.?\d*)[""'']?/i;
    const match = (item.description || item.itemName).match(dimPattern);
    
    if (!match) return null;
    
    const dim1 = parseFloat(match[1]);
    const dim2 = parseFloat(match[2]);
    
    // Assume dimensions are in inches if small values
    const width = dim1 > 24 ? dim1 : dim1 / 12; // Convert inches to feet
    const depth = dim2 > 24 ? dim2 : dim2 / 12; // Convert inches to feet
    
    if (item.unit === 'LF') {
      // Linear feet × cross-section area = cubic feet
      const cubicFeet = item.quantity * width * depth;
      const cubicYards = cubicFeet / 27;
      return { volume: cubicYards, unit: 'CY' };
    } else if (item.unit === 'SF') {
      // Square feet × depth = cubic feet
      const cubicFeet = item.quantity * depth;
      const cubicYards = cubicFeet / 27;
      return { volume: cubicYards, unit: 'CY' };
    }
    
    return null;
  };

  // Convert budget item to virtual takeoff line item
  interface BudgetItemInput {
    id: string;
    name: string;
    description?: string;
    phaseName?: string;
    budgetedAmount?: number;
    costCode?: string;
  }
  const budgetItemToTakeoffItem = (budgetItem: BudgetItemInput): TakeoffLineItem => ({
    id: `budget-${budgetItem.id}`,
    category: budgetItem.phaseName || 'Budget Item',
    itemName: budgetItem.name,
    description: budgetItem.description || '',
    quantity: 1,
    unit: 'LS',
    unitCost: budgetItem.budgetedAmount || 0,
    totalCost: budgetItem.budgetedAmount || 0,
    location: budgetItem.costCode || undefined,
    verified: true,
    confidence: 1.0,
    // Mark as from budget
    notes: `From Budget Document (Cost Code: ${budgetItem.costCode || 'N/A'})`,
  });

  // Calculate CSI groups using utility function
  // Note: CSI_KEYWORD_MAP is kept here for now - can be moved to utility later
  const csiGroups = useMemo(() => {
    const divisionGroups: Map<number, Map<string, { items: TakeoffLineItem[]; totalCost: number; fromBudget: boolean }>> = new Map();

    // STEP 1: Add budget items first (these define the divisions and their budgeted costs)
    if (hasBudgetDoc && budgetItems.length > 0) {
      console.log('[CSI Debug] Processing', budgetItems.length, 'budget items');
      
      budgetItems.forEach((budgetItem) => {
        const csiNumber = budgetPhaseToCSI(budgetItem.phaseCode);
        const categoryName = budgetItem.phaseName || `Division ${csiNumber}`;
        
        if (!divisionGroups.has(csiNumber)) {
          divisionGroups.set(csiNumber, new Map());
        }
        
        const divisionMap = divisionGroups.get(csiNumber)!;
        if (!divisionMap.has(categoryName)) {
          divisionMap.set(categoryName, { items: [], totalCost: 0, fromBudget: true });
        }
        
        const virtualItem = budgetItemToTakeoffItem(budgetItem);
        divisionMap.get(categoryName)!.items.push(virtualItem);
        divisionMap.get(categoryName)!.totalCost += budgetItem.budgetedAmount || 0;
      });
    }

    // STEP 2: Add takeoff items (these provide detailed quantities and may update costs)
    const allItems = getAllTakeoffItems();
    
    if (typeof window !== 'undefined') {
      console.log('[CSI Debug] Aggregating from ALL takeoffs');
      console.log('[CSI Debug] Total takeoffs:', takeoffs.length);
      console.log('[CSI Debug] Total takeoff items:', allItems.length);
      console.log('[CSI Debug] Budget items:', budgetItems.length);
    }

    allItems.forEach((item) => {
      const division = getCSIDivisionForItem(item);
      if (division) {
        if (!divisionGroups.has(division.number)) {
          divisionGroups.set(division.number, new Map());
        }
        
        const divisionMap = divisionGroups.get(division.number)!;
        // Use "Takeoff Details" category to separate from budget categories
        const categoryKey = hasBudgetDoc ? `${item.category} (Takeoff)` : item.category;
        
        if (!divisionMap.has(categoryKey)) {
          divisionMap.set(categoryKey, { items: [], totalCost: 0, fromBudget: false });
        }
        
        divisionMap.get(categoryKey)!.items.push(item);
        // Always add takeoff costs - they represent extracted quantities with unit pricing
        divisionMap.get(categoryKey)!.totalCost += item.totalCost || 0;
      }
    });

    // Debug: Log division distribution
    if (typeof window !== 'undefined') {
      console.log('[CSI Debug] Division distribution:');
      divisionGroups.forEach((categoryMap, divNum) => {
        let totalItems = 0;
        let totalCost = 0;
        categoryMap.forEach(data => {
          totalItems += data.items.length;
          totalCost += data.totalCost;
        });
        const div = CSI_DIVISIONS.find(d => d.number === divNum);
        console.log(`  Division ${divNum} (${div?.name}): ${totalItems} items, $${totalCost.toLocaleString()}`);
      });
    }

    // Convert to the expected format
    const result: Array<{ division: CSIDivision; categories: CategorySummary[]; fromBudget?: boolean }> = [];
    
    divisionGroups.forEach((categoryMap, divisionNumber) => {
      const division = CSI_DIVISIONS.find(d => d.number === divisionNumber);
      if (division) {
        const categories: CategorySummary[] = [];
        let hasAnyBudgetItems = false;
        
        categoryMap.forEach((data, category) => {
          if (data.fromBudget) hasAnyBudgetItems = true;
          categories.push({
            category,
            itemCount: data.items.length,
            totalCost: data.totalCost,
            items: data.items
          });
        });
        
        // Sort categories: budget items first, then by total cost
        categories.sort((a, b) => {
          const aIsBudget = a.category.includes('(Takeoff)') ? 0 : 1;
          const bIsBudget = b.category.includes('(Takeoff)') ? 0 : 1;
          if (aIsBudget !== bIsBudget) return bIsBudget - aIsBudget;
          return b.totalCost - a.totalCost;
        });
        
        result.push({ division, categories, fromBudget: hasAnyBudgetItems });
      }
    });

    // Sort divisions by number
    return result.sort((a, b) => a.division.number - b.division.number);
  }, [takeoffs, budgetItems, hasBudgetDoc, getAllTakeoffItems, getCSIDivisionForItem, budgetPhaseToCSI, budgetItemToTakeoffItem]);

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  // Handle item edit
  const handleEditItem = (item: TakeoffLineItem) => {
    setEditingItem(item);
    setShowEditModal(true);
  };
  
  // Handle add new item
  const handleAddItem = async (newItem: Partial<TakeoffLineItem>) => {
    if (!selectedTakeoff) return;
    
    try {
      setAddingItem(true);
      
      const response = await fetch(`/api/takeoff/${selectedTakeoff.id}/line-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newItem,
          verified: true, // Manual entries are auto-verified
          confidence: 1.0,
          extractedFrom: 'Manual Entry',
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add item');
      }

      const { item: createdItem } = await response.json();
      
      // Update local state
      const updatedTakeoff = {
        ...selectedTakeoff,
        lineItems: [...selectedTakeoff.lineItems, createdItem]
      };
      
      setSelectedTakeoff(updatedTakeoff);
      setTakeoffs((prev: MaterialTakeoff[]) =>
        prev.map((t: MaterialTakeoff) => (t.id === updatedTakeoff.id ? updatedTakeoff : t))
      );
      
      setShowAddModal(false);
      toast.success('Item added successfully');
    } catch (error: unknown) {
      console.error('Error adding item:', error);
      toast.error(error.message || 'Failed to add item');
    } finally {
      setAddingItem(false);
    }
  };
  
  // Handle delete item
  const handleDeleteItem = async (itemId: string) => {
    if (!selectedTakeoff) return;
    
    if (!confirm('Are you sure you want to delete this item?')) return;
    
    try {
      const response = await fetch(`/api/takeoff/${selectedTakeoff.id}/line-items/${itemId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete item');
      }

      // Update local state
      const updatedLineItems = selectedTakeoff.lineItems.filter((item: TakeoffLineItem) => item.id !== itemId);
      const updatedTakeoff = {
        ...selectedTakeoff,
        lineItems: updatedLineItems
      };
      
      setSelectedTakeoff(updatedTakeoff);
      setTakeoffs((prev: MaterialTakeoff[]) =>
        prev.map((t: MaterialTakeoff) => (t.id === updatedTakeoff.id ? updatedTakeoff : t))
      );
      
      // Remove from selection if selected
      if (selectedItems.has(itemId)) {
        const newSelected = new Set(selectedItems);
        newSelected.delete(itemId);
        setSelectedItems(newSelected);
      }
      
      toast.success('Item deleted');
    } catch (error: unknown) {
      console.error('Error deleting item:', error);
      toast.error(error.message || 'Failed to delete item');
    }
  };

  // Handle item update from edit modal
  const handleItemUpdate = (updatedItem: TakeoffLineItem) => {
    if (!selectedTakeoff) return;
    
    // Update the item in the selected takeoff
    const updatedLineItems = selectedTakeoff.lineItems.map((item: TakeoffLineItem) =>
      item.id === updatedItem.id ? updatedItem : item
    );
    
    const updatedTakeoff = {
      ...selectedTakeoff,
      lineItems: updatedLineItems
    };
    
    setSelectedTakeoff(updatedTakeoff);
    
    // Also update in takeoffs array
    setTakeoffs((prev: MaterialTakeoff[]) =>
      prev.map((t: MaterialTakeoff) => (t.id === updatedTakeoff.id ? updatedTakeoff : t))
    );
  };

  // Select all unverified items
  const selectAllUnverified = () => {
    const unverified = filteredItems.filter((item: TakeoffLineItem) => !item.verified);
    selectAllItems(unverified.map((item: TakeoffLineItem) => item.id));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedItems(new Set());
  };

  // Bulk verify selected items
  const handleBulkVerify = async () => {
    if (!selectedTakeoff || selectedItems.size === 0) return;
    
    try {
      setBulkVerifying(true);
      
      const response = await fetch(`/api/takeoff/${selectedTakeoff.id}/bulk-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemIds: Array.from(selectedItems),
          verified: true
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to verify items');
      }

      const { count } = await response.json();
      
      // Update local state
      const updatedLineItems = selectedTakeoff.lineItems.map((item: TakeoffLineItem) =>
        selectedItems.has(item.id) ? { ...item, verified: true, confidence: 1.0 } : item
      );
      
      const updatedTakeoff = {
        ...selectedTakeoff,
        lineItems: updatedLineItems
      };
      
      setSelectedTakeoff(updatedTakeoff);
      setTakeoffs((prev: MaterialTakeoff[]) =>
        prev.map((t: MaterialTakeoff) => (t.id === updatedTakeoff.id ? updatedTakeoff : t))
      );
      
      clearSelection();
      toast.success(`Verified ${count} items`);
    } catch (error: unknown) {
      console.error('Error bulk verifying:', error);
      toast.error(error.message || 'Failed to verify items');
    } finally {
      setBulkVerifying(false);
    }
  };

  // getConfidenceColor is now imported from lib/takeoff-formatters

  // Auto-calculate costs for all items
  const handleAutoCalculate = async () => {
    if (!selectedTakeoff) return;
    
    try {
      setCalculating(true);
      const res = await fetch(`/api/takeoff/${selectedTakeoff.id}/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region: 'default' }),
      });
      
      if (!res.ok) throw new Error('Failed to calculate costs');
      
      const data = await res.json();
      setCostSummary(data.summary);
      
      toast.success(`Updated ${data.updated} items with calculated costs`);
      
      // Refresh takeoff data
      await fetchTakeoffs();
    } catch (error) {
      console.error('Error calculating costs:', error);
      toast.error('Failed to calculate costs');
    } finally {
      setCalculating(false);
    }
  };

  // Fetch cost summary
  const fetchCostSummary = async () => {
    if (!selectedTakeoff) return;
    
    try {
      const res = await fetch(`/api/takeoff/${selectedTakeoff.id}/calculate`);
      if (res.ok) {
        const data = await res.json();
        setCostSummary(data);
      }
    } catch (error) {
      console.error('Error fetching cost summary:', error);
    }
  };

  // Fetch cost summary when takeoff changes
  useEffect(() => {
    if (selectedTakeoff) {
      fetchCostSummary();
    }
  }, [selectedTakeoff?.id]);

  // Import pricing from Walker Company budget
  const [importingBudget, setImportingBudget] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  
  const handleImportFromBudget = async () => {
    try {
      setImportingBudget(true);
      toast.loading('Importing budget pricing...', { id: 'budget-import' });
      
      // First, get project ID from slug
      const projectRes = await fetch(`/api/projects/${projectSlug}`);
      if (!projectRes.ok) throw new Error('Failed to get project');
      const projectData = await projectRes.json();
      
      // Import budget data if not already imported
      const budgetRes = await fetch('/api/budget/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: projectData.project.id }),
      });
      
      if (!budgetRes.ok) throw new Error('Failed to import budget');
      const budgetData = await budgetRes.json();
      
      // Sync budget prices to takeoff items
      const syncRes = await fetch('/api/takeoff/sync-budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: projectData.project.id }),
      });
      
      if (!syncRes.ok) throw new Error('Failed to sync prices');
      const syncData = await syncRes.json();
      
      toast.dismiss('budget-import');
      toast.success(
        `Imported $${(syncData.summary?.totalAllocated || 0).toLocaleString()} from budget across ${syncData.summary?.pricedItems || 0} items`,
        { duration: 5000 }
      );
      
      // Show details about unmapped items
      if (syncData.unmappedCategories?.length > 0) {
        toast.info(`${syncData.summary?.unmappedItems || 0} items couldn't be mapped to budget phases`, { duration: 3000 });
      }
      
      // Refresh takeoff data
      await fetchTakeoffs();
    } catch (error) {
      console.error('Error importing from budget:', error);
      toast.dismiss('budget-import');
      toast.error('Failed to import budget pricing');
    } finally {
      setImportingBudget(false);
    }
  };

  // Regenerate takeoff from all project documents
  const handleRegenerateTakeoff = async () => {
    try {
      setRegenerating(true);
      toast.loading('Regenerating takeoff from all documents...', { id: 'regenerate-takeoff' });
      
      const response = await fetch(`/api/projects/${projectSlug}/takeoffs/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) throw new Error('Failed to regenerate takeoff');
      const data = await response.json();

      toast.dismiss('regenerate-takeoff');
      
      if (data.success) {
        toast.success(
          `Regenerated takeoff: ${data.takeoff?.totalItems || 0} items, $${(data.takeoff?.totalCost || 0).toLocaleString()}`,
          { duration: 5000 }
        );
        
        if (data.budgetSync) {
          toast.info(`Auto-synced ${data.budgetSync.itemsSynced} items from budget`, { duration: 3000 });
        }
        
        // Refresh takeoff data
        await fetchTakeoffs();
        await fetchCostSummary();
      } else {
        toast.error(data.message || 'Regeneration failed');
      }
    } catch (error) {
      console.error('Error regenerating takeoff:', error);
      toast.dismiss('regenerate-takeoff');
      toast.error('Failed to regenerate takeoff');
    } finally {
      setRegenerating(false);
    }
  };

  const exportToCSV = () => {
    // Export from CSI Division view (all takeoffs + budget)
    const divisions = getCSIDivisionGroups();
    const allItems = getAllTakeoffItems();
    
    if (divisions.length === 0 && allItems.length === 0) {
      toast.error('No items to export');
      return;
    }

    const csvLines: string[] = [];
    
    // === HEADER SECTION ===
    csvLines.push('MATERIAL TAKEOFF REPORT');
    csvLines.push(`"Project: ${projectSlug}"`);
    csvLines.push(`"Generated: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}"`);
    csvLines.push(`"Source: ${hasBudgetDoc ? 'Budget Document + Takeoffs' : 'Plan Takeoffs'}"`);
    csvLines.push('');
    
    // === COLUMN HEADERS ===
    const header = [
      'Division',
      'Category',
      'Item Name',
      'Description',
      'Quantity',
      'Unit',
      'Volume/Area',
      'Unit Cost',
      'Total Cost',
      'Location',
      'Sheet Reference',
      'Verified',
      'Notes'
    ].join(',');
    
    let grandTotal = 0;
    const divisionSummaries: Array<{ division: string; subtotal: number; itemCount: number }> = [];
    
    // === ITEMS BY DIVISION ===
    divisions.forEach(({ division, categories }) => {
      let divisionSubtotal = 0;
      let divisionItemCount = 0;
      
      // Division header row
      csvLines.push('');
      csvLines.push(`"=== DIVISION ${String(division.number).padStart(2, '0')} - ${division.name.toUpperCase()} ==="`);
      csvLines.push(header);
      
      categories.forEach((catSummary) => {
        catSummary.items.forEach((item) => {
          // Calculate volume/area for applicable items
          let volumeDisplay = '';
          const vol = calculateConcreteVolume(item);
          if (vol) {
            volumeDisplay = `${vol.volume.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${vol.unit}`;
          }
          
          // Format quantity with unit context
          const qtyDisplay = `${item.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
          
          const row = [
            `"${String(division.number).padStart(2, '0')} - ${division.name}"`,
            `"${catSummary.category}"`,
            `"${item.itemName.replace(/"/g, '""')}"`,
            `"${(item.description || '').replace(/"/g, '""')}"`,
            qtyDisplay,
            item.unit,
            volumeDisplay,
            item.unitCost ? `$${item.unitCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '',
            item.totalCost ? `$${item.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '',
            `"${item.location || ''}"`,
            `"${item.sheetNumber || ''}${item.gridLocation ? ' @ ' + item.gridLocation : ''}"`,
            item.verified ? 'Yes' : 'No',
            `"${(item.notes || '').replace(/"/g, '""')}"`
          ].join(',');
          
          csvLines.push(row);
          divisionSubtotal += item.totalCost || 0;
          divisionItemCount++;
        });
      });
      
      // Division subtotal row
      csvLines.push(`"","","","DIVISION ${String(division.number).padStart(2, '0')} SUBTOTAL","${divisionItemCount} items","","","","$${divisionSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}","","","",""`);
      
      grandTotal += divisionSubtotal;
      divisionSummaries.push({
        division: `${String(division.number).padStart(2, '0')} - ${division.name}`,
        subtotal: divisionSubtotal,
        itemCount: divisionItemCount
      });
    });
    
    // === SUMMARY SECTION ===
    csvLines.push('');
    csvLines.push('');
    csvLines.push('"=== TAKEOFF SUMMARY ==="');
    csvLines.push('Division,Item Count,Subtotal');
    
    divisionSummaries
      .sort((a, b) => b.subtotal - a.subtotal)
      .forEach(summary => {
        csvLines.push(`"${summary.division}",${summary.itemCount},"$${summary.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}"`);
      });
    
    csvLines.push('');
    csvLines.push(`"GRAND TOTAL",${divisionSummaries.reduce((sum, s) => sum + s.itemCount, 0)},"$${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}"`);
    
    // === QUANTITY TOTALS BY UNIT ===
    const unitTotals: Record<string, number> = {};
    const volumeTotals: Record<string, number> = {};
    
    getAllTakeoffItems().forEach(item => {
      unitTotals[item.unit] = (unitTotals[item.unit] || 0) + item.quantity;
      
      // Track volume for concrete items
      const vol = calculateConcreteVolume(item);
      if (vol) {
        volumeTotals[vol.unit] = (volumeTotals[vol.unit] || 0) + vol.volume;
      }
    });
    
    csvLines.push('');
    csvLines.push('"=== QUANTITY TOTALS BY UNIT ==="');
    csvLines.push('Unit,Total Quantity');
    
    Object.entries(unitTotals)
      .sort((a, b) => b[1] - a[1])
      .forEach(([unit, total]) => {
        csvLines.push(`"${unit}","${total.toLocaleString(undefined, { maximumFractionDigits: 2 })}"`);
      });
    
    // Add volume totals if any
    if (Object.keys(volumeTotals).length > 0) {
      csvLines.push('');
      csvLines.push('"=== CALCULATED VOLUMES ==="');
      csvLines.push('Unit,Total Volume');
      Object.entries(volumeTotals).forEach(([unit, total]) => {
        csvLines.push(`"${unit}","${total.toLocaleString(undefined, { maximumFractionDigits: 1 })}"`);
      });
    }
    
    // Generate CSV file
    const csv = csvLines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Takeoff_Report_${projectSlug}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    toast.success(`Exported ${divisionSummaries.reduce((sum, s) => sum + s.itemCount, 0)} items across ${divisionSummaries.length} divisions`);
  };

  // These are now calculated via useMemo above using utility functions

  // Calculate CSI groups - keep existing function for now (uses CSI_KEYWORD_MAP)
  // TODO: Move CSI_KEYWORD_MAP to utility and fully migrate
  const csiGroups = useMemo(() => {
    // Use existing getCSIDivisionGroups function (defined below)
    // This will be fully migrated to utility in next iteration
    return getCSIDivisionGroups();
  }, [getAllTakeoffItems, budgetItems, hasBudgetDoc, takeoffs]);

  // Define action menu items
  const pricingActions: ActionItem[] = [
    {
      id: 'update-from-web',
      label: 'Update from Web',
      icon: Globe,
      onClick: () => setShowPriceUpdate(true),
      disabled: filteredItems.length === 0,
      variant: 'default',
      description: 'Search current market prices by location',
    },
    {
      id: 'import-budget',
      label: 'Import from Budget',
      icon: FileText,
      onClick: handleImportFromBudget,
      disabled: importingBudget || getFilteredItems().length === 0,
      variant: 'success',
      description: 'Apply Walker Company budget pricing',
    },
    {
      id: 'auto-price',
      label: 'Auto-Calculate Prices',
      icon: Calculator,
      onClick: handleAutoCalculate,
      disabled: calculating || getFilteredItems().length === 0,
      description: 'Apply unit prices from database',
    },
    {
      id: 'manage-prices',
      label: 'Manage Unit Prices',
      icon: DollarSign,
      onClick: () => setShowPriceManager(true),
      description: 'Edit regional price database',
    },
    {
      id: 'sync-budget',
      label: 'Sync to Budget',
      icon: ArrowRightCircle,
      onClick: () => setShowBudgetSync(true),
      disabled: filteredItems.length === 0,
      description: 'Push takeoff to project budget',
    },
  ];

  const analysisActions: ActionItem[] = [
    {
      id: 'regenerate',
      label: 'Regenerate Takeoff',
      icon: RefreshCw,
      onClick: handleRegenerateTakeoff,
      disabled: regenerating,
      description: 'Re-extract from all documents',
    },
    {
      id: 'qa-dashboard',
      label: 'QA Dashboard',
      icon: ShieldCheck,
      onClick: () => setShowQA(true),
      description: 'Review quality & accuracy',
    },
    {
      id: 'labor-planning',
      label: 'Labor Planning',
      icon: HardHat,
      onClick: () => setShowLaborPlanning(true),
      description: 'Estimate crew hours',
    },
    {
      id: 'learning-panel',
      label: 'AI Learning',
      icon: Brain,
      onClick: () => setShowLearning(true),
      description: 'Train extraction model',
    },
    {
      id: 'aggregation',
      label: 'Aggregate Takeoffs',
      icon: Combine,
      onClick: () => setShowAggregation(true),
      disabled: takeoffs.length === 0,
      description: 'Combine multiple takeoffs',
    },
  ];

  const exportActions: ActionItem[] = [
    {
      id: 'export-csv',
      label: 'Export to CSV',
      icon: Download,
      onClick: exportToCSV,
      disabled: !selectedTakeoff || getFilteredItems().length === 0,
    },
  ];

  return (
    <div className="flex h-full flex-col bg-[#1F2328] text-[#F8FAFC]">
      {/* Header - Streamlined with Dropdown Menus */}
      <div className="flex items-center justify-between border-b border-gray-700 p-4">
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-orange-500" />
          <h2 className="text-lg font-semibold">Material Takeoff</h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Primary Action: Add Item */}
          {selectedTakeoff && (
            <WithTooltip tooltip="Add new line item to takeoff">
              <Button
                variant="default"
                size="sm"
                onClick={() => setShowAddModal(true)}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Plus className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Add Item</span>
              </Button>
            </WithTooltip>
          )}

          {/* Pricing Dropdown */}
          {selectedTakeoff && (
            <QuickActionMenu
              label="Pricing"
              icon={DollarSign}
              items={pricingActions}
              variant="outline"
            />
          )}

          {/* Analysis Dropdown */}
          {selectedTakeoff && (
            <QuickActionMenu
              label="Analysis"
              icon={BarChart2}
              items={analysisActions}
              variant="outline"
            />
          )}

          {/* Export Dropdown */}
          <QuickActionMenu
            label="Export"
            icon={Download}
            items={exportActions}
            variant="outline"
          />

          {onClose && (
            <WithTooltip tooltip="Close panel">
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </WithTooltip>
          )}
        </div>
      </div>

      {/* Takeoff Selector */}
      {takeoffs.length > 1 && (
        <div className="border-b border-gray-700 p-4">
          <Select
            value={selectedTakeoff?.id || ''}
            onValueChange={(value) => {
              const takeoff = takeoffs.find(t => t.id === value);
              setSelectedTakeoff(takeoff || null);
              setExpandedCategories(new Set());
            }}
          >
            <SelectTrigger className="bg-[#2d333b] border-gray-600 text-[#F8FAFC]">
              <SelectValue placeholder="Select takeoff" />
            </SelectTrigger>
            <SelectContent>
              {takeoffs.map((takeoff) => (
                <SelectItem key={takeoff.id} value={takeoff.id}>
                  {takeoff.name} ({takeoff.lineItems?.length || 0} items)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Summary - Using new component */}
      <TakeoffSummary
        takeoff={selectedTakeoff}
        totalCost={totalCost}
        categoryCount={categories.length}
        quantityTotals={quantityTotals}
        mepData={mepData}
        costSummary={costSummary}
      />

      {/* Content - Scrollable area starts here */}
      <ScrollArea className="flex-1 min-h-0">
        {/* Data Requirements Checklist */}
        <div className="border-b border-gray-700 p-4">
          <TakeoffDataChecklist 
            projectSlug={projectSlug}
            onTriggerExtraction={handleChecklistAction}
          />
        </div>

      {/* Earthwork Calculator - Moved to Analysis dropdown, only show inline if expanded */}

      {/* Bulk Actions - Using new component */}
      <TakeoffActions
        takeoff={selectedTakeoff}
        selectedItems={selectedItems}
        unverifiedCount={selectedTakeoff?.lineItems.filter((i) => !i.verified).length || 0}
        onSelectAllUnverified={selectAllUnverified}
        onClearSelection={clearSelection}
        onBulkVerify={handleBulkVerify}
        bulkVerifying={bulkVerifying}
      />

      {/* Pricing Warning Banner */}
      {costSummary && costSummary.unpricedItems?.length > 0 && costSummary.unpricedItems.length > costSummary.pricedItemCount && (
        <div className="border-b border-yellow-600/50 p-3 bg-yellow-900/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <div>
                <span className="text-sm font-medium text-yellow-400">
                  {costSummary.unpricedItems.length.toLocaleString()} items need pricing
                </span>
                <p className="text-xs text-yellow-500/70 mt-0.5">
                  Total cost shown may be incomplete. Import from your uploaded Budget.pdf ($2.77M) to apply division pricing.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleImportFromBudget}
                disabled={importingBudget}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {importingBudget ? (
                  <RefreshCw className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="mr-1 h-4 w-4" />
                )}
                {importingBudget ? 'Importing...' : 'Import from Budget'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleAutoCalculate}
                disabled={calculating}
                className="border-yellow-600 text-yellow-400 hover:bg-yellow-900/30"
              >
                {calculating ? (
                  <RefreshCw className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Calculator className="mr-1 h-4 w-4" />
                )}
                {calculating ? 'Calculating...' : 'Auto-Calculate'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Filters - Using new component */}
      <TakeoffFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filterCategory={filterCategory}
        onCategoryChange={setFilterCategory}
        filterVerified={filterVerified}
        onVerifiedChange={setFilterVerified}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        availableCategories={availableCategories}
      />

      {/* Items Content - Using new TakeoffTable component */}
      <div className="pb-20">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <div className="mb-2 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-orange-500 border-r-transparent"></div>
              <p className="text-sm text-gray-400">Loading takeoffs...</p>
            </div>
          </div>
        ) : !selectedTakeoff ? (
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <Calculator className="mx-auto mb-3 h-12 w-12 text-gray-600" />
              <p className="text-sm text-gray-400">No material takeoffs found</p>
              <p className="mt-2 text-xs text-gray-500">Process floor plans to extract quantities</p>
            </div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <Package className="mx-auto mb-3 h-12 w-12 text-gray-600" />
              <p className="text-sm text-gray-400">
                {searchQuery || filterCategory !== 'all' || filterVerified !== 'all'
                  ? 'No items match your filters'
                  : 'No line items in this takeoff'}
              </p>
            </div>
          </div>
        ) : (
          <TakeoffTable
            items={filteredItems}
            selectedItems={selectedItems}
            onSelectItem={toggleItemSelection}
            onEditItem={handleEditItem}
            viewMode={viewMode}
            expandedCategories={expandedCategories}
            onToggleCategory={toggleCategory}
            categories={categories}
            csiGroups={csiGroups}
            hasBudgetDoc={hasBudgetDoc}
          />
        )}
      </div>
      </ScrollArea>

      {/* Modals - Using new TakeoffModals component */}
      <TakeoffModals
        takeoff={selectedTakeoff}
        projectSlug={projectSlug}
        editingItem={editingItem}
        showEditModal={showEditModal}
        onCloseEditModal={() => {
          setShowEditModal(false);
          setEditingItem(null);
        }}
        onItemUpdate={handleItemUpdate}
        showAddModal={showAddModal}
        onCloseAddModal={() => setShowAddModal(false)}
        onAddItem={handleAddItem}
        addingItem={addingItem}
        showPriceManager={showPriceManager}
        onClosePriceManager={() => setShowPriceManager(false)}
        onPricesUpdated={() => {
          fetchTakeoffs();
          fetchCostSummary();
        }}
        showBudgetSync={showBudgetSync}
        onCloseBudgetSync={() => setShowBudgetSync(false)}
        onSyncComplete={() => {
          fetchTakeoffs();
          toast.success('Takeoff synced to budget successfully');
        }}
        showAggregation={showAggregation}
        onCloseAggregation={() => setShowAggregation(false)}
        onAggregationCreated={() => {
          fetchTakeoffs();
          toast.success('Aggregation created successfully');
        }}
        showQA={showQA}
        onCloseQA={() => setShowQA(false)}
        onRefresh={fetchTakeoffs}
        showLaborPlanning={showLaborPlanning}
        onCloseLaborPlanning={() => setShowLaborPlanning(false)}
        showLearning={showLearning}
        onCloseLearning={() => setShowLearning(false)}
        showPriceUpdate={showPriceUpdate}
        onClosePriceUpdate={() => setShowPriceUpdate(false)}
      />

      {/* Cost Summary Banner */}
      {costSummary && selectedTakeoff && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#21262D] border-t border-gray-700 p-3">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-400">Total Cost:</span>
                <span className="text-lg font-bold text-green-400">
                  ${costSummary.totalCost?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400">Material:</span>
                <span className="text-white">
                  ${costSummary.totalMaterialCost?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400">Labor:</span>
                <span className="text-white">
                  ${costSummary.totalLaborCost?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400">Hours:</span>
                <span className="text-white">
                  {costSummary.totalLaborHours?.toFixed(1) || '0'} hrs
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span>{costSummary.pricedItemCount || 0}/{costSummary.itemCount || 0} items priced</span>
              {costSummary.unpricedItems?.length > 0 && (
                <span className="text-yellow-500">
                  {costSummary.unpricedItems.length} items need pricing
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
