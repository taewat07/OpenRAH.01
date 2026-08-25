var RAH01_CHECKLIST = Object.freeze({
  occ_fire_safety: Object.freeze({ label: 'Fire prevention and suppression system', na: false }),
  occ_health_education: Object.freeze({ label: 'Occupational-health education', na: false }),
  occ_waste_management: Object.freeze({ label: 'Hazardous-waste management system', na: false }),
  occ_ppe_measures: Object.freeze({ label: 'Personal protective equipment measures', na: false }),
  occ_annual_health_exam: Object.freeze({ label: 'Annual health examination', na: false }),
  occ_risk_exam_lung: Object.freeze({ label: 'Risk-based lung-function examination', na: true }),
  occ_risk_exam_hearing: Object.freeze({ label: 'Risk-based hearing examination', na: true }),
  occ_risk_exam_vision: Object.freeze({ label: 'Risk-based vision examination', na: true }),
  occ_bio_exam: Object.freeze({ label: 'Biological monitoring', na: true }),
  occ_env_exam: Object.freeze({ label: 'Workplace environmental monitoring', na: true })
});
var RAH01_CATEGORIES = Object.freeze({
  PHYSICAL: 'Physical Hazards', BIOLOGICAL: 'Biological Hazards', CHEMICAL: 'Chemical Hazards',
  ERGONOMIC: 'Ergonomic Hazards', PSYCHOSOCIAL: 'Psychosocial Hazards',
  SAFETY_ACCIDENT: 'Safety and Accident Hazards', FIRE_DISASTER: 'Fire and Disaster Hazards',
  INDOOR_AIR_QUALITY: 'Indoor Air Quality Hazards'
});

var RAH01_HAZARDS = Object.freeze({
  heat: ['PHYSICAL', 'Heat'], noise: ['PHYSICAL', 'Noise'], lighting: ['PHYSICAL', 'Lighting'], vibration: ['PHYSICAL', 'Vibration'], radiation: ['PHYSICAL', 'Radiation'],
  bacteria: ['BIOLOGICAL', 'Bacteria'], fungi_mold: ['BIOLOGICAL', 'Fungi / Mold'], viruses: ['BIOLOGICAL', 'Viruses'],
  hibitane_disinfectant_soap: ['CHEMICAL', 'Hibitane / Disinfectant Soap'], toilet_cleaner: ['CHEMICAL', 'Toilet Cleaner'], alcohol_sanitizer: ['CHEMICAL', 'Alcohol Gel / Sanitizer'], floor_cleaner: ['CHEMICAL', 'Floor Cleaner'], glass_cleaner: ['CHEMICAL', 'Glass Cleaner'], chemotherapy_agents: ['CHEMICAL', 'Chemotherapy Agents'], acidic_agents_or_medicines: ['CHEMICAL', 'Acidic Agents or Medicines'], sterilization_disinfection_chemicals: ['CHEMICAL', 'Sterilization / Disinfection Chemicals'],
  heavy_lifting_patient_transfer: ['ERGONOMIC', 'Heavy Lifting / Patient Transfer'], lifting_with_twisting: ['ERGONOMIC', 'Lifting with Twisting'], unnatural_posture: ['ERGONOMIC', 'Unnatural Posture or Movement'], prolonged_standing_sitting: ['ERGONOMIC', 'Prolonged Standing or Sitting'], unsuitable_desk_chair: ['ERGONOMIC', 'Unsuitable Desk or Chair'], repetitive_tasks: ['ERGONOMIC', 'Repetitive Tasks'], high_push_pull_force: ['ERGONOMIC', 'High Push / Pull Force'], unsuitable_grip_equipment: ['ERGONOMIC', 'Unsuitable Equipment for Gripping'],
  sharps: ['SAFETY_ACCIDENT', 'Sharps / Needlestick'], machinery: ['SAFETY_ACCIDENT', 'Machinery Operation'], vehicle_use: ['SAFETY_ACCIDENT', 'Vehicle Use'], work_at_height: ['SAFETY_ACCIDENT', 'Work at Height'], confined_space: ['SAFETY_ACCIDENT', 'Confined Space Work'], slippery_surface: ['SAFETY_ACCIDENT', 'Slippery Surface'], hot_objects: ['SAFETY_ACCIDENT', 'Work with Hot Objects'], pathway_obstruction: ['SAFETY_ACCIDENT', 'Pathway Obstruction'],
  generator: ['FIRE_DISASTER', 'Generator Work'], electrical_work: ['FIRE_DISASTER', 'Electrical Work / Wiring'], electrical_equipment: ['FIRE_DISASTER', 'Electrical Equipment'], water_heater_boiler: ['FIRE_DISASTER', 'Water Heater / Boiler Work'], flammable_storage: ['FIRE_DISASTER', 'Flammable Material / Gas Storage'], flammable_chemical_gas_use: ['FIRE_DISASTER', 'Use of Flammable Chemicals or Gases'],
  work_stress: ['PSYCHOSOCIAL', 'Work Stress'], patient_relative_violence: ['PSYCHOSOCIAL', 'Violence from Patients or Relatives'], coworker_violence: ['PSYCHOSOCIAL', 'Coworker Violence'], insufficient_rest: ['PSYCHOSOCIAL', 'Insufficient Rest'],
  crowded_stuffy: ['INDOOR_AIR_QUALITY', 'Crowded / Stuffy Conditions'], extreme_temperature: ['INDOOR_AIR_QUALITY', 'Excessively Hot or Cold Air'], chemical_odor: ['INDOOR_AIR_QUALITY', 'Pungent Chemical Odor'], poor_ventilation: ['INDOOR_AIR_QUALITY', 'Poor Ventilation'], dust: ['INDOOR_AIR_QUALITY', 'Dust'], dark_damp: ['INDOOR_AIR_QUALITY', 'Dark / Damp Conditions'], surface_mold: ['INDOOR_AIR_QUALITY', 'Surface Mold']
});
