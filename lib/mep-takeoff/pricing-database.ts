// ============================================================================
// MEP COMMERCIAL PRICING DATABASE
// ============================================================================

export const MEP_PRICING = {
  // ============================================================================
  // ELECTRICAL - Division 26 (Expanded)
  // ============================================================================
  electrical: {
    // ---------- Receptacles & Outlets ----------
    'duplex_outlet': { price: 125, unit: 'EA', description: 'Duplex Receptacle (20A)' },
    'duplex_outlet_15a': { price: 95, unit: 'EA', description: 'Duplex Receptacle (15A)' },
    'gfci_outlet': { price: 185, unit: 'EA', description: 'GFCI Receptacle' },
    'gfci_outlet_wp': { price: 225, unit: 'EA', description: 'GFCI Weatherproof Receptacle' },
    'dedicated_outlet': { price: 225, unit: 'EA', description: 'Dedicated Circuit Outlet' },
    'isolated_ground_outlet': { price: 275, unit: 'EA', description: 'Isolated Ground Receptacle' },
    'hospital_grade_outlet': { price: 195, unit: 'EA', description: 'Hospital Grade Receptacle' },
    'floor_outlet': { price: 350, unit: 'EA', description: 'Floor Box Outlet' },
    'floor_box_duplex': { price: 425, unit: 'EA', description: 'Floor Box w/ Duplex & Data' },
    'usb_outlet': { price: 165, unit: 'EA', description: 'USB Duplex Receptacle' },
    'usb_c_outlet': { price: 195, unit: 'EA', description: 'USB-C Fast Charge Receptacle' },
    'quad_outlet': { price: 185, unit: 'EA', description: 'Quad Receptacle' },
    'weatherproof_outlet': { price: 165, unit: 'EA', description: 'Weatherproof Receptacle' },
    'twist_lock_outlet': { price: 285, unit: 'EA', description: 'Twist-Lock Receptacle (L6-20)' },
    'twist_lock_30a': { price: 385, unit: 'EA', description: 'Twist-Lock Receptacle (L6-30)' },
    '240v_outlet': { price: 325, unit: 'EA', description: '240V Outlet (NEMA 6-20)' },
    'dryer_outlet': { price: 285, unit: 'EA', description: 'Dryer Outlet (NEMA 14-30)' },
    'range_outlet': { price: 345, unit: 'EA', description: 'Range Outlet (NEMA 14-50)' },
    'ev_charger_outlet': { price: 485, unit: 'EA', description: 'EV Charger Outlet (NEMA 14-50)' },
    
    // ---------- Switches ----------
    'single_pole_switch': { price: 95, unit: 'EA', description: 'Single Pole Switch' },
    'three_way_switch': { price: 135, unit: 'EA', description: '3-Way Switch' },
    'four_way_switch': { price: 165, unit: 'EA', description: '4-Way Switch' },
    'dimmer_switch': { price: 185, unit: 'EA', description: 'Dimmer Switch' },
    'dimmer_switch_led': { price: 225, unit: 'EA', description: 'LED Compatible Dimmer' },
    'occupancy_sensor': { price: 275, unit: 'EA', description: 'Occupancy Sensor Switch' },
    'vacancy_sensor': { price: 295, unit: 'EA', description: 'Vacancy Sensor Switch' },
    'dual_tech_sensor': { price: 385, unit: 'EA', description: 'Dual Technology Sensor' },
    'daylight_sensor': { price: 245, unit: 'EA', description: 'Daylight Harvesting Sensor' },
    'timer_switch': { price: 165, unit: 'EA', description: 'Timer Switch' },
    'key_switch': { price: 225, unit: 'EA', description: 'Key-Operated Switch' },
    'pilot_light_switch': { price: 145, unit: 'EA', description: 'Switch w/ Pilot Light' },
    'combination_switch': { price: 175, unit: 'EA', description: 'Switch/Outlet Combination' },
    'fan_speed_control': { price: 195, unit: 'EA', description: 'Fan Speed Control' },
    'smart_switch': { price: 285, unit: 'EA', description: 'Smart Switch (WiFi)' },
    'smart_dimmer': { price: 325, unit: 'EA', description: 'Smart Dimmer (WiFi)' },
    
    // ---------- Lighting - Interior ----------
    '2x4_troffer': { price: 425, unit: 'EA', description: '2x4 LED Troffer' },
    '2x4_troffer_tunable': { price: 525, unit: 'EA', description: '2x4 LED Troffer (Tunable White)' },
    '2x2_troffer': { price: 375, unit: 'EA', description: '2x2 LED Troffer' },
    '2x2_troffer_tunable': { price: 475, unit: 'EA', description: '2x2 LED Troffer (Tunable White)' },
    '1x4_troffer': { price: 325, unit: 'EA', description: '1x4 LED Troffer' },
    'recessed_downlight': { price: 285, unit: 'EA', description: '6" LED Downlight' },
    'recessed_downlight_4': { price: 225, unit: 'EA', description: '4" LED Downlight' },
    'recessed_downlight_8': { price: 345, unit: 'EA', description: '8" LED Downlight' },
    'recessed_adjustable': { price: 325, unit: 'EA', description: 'Adjustable LED Downlight' },
    'wall_sconce': { price: 325, unit: 'EA', description: 'Wall Sconce' },
    'wall_sconce_ada': { price: 385, unit: 'EA', description: 'ADA Wall Sconce' },
    'linear_pendant': { price: 485, unit: 'LF', description: 'Linear LED Pendant' },
    'linear_surface': { price: 385, unit: 'LF', description: 'Linear Surface LED' },
    'strip_light': { price: 145, unit: 'LF', description: 'LED Strip Light' },
    'cove_light': { price: 185, unit: 'LF', description: 'Cove LED Light' },
    'under_cabinet': { price: 125, unit: 'LF', description: 'Under Cabinet LED' },
    'track_head': { price: 185, unit: 'EA', description: 'Track Light Head' },
    'track_rail': { price: 95, unit: 'LF', description: 'Track Rail' },
    'high_bay_led': { price: 485, unit: 'EA', description: 'LED High Bay Light' },
    'low_bay_led': { price: 385, unit: 'EA', description: 'LED Low Bay Light' },
    'vapor_tight': { price: 285, unit: 'EA', description: 'Vapor Tight LED Fixture' },
    'garage_light': { price: 225, unit: 'EA', description: 'Garage LED Light' },
    'closet_light': { price: 145, unit: 'EA', description: 'Closet LED Light' },
    
    // ---------- Lighting - Emergency/Exit ----------
    'exit_sign': { price: 225, unit: 'EA', description: 'Exit Sign w/ Emergency' },
    'exit_sign_edge_lit': { price: 285, unit: 'EA', description: 'Edge-Lit Exit Sign' },
    'exit_sign_combo': { price: 345, unit: 'EA', description: 'Exit Sign w/ Emergency Heads' },
    'emergency_light': { price: 285, unit: 'EA', description: 'Emergency Light Unit' },
    'emergency_light_remote': { price: 165, unit: 'EA', description: 'Remote Emergency Head' },
    'emergency_inverter': { price: 4500, unit: 'EA', description: 'Emergency Lighting Inverter' },
    'egress_path_marking': { price: 85, unit: 'LF', description: 'Photoluminescent Path Marking' },
    
    // ---------- Lighting - Exterior ----------
    'exterior_light': { price: 485, unit: 'EA', description: 'Exterior Wall Pack' },
    'wall_pack_led': { price: 385, unit: 'EA', description: 'LED Wall Pack' },
    'wall_pack_full_cutoff': { price: 425, unit: 'EA', description: 'Full Cutoff Wall Pack' },
    'soffit_light': { price: 285, unit: 'EA', description: 'Soffit Downlight' },
    'canopy_light': { price: 485, unit: 'EA', description: 'Canopy Light' },
    'bollard_light': { price: 685, unit: 'EA', description: 'Bollard Light' },
    'step_light': { price: 185, unit: 'EA', description: 'Step Light' },
    'landscape_light': { price: 245, unit: 'EA', description: 'Landscape Accent Light' },
    'flood_light': { price: 485, unit: 'EA', description: 'LED Flood Light' },
    'pole_light': { price: 2850, unit: 'EA', description: 'Parking Lot Pole Light' },
    'pole_light_20ft': { price: 3250, unit: 'EA', description: '20ft Pole w/ LED Fixture' },
    'pole_light_25ft': { price: 3850, unit: 'EA', description: '25ft Pole w/ LED Fixture' },
    'pole_light_30ft': { price: 4250, unit: 'EA', description: '30ft Pole w/ LED Fixture' },
    'area_light': { price: 685, unit: 'EA', description: 'Area/Shoebox Light' },
    
    // ---------- Panels & Distribution ----------
    'panel_100a': { price: 1850, unit: 'EA', description: '100A Panel' },
    'panel_200a': { price: 2650, unit: 'EA', description: '200A Panel' },
    'panel_225a': { price: 2950, unit: 'EA', description: '225A Panel' },
    'panel_400a': { price: 4500, unit: 'EA', description: '400A Panel' },
    'panel_600a': { price: 6500, unit: 'EA', description: '600A Panel' },
    'panel_800a': { price: 8500, unit: 'EA', description: '800A Panel' },
    'mlo_panel': { price: 2250, unit: 'EA', description: 'MLO Panel' },
    'lighting_panel': { price: 1650, unit: 'EA', description: 'Lighting Contactor Panel' },
    'transformer_15kva': { price: 3500, unit: 'EA', description: '15 kVA Dry Transformer' },
    'transformer_30kva': { price: 5500, unit: 'EA', description: '30 kVA Dry Transformer' },
    'transformer_45kva': { price: 7500, unit: 'EA', description: '45 kVA Dry Transformer' },
    'transformer_75kva': { price: 9500, unit: 'EA', description: '75 kVA Dry Transformer' },
    'transformer': { price: 8500, unit: 'EA', description: 'Dry Type Transformer' },
    'transformer_112kva': { price: 12500, unit: 'EA', description: '112.5 kVA Dry Transformer' },
    'switchgear': { price: 45000, unit: 'EA', description: 'Main Switchgear' },
    'ats_100a': { price: 8500, unit: 'EA', description: 'Automatic Transfer Switch 100A' },
    'ats_200a': { price: 12500, unit: 'EA', description: 'Automatic Transfer Switch 200A' },
    'ats_400a': { price: 18500, unit: 'EA', description: 'Automatic Transfer Switch 400A' },
    'disconnect': { price: 650, unit: 'EA', description: 'Fused Disconnect' },
    'disconnect_nf': { price: 485, unit: 'EA', description: 'Non-Fused Disconnect' },
    'disconnect_60a': { price: 385, unit: 'EA', description: '60A Disconnect' },
    'disconnect_100a': { price: 585, unit: 'EA', description: '100A Disconnect' },
    'disconnect_200a': { price: 985, unit: 'EA', description: '200A Disconnect' },
    'meter_base': { price: 1250, unit: 'EA', description: 'Meter Base/CT Cabinet' },
    'ct_cabinet': { price: 1850, unit: 'EA', description: 'CT Cabinet' },
    'surge_protector': { price: 685, unit: 'EA', description: 'Surge Protective Device' },
    'capacitor_bank': { price: 4500, unit: 'EA', description: 'Power Factor Capacitor Bank' },
    
    // ---------- Generators & UPS ----------
    'generator_20kw': { price: 18500, unit: 'EA', description: '20 kW Generator' },
    'generator_50kw': { price: 32500, unit: 'EA', description: '50 kW Generator' },
    'generator_100kw': { price: 55000, unit: 'EA', description: '100 kW Generator' },
    'generator_150kw': { price: 75000, unit: 'EA', description: '150 kW Generator' },
    'generator_200kw': { price: 95000, unit: 'EA', description: '200 kW Generator' },
    'ups_3kva': { price: 2850, unit: 'EA', description: '3 kVA UPS' },
    'ups_6kva': { price: 4850, unit: 'EA', description: '6 kVA UPS' },
    'ups_10kva': { price: 7500, unit: 'EA', description: '10 kVA UPS' },
    'ups_20kva': { price: 12500, unit: 'EA', description: '20 kVA UPS' },
    'battery_cabinet': { price: 3500, unit: 'EA', description: 'UPS Battery Cabinet' },
    
    // ---------- Conduit & Raceways ----------
    'emt_1_2': { price: 8.50, unit: 'LF', description: 'EMT Conduit 1/2"' },
    'emt_3_4': { price: 10.50, unit: 'LF', description: 'EMT Conduit 3/4"' },
    'emt_1': { price: 13.50, unit: 'LF', description: 'EMT Conduit 1"' },
    'emt_1_1_4': { price: 16.50, unit: 'LF', description: 'EMT Conduit 1-1/4"' },
    'emt_1_1_2': { price: 19.50, unit: 'LF', description: 'EMT Conduit 1-1/2"' },
    'emt_2': { price: 24.50, unit: 'LF', description: 'EMT Conduit 2"' },
    'rmc_1_2': { price: 14.50, unit: 'LF', description: 'RMC Conduit 1/2"' },
    'rmc_3_4': { price: 17.50, unit: 'LF', description: 'RMC Conduit 3/4"' },
    'rmc_1': { price: 22.50, unit: 'LF', description: 'RMC Conduit 1"' },
    'pvc_conduit_1': { price: 8.50, unit: 'LF', description: 'PVC Conduit 1"' },
    'pvc_conduit_2': { price: 12.50, unit: 'LF', description: 'PVC Conduit 2"' },
    'mc_cable_12_2': { price: 4.50, unit: 'LF', description: 'MC Cable 12/2' },
    'mc_cable_12_3': { price: 5.50, unit: 'LF', description: 'MC Cable 12/3' },
    'mc_cable_10_3': { price: 7.50, unit: 'LF', description: 'MC Cable 10/3' },
    'wire_mold': { price: 18.50, unit: 'LF', description: 'Surface Raceway' },
    'cable_tray': { price: 45, unit: 'LF', description: 'Cable Tray' },
    'junction_box_4sq': { price: 45, unit: 'EA', description: '4" Square Junction Box' },
    'junction_box_6x6': { price: 85, unit: 'EA', description: '6x6 Junction Box' },
    'junction_box_12x12': { price: 185, unit: 'EA', description: '12x12 Junction Box' },
    'pull_box': { price: 285, unit: 'EA', description: 'Pull Box' },
    
    // ---------- Wire & Cable ----------
    'wire_14awg': { price: 0.85, unit: 'LF', description: '#14 AWG Wire' },
    'wire_12awg': { price: 1.05, unit: 'LF', description: '#12 AWG Wire' },
    'wire_10awg': { price: 1.45, unit: 'LF', description: '#10 AWG Wire' },
    'wire_8awg': { price: 2.25, unit: 'LF', description: '#8 AWG Wire' },
    'wire_6awg': { price: 3.45, unit: 'LF', description: '#6 AWG Wire' },
    'wire_4awg': { price: 4.85, unit: 'LF', description: '#4 AWG Wire' },
    'wire_2awg': { price: 6.85, unit: 'LF', description: '#2 AWG Wire' },
    'wire_1_0': { price: 8.50, unit: 'LF', description: '#1/0 AWG Wire' },
    'wire_2_0': { price: 10.50, unit: 'LF', description: '#2/0 AWG Wire' },
    'wire_3_0': { price: 12.50, unit: 'LF', description: '#3/0 AWG Wire' },
    'wire_4_0': { price: 14.50, unit: 'LF', description: '#4/0 AWG Wire' },
    'wire_250mcm': { price: 18.50, unit: 'LF', description: '250 MCM Wire' },
    'wire_350mcm': { price: 24.50, unit: 'LF', description: '350 MCM Wire' },
    'wire_500mcm': { price: 32.50, unit: 'LF', description: '500 MCM Wire' },
    
    // ---------- Data/Low Voltage ----------
    'data_outlet': { price: 185, unit: 'EA', description: 'Data Outlet (Cat6)' },
    'data_outlet_cat6a': { price: 225, unit: 'EA', description: 'Data Outlet (Cat6A)' },
    'fiber_outlet': { price: 285, unit: 'EA', description: 'Fiber Optic Outlet' },
    'tv_outlet': { price: 145, unit: 'EA', description: 'TV/Coax Outlet' },
    'phone_outlet': { price: 125, unit: 'EA', description: 'Phone Outlet' },
    'av_plate': { price: 165, unit: 'EA', description: 'A/V Wall Plate' },
    'hdmi_plate': { price: 185, unit: 'EA', description: 'HDMI Wall Plate' },
    'cat6_cable': { price: 0.85, unit: 'LF', description: 'Cat6 Cable' },
    'cat6a_cable': { price: 1.25, unit: 'LF', description: 'Cat6A Cable' },
    'fiber_cable': { price: 2.85, unit: 'LF', description: 'Fiber Optic Cable' },
    'data_rack': { price: 2850, unit: 'EA', description: 'Data Rack (42U)' },
    'patch_panel_24': { price: 285, unit: 'EA', description: '24-Port Patch Panel' },
    'patch_panel_48': { price: 485, unit: 'EA', description: '48-Port Patch Panel' },
    'network_switch': { price: 1850, unit: 'EA', description: 'Network Switch (24-Port)' },
    'wap': { price: 685, unit: 'EA', description: 'Wireless Access Point' },
    
    // ---------- Fire Alarm ----------
    'smoke_detector': { price: 185, unit: 'EA', description: 'Smoke Detector' },
    'smoke_detector_addressable': { price: 245, unit: 'EA', description: 'Addressable Smoke Detector' },
    'heat_detector': { price: 165, unit: 'EA', description: 'Heat Detector' },
    'duct_detector': { price: 485, unit: 'EA', description: 'Duct Smoke Detector' },
    'beam_detector': { price: 1250, unit: 'EA', description: 'Beam Smoke Detector' },
    'pull_station': { price: 225, unit: 'EA', description: 'Pull Station' },
    'pull_station_addressable': { price: 285, unit: 'EA', description: 'Addressable Pull Station' },
    'horn_strobe': { price: 275, unit: 'EA', description: 'Horn/Strobe' },
    'horn_strobe_addressable': { price: 345, unit: 'EA', description: 'Addressable Horn/Strobe' },
    'speaker_strobe': { price: 385, unit: 'EA', description: 'Speaker/Strobe' },
    'fire_alarm_panel': { price: 4500, unit: 'EA', description: 'Fire Alarm Panel' },
    'facp_addressable': { price: 8500, unit: 'EA', description: 'Addressable FACP' },
    'annunciator': { price: 1250, unit: 'EA', description: 'Remote Annunciator' },
    'relay_module': { price: 285, unit: 'EA', description: 'Relay Module' },
    'monitor_module': { price: 245, unit: 'EA', description: 'Monitor Module' },
    
    // ---------- Security ----------
    'card_reader': { price: 685, unit: 'EA', description: 'Card Reader' },
    'keypad': { price: 485, unit: 'EA', description: 'Security Keypad' },
    'door_contact': { price: 145, unit: 'EA', description: 'Door Contact' },
    'motion_detector': { price: 225, unit: 'EA', description: 'Motion Detector' },
    'glass_break': { price: 185, unit: 'EA', description: 'Glass Break Sensor' },
    'security_camera': { price: 485, unit: 'EA', description: 'Security Camera' },
    'security_camera_ptz': { price: 1250, unit: 'EA', description: 'PTZ Security Camera' },
    'nvr': { price: 2850, unit: 'EA', description: 'Network Video Recorder' },
    'access_panel': { price: 4500, unit: 'EA', description: 'Access Control Panel' },
    'electric_strike': { price: 485, unit: 'EA', description: 'Electric Door Strike' },
    'mag_lock': { price: 385, unit: 'EA', description: 'Magnetic Lock' },
    'rex_sensor': { price: 165, unit: 'EA', description: 'Request-to-Exit Sensor' },
    
    // ---------- Nurse Call / Healthcare ----------
    'nurse_call_station': { price: 485, unit: 'EA', description: 'Nurse Call Station' },
    'pillow_speaker': { price: 385, unit: 'EA', description: 'Pillow Speaker' },
    'code_blue_station': { price: 685, unit: 'EA', description: 'Code Blue Station' },
    'staff_station': { price: 1250, unit: 'EA', description: 'Staff Station' },
    'dome_light': { price: 185, unit: 'EA', description: 'Corridor Dome Light' },
    'master_station': { price: 4500, unit: 'EA', description: 'Nurse Call Master Station' },
    
    // ---------- Motor Connections ----------
    'motor_connection_1hp': { price: 485, unit: 'EA', description: 'Motor Connection (≤1 HP)' },
    'motor_connection_5hp': { price: 685, unit: 'EA', description: 'Motor Connection (2-5 HP)' },
    'motor_connection_10hp': { price: 985, unit: 'EA', description: 'Motor Connection (6-10 HP)' },
    'motor_connection_25hp': { price: 1485, unit: 'EA', description: 'Motor Connection (11-25 HP)' },
    'motor_connection_50hp': { price: 2250, unit: 'EA', description: 'Motor Connection (26-50 HP)' },
    'vfd_5hp': { price: 1850, unit: 'EA', description: 'VFD (5 HP)' },
    'vfd_10hp': { price: 2850, unit: 'EA', description: 'VFD (10 HP)' },
    'vfd_25hp': { price: 4250, unit: 'EA', description: 'VFD (25 HP)' },
    'vfd_50hp': { price: 6500, unit: 'EA', description: 'VFD (50 HP)' },
    'starter_1hp': { price: 485, unit: 'EA', description: 'Motor Starter (≤1 HP)' },
    'starter_5hp': { price: 685, unit: 'EA', description: 'Motor Starter (2-5 HP)' },
    'starter_10hp': { price: 985, unit: 'EA', description: 'Motor Starter (6-10 HP)' },
  },
  
  // ============================================================================
  // PLUMBING - Division 22 (Expanded)
  // ============================================================================
  plumbing: {
    // ---------- Water Closets & Toilets ----------
    'water_closet': { price: 1250, unit: 'EA', description: 'Water Closet (Commercial)' },
    'water_closet_flushometer': { price: 1450, unit: 'EA', description: 'Water Closet w/ Flushometer' },
    'water_closet_tank': { price: 985, unit: 'EA', description: 'Water Closet w/ Tank' },
    'water_closet_ada': { price: 1550, unit: 'EA', description: 'ADA Water Closet' },
    'water_closet_wall_hung': { price: 1850, unit: 'EA', description: 'Wall-Hung Water Closet' },
    'water_closet_dual_flush': { price: 1350, unit: 'EA', description: 'Dual Flush Water Closet' },
    'water_closet_sensor': { price: 1650, unit: 'EA', description: 'Sensor Flush Water Closet' },
    'bidet': { price: 1250, unit: 'EA', description: 'Bidet' },
    
    // ---------- Urinals ----------
    'urinal': { price: 1150, unit: 'EA', description: 'Wall-Hung Urinal' },
    'urinal_ada': { price: 1350, unit: 'EA', description: 'ADA Urinal' },
    'urinal_sensor': { price: 1450, unit: 'EA', description: 'Sensor Flush Urinal' },
    'urinal_waterless': { price: 985, unit: 'EA', description: 'Waterless Urinal' },
    'urinal_trough': { price: 2850, unit: 'EA', description: 'Trough Urinal' },
    
    // ---------- Lavatories & Sinks ----------
    'lavatory': { price: 850, unit: 'EA', description: 'Lavatory w/ Faucet' },
    'ada_lavatory': { price: 1050, unit: 'EA', description: 'ADA Lavatory w/ Faucet' },
    'lavatory_wall_hung': { price: 950, unit: 'EA', description: 'Wall-Hung Lavatory' },
    'lavatory_countertop': { price: 750, unit: 'EA', description: 'Drop-In Lavatory' },
    'lavatory_undermount': { price: 850, unit: 'EA', description: 'Undermount Lavatory' },
    'lavatory_vessel': { price: 950, unit: 'EA', description: 'Vessel Lavatory' },
    'lavatory_sensor': { price: 1250, unit: 'EA', description: 'Sensor Faucet Lavatory' },
    'kitchen_sink': { price: 1450, unit: 'EA', description: 'Stainless Kitchen Sink' },
    'kitchen_sink_double': { price: 1650, unit: 'EA', description: 'Double Bowl Kitchen Sink' },
    'kitchen_sink_triple': { price: 2150, unit: 'EA', description: 'Triple Bowl Kitchen Sink' },
    'prep_sink': { price: 1250, unit: 'EA', description: 'Prep Sink' },
    'bar_sink': { price: 850, unit: 'EA', description: 'Bar Sink' },
    'mop_sink': { price: 950, unit: 'EA', description: 'Mop Sink/Service Sink' },
    'utility_sink': { price: 850, unit: 'EA', description: 'Utility Sink' },
    'laundry_sink': { price: 750, unit: 'EA', description: 'Laundry Sink' },
    'clinical_sink': { price: 2850, unit: 'EA', description: 'Clinical/Hopper Sink' },
    'scrub_sink': { price: 4500, unit: 'EA', description: 'Surgical Scrub Sink' },
    
    // ---------- Showers & Tubs ----------
    'shower': { price: 1850, unit: 'EA', description: 'Shower Valve & Head' },
    'shower_ada': { price: 2850, unit: 'EA', description: 'ADA Shower w/ Seat' },
    'shower_multi_head': { price: 2250, unit: 'EA', description: 'Multi-Head Shower' },
    'shower_body_spray': { price: 485, unit: 'EA', description: 'Body Spray' },
    'shower_hand_held': { price: 285, unit: 'EA', description: 'Hand-Held Shower' },
    'shower_pan': { price: 685, unit: 'EA', description: 'Shower Pan' },
    'shower_pan_tile': { price: 1250, unit: 'EA', description: 'Tile-Ready Shower Pan' },
    'bathtub': { price: 1250, unit: 'EA', description: 'Bathtub' },
    'bathtub_whirlpool': { price: 3500, unit: 'EA', description: 'Whirlpool Tub' },
    'bathtub_walk_in': { price: 4500, unit: 'EA', description: 'Walk-In Tub' },
    
    // ---------- Drinking Water ----------
    'drinking_fountain': { price: 2250, unit: 'EA', description: 'Drinking Fountain/Cooler' },
    'drinking_fountain_ada': { price: 2650, unit: 'EA', description: 'ADA Drinking Fountain' },
    'drinking_fountain_hi_lo': { price: 3850, unit: 'EA', description: 'Hi-Lo Drinking Fountain' },
    'bottle_filler': { price: 2850, unit: 'EA', description: 'Bottle Filler Station' },
    'bottle_filler_combo': { price: 3250, unit: 'EA', description: 'Bottle Filler w/ Fountain' },
    'water_dispenser': { price: 1850, unit: 'EA', description: 'Water Dispenser' },
    'ice_maker': { price: 3500, unit: 'EA', description: 'Ice Maker' },
    
    // ---------- Emergency Equipment ----------
    'eye_wash': { price: 1450, unit: 'EA', description: 'Eye Wash Station' },
    'eye_wash_deck': { price: 685, unit: 'EA', description: 'Deck-Mount Eye Wash' },
    'emergency_shower': { price: 2850, unit: 'EA', description: 'Emergency Shower' },
    'combo_shower_eye_wash': { price: 3850, unit: 'EA', description: 'Combo Shower/Eye Wash' },
    'drench_hose': { price: 685, unit: 'EA', description: 'Drench Hose' },
    
    // ---------- Water Heaters ----------
    'water_heater_40': { price: 2850, unit: 'EA', description: '40 Gal Water Heater' },
    'water_heater_50': { price: 3500, unit: 'EA', description: '50 Gal Water Heater' },
    'water_heater_80': { price: 4500, unit: 'EA', description: '80 Gal Water Heater' },
    'water_heater_100': { price: 5500, unit: 'EA', description: '100 Gal Water Heater' },
    'water_heater_commercial': { price: 8500, unit: 'EA', description: 'Commercial Water Heater' },
    'tankless_heater': { price: 5500, unit: 'EA', description: 'Tankless Water Heater' },
    'tankless_heater_commercial': { price: 8500, unit: 'EA', description: 'Commercial Tankless Heater' },
    'booster_heater': { price: 4500, unit: 'EA', description: 'Booster Water Heater' },
    'mixing_valve': { price: 685, unit: 'EA', description: 'Master Mixing Valve' },
    'recirculation_pump': { price: 850, unit: 'EA', description: 'Hot Water Recirc Pump' },
    
    // ---------- Pumps ----------
    'sump_pump': { price: 1650, unit: 'EA', description: 'Sump Pump' },
    'sump_pump_duplex': { price: 3250, unit: 'EA', description: 'Duplex Sump Pump' },
    'sewage_ejector': { price: 2850, unit: 'EA', description: 'Sewage Ejector Pump' },
    'sewage_ejector_duplex': { price: 5500, unit: 'EA', description: 'Duplex Sewage Ejector' },
    'grinder_pump': { price: 3850, unit: 'EA', description: 'Grinder Pump' },
    'booster_pump': { price: 4500, unit: 'EA', description: 'Booster Pump' },
    'transfer_pump': { price: 1850, unit: 'EA', description: 'Transfer Pump' },
    'condensate_pump': { price: 485, unit: 'EA', description: 'Condensate Pump' },
    
    // ---------- Valves ----------
    'ball_valve_1': { price: 85, unit: 'EA', description: 'Ball Valve 1"' },
    'ball_valve_2': { price: 145, unit: 'EA', description: 'Ball Valve 2"' },
    'ball_valve_3': { price: 285, unit: 'EA', description: 'Ball Valve 3"' },
    'gate_valve_2': { price: 185, unit: 'EA', description: 'Gate Valve 2"' },
    'gate_valve_4': { price: 385, unit: 'EA', description: 'Gate Valve 4"' },
    'check_valve_1': { price: 125, unit: 'EA', description: 'Check Valve 1"' },
    'check_valve_2': { price: 225, unit: 'EA', description: 'Check Valve 2"' },
    'prv': { price: 485, unit: 'EA', description: 'Pressure Reducing Valve' },
    'prv_2': { price: 685, unit: 'EA', description: 'PRV 2"' },
    'backflow_preventer': { price: 1850, unit: 'EA', description: 'Backflow Preventer' },
    'backflow_preventer_2': { price: 2850, unit: 'EA', description: 'Backflow Preventer 2"' },
    'backflow_preventer_4': { price: 4500, unit: 'EA', description: 'Backflow Preventer 4"' },
    'vacuum_breaker': { price: 285, unit: 'EA', description: 'Vacuum Breaker' },
    'thermostatic_mixing': { price: 485, unit: 'EA', description: 'Thermostatic Mixing Valve' },
    'balancing_valve': { price: 385, unit: 'EA', description: 'Balancing Valve' },
    
    // ---------- Traps & Interceptors ----------
    'grease_trap': { price: 2850, unit: 'EA', description: 'Grease Trap/Interceptor' },
    'grease_trap_large': { price: 5500, unit: 'EA', description: 'Grease Interceptor (500 GPM)' },
    'oil_interceptor': { price: 3850, unit: 'EA', description: 'Oil/Sand Interceptor' },
    'lint_trap': { price: 1250, unit: 'EA', description: 'Lint Interceptor' },
    'hair_trap': { price: 485, unit: 'EA', description: 'Hair Trap' },
    'plaster_trap': { price: 1650, unit: 'EA', description: 'Plaster Trap' },
    'p_trap': { price: 85, unit: 'EA', description: 'P-Trap' },
    
    // ---------- Tanks ----------
    'pressure_tank': { price: 2250, unit: 'EA', description: 'Pressure Tank' },
    'expansion_tank': { price: 485, unit: 'EA', description: 'Expansion Tank' },
    'expansion_tank_large': { price: 1250, unit: 'EA', description: 'Large Expansion Tank' },
    'storage_tank': { price: 4500, unit: 'EA', description: 'Hot Water Storage Tank' },
    'water_softener': { price: 3850, unit: 'EA', description: 'Water Softener' },
    'water_filter': { price: 1250, unit: 'EA', description: 'Water Filter System' },
    
    // ---------- Drains & Cleanouts ----------
    'floor_drain': { price: 450, unit: 'EA', description: 'Floor Drain' },
    'floor_drain_heavy': { price: 650, unit: 'EA', description: 'Heavy Duty Floor Drain' },
    'floor_drain_ada': { price: 550, unit: 'EA', description: 'ADA Floor Drain' },
    'trench_drain': { price: 185, unit: 'LF', description: 'Trench Drain' },
    'area_drain': { price: 485, unit: 'EA', description: 'Area Drain' },
    'hub_drain': { price: 285, unit: 'EA', description: 'Hub Drain' },
    'cleanout': { price: 285, unit: 'EA', description: 'Cleanout' },
    'cleanout_wall': { price: 345, unit: 'EA', description: 'Wall Cleanout' },
    'cleanout_floor': { price: 385, unit: 'EA', description: 'Floor Cleanout' },
    'roof_drain': { price: 650, unit: 'EA', description: 'Roof Drain' },
    'roof_drain_large': { price: 950, unit: 'EA', description: 'Roof Drain (6")' },
    'overflow_drain': { price: 550, unit: 'EA', description: 'Overflow Drain' },
    
    // ---------- Piping ----------
    'copper_1_2': { price: 28, unit: 'LF', description: 'Copper Pipe 1/2"' },
    'copper_3_4': { price: 35, unit: 'LF', description: 'Copper Pipe 3/4"' },
    'copper_1': { price: 45, unit: 'LF', description: 'Copper Pipe 1"' },
    'copper_1_1_2': { price: 65, unit: 'LF', description: 'Copper Pipe 1-1/2"' },
    'copper_2': { price: 85, unit: 'LF', description: 'Copper Pipe 2"' },
    'pex_1_2': { price: 12, unit: 'LF', description: 'PEX Pipe 1/2"' },
    'pex_3_4': { price: 15, unit: 'LF', description: 'PEX Pipe 3/4"' },
    'pex_1': { price: 22, unit: 'LF', description: 'PEX Pipe 1"' },
    'cpvc_1_2': { price: 14, unit: 'LF', description: 'CPVC Pipe 1/2"' },
    'cpvc_3_4': { price: 18, unit: 'LF', description: 'CPVC Pipe 3/4"' },
    'cpvc_1': { price: 24, unit: 'LF', description: 'CPVC Pipe 1"' },
    'domestic_water': { price: 45, unit: 'LF', description: 'Domestic Water Piping' },
    'pvc_dwv_2': { price: 24, unit: 'LF', description: 'PVC DWV 2"' },
    'pvc_dwv_3': { price: 32, unit: 'LF', description: 'PVC DWV 3"' },
    'pvc_dwv_4': { price: 42, unit: 'LF', description: 'PVC DWV 4"' },
    'pvc_dwv_6': { price: 65, unit: 'LF', description: 'PVC DWV 6"' },
    'cast_iron_4': { price: 85, unit: 'LF', description: 'Cast Iron 4"' },
    'cast_iron_6': { price: 125, unit: 'LF', description: 'Cast Iron 6"' },
    'waste_pipe': { price: 55, unit: 'LF', description: 'Sanitary Waste Piping' },
    'vent_pipe': { price: 35, unit: 'LF', description: 'Vent Piping' },
    'gas_pipe': { price: 65, unit: 'LF', description: 'Gas Piping' },
    'gas_pipe_1': { price: 55, unit: 'LF', description: 'Gas Pipe 1"' },
    'gas_pipe_2': { price: 85, unit: 'LF', description: 'Gas Pipe 2"' },
    'med_gas_oxygen': { price: 125, unit: 'LF', description: 'Medical Gas - Oxygen' },
    'med_gas_vacuum': { price: 95, unit: 'LF', description: 'Medical Gas - Vacuum' },
    'med_gas_air': { price: 95, unit: 'LF', description: 'Medical Gas - Air' },
    'pipe_insulation': { price: 12, unit: 'LF', description: 'Pipe Insulation' },
    
    // ---------- Fixtures - General ----------
    'hose_bibb': { price: 285, unit: 'EA', description: 'Hose Bibb' },
    'hose_bibb_frost_proof': { price: 385, unit: 'EA', description: 'Frost-Proof Hose Bibb' },
    'wall_hydrant': { price: 485, unit: 'EA', description: 'Wall Hydrant' },
    'sediment_bucket': { price: 485, unit: 'EA', description: 'Sediment Bucket' },
    'indirect_waste': { price: 285, unit: 'EA', description: 'Indirect Waste Receptor' },
  },
  
  // ============================================================================
  // HVAC - Division 23 (Expanded)
  // ============================================================================
  hvac: {
    // ---------- Rooftop Units ----------
    'rtu_2ton': { price: 8500, unit: 'EA', description: '2-Ton RTU' },
    'rtu_3ton': { price: 10500, unit: 'EA', description: '3-Ton RTU' },
    'rtu_4ton': { price: 11500, unit: 'EA', description: '4-Ton RTU' },
    'rtu_5ton': { price: 12500, unit: 'EA', description: '5-Ton RTU' },
    'rtu_7_5ton': { price: 15500, unit: 'EA', description: '7.5-Ton RTU' },
    'rtu_10ton': { price: 18500, unit: 'EA', description: '10-Ton RTU' },
    'rtu_12_5ton': { price: 21500, unit: 'EA', description: '12.5-Ton RTU' },
    'rtu_15ton': { price: 24500, unit: 'EA', description: '15-Ton RTU' },
    'rtu_20ton': { price: 32500, unit: 'EA', description: '20-Ton RTU' },
    'rtu_25ton': { price: 42500, unit: 'EA', description: '25-Ton RTU' },
    'rtu_30ton': { price: 52500, unit: 'EA', description: '30-Ton RTU' },
    'rtu_doas': { price: 28500, unit: 'EA', description: 'DOAS RTU' },
    
    // ---------- Split Systems ----------
    'split_system': { price: 8500, unit: 'EA', description: 'Mini-Split System' },
    'split_2ton': { price: 6500, unit: 'EA', description: '2-Ton Split System' },
    'split_3ton': { price: 7500, unit: 'EA', description: '3-Ton Split System' },
    'split_4ton': { price: 8500, unit: 'EA', description: '4-Ton Split System' },
    'split_5ton': { price: 9500, unit: 'EA', description: '5-Ton Split System' },
    'mini_split_9k': { price: 3500, unit: 'EA', description: 'Mini-Split 9,000 BTU' },
    'mini_split_12k': { price: 4250, unit: 'EA', description: 'Mini-Split 12,000 BTU' },
    'mini_split_18k': { price: 5250, unit: 'EA', description: 'Mini-Split 18,000 BTU' },
    'mini_split_24k': { price: 6250, unit: 'EA', description: 'Mini-Split 24,000 BTU' },
    'mini_split_multi': { price: 8500, unit: 'EA', description: 'Multi-Zone Mini-Split' },
    'condenser_2ton': { price: 2850, unit: 'EA', description: '2-Ton Condenser' },
    'condenser_3ton': { price: 3450, unit: 'EA', description: '3-Ton Condenser' },
    'condenser_4ton': { price: 4250, unit: 'EA', description: '4-Ton Condenser' },
    'condenser_5ton': { price: 5250, unit: 'EA', description: '5-Ton Condenser' },
    
    // ---------- VRF Systems ----------
    'vrf_outdoor': { price: 18500, unit: 'EA', description: 'VRF Outdoor Unit' },
    'vrf_outdoor_8ton': { price: 24500, unit: 'EA', description: 'VRF Outdoor 8-Ton' },
    'vrf_outdoor_12ton': { price: 32500, unit: 'EA', description: 'VRF Outdoor 12-Ton' },
    'vrf_outdoor_16ton': { price: 42500, unit: 'EA', description: 'VRF Outdoor 16-Ton' },
    'vrf_indoor': { price: 3500, unit: 'EA', description: 'VRF Indoor Unit' },
    'vrf_cassette': { price: 4250, unit: 'EA', description: 'VRF Ceiling Cassette' },
    'vrf_ducted': { price: 4850, unit: 'EA', description: 'VRF Ducted Unit' },
    'vrf_wall': { price: 3250, unit: 'EA', description: 'VRF Wall Unit' },
    'vrf_floor': { price: 3850, unit: 'EA', description: 'VRF Floor Unit' },
    
    // ---------- PTAC/PTHP ----------
    'ptac_9k': { price: 1850, unit: 'EA', description: 'PTAC 9,000 BTU' },
    'ptac_12k': { price: 2150, unit: 'EA', description: 'PTAC 12,000 BTU' },
    'ptac_15k': { price: 2450, unit: 'EA', description: 'PTAC 15,000 BTU' },
    'pthp_9k': { price: 2250, unit: 'EA', description: 'PTHP 9,000 BTU' },
    'pthp_12k': { price: 2550, unit: 'EA', description: 'PTHP 12,000 BTU' },
    'pthp_15k': { price: 2850, unit: 'EA', description: 'PTHP 15,000 BTU' },
    'ptac_wall_sleeve': { price: 485, unit: 'EA', description: 'PTAC Wall Sleeve' },
    
    // ---------- Air Handlers & Fan Coils ----------
    'ahu_2000cfm': { price: 12500, unit: 'EA', description: 'AHU 2,000 CFM' },
    'ahu_4000cfm': { price: 18500, unit: 'EA', description: 'AHU 4,000 CFM' },
    'ahu_6000cfm': { price: 24500, unit: 'EA', description: 'AHU 6,000 CFM' },
    'ahu_10000cfm': { price: 35000, unit: 'EA', description: 'AHU 10,000 CFM' },
    'fcu_horizontal': { price: 2850, unit: 'EA', description: 'Fan Coil - Horizontal' },
    'fcu_vertical': { price: 2650, unit: 'EA', description: 'Fan Coil - Vertical' },
    'fcu_ceiling': { price: 3250, unit: 'EA', description: 'Fan Coil - Ceiling' },
    'fcu_cassette': { price: 3850, unit: 'EA', description: 'Fan Coil - Cassette' },
    'crac_unit': { price: 32500, unit: 'EA', description: 'CRAC Unit' },
    
    // ---------- Fans ----------
    'exhaust_fan': { price: 1850, unit: 'EA', description: 'Exhaust Fan' },
    'exhaust_fan_roof': { price: 2450, unit: 'EA', description: 'Roof Exhaust Fan' },
    'exhaust_fan_inline': { price: 1250, unit: 'EA', description: 'Inline Exhaust Fan' },
    'exhaust_fan_sidewall': { price: 1450, unit: 'EA', description: 'Sidewall Exhaust Fan' },
    'exhaust_fan_ceiling': { price: 485, unit: 'EA', description: 'Ceiling Exhaust Fan' },
    'exhaust_fan_bath': { price: 285, unit: 'EA', description: 'Bathroom Exhaust Fan' },
    'exhaust_fan_kitchen': { price: 3850, unit: 'EA', description: 'Kitchen Hood Exhaust' },
    'supply_fan': { price: 2850, unit: 'EA', description: 'Supply Fan' },
    'return_fan': { price: 2650, unit: 'EA', description: 'Return Fan' },
    'makeup_air': { price: 8500, unit: 'EA', description: 'Makeup Air Unit' },
    'erv': { price: 8500, unit: 'EA', description: 'Energy Recovery Ventilator' },
    'hrv': { price: 6500, unit: 'EA', description: 'Heat Recovery Ventilator' },
    'destratification_fan': { price: 1850, unit: 'EA', description: 'Destratification Fan' },
    
    // ---------- Unit Heaters ----------
    'unit_heater': { price: 2250, unit: 'EA', description: 'Unit Heater' },
    'unit_heater_gas_50k': { price: 1850, unit: 'EA', description: 'Gas Unit Heater 50K BTU' },
    'unit_heater_gas_100k': { price: 2450, unit: 'EA', description: 'Gas Unit Heater 100K BTU' },
    'unit_heater_gas_150k': { price: 2850, unit: 'EA', description: 'Gas Unit Heater 150K BTU' },
    'unit_heater_electric': { price: 1250, unit: 'EA', description: 'Electric Unit Heater' },
    'cabinet_heater': { price: 1850, unit: 'EA', description: 'Cabinet Unit Heater' },
    'baseboard_heater': { price: 85, unit: 'LF', description: 'Electric Baseboard' },
    'radiant_heater': { price: 1450, unit: 'EA', description: 'Radiant Heater' },
    'infrared_heater': { price: 1850, unit: 'EA', description: 'Infrared Tube Heater' },
    
    // ---------- Boilers ----------
    'boiler_gas_100k': { price: 8500, unit: 'EA', description: 'Gas Boiler 100K BTU' },
    'boiler_gas_200k': { price: 12500, unit: 'EA', description: 'Gas Boiler 200K BTU' },
    'boiler_gas_400k': { price: 18500, unit: 'EA', description: 'Gas Boiler 400K BTU' },
    'boiler_gas_800k': { price: 28500, unit: 'EA', description: 'Gas Boiler 800K BTU' },
    'boiler_electric': { price: 6500, unit: 'EA', description: 'Electric Boiler' },
    'boiler_condensing': { price: 14500, unit: 'EA', description: 'Condensing Boiler' },
    
    // ---------- Chillers ----------
    'chiller_air_20ton': { price: 45000, unit: 'EA', description: 'Air-Cooled Chiller 20-Ton' },
    'chiller_air_40ton': { price: 65000, unit: 'EA', description: 'Air-Cooled Chiller 40-Ton' },
    'chiller_air_60ton': { price: 85000, unit: 'EA', description: 'Air-Cooled Chiller 60-Ton' },
    'chiller_water_100ton': { price: 125000, unit: 'EA', description: 'Water-Cooled Chiller 100-Ton' },
    
    // ---------- Air Distribution ----------
    'supply_diffuser': { price: 185, unit: 'EA', description: 'Supply Diffuser' },
    'supply_diffuser_perf': { price: 225, unit: 'EA', description: 'Perforated Supply Diffuser' },
    'supply_diffuser_adj': { price: 245, unit: 'EA', description: 'Adjustable Diffuser' },
    'return_grille': { price: 145, unit: 'EA', description: 'Return Air Grille' },
    'return_grille_filter': { price: 225, unit: 'EA', description: 'Return Grille w/ Filter' },
    'linear_diffuser': { price: 285, unit: 'LF', description: 'Linear Slot Diffuser' },
    'register_floor': { price: 125, unit: 'EA', description: 'Floor Register' },
    'register_ceiling': { price: 145, unit: 'EA', description: 'Ceiling Register' },
    'register_wall': { price: 125, unit: 'EA', description: 'Wall Register' },
    'transfer_grille': { price: 95, unit: 'EA', description: 'Transfer Grille' },
    'louver_intake': { price: 385, unit: 'EA', description: 'Intake Louver' },
    'louver_exhaust': { price: 345, unit: 'EA', description: 'Exhaust Louver' },
    'louver_penthouse': { price: 1850, unit: 'EA', description: 'Penthouse Louver' },
    
    // ---------- VAV & Terminal Units ----------
    'vav_box': { price: 1850, unit: 'EA', description: 'VAV Box' },
    'vav_box_reheat': { price: 2850, unit: 'EA', description: 'VAV Box w/ Reheat' },
    'vav_fan_powered': { price: 3850, unit: 'EA', description: 'Fan-Powered VAV' },
    'cav_box': { price: 1250, unit: 'EA', description: 'Constant Volume Box' },
    'mixing_box': { price: 1450, unit: 'EA', description: 'Mixing Box' },
    
    // ---------- Ductwork ----------
    'rect_duct_small': { price: 35, unit: 'LF', description: 'Rectangular Duct (≤24")' },
    'rect_duct_medium': { price: 45, unit: 'LF', description: 'Rectangular Duct (25-36")' },
    'rect_duct_large': { price: 55, unit: 'LF', description: 'Rectangular Duct (>36")' },
    'round_duct_6': { price: 18, unit: 'LF', description: 'Round Duct 6"' },
    'round_duct_8': { price: 22, unit: 'LF', description: 'Round Duct 8"' },
    'round_duct_10': { price: 26, unit: 'LF', description: 'Round Duct 10"' },
    'round_duct_12': { price: 32, unit: 'LF', description: 'Round Duct 12"' },
    'round_duct': { price: 28, unit: 'LF', description: 'Round/Spiral Duct' },
    'flex_duct': { price: 18, unit: 'LF', description: 'Flex Duct' },
    'flex_duct_insulated': { price: 24, unit: 'LF', description: 'Insulated Flex Duct' },
    'duct_liner': { price: 8, unit: 'SF', description: 'Duct Liner' },
    'duct_wrap': { price: 6, unit: 'SF', description: 'Duct Wrap Insulation' },
    'duct_board': { price: 12, unit: 'SF', description: 'Duct Board' },
    
    // ---------- Dampers ----------
    'damper': { price: 650, unit: 'EA', description: 'Fire/Smoke Damper' },
    'fire_damper': { price: 485, unit: 'EA', description: 'Fire Damper' },
    'smoke_damper': { price: 685, unit: 'EA', description: 'Smoke Damper' },
    'combination_fsd': { price: 785, unit: 'EA', description: 'Combination Fire/Smoke' },
    'volume_damper': { price: 185, unit: 'EA', description: 'Volume Damper' },
    'backdraft_damper': { price: 145, unit: 'EA', description: 'Backdraft Damper' },
    'motorized_damper': { price: 485, unit: 'EA', description: 'Motorized Damper' },
    'od_air_damper': { price: 585, unit: 'EA', description: 'Outside Air Damper' },
    
    // ---------- Piping ----------
    'refrigerant_piping': { price: 45, unit: 'LF', description: 'Refrigerant Piping' },
    'refrigerant_3_8': { price: 32, unit: 'LF', description: 'Refrigerant Line 3/8"' },
    'refrigerant_1_2': { price: 38, unit: 'LF', description: 'Refrigerant Line 1/2"' },
    'refrigerant_5_8': { price: 45, unit: 'LF', description: 'Refrigerant Line 5/8"' },
    'refrigerant_7_8': { price: 55, unit: 'LF', description: 'Refrigerant Line 7/8"' },
    'chilled_water_pipe': { price: 65, unit: 'LF', description: 'Chilled Water Piping' },
    'hot_water_pipe': { price: 55, unit: 'LF', description: 'Hot Water Piping' },
    'condensate_drain': { price: 18, unit: 'LF', description: 'Condensate Drain' },
    'pipe_insulation': { price: 14, unit: 'LF', description: 'Pipe Insulation' },
    
    // ---------- Controls ----------
    'thermostat': { price: 485, unit: 'EA', description: 'Programmable Thermostat' },
    'thermostat_smart': { price: 685, unit: 'EA', description: 'Smart Thermostat' },
    'thermostat_wireless': { price: 585, unit: 'EA', description: 'Wireless Thermostat' },
    'bms_point': { price: 350, unit: 'EA', description: 'BMS Control Point' },
    'bms_controller': { price: 2850, unit: 'EA', description: 'BMS Controller' },
    'temp_sensor': { price: 185, unit: 'EA', description: 'Temperature Sensor' },
    'humidity_sensor': { price: 245, unit: 'EA', description: 'Humidity Sensor' },
    'co2_sensor': { price: 485, unit: 'EA', description: 'CO2 Sensor' },
    'pressure_sensor': { price: 285, unit: 'EA', description: 'Pressure Sensor' },
    'flow_switch': { price: 185, unit: 'EA', description: 'Flow Switch' },
    'actuator': { price: 385, unit: 'EA', description: 'Valve/Damper Actuator' },
  },
  
  // ============================================================================
  // FIRE PROTECTION - Division 21 (New)
  // ============================================================================
  fire_protection: {
    // ---------- Sprinkler Heads ----------
    'sprinkler_pendent': { price: 85, unit: 'EA', description: 'Pendent Sprinkler Head' },
    'sprinkler_upright': { price: 85, unit: 'EA', description: 'Upright Sprinkler Head' },
    'sprinkler_sidewall': { price: 95, unit: 'EA', description: 'Sidewall Sprinkler Head' },
    'sprinkler_concealed': { price: 125, unit: 'EA', description: 'Concealed Sprinkler Head' },
    'sprinkler_recessed': { price: 95, unit: 'EA', description: 'Recessed Sprinkler Head' },
    'sprinkler_dry': { price: 145, unit: 'EA', description: 'Dry Sprinkler Head' },
    'sprinkler_esfr': { price: 185, unit: 'EA', description: 'ESFR Sprinkler Head' },
    'sprinkler_residential': { price: 75, unit: 'EA', description: 'Residential Sprinkler' },
    
    // ---------- Sprinkler Piping ----------
    'sprinkler_main_2': { price: 45, unit: 'LF', description: 'Sprinkler Main 2"' },
    'sprinkler_main_4': { price: 85, unit: 'LF', description: 'Sprinkler Main 4"' },
    'sprinkler_main_6': { price: 125, unit: 'LF', description: 'Sprinkler Main 6"' },
    'sprinkler_branch_1': { price: 28, unit: 'LF', description: 'Sprinkler Branch 1"' },
    'sprinkler_branch_1_1_4': { price: 32, unit: 'LF', description: 'Sprinkler Branch 1-1/4"' },
    'sprinkler_branch_1_1_2': { price: 38, unit: 'LF', description: 'Sprinkler Branch 1-1/2"' },
    'cpvc_sprinkler': { price: 22, unit: 'LF', description: 'CPVC Sprinkler Pipe' },
    
    // ---------- Valves & Trim ----------
    'alarm_valve': { price: 2850, unit: 'EA', description: 'Alarm Check Valve' },
    'dry_valve': { price: 4500, unit: 'EA', description: 'Dry Pipe Valve' },
    'deluge_valve': { price: 5500, unit: 'EA', description: 'Deluge Valve' },
    'preaction_valve': { price: 6500, unit: 'EA', description: 'Preaction Valve' },
    'osyy_valve': { price: 685, unit: 'EA', description: 'OS&Y Valve' },
    'piv': { price: 1850, unit: 'EA', description: 'Post Indicator Valve' },
    'butterfly_valve': { price: 485, unit: 'EA', description: 'Butterfly Valve' },
    'inspector_test': { price: 285, unit: 'EA', description: 'Inspector Test Connection' },
    'fdc': { price: 1250, unit: 'EA', description: 'Fire Department Connection' },
    'flow_switch': { price: 385, unit: 'EA', description: 'Water Flow Switch' },
    'tamper_switch': { price: 185, unit: 'EA', description: 'Tamper Switch' },
    
    // ---------- Fire Pumps ----------
    'fire_pump_500gpm': { price: 45000, unit: 'EA', description: 'Fire Pump 500 GPM' },
    'fire_pump_750gpm': { price: 55000, unit: 'EA', description: 'Fire Pump 750 GPM' },
    'fire_pump_1000gpm': { price: 68000, unit: 'EA', description: 'Fire Pump 1000 GPM' },
    'fire_pump_1500gpm': { price: 85000, unit: 'EA', description: 'Fire Pump 1500 GPM' },
    'jockey_pump': { price: 8500, unit: 'EA', description: 'Jockey Pump' },
    'fire_pump_controller': { price: 18500, unit: 'EA', description: 'Fire Pump Controller' },
    
    // ---------- Standpipe ----------
    'standpipe_4': { price: 185, unit: 'LF', description: 'Standpipe 4"' },
    'standpipe_6': { price: 245, unit: 'LF', description: 'Standpipe 6"' },
    'hose_valve': { price: 485, unit: 'EA', description: 'Hose Valve Connection' },
    'hose_cabinet': { price: 685, unit: 'EA', description: 'Fire Hose Cabinet' },
    'roof_manifold': { price: 1850, unit: 'EA', description: 'Roof Manifold' },
    
    // ---------- Suppression Systems ----------
    'clean_agent_panel': { price: 12500, unit: 'EA', description: 'Clean Agent Panel' },
    'clean_agent_cylinder': { price: 4500, unit: 'EA', description: 'Clean Agent Cylinder' },
    'clean_agent_nozzle': { price: 485, unit: 'EA', description: 'Clean Agent Nozzle' },
    'kitchen_suppression': { price: 8500, unit: 'EA', description: 'Kitchen Hood Suppression' },
    'kitchen_nozzle': { price: 285, unit: 'EA', description: 'Kitchen Suppression Nozzle' },
    'ansul_link': { price: 145, unit: 'EA', description: 'Fusible Link' },
    
    // ---------- Extinguishers ----------
    'extinguisher_abc': { price: 125, unit: 'EA', description: 'Fire Extinguisher ABC' },
    'extinguisher_k': { price: 285, unit: 'EA', description: 'Fire Extinguisher Class K' },
    'extinguisher_co2': { price: 385, unit: 'EA', description: 'CO2 Extinguisher' },
    'extinguisher_cabinet': { price: 185, unit: 'EA', description: 'Extinguisher Cabinet' },
    'extinguisher_cabinet_recessed': { price: 285, unit: 'EA', description: 'Recessed Extinguisher Cabinet' },
  },
};

// ============================================================================
// MEP SYMBOL PATTERNS
// ============================================================================

export const MEP_PATTERNS = {
  electrical: [
    // Receptacles & Outlets
    { pattern: /duplex|outlet|receptacle|\bDR\b|\$|⊕/gi, item: 'duplex_outlet' },
    { pattern: /gfci|gfi|ground fault/gi, item: 'gfci_outlet' },
    { pattern: /dedicated|isolated ground/gi, item: 'dedicated_outlet' },
    { pattern: /hospital grade|hosp[\s\-]?grade/gi, item: 'hospital_grade_outlet' },
    { pattern: /floor box|floor outlet/gi, item: 'floor_outlet' },
    { pattern: /usb[\s\-]?c|type[\s\-]?c/gi, item: 'usb_c_outlet' },
    { pattern: /usb outlet|usb receptacle/gi, item: 'usb_outlet' },
    { pattern: /weatherproof|wp outlet|exterior outlet/gi, item: 'weatherproof_outlet' },
    { pattern: /twist[\s\-]?lock|locking/gi, item: 'twist_lock_outlet' },
    { pattern: /240v|220v|dryer outlet/gi, item: '240v_outlet' },
    { pattern: /ev charger|electric vehicle/gi, item: 'ev_charger_outlet' },
    
    // Switches
    { pattern: /switch|\bS\b|\bS1\b|\bS3\b/gi, item: 'single_pole_switch' },
    { pattern: /3[\-\s]?way|three way/gi, item: 'three_way_switch' },
    { pattern: /4[\-\s]?way|four way/gi, item: 'four_way_switch' },
    { pattern: /dimmer|\bD\b/gi, item: 'dimmer_switch' },
    { pattern: /occupancy|occ[\s\-]?sensor|motion sensor/gi, item: 'occupancy_sensor' },
    { pattern: /vacancy sensor/gi, item: 'vacancy_sensor' },
    { pattern: /daylight sensor|photocell/gi, item: 'daylight_sensor' },
    { pattern: /timer switch|time clock/gi, item: 'timer_switch' },
    { pattern: /key switch|keyed/gi, item: 'key_switch' },
    { pattern: /smart switch|wifi switch/gi, item: 'smart_switch' },
    { pattern: /fan speed|fan control/gi, item: 'fan_speed_control' },
    
    // Lighting
    { pattern: /2x4|2'x4'/gi, item: '2x4_troffer' },
    { pattern: /2x2|2'x2'/gi, item: '2x2_troffer' },
    { pattern: /1x4|1'x4'/gi, item: '1x4_troffer' },
    { pattern: /downlight|can light|recessed light/gi, item: 'recessed_downlight' },
    { pattern: /wall sconce/gi, item: 'wall_sconce' },
    { pattern: /pendant|linear pendant/gi, item: 'linear_pendant' },
    { pattern: /strip light|tape light/gi, item: 'strip_light' },
    { pattern: /cove light/gi, item: 'cove_light' },
    { pattern: /under cabinet/gi, item: 'under_cabinet' },
    { pattern: /track light|track head/gi, item: 'track_head' },
    { pattern: /high bay/gi, item: 'high_bay_led' },
    { pattern: /low bay/gi, item: 'low_bay_led' },
    { pattern: /vapor tight|wet location/gi, item: 'vapor_tight' },
    { pattern: /exit|egress/gi, item: 'exit_sign' },
    { pattern: /emergency|em[\s\-]?light/gi, item: 'emergency_light' },
    { pattern: /wall pack|exterior wall/gi, item: 'wall_pack_led' },
    { pattern: /canopy light/gi, item: 'canopy_light' },
    { pattern: /bollard/gi, item: 'bollard_light' },
    { pattern: /flood light/gi, item: 'flood_light' },
    { pattern: /pole light|parking lot|area light/gi, item: 'pole_light' },
    { pattern: /step light/gi, item: 'step_light' },
    
    // Panels & Distribution
    { pattern: /100[\s]?a(mp)?[\s]?panel/gi, item: 'panel_100a' },
    { pattern: /200[\s]?a(mp)?[\s]?panel/gi, item: 'panel_200a' },
    { pattern: /400[\s]?a(mp)?[\s]?panel/gi, item: 'panel_400a' },
    { pattern: /panel|\bMLO\b|\bMCB\b/gi, item: 'panel_200a' },
    { pattern: /transformer|xfmr/gi, item: 'transformer' },
    { pattern: /switchgear|main distribution/gi, item: 'switchgear' },
    { pattern: /ats|transfer switch/gi, item: 'ats_200a' },
    { pattern: /disconnect|\bDS\b/gi, item: 'disconnect' },
    { pattern: /meter base|ct cabinet/gi, item: 'meter_base' },
    { pattern: /surge protector|spd/gi, item: 'surge_protector' },
    
    // Generators & UPS
    { pattern: /generator|gen[\s\-]?set/gi, item: 'generator_50kw' },
    { pattern: /ups|uninterruptible/gi, item: 'ups_10kva' },
    
    // Conduit & Wire
    { pattern: /emt|conduit/gi, item: 'emt_3_4' },
    { pattern: /mc cable/gi, item: 'mc_cable_12_2' },
    { pattern: /cable tray/gi, item: 'cable_tray' },
    { pattern: /junction box|j[\-]?box/gi, item: 'junction_box_4sq' },
    { pattern: /pull box/gi, item: 'pull_box' },
    
    // Data/Low Voltage
    { pattern: /data|cat[\s\-]?6|ethernet/gi, item: 'data_outlet' },
    { pattern: /cat[\s\-]?6a/gi, item: 'data_outlet_cat6a' },
    { pattern: /fiber|fibre/gi, item: 'fiber_outlet' },
    { pattern: /tv outlet|coax/gi, item: 'tv_outlet' },
    { pattern: /phone outlet|telephone/gi, item: 'phone_outlet' },
    { pattern: /wireless access|wap|\bAP\b/gi, item: 'wap' },
    { pattern: /data rack|server rack/gi, item: 'data_rack' },
    { pattern: /patch panel/gi, item: 'patch_panel_24' },
    
    // Fire Alarm
    { pattern: /smoke[\s]?detect|\bSD\b/gi, item: 'smoke_detector' },
    { pattern: /heat[\s]?detect/gi, item: 'heat_detector' },
    { pattern: /duct[\s]?detect/gi, item: 'duct_detector' },
    { pattern: /pull station|\bPS\b/gi, item: 'pull_station' },
    { pattern: /horn[\s\-]?strobe|\bHS\b/gi, item: 'horn_strobe' },
    { pattern: /speaker[\s\-]?strobe/gi, item: 'speaker_strobe' },
    { pattern: /fire[\s]?alarm[\s]?panel|facp/gi, item: 'fire_alarm_panel' },
    { pattern: /annunciator/gi, item: 'annunciator' },
    
    // Security
    { pattern: /card reader|access reader/gi, item: 'card_reader' },
    { pattern: /keypad|security keypad/gi, item: 'keypad' },
    { pattern: /door contact/gi, item: 'door_contact' },
    { pattern: /motion[\s]?detect|pir/gi, item: 'motion_detector' },
    { pattern: /glass break/gi, item: 'glass_break' },
    { pattern: /security camera|cctv/gi, item: 'security_camera' },
    { pattern: /ptz camera/gi, item: 'security_camera_ptz' },
    { pattern: /nvr|dvr/gi, item: 'nvr' },
    { pattern: /electric strike/gi, item: 'electric_strike' },
    { pattern: /mag lock|magnetic lock/gi, item: 'mag_lock' },
    
    // Nurse Call
    { pattern: /nurse call|patient call/gi, item: 'nurse_call_station' },
    { pattern: /pillow speaker/gi, item: 'pillow_speaker' },
    { pattern: /code blue/gi, item: 'code_blue_station' },
    { pattern: /dome light/gi, item: 'dome_light' },
    
    // Motor
    { pattern: /motor connection|mcc/gi, item: 'motor_connection_5hp' },
    { pattern: /vfd|variable frequency/gi, item: 'vfd_10hp' },
    { pattern: /motor starter/gi, item: 'starter_5hp' },
  ],
  plumbing: [
    // Water Closets
    { pattern: /water closet|toilet|\bWC\b|\bW\.C\./gi, item: 'water_closet' },
    { pattern: /ada[\s\-]?toilet|ada[\s\-]?wc/gi, item: 'water_closet_ada' },
    { pattern: /wall[\s\-]?hung[\s\-]?wc|wall[\s\-]?hung[\s\-]?toilet/gi, item: 'water_closet_wall_hung' },
    { pattern: /sensor[\s\-]?flush|auto[\s\-]?flush/gi, item: 'water_closet_sensor' },
    { pattern: /flushometer/gi, item: 'water_closet_flushometer' },
    { pattern: /dual[\s\-]?flush/gi, item: 'water_closet_dual_flush' },
    
    // Urinals
    { pattern: /urinal|\bUR\b/gi, item: 'urinal' },
    { pattern: /ada[\s\-]?urinal/gi, item: 'urinal_ada' },
    { pattern: /waterless urinal/gi, item: 'urinal_waterless' },
    
    // Lavatories & Sinks
    { pattern: /lavatory|lav|\bLAV\b/gi, item: 'lavatory' },
    { pattern: /ada[\s\-]?lav|ada[\s\-]?sink/gi, item: 'ada_lavatory' },
    { pattern: /sensor[\s\-]?faucet/gi, item: 'lavatory_sensor' },
    { pattern: /wall[\s\-]?hung[\s\-]?lav/gi, item: 'lavatory_wall_hung' },
    { pattern: /vessel[\s\-]?sink/gi, item: 'lavatory_vessel' },
    { pattern: /kitchen sink|\bKS\b/gi, item: 'kitchen_sink' },
    { pattern: /double[\s\-]?bowl/gi, item: 'kitchen_sink_double' },
    { pattern: /triple[\s\-]?bowl/gi, item: 'kitchen_sink_triple' },
    { pattern: /prep[\s\-]?sink/gi, item: 'prep_sink' },
    { pattern: /bar[\s\-]?sink/gi, item: 'bar_sink' },
    { pattern: /mop sink|service sink|\bMS\b/gi, item: 'mop_sink' },
    { pattern: /utility sink|laundry sink/gi, item: 'utility_sink' },
    { pattern: /clinical[\s\-]?sink|hopper/gi, item: 'clinical_sink' },
    { pattern: /scrub[\s\-]?sink|surgical sink/gi, item: 'scrub_sink' },
    
    // Showers & Tubs
    { pattern: /shower/gi, item: 'shower' },
    { pattern: /ada[\s\-]?shower/gi, item: 'shower_ada' },
    { pattern: /hand[\s\-]?held[\s\-]?shower/gi, item: 'shower_hand_held' },
    { pattern: /bathtub|tub/gi, item: 'bathtub' },
    { pattern: /whirlpool/gi, item: 'bathtub_whirlpool' },
    { pattern: /walk[\s\-]?in[\s\-]?tub/gi, item: 'bathtub_walk_in' },
    
    // Drinking Water
    { pattern: /drinking fountain|\bDF\b|cooler/gi, item: 'drinking_fountain' },
    { pattern: /hi[\s\-]?lo[\s\-]?fountain/gi, item: 'drinking_fountain_hi_lo' },
    { pattern: /bottle filler|\bBF\b/gi, item: 'bottle_filler' },
    { pattern: /ice maker/gi, item: 'ice_maker' },
    
    // Emergency
    { pattern: /eye[\s\-]?wash/gi, item: 'eye_wash' },
    { pattern: /emergency[\s\-]?shower/gi, item: 'emergency_shower' },
    { pattern: /combo[\s\-]?shower[\s\-]?eye/gi, item: 'combo_shower_eye_wash' },
    { pattern: /drench[\s\-]?hose/gi, item: 'drench_hose' },
    
    // Water Heaters
    { pattern: /water heater|\bWH\b/gi, item: 'water_heater_50' },
    { pattern: /tankless[\s\-]?heater/gi, item: 'tankless_heater' },
    { pattern: /booster[\s\-]?heater/gi, item: 'booster_heater' },
    { pattern: /mixing[\s\-]?valve/gi, item: 'mixing_valve' },
    { pattern: /recirculation|recirc/gi, item: 'recirculation_pump' },
    
    // Pumps
    { pattern: /sump[\s\-]?pump/gi, item: 'sump_pump' },
    { pattern: /sewage[\s\-]?ejector/gi, item: 'sewage_ejector' },
    { pattern: /grinder[\s\-]?pump/gi, item: 'grinder_pump' },
    { pattern: /booster[\s\-]?pump/gi, item: 'booster_pump' },
    { pattern: /condensate[\s\-]?pump/gi, item: 'condensate_pump' },
    
    // Valves
    { pattern: /ball[\s\-]?valve/gi, item: 'ball_valve_1' },
    { pattern: /gate[\s\-]?valve/gi, item: 'gate_valve_2' },
    { pattern: /check[\s\-]?valve/gi, item: 'check_valve_1' },
    { pattern: /prv|pressure[\s\-]?reducing/gi, item: 'prv' },
    { pattern: /backflow|\bBFP\b/gi, item: 'backflow_preventer' },
    { pattern: /vacuum[\s\-]?breaker/gi, item: 'vacuum_breaker' },
    { pattern: /thermostatic[\s\-]?mixing/gi, item: 'thermostatic_mixing' },
    
    // Traps
    { pattern: /grease[\s\-]?trap|\bGT\b|interceptor/gi, item: 'grease_trap' },
    { pattern: /oil[\s\-]?interceptor/gi, item: 'oil_interceptor' },
    { pattern: /lint[\s\-]?trap/gi, item: 'lint_trap' },
    { pattern: /hair[\s\-]?trap/gi, item: 'hair_trap' },
    
    // Tanks
    { pattern: /expansion[\s\-]?tank/gi, item: 'expansion_tank' },
    { pattern: /pressure[\s\-]?tank/gi, item: 'pressure_tank' },
    { pattern: /water[\s\-]?softener/gi, item: 'water_softener' },
    { pattern: /water[\s\-]?filter/gi, item: 'water_filter' },
    
    // Drains
    { pattern: /floor drain|\bFD\b/gi, item: 'floor_drain' },
    { pattern: /trench[\s\-]?drain/gi, item: 'trench_drain' },
    { pattern: /area[\s\-]?drain/gi, item: 'area_drain' },
    { pattern: /cleanout|\bCO\b/gi, item: 'cleanout' },
    { pattern: /roof drain|\bRD\b/gi, item: 'roof_drain' },
    { pattern: /overflow[\s\-]?drain/gi, item: 'overflow_drain' },
    
    // Piping
    { pattern: /copper[\s\-]?pipe/gi, item: 'copper_1' },
    { pattern: /pex[\s\-]?pipe/gi, item: 'pex_3_4' },
    { pattern: /cpvc/gi, item: 'cpvc_3_4' },
    { pattern: /pvc[\s\-]?dwv/gi, item: 'pvc_dwv_4' },
    { pattern: /cast[\s\-]?iron/gi, item: 'cast_iron_4' },
    { pattern: /gas[\s\-]?pipe/gi, item: 'gas_pipe' },
    { pattern: /med[\s\-]?gas|medical[\s\-]?gas/gi, item: 'med_gas_oxygen' },
    
    // Fixtures
    { pattern: /hose[\s\-]?bibb/gi, item: 'hose_bibb' },
    { pattern: /wall[\s\-]?hydrant/gi, item: 'wall_hydrant' },
  ],
  hvac: [
    // RTUs
    { pattern: /rtu|rooftop unit|package unit/gi, item: 'rtu_10ton' },
    { pattern: /doas/gi, item: 'rtu_doas' },
    
    // Split Systems
    { pattern: /mini[\s\-]?split/gi, item: 'mini_split_12k' },
    { pattern: /split system/gi, item: 'split_system' },
    { pattern: /condenser/gi, item: 'condenser_3ton' },
    
    // VRF
    { pattern: /vrf|vrv/gi, item: 'vrf_outdoor' },
    { pattern: /vrf[\s\-]?cassette/gi, item: 'vrf_cassette' },
    { pattern: /vrf[\s\-]?ducted/gi, item: 'vrf_ducted' },
    
    // PTAC
    { pattern: /ptac/gi, item: 'ptac_12k' },
    { pattern: /pthp/gi, item: 'pthp_12k' },
    
    // Air Handlers & Fan Coils
    { pattern: /ahu|air[\s\-]?handler/gi, item: 'ahu_4000cfm' },
    { pattern: /fan[\s\-]?coil|\bFCU\b/gi, item: 'fcu_horizontal' },
    { pattern: /crac/gi, item: 'crac_unit' },
    
    // Fans
    { pattern: /exhaust fan|\bEF\b/gi, item: 'exhaust_fan' },
    { pattern: /roof[\s\-]?exhaust/gi, item: 'exhaust_fan_roof' },
    { pattern: /inline[\s\-]?fan/gi, item: 'exhaust_fan_inline' },
    { pattern: /bath[\s\-]?fan|bathroom[\s\-]?exhaust/gi, item: 'exhaust_fan_bath' },
    { pattern: /kitchen[\s\-]?hood|range[\s\-]?hood/gi, item: 'exhaust_fan_kitchen' },
    { pattern: /supply[\s\-]?fan/gi, item: 'supply_fan' },
    { pattern: /return[\s\-]?fan/gi, item: 'return_fan' },
    { pattern: /makeup air|\bMAU\b/gi, item: 'makeup_air' },
    { pattern: /erv|energy[\s\-]?recovery/gi, item: 'erv' },
    { pattern: /hrv|heat[\s\-]?recovery/gi, item: 'hrv' },
    
    // Heaters
    { pattern: /unit heater|\bUH\b/gi, item: 'unit_heater' },
    { pattern: /cabinet[\s\-]?heater/gi, item: 'cabinet_heater' },
    { pattern: /baseboard/gi, item: 'baseboard_heater' },
    { pattern: /radiant[\s\-]?heater/gi, item: 'radiant_heater' },
    { pattern: /infrared[\s\-]?heater|tube[\s\-]?heater/gi, item: 'infrared_heater' },
    
    // Boilers & Chillers
    { pattern: /boiler/gi, item: 'boiler_gas_200k' },
    { pattern: /condensing[\s\-]?boiler/gi, item: 'boiler_condensing' },
    { pattern: /chiller/gi, item: 'chiller_air_40ton' },
    
    // Air Distribution
    { pattern: /supply[\s\-]?diffuser/gi, item: 'supply_diffuser' },
    { pattern: /perforated[\s\-]?diffuser/gi, item: 'supply_diffuser_perf' },
    { pattern: /return[\s\-]?grille|\bRAG\b|\bRG\b/gi, item: 'return_grille' },
    { pattern: /linear[\s\-]?diffuser|slot[\s\-]?diffuser/gi, item: 'linear_diffuser' },
    { pattern: /floor[\s\-]?register/gi, item: 'register_floor' },
    { pattern: /wall[\s\-]?register/gi, item: 'register_wall' },
    { pattern: /transfer[\s\-]?grille/gi, item: 'transfer_grille' },
    { pattern: /louver/gi, item: 'louver_intake' },
    
    // VAV
    { pattern: /vav|variable[\s\-]?air/gi, item: 'vav_box' },
    { pattern: /vav[\s\-]?reheat/gi, item: 'vav_box_reheat' },
    { pattern: /fan[\s\-]?powered[\s\-]?vav/gi, item: 'vav_fan_powered' },
    
    // Ductwork
    { pattern: /rectangular[\s\-]?duct|rect[\s\-]?duct/gi, item: 'rect_duct_small' },
    { pattern: /round[\s\-]?duct|spiral[\s\-]?duct/gi, item: 'round_duct' },
    { pattern: /flex[\s\-]?duct/gi, item: 'flex_duct' },
    { pattern: /duct[\s\-]?insulation|duct[\s\-]?wrap/gi, item: 'duct_wrap' },
    
    // Dampers
    { pattern: /fire[\s\-]?damper/gi, item: 'fire_damper' },
    { pattern: /smoke[\s\-]?damper/gi, item: 'smoke_damper' },
    { pattern: /fire[\s\-]?smoke[\s\-]?damper|\bFSD\b/gi, item: 'combination_fsd' },
    { pattern: /volume[\s\-]?damper/gi, item: 'volume_damper' },
    { pattern: /backdraft[\s\-]?damper/gi, item: 'backdraft_damper' },
    { pattern: /motorized[\s\-]?damper/gi, item: 'motorized_damper' },
    { pattern: /damper/gi, item: 'damper' },
    
    // Piping
    { pattern: /refrigerant[\s\-]?pipe|ref[\s\-]?line/gi, item: 'refrigerant_piping' },
    { pattern: /chilled[\s\-]?water[\s\-]?pipe/gi, item: 'chilled_water_pipe' },
    { pattern: /hot[\s\-]?water[\s\-]?pipe/gi, item: 'hot_water_pipe' },
    { pattern: /condensate[\s\-]?drain/gi, item: 'condensate_drain' },
    
    // Controls
    { pattern: /thermostat|\bT[\-]?STAT\b/gi, item: 'thermostat' },
    { pattern: /smart[\s\-]?thermostat/gi, item: 'thermostat_smart' },
    { pattern: /bms[\s\-]?point|bas[\s\-]?point/gi, item: 'bms_point' },
    { pattern: /bms[\s\-]?controller/gi, item: 'bms_controller' },
    { pattern: /temp[\s\-]?sensor/gi, item: 'temp_sensor' },
    { pattern: /humidity[\s\-]?sensor/gi, item: 'humidity_sensor' },
    { pattern: /co2[\s\-]?sensor/gi, item: 'co2_sensor' },
    { pattern: /actuator/gi, item: 'actuator' },
  ],
  fire_protection: [
    // Sprinkler Heads
    { pattern: /sprinkler[\s\-]?head|sprinkler/gi, item: 'sprinkler_pendent' },
    { pattern: /pendent[\s\-]?sprinkler/gi, item: 'sprinkler_pendent' },
    { pattern: /upright[\s\-]?sprinkler/gi, item: 'sprinkler_upright' },
    { pattern: /sidewall[\s\-]?sprinkler/gi, item: 'sprinkler_sidewall' },
    { pattern: /concealed[\s\-]?sprinkler/gi, item: 'sprinkler_concealed' },
    { pattern: /dry[\s\-]?sprinkler/gi, item: 'sprinkler_dry' },
    { pattern: /esfr/gi, item: 'sprinkler_esfr' },
    
    // Valves
    { pattern: /alarm[\s\-]?valve/gi, item: 'alarm_valve' },
    { pattern: /dry[\s\-]?valve/gi, item: 'dry_valve' },
    { pattern: /deluge[\s\-]?valve/gi, item: 'deluge_valve' },
    { pattern: /preaction/gi, item: 'preaction_valve' },
    { pattern: /os[\s\-]?y|osyy/gi, item: 'osyy_valve' },
    { pattern: /piv|post[\s\-]?indicator/gi, item: 'piv' },
    { pattern: /fdc|fire[\s\-]?dept[\s\-]?conn/gi, item: 'fdc' },
    { pattern: /flow[\s\-]?switch/gi, item: 'flow_switch' },
    { pattern: /tamper[\s\-]?switch/gi, item: 'tamper_switch' },
    
    // Fire Pump
    { pattern: /fire[\s\-]?pump/gi, item: 'fire_pump_750gpm' },
    { pattern: /jockey[\s\-]?pump/gi, item: 'jockey_pump' },
    { pattern: /fire[\s\-]?pump[\s\-]?controller/gi, item: 'fire_pump_controller' },
    
    // Standpipe
    { pattern: /standpipe/gi, item: 'standpipe_4' },
    { pattern: /hose[\s\-]?valve/gi, item: 'hose_valve' },
    { pattern: /hose[\s\-]?cabinet/gi, item: 'hose_cabinet' },
    
    // Suppression
    { pattern: /clean[\s\-]?agent/gi, item: 'clean_agent_panel' },
    { pattern: /kitchen[\s\-]?suppression|ansul/gi, item: 'kitchen_suppression' },
    { pattern: /fusible[\s\-]?link/gi, item: 'ansul_link' },
    
    // Extinguishers
    { pattern: /extinguisher/gi, item: 'extinguisher_abc' },
    { pattern: /extinguisher[\s\-]?cabinet/gi, item: 'extinguisher_cabinet' },
    { pattern: /class[\s\-]?k[\s\-]?extinguisher/gi, item: 'extinguisher_k' },
  ],
};