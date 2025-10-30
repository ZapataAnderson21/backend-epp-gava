export enum PettyCashType {
  Meals = 'meals',
  Fuel = 'fuel',
  Transport = 'transport',
  Supplies = 'supplies',
  SafetyEquipment = 'safety_equipment',
  Services = 'services',
  Other = 'other'
}
export const PettyCashLabelEs: Record<PettyCashType, string> = {
  [PettyCashType.Meals]: 'Comidas',
  [PettyCashType.Fuel]: 'Combustible',
  [PettyCashType.Transport]: 'Transporte',
  [PettyCashType.Supplies]: 'Materiales / Insumos',
  [PettyCashType.SafetyEquipment]: 'Equipo de Seguridad',
  [PettyCashType.Services]: 'Servicios',
  [PettyCashType.Other]: 'Otros',
};