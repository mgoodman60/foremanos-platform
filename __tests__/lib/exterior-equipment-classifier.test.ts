/**
 * Tests for Exterior Equipment Classifier
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
  createScopedLogger: vi.fn(() => mockLogger),
}));

import {
  EXTERIOR_LOCATION_KEYWORDS,
  EXTERIOR_EQUIPMENT_ITEM_KEYS,
  isExteriorLocation,
  isExteriorEquipment,
  classifyLocation,
} from '@/lib/exterior-equipment-classifier';

describe('Exterior Equipment Classifier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('EXTERIOR_LOCATION_KEYWORDS', () => {
    it('should contain expected keywords', () => {
      expect(EXTERIOR_LOCATION_KEYWORDS).toContain('parking');
      expect(EXTERIOR_LOCATION_KEYWORDS).toContain('exterior');
      expect(EXTERIOR_LOCATION_KEYWORDS).toContain('site');
      expect(EXTERIOR_LOCATION_KEYWORDS).toContain('roof');
      expect(EXTERIOR_LOCATION_KEYWORDS).toContain('bollard');
      expect(EXTERIOR_LOCATION_KEYWORDS).toContain('landscape');
    });
  });

  describe('EXTERIOR_EQUIPMENT_ITEM_KEYS', () => {
    it('should contain expected item keys', () => {
      expect(EXTERIOR_EQUIPMENT_ITEM_KEYS).toContain('exterior_light');
      expect(EXTERIOR_EQUIPMENT_ITEM_KEYS).toContain('pole_light');
      expect(EXTERIOR_EQUIPMENT_ITEM_KEYS).toContain('bollard_light');
      expect(EXTERIOR_EQUIPMENT_ITEM_KEYS).toContain('hose_bibb');
      expect(EXTERIOR_EQUIPMENT_ITEM_KEYS).toContain('wall_pack_led');
    });
  });

  describe('isExteriorLocation', () => {
    it('should return true for parking lot', () => {
      expect(isExteriorLocation('Parking Lot A')).toBe(true);
    });

    it('should return true for exterior wall', () => {
      expect(isExteriorLocation('Exterior Wall - North')).toBe(true);
    });

    it('should return true for roof', () => {
      expect(isExteriorLocation('Roof Level')).toBe(true);
    });

    it('should return true for site', () => {
      expect(isExteriorLocation('Site Area')).toBe(true);
    });

    it('should return true for loading dock', () => {
      expect(isExteriorLocation('Loading Dock Bay 2')).toBe(true);
    });

    it('should return true for landscape area', () => {
      expect(isExteriorLocation('Landscape Island')).toBe(true);
    });

    it('should return true for bollard location', () => {
      expect(isExteriorLocation('Bollard Row 3')).toBe(true);
    });

    it('should return false for interior room names', () => {
      expect(isExteriorLocation('Office 101')).toBe(false);
      expect(isExteriorLocation('Corridor')).toBe(false);
      expect(isExteriorLocation('Bathroom 2')).toBe(false);
      expect(isExteriorLocation('Break Room')).toBe(false);
    });

    it('should return false for numeric room numbers', () => {
      expect(isExteriorLocation('101')).toBe(false);
      expect(isExteriorLocation('205A')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isExteriorLocation('')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(isExteriorLocation('PARKING LOT')).toBe(true);
      expect(isExteriorLocation('parking lot')).toBe(true);
      expect(isExteriorLocation('Parking Lot')).toBe(true);
    });

    it('should return true for courtyard', () => {
      expect(isExteriorLocation('Courtyard Area')).toBe(true);
    });

    it('should return true for patio', () => {
      expect(isExteriorLocation('Covered Patio')).toBe(true);
    });

    it('should return true for driveway', () => {
      expect(isExteriorLocation('Front Drive')).toBe(true);
    });
  });

  describe('isExteriorEquipment', () => {
    it('should return true for exterior_light', () => {
      expect(isExteriorEquipment('exterior_light', 'LED Exterior Light')).toBe(true);
    });

    it('should return true for pole_light', () => {
      expect(isExteriorEquipment('pole_light', 'Pole Light 25ft')).toBe(true);
    });

    it('should return true for pole_light_20ft', () => {
      expect(isExteriorEquipment('pole_light_20ft', '20ft Pole Light')).toBe(true);
    });

    it('should return true for bollard_light', () => {
      expect(isExteriorEquipment('bollard_light', 'LED Bollard')).toBe(true);
    });

    it('should return true for wall_pack_led', () => {
      expect(isExteriorEquipment('wall_pack_led', 'Wall Pack LED')).toBe(true);
    });

    it('should return true for hose_bibb', () => {
      expect(isExteriorEquipment('hose_bibb', 'Frost-proof Hose Bibb')).toBe(true);
    });

    it('should return true for flood_light', () => {
      expect(isExteriorEquipment('flood_light', 'LED Flood Light')).toBe(true);
    });

    it('should return true for canopy_light', () => {
      expect(isExteriorEquipment('canopy_light', 'Canopy Light')).toBe(true);
    });

    it('should return false for regular outlet', () => {
      expect(isExteriorEquipment('duplex_outlet', 'Duplex Receptacle')).toBe(false);
    });

    it('should return false for interior switch', () => {
      expect(isExteriorEquipment('single_pole_switch', 'Single Pole Switch')).toBe(false);
    });

    it('should return false for troffer light', () => {
      expect(isExteriorEquipment('2x4_troffer', '2x4 LED Troffer')).toBe(false);
    });

    it('should return true when description contains exterior keywords', () => {
      expect(isExteriorEquipment('custom_light', 'Parking lot fixture')).toBe(true);
    });

    it('should return true when description mentions roof', () => {
      expect(isExteriorEquipment('custom_item', 'Roof mounted exhaust')).toBe(true);
    });

    it('should return false for empty strings', () => {
      expect(isExteriorEquipment('', '')).toBe(false);
    });

    it('should handle item key containing known exterior key', () => {
      expect(isExteriorEquipment('site-light-pole-assembly', 'Assembly')).toBe(true);
    });
  });

  describe('classifyLocation', () => {
    it('should return unknown for null room', () => {
      expect(classifyLocation(null)).toBe('unknown');
    });

    it('should return unknown for undefined room', () => {
      expect(classifyLocation(undefined)).toBe('unknown');
    });

    it('should return unknown for empty string', () => {
      expect(classifyLocation('')).toBe('unknown');
    });

    it('should return unknown for whitespace-only string', () => {
      expect(classifyLocation('   ')).toBe('unknown');
    });

    it('should return roof for roof locations', () => {
      expect(classifyLocation('Roof Level')).toBe('roof');
      expect(classifyLocation('Rooftop Unit Area')).toBe('roof');
    });

    it('should return site for parking lot', () => {
      expect(classifyLocation('Parking Lot A')).toBe('site');
    });

    it('should return site for driveway', () => {
      expect(classifyLocation('Main Drive')).toBe('site');
    });

    it('should return site for site area', () => {
      expect(classifyLocation('Site Work Area')).toBe('site');
    });

    it('should return site for landscape', () => {
      expect(classifyLocation('Landscape Island')).toBe('site');
    });

    it('should return exterior for exterior locations', () => {
      expect(classifyLocation('Exterior Wall')).toBe('exterior');
    });

    it('should return exterior for perimeter', () => {
      expect(classifyLocation('Building Perimeter')).toBe('exterior');
    });

    it('should return exterior for patio', () => {
      expect(classifyLocation('Covered Patio')).toBe('exterior');
    });

    it('should return exterior for balcony', () => {
      expect(classifyLocation('Balcony 3rd Floor')).toBe('exterior');
    });

    it('should return interior for standard room names', () => {
      expect(classifyLocation('Office 101')).toBe('interior');
      expect(classifyLocation('Corridor')).toBe('interior');
      expect(classifyLocation('Break Room')).toBe('interior');
      expect(classifyLocation('Bathroom 2')).toBe('interior');
    });

    it('should return interior for numeric room numbers', () => {
      expect(classifyLocation('101')).toBe('interior');
      expect(classifyLocation('205A')).toBe('interior');
    });

    it('should return exterior for numeric room with known-exterior equipment type', () => {
      expect(classifyLocation('101', 'exterior_light')).toBe('exterior');
      expect(classifyLocation('205', 'pole_light')).toBe('exterior');
      expect(classifyLocation('300', 'bollard_light')).toBe('exterior');
    });

    it('should return interior for numeric room with interior equipment type', () => {
      expect(classifyLocation('101', 'duplex_outlet')).toBe('interior');
      expect(classifyLocation('205', '2x4_troffer')).toBe('interior');
    });

    it('should be case-insensitive', () => {
      expect(classifyLocation('PARKING LOT')).toBe('site');
      expect(classifyLocation('ROOF LEVEL')).toBe('roof');
      expect(classifyLocation('EXTERIOR WALL')).toBe('exterior');
    });

    it('should log when overriding numeric room to exterior', () => {
      classifyLocation('101', 'exterior_light');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'EXTERIOR_CLASSIFIER',
        'Exterior equipment in numeric room override',
        { room: '101', equipmentType: 'exterior_light' },
      );
    });

    it('should prioritize roof over other exterior keywords', () => {
      // "Roof" should return 'roof' not 'exterior'
      expect(classifyLocation('Roof')).toBe('roof');
    });

    it('should prioritize site over generic exterior for parking', () => {
      // "Parking" should be 'site' not 'exterior'
      expect(classifyLocation('Parking Area')).toBe('site');
    });

    it('should handle loading dock as exterior', () => {
      expect(classifyLocation('Loading Dock')).toBe('exterior');
    });

    it('should handle plaza as exterior', () => {
      expect(classifyLocation('Main Plaza')).toBe('exterior');
    });

    it('should handle outdoor as exterior', () => {
      expect(classifyLocation('Outdoor Seating')).toBe('exterior');
    });
  });
});
