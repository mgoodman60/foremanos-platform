'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  Calculator,
  ChevronDown,
  ChevronRight,
  Search,
  Download,
  X,
  FileText,
  DollarSign,
  Ruler,
  CheckCircle2,
  AlertCircle,
  Package,
  Layers,
  Filter,
  TrendingUp,
  Edit2,
  CheckCheck,
  Sparkles,
  Plus,
  Trash2,
  AlertTriangle,
  Info,
  ArrowRightCircle,
  Combine,
  FileStack,
  ShieldCheck,
  HardHat,
  Brain,
  Wrench,
  BarChart2,
  Settings,
  RefreshCw,
  Zap,
  Globe
} from 'lucide-react';
import { TakeoffLineItemEditModal } from './takeoff-line-item-edit-modal';
import { TakeoffAddItemModal } from './takeoff-add-item-modal';
import { UnitPriceManager } from './unit-price-manager';
import { TakeoffBudgetSyncModal } from './takeoff-budget-sync-modal';
import { TakeoffAggregationModal } from './takeoff-aggregation-modal';
import { TakeoffQADashboard } from './takeoff-qa-dashboard';
import { TakeoffLaborPlanning } from './takeoff-labor-planning';
import TakeoffLearningPanel from './takeoff-learning-panel';
import EarthworkCalculator from './earthwork-calculator';
import TakeoffDataChecklist from './takeoff-data-checklist';
import { PriceUpdateModal } from './price-update-modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { WithTooltip } from '@/components/ui/icon-button';
import { toast } from 'sonner';
import { CSI_DIVISIONS, type CSIDivision } from '@/lib/csi-divisions';
import { QuickActionMenu, type ActionItem } from '@/components/ui/header-action-menu';

interface TakeoffLineItem {
  id: string;
  category: string;
  itemName: string;
  description?: string;
  quantity: number;
  unit: string;
  unitCost?: number;
  totalCost?: number;
  location?: string;
  sheetNumber?: string;
  gridLocation?: string;
  notes?: string;
  confidence?: number;
  verified: boolean;
}

interface MaterialTakeoff {
  id: string;
  name: string;
  description?: string;
  status: string;
  totalCost?: number;
  lineItems: TakeoffLineItem[];
  document?: {
    id: string;
    name: string;
  };
  createdAt: string;
}

interface CategorySummary {
  category: string;
  itemCount: number;
  totalCost: number;
  items: TakeoffLineItem[];
}

interface MaterialTakeoffManagerProps {
  projectSlug: string;
  onClose?: () => void;
}

export function MaterialTakeoffManager({ projectSlug, onClose }: MaterialTakeoffManagerProps) {
  const { data: session } = useSession() || {};
  const [takeoffs, setTakeoffs] = useState<MaterialTakeoff[]>([]);
  const [selectedTakeoff, setSelectedTakeoff] = useState<MaterialTakeoff | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterVerified, setFilterVerified] = useState<string>('all');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'csi' | 'category'>('category');
  
  // Edit modal state
  const [editingItem, setEditingItem] = useState<TakeoffLineItem | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Bulk selection state
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  
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
  const [costSummary, setCostSummary] = useState<any>(null);
  const [mepData, setMepData] = useState<any>(null);
  const [extractingMEP, setExtractingMEP] = useState(false);
  const [budgetItems, setBudgetItems] = useState<any[]>([]);
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

  const fetchTakeoffs = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${projectSlug}/takeoffs`);
      if (!response.ok) throw new Error('Failed to fetch takeoffs');

      const data = await response.json();
      setTakeoffs(data.takeoffs || []);
      
      // Auto-select first takeoff if available
      if (data.takeoffs && data.takeoffs.length > 0 && !selectedTakeoff) {
        setSelectedTakeoff(data.takeoffs[0]);
      }
    } catch (error: unknown) {
      console.error('Error fetching takeoffs:', error);
      toast.error('Failed to load material takeoffs');
    } finally {
      setLoading(false);
    }
  };

  // Filter line items by search and filters
  const getFilteredItems = (): TakeoffLineItem[] => {
    if (!selectedTakeoff) return [];

    return selectedTakeoff.lineItems.filter((item) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          item.itemName.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query) ||
          item.location?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Category filter
      if (filterCategory !== 'all' && item.category !== filterCategory) {
        return false;
      }

      // Verified filter
      if (filterVerified === 'verified' && !item.verified) return false;
      if (filterVerified === 'unverified' && item.verified) return false;

      return true;
    });
  };

  // Get ALL items from ALL takeoffs (for CSI Division view aggregation)
  const getAllTakeoffItems = (): TakeoffLineItem[] => {
    const allItems: TakeoffLineItem[] = [];
    
    takeoffs.forEach((takeoff) => {
      takeoff.lineItems.forEach((item) => {
        // Apply same filters as getFilteredItems but across all takeoffs
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
  };

  // Group items by category
  const getCategorySummaries = (): CategorySummary[] => {
    const filtered = getFilteredItems();
    const groups: Record<string, CategorySummary> = {};

    filtered.forEach((item) => {
      if (!groups[item.category]) {
        groups[item.category] = {
          category: item.category,
          itemCount: 0,
          totalCost: 0,
          items: []
        };
      }

      groups[item.category].itemCount++;
      groups[item.category].totalCost += item.totalCost || 0;
      groups[item.category].items.push(item);
    });

    return Object.values(groups).sort((a, b) => b.totalCost - a.totalCost);
  };

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

  // Group by CSI division - merges budget items with takeoff items
  // Budget items populate all divisions; takeoffs provide detail quantities
  const getCSIDivisionGroups = (): Array<{ division: CSIDivision; categories: CategorySummary[]; fromBudget?: boolean }> => {
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
  };

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

  // Toggle item selection for bulk operations
  const toggleItemSelection = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  // Select all unverified items
  const selectAllUnverified = () => {
    const unverified = getFilteredItems().filter((item: TakeoffLineItem) => !item.verified);
    setSelectedItems(new Set(unverified.map((item: TakeoffLineItem) => item.id)));
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

  // Get confidence color - confidence is stored as 0-100
  const getConfidenceColor = (confidence: number | undefined): string => {
    if (confidence === undefined) return 'text-gray-500';
    // Normalize: if > 1, it's already 0-100 scale
    const normalized = confidence > 1 ? confidence : confidence * 100;
    if (normalized >= 80) return 'text-green-500';
    if (normalized >= 60) return 'text-yellow-500';
    if (normalized >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

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

  const getTotalQuantityByUnit = (): Record<string, number> => {
    const filtered = getFilteredItems();
    const totals: Record<string, number> = {};

    filtered.forEach((item) => {
      if (!totals[item.unit]) {
        totals[item.unit] = 0;
      }
      totals[item.unit] += item.quantity;
    });

    return totals;
  };

  const getTotalCost = (): number => {
    return getFilteredItems().reduce((sum, item) => sum + (item.totalCost || 0), 0);
  };

  const categories = getCategorySummaries();
  const csiGroups = getCSIDivisionGroups();
  const quantityTotals = getTotalQuantityByUnit();
  const totalCost = getTotalCost();

  // Define action menu items
  const pricingActions: ActionItem[] = [
    {
      id: 'update-from-web',
      label: 'Update from Web',
      icon: Globe,
      onClick: () => setShowPriceUpdate(true),
      disabled: getFilteredItems().length === 0,
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
      disabled: getFilteredItems().length === 0,
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

      {/* Summary Stats */}
      {selectedTakeoff && (
        <div className="border-b border-gray-700 p-4">
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-500">{selectedTakeoff.lineItems?.length || 0}</div>
              <div className="text-xs text-gray-400">Total Items</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500">{categories.length}</div>
              <div className="text-xs text-gray-400">Categories</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-500">
                ${totalCost > 0 ? totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0'}
              </div>
              <div className="text-xs text-gray-400">Total Cost</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-500">
                {selectedTakeoff.lineItems?.filter(i => i.verified).length || 0}
              </div>
              <div className="text-xs text-gray-400">Verified</div>
            </div>
          </div>

          {/* Quantity Summaries */}
          {Object.keys(quantityTotals).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(quantityTotals).map(([unit, total]) => (
                <Badge key={unit} variant="outline" className="text-xs">
                  {total.toLocaleString(undefined, { maximumFractionDigits: 2 })} {unit}
                </Badge>
              ))}
            </div>
          )}

          {/* MEP Summary - if available */}
          {mepData?.exists && (
            <div className="mt-4 p-3 bg-[#1F2328] rounded-lg border border-gray-700">
              <h4 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <Zap className="h-4 w-4 text-yellow-500" />
                MEP Systems Summary
              </h4>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {mepData.electrical?.itemCount > 0 && (
                  <div className="p-2 bg-[#2d333b] rounded">
                    <span className="text-yellow-400">⚡ Electrical</span>
                    <div className="text-[#F8FAFC]">{mepData.electrical.itemCount} items</div>
                    <div className="text-green-400">${(mepData.electrical.total || 0).toLocaleString()}</div>
                  </div>
                )}
                {mepData.plumbing?.itemCount > 0 && (
                  <div className="p-2 bg-[#2d333b] rounded">
                    <span className="text-blue-400">💧 Plumbing</span>
                    <div className="text-[#F8FAFC]">{mepData.plumbing.itemCount} items</div>
                    <div className="text-green-400">${(mepData.plumbing.total || 0).toLocaleString()}</div>
                  </div>
                )}
                {mepData.hvac?.itemCount > 0 && (
                  <div className="p-2 bg-[#2d333b] rounded">
                    <span className="text-cyan-400">🌬️ HVAC</span>
                    <div className="text-[#F8FAFC]">{mepData.hvac.itemCount} items</div>
                    <div className="text-green-400">${(mepData.hvac.total || 0).toLocaleString()}</div>
                  </div>
                )}
              </div>
              {mepData.totalCost > 0 && (
                <div className="mt-2 text-right text-sm text-gray-400">
                  MEP Total: <span className="text-green-400 font-medium">${(mepData.totalCost || 0).toLocaleString()}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

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

      {/* Bulk Verification Toolbar */}
      {selectedTakeoff && selectedTakeoff.lineItems.some((i: TakeoffLineItem) => !i.verified) && (
        <div className="border-b border-gray-700 p-3 bg-[#2D333B]/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400">
                {selectedItems.size > 0 ? (
                  <span className="text-orange-400">{selectedItems.size} items selected</span>
                ) : (
                  <span>{selectedTakeoff.lineItems.filter((i: TakeoffLineItem) => !i.verified).length} unverified items</span>
                )}
              </span>
              {selectedItems.size === 0 ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAllUnverified}
                  className="border-gray-600 text-xs"
                >
                  <CheckCheck className="mr-1 h-3 w-3" />
                  Select All Unverified
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                  className="text-xs text-gray-400"
                >
                  Clear Selection
                </Button>
              )}
            </div>
            {selectedItems.size > 0 && (
              <Button
                size="sm"
                onClick={handleBulkVerify}
                disabled={bulkVerifying}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle2 className="mr-1 h-4 w-4" />
                {bulkVerifying ? 'Verifying...' : `Verify ${selectedItems.size} Items`}
              </Button>
            )}
          </div>
        </div>
      )}

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

      {/* Compact Filters Row */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-700 px-4 py-2">
        {/* View Mode Toggle */}
        <div className="flex rounded-md border border-gray-600 overflow-hidden">
          <button
            onClick={() => setViewMode('category')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'category' ? 'bg-orange-500 text-white' : 'bg-[#2d333b] text-gray-300 hover:bg-[#3d434b]'}`}
          >
            Category
          </button>
          <button
            onClick={() => setViewMode('csi')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'csi' ? 'bg-orange-500 text-white' : 'bg-[#2d333b] text-gray-300 hover:bg-[#3d434b]'}`}
          >
            CSI Division
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search materials..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 bg-[#2d333b] border-gray-600 pl-8 text-sm text-[#F8FAFC] placeholder:text-gray-500"
          />
        </div>

        {/* Category Filter */}
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="h-8 w-[140px] bg-[#2d333b] border-gray-600 text-sm text-[#F8FAFC]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {Array.from(new Set(selectedTakeoff?.lineItems?.map(i => i.category) || [])).map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status Filter */}
        <Select value={filterVerified} onValueChange={setFilterVerified}>
          <SelectTrigger className="h-8 w-[110px] bg-[#2d333b] border-gray-600 text-sm text-[#F8FAFC]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="unverified">Unverified</SelectItem>
          </SelectContent>
        </Select>

        {/* Clear Filters */}
        {(searchQuery || filterCategory !== 'all' || filterVerified !== 'all') && (
          <WithTooltip tooltip="Clear all filters">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setFilterCategory('all');
                setFilterVerified('all');
              }}
              className="h-8 text-xs text-orange-500 hover:text-orange-400 hover:bg-[#2d333b]"
            >
              <X className="mr-1 h-3.5 w-3.5" />
              Clear
            </Button>
          </WithTooltip>
        )}
      </div>

      {/* Items Content */}
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
        ) : getFilteredItems().length === 0 ? (
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
        ) : viewMode === 'csi' ? (
          // CSI Division View - Aggregated from ALL takeoffs + Budget
          <div className="p-4 space-y-2">
            {/* Source indicator */}
            <div className="flex flex-wrap items-center gap-2 p-2 bg-blue-900/30 border border-blue-700/50 rounded-lg mb-3">
              <FileStack className="h-4 w-4 text-blue-400" />
              <span className="text-sm text-blue-300">
                {hasBudgetDoc ? (
                  <>
                    <DollarSign className="inline h-3 w-3 mr-1 text-green-400" />
                    Budget document is source of truth for costs
                  </>
                ) : (
                  `Showing items from all ${takeoffs.length} takeoff${takeoffs.length !== 1 ? 's' : ''}`
                )}
              </span>
              {hasBudgetDoc && (
                <Badge className="bg-green-900/50 text-green-300 border border-green-700">
                  {budgetItems.length} budget items
                </Badge>
              )}
              <Badge className="bg-blue-900/50 text-blue-300 border border-blue-700">
                {getAllTakeoffItems().length} takeoff items
              </Badge>
            </div>
            {csiGroups.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Layers className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No items to display</p>
                <p className="text-sm mt-1">Upload a budget document or process takeoffs to see items by CSI division</p>
              </div>
            ) : null}
            {csiGroups.map(({ division, categories: divCategories, fromBudget }) => (
              <div key={division.number} className="space-y-1">
                {/* Division Header */}
                <div className={`rounded-lg px-3 py-2 ${fromBudget ? 'bg-green-900/20 border border-green-800/50' : 'bg-[#2d333b]'}`}>
                  <div className="flex items-center gap-2">
                    <Layers className={`h-4 w-4 ${fromBudget ? 'text-green-500' : 'text-orange-500'}`} />
                    <span className="font-medium text-[#F8FAFC]">
                      Division {String(division.number).padStart(2, '0')} - {division.name}
                    </span>
                    {fromBudget && (
                      <Badge className="bg-green-900/50 text-green-300 border border-green-700 text-xs">
                        <DollarSign className="h-3 w-3 mr-1" />Budget
                      </Badge>
                    )}
                    <Badge variant="secondary" className="ml-auto">
                      {divCategories.reduce((sum, cat) => sum + cat.itemCount, 0)} items
                    </Badge>
                    <span className="text-sm text-green-400 font-medium">
                      ${divCategories.reduce((sum, cat) => sum + cat.totalCost, 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Categories in Division */}
                <div className="ml-6 space-y-1">
                  {divCategories.map((catSummary) => {
                    const isBudgetCategory = !catSummary.category.includes('(Takeoff)');
                    return (
                    <div key={catSummary.category}>
                      <button
                        onClick={() => toggleCategory(catSummary.category)}
                        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-[#2d333b] transition-colors border ${
                          isBudgetCategory && hasBudgetDoc 
                            ? 'bg-green-900/10 border-green-800/30' 
                            : 'bg-[#1F2328] border-gray-700'
                        }`}
                      >
                        {expandedCategories.has(catSummary.category) ? (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        )}
                        {isBudgetCategory && hasBudgetDoc ? (
                          <DollarSign className="h-4 w-4 text-green-400" />
                        ) : (
                          <Package className="h-4 w-4 text-blue-400" />
                        )}
                        <span className="font-medium text-[#F8FAFC] capitalize">{catSummary.category}</span>
                        <div className="ml-auto flex items-center gap-3 text-xs text-gray-400">
                          <span>{catSummary.itemCount} items</span>
                          {catSummary.totalCost > 0 && (
                            <span className="text-green-400">${catSummary.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                          )}
                        </div>
                      </button>

                      {/* Category Items */}
                      {expandedCategories.has(catSummary.category) && (
                        <div className="ml-6 mt-1 space-y-1">
                          {catSummary.items.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-start gap-3 rounded-lg border border-gray-700 bg-[#1F2328] p-3 text-sm"
                            >
                              {/* Status Icon */}
                              <div className="mt-1">
                                {item.verified ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                ) : (
                                  <AlertCircle className="h-4 w-4 text-orange-400" />
                                )}
                              </div>

                              {/* Item Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-medium text-[#F8FAFC] truncate">{item.itemName}</h4>
                                  {item.verified && (
                                    <Badge variant="outline" className="text-xs text-green-400 border-green-700">
                                      Verified
                                    </Badge>
                                  )}
                                </div>

                                {item.description && (
                                  <p className="text-xs text-gray-400 mb-2">{item.description}</p>
                                )}

                                {/* Quantity Row */}
                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                  <div className="flex items-center gap-1">
                                    <Ruler className="h-3 w-3" />
                                    <span className="font-medium text-orange-400">
                                      {item.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })} {item.unit}
                                    </span>
                                    {/* Show calculated volume for concrete items */}
                                    {(() => {
                                      const vol = calculateConcreteVolume(item);
                                      return vol ? (
                                        <span className="text-blue-400 ml-1">
                                          ({vol.volume.toLocaleString(undefined, { maximumFractionDigits: 1 })} {vol.unit})
                                        </span>
                                      ) : null;
                                    })()}
                                  </div>

                                  {item.unitCost && (
                                    <div className="flex items-center gap-1">
                                      <DollarSign className="h-3 w-3" />
                                      <span>${item.unitCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}/{item.unit}</span>
                                    </div>
                                  )}

                                  {item.location && (
                                    <div className="flex items-center gap-1">
                                      <Layers className="h-3 w-3" />
                                      <span>{item.location}</span>
                                    </div>
                                  )}

                                  {item.sheetNumber && (
                                    <div className="flex items-center gap-1">
                                      <FileText className="h-3 w-3" />
                                      <span>Sheet {item.sheetNumber}</span>
                                    </div>
                                  )}
                                </div>

                                {item.notes && (
                                  <p className="mt-2 text-xs text-gray-500 italic">{item.notes}</p>
                                )}
                              </div>

                              {/* Total Cost */}
                              {item.totalCost && (
                                <div className="flex-shrink-0 text-right">
                                  <div className="text-sm font-medium text-green-400">
                                    ${item.totalCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                  </div>
                                  <div className="text-xs text-gray-500">Total</div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Category View (default)
          <div className="p-4 space-y-2">
            {categories.map((catSummary) => (
              <div key={catSummary.category}>
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(catSummary.category)}
                  className="flex w-full items-center gap-2 rounded-lg bg-[#2d333b] px-3 py-2 text-left hover:bg-[#383e47] transition-colors"
                >
                  {expandedCategories.has(catSummary.category) ? (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  )}
                  <Package className="h-4 w-4 text-orange-500" />
                  <span className="font-medium text-[#F8FAFC] capitalize">{catSummary.category}</span>
                  <div className="ml-auto flex items-center gap-3 text-xs text-gray-400">
                    <span>{catSummary.itemCount} items</span>
                    {catSummary.totalCost > 0 && (
                      <span className="text-green-400 font-medium">
                        ${catSummary.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    )}
                  </div>
                </button>

                {/* Category Items */}
                {expandedCategories.has(catSummary.category) && (
                  <div className="ml-6 mt-1 space-y-1">
                    {catSummary.items.map((item) => (
                      <div
                        key={item.id}
                        className={`flex items-start gap-3 rounded-lg border bg-[#1F2328] p-3 text-sm transition-all cursor-pointer group ${
                          selectedItems.has(item.id)
                            ? 'border-orange-500 bg-orange-500/10'
                            : 'border-gray-700 hover:border-orange-500'
                        }`}
                        onClick={() => handleEditItem(item)}
                      >
                        {/* Checkbox for bulk selection */}
                        {!item.verified && (
                          <div
                            className="mt-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleItemSelection(item.id);
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={selectedItems.has(item.id)}
                              onChange={() => {}}
                              className="h-4 w-4 rounded border-gray-600 bg-[#2D333B] text-orange-500 focus:ring-orange-500 cursor-pointer"
                            />
                          </div>
                        )}

                        {/* Status Icon */}
                        <div className="mt-1">
                          {item.verified ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-orange-400" />
                          )}
                        </div>

                        {/* Item Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-[#F8FAFC] truncate">{item.itemName}</h4>
                            {item.verified && (
                              <Badge variant="outline" className="text-xs text-green-400 border-green-700">
                                Verified
                              </Badge>
                            )}
                            {/* Confidence indicator */}
                            {item.confidence !== undefined && (
                              <div className={`flex items-center gap-1 text-xs ${getConfidenceColor(item.confidence)}`}>
                                <Sparkles className="h-3 w-3" />
                                <span>{item.confidence > 1 ? item.confidence.toFixed(0) : (item.confidence * 100).toFixed(0)}%</span>
                              </div>
                            )}
                          </div>

                          {item.description && (
                            <p className="text-xs text-gray-400 mb-2">{item.description}</p>
                          )}

                          {/* Quantity Row */}
                          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                            <div className="flex items-center gap-1">
                              <Ruler className="h-3 w-3" />
                              <span className="font-medium text-orange-400">
                                {item.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })} {item.unit}
                              </span>
                            </div>

                            {item.unitCost ? (
                              <div className="flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                <span>${item.unitCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}/{item.unit}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-yellow-500">
                                <DollarSign className="h-3 w-3" />
                                <span>No price - click to add</span>
                              </div>
                            )}

                            {item.location && (
                              <div className="flex items-center gap-1">
                                <Layers className="h-3 w-3" />
                                <span>{item.location}</span>
                              </div>
                            )}

                            {item.sheetNumber && (
                              <div className="flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                <span>Sheet {item.sheetNumber}</span>
                              </div>
                            )}

                            {item.gridLocation && (
                              <div className="flex items-center gap-1">
                                <span>Grid: {item.gridLocation}</span>
                              </div>
                            )}
                          </div>

                          {item.notes && (
                            <p className="mt-2 text-xs text-gray-500 italic">{item.notes}</p>
                          )}

                          {/* Low confidence warning */}
                          {item.confidence !== undefined && ((item.confidence > 1 ? item.confidence : item.confidence * 100) < 60) && !item.verified && (
                            <div className="mt-2 flex items-center gap-1 text-xs text-yellow-500">
                              <AlertCircle className="h-3 w-3" />
                              <span>Low confidence - click to verify manually</span>
                            </div>
                          )}
                        </div>

                        {/* Total Cost & Edit */}
                        <div className="flex-shrink-0 text-right flex flex-col items-end gap-2">
                          {item.totalCost ? (
                            <>
                              <div className="text-sm font-medium text-green-400">
                                ${item.totalCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                              </div>
                              <div className="text-xs text-gray-500">Total</div>
                            </>
                          ) : (
                            <div className="text-xs text-gray-500">No cost</div>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity h-7 px-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditItem(item);
                            }}
                          >
                            <Edit2 className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      </ScrollArea>

      {/* Edit Modal */}
      {selectedTakeoff && (
        <TakeoffLineItemEditModal
          open={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingItem(null);
          }}
          item={editingItem}
          takeoffId={selectedTakeoff.id}
          onSave={handleItemUpdate}
        />
      )}
      
      {/* Add Item Modal */}
      {selectedTakeoff && (
        <TakeoffAddItemModal
          open={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSave={handleAddItem}
          saving={addingItem}
        />
      )}

      {/* Unit Price Manager Modal */}
      {showPriceManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-4xl mx-4">
            <UnitPriceManager
              projectSlug={projectSlug}
              onClose={() => setShowPriceManager(false)}
              onPricesUpdated={() => {
                fetchTakeoffs();
                fetchCostSummary();
              }}
            />
          </div>
        </div>
      )}

      {/* Budget Sync Modal */}
      {selectedTakeoff && (
        <TakeoffBudgetSyncModal
          isOpen={showBudgetSync}
          onClose={() => setShowBudgetSync(false)}
          takeoffId={selectedTakeoff.id}
          takeoffName={selectedTakeoff.name}
          projectSlug={projectSlug}
          onSyncComplete={() => {
            fetchTakeoffs();
            toast.success('Takeoff synced to budget successfully');
          }}
        />
      )}

      {/* Aggregation Modal */}
      <TakeoffAggregationModal
        isOpen={showAggregation}
        onClose={() => setShowAggregation(false)}
        projectSlug={projectSlug}
        onAggregationCreated={() => {
          fetchTakeoffs();
          toast.success('Aggregation created successfully');
        }}
      />

      {/* QA Dashboard */}
      {selectedTakeoff && (
        <TakeoffQADashboard
          isOpen={showQA}
          onClose={() => setShowQA(false)}
          takeoffId={selectedTakeoff.id}
          takeoffName={selectedTakeoff.name}
          onRefresh={fetchTakeoffs}
        />
      )}

      {/* Labor Planning */}
      {selectedTakeoff && (
        <TakeoffLaborPlanning
          isOpen={showLaborPlanning}
          onClose={() => setShowLaborPlanning(false)}
          takeoffId={selectedTakeoff.id}
          takeoffName={selectedTakeoff.name}
        />
      )}

      {/* Learning Panel */}
      {selectedTakeoff && showLearning && (
        <TakeoffLearningPanel
          takeoffId={selectedTakeoff.id}
          takeoffName={selectedTakeoff.name}
          onClose={() => setShowLearning(false)}
          onRefresh={fetchTakeoffs}
        />
      )}

      {/* Price Update Modal */}
      <PriceUpdateModal
        isOpen={showPriceUpdate}
        onClose={() => setShowPriceUpdate(false)}
        projectSlug={projectSlug}
        onPricesUpdated={fetchTakeoffs}
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
