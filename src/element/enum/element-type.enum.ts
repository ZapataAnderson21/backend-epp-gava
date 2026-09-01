export const ElementType = {
  Epp: 'epp',
  Operative: 'operative',
} as const;
export type ElementType = (typeof ElementType)[keyof typeof ElementType];

export const ElementTypeLabelEs: Record<ElementType, string> = {
  [ElementType.Epp]: 'EPP',
  [ElementType.Operative]: 'Operativo',
};

export const ElementControlType = {
  Consumable: 'consumable',
  Returnable: 'returnable',
  Individual: 'individual',
} as const;
export type ElementControlType =
  (typeof ElementControlType)[keyof typeof ElementControlType];

export const ElementControlTypeLabelEs: Record<ElementControlType, string> = {
  [ElementControlType.Consumable]: 'Consumible',
  [ElementControlType.Returnable]: 'Retornable',
  [ElementControlType.Individual]: 'Individual',
};

export const ElementFamily = {
  Epp: 'epp',
  Epi: 'epi',
  Uniform: 'uniform',
  OfficeMaterial: 'officeMaterial',
  SsomaSupply: 'ssomaSupply',
  Ese: 'ese',
  Harness: 'harness',
  Measurement: 'measurement',
} as const;
export type ElementFamily = (typeof ElementFamily)[keyof typeof ElementFamily];

export const ElementFamilyLabelEs: Record<ElementFamily, string> = {
  [ElementFamily.Epp]: 'EPP',
  [ElementFamily.Epi]: 'EPI',
  [ElementFamily.Uniform]: 'Uniforme',
  [ElementFamily.OfficeMaterial]: 'Materiales de Oficina',
  [ElementFamily.SsomaSupply]: 'Insumos SSOMA',
  [ElementFamily.Ese]: 'ESE',
  [ElementFamily.Measurement]: 'Equipos de Medicion',
  [ElementFamily.Harness]: 'Arnes',
};

export const ElementFamilyControlType: Record<
  ElementFamily,
  ElementControlType
> = {
  [ElementFamily.Epp]: ElementControlType.Returnable,
  [ElementFamily.Epi]: ElementControlType.Individual,
  [ElementFamily.Uniform]: ElementControlType.Consumable,
  [ElementFamily.OfficeMaterial]: ElementControlType.Consumable,
  [ElementFamily.SsomaSupply]: ElementControlType.Consumable,
  [ElementFamily.Ese]: ElementControlType.Returnable,
  [ElementFamily.Harness]: ElementControlType.Individual,
  [ElementFamily.Measurement]: ElementControlType.Individual,
};

export const ElementFamilyReturnsToOffice: Record<ElementFamily, boolean> = {
  [ElementFamily.Epp]: true,
  [ElementFamily.Epi]: true,
  [ElementFamily.Uniform]: false,
  [ElementFamily.OfficeMaterial]: false,
  [ElementFamily.SsomaSupply]: false,
  [ElementFamily.Ese]: true,
  [ElementFamily.Harness]: true,
  [ElementFamily.Measurement]: true,
};

export const ElementFamilyRequiresCode: Record<ElementFamily, boolean> = {
  [ElementFamily.Epp]: false,
  [ElementFamily.Epi]: false,
  [ElementFamily.Uniform]: false,
  [ElementFamily.OfficeMaterial]: false,
  [ElementFamily.SsomaSupply]: false,
  [ElementFamily.Ese]: false,
  [ElementFamily.Harness]: true,
  [ElementFamily.Measurement]: false,
};

export const ElementFamilyUsesDecimalQuantity: Record<
  ElementFamily,
  boolean
> = {
  [ElementFamily.Epp]: false,
  [ElementFamily.Epi]: false,
  [ElementFamily.Uniform]: false,
  [ElementFamily.OfficeMaterial]: false,
  [ElementFamily.SsomaSupply]: false,
  [ElementFamily.Ese]: false,
  [ElementFamily.Harness]: false,
  [ElementFamily.Measurement]: false,
};

export const ElementFamilyUsesUniqueInventory: Record<
  ElementFamily,
  boolean
> = {
  [ElementFamily.Epp]: false,
  [ElementFamily.Epi]: false,
  [ElementFamily.Uniform]: false,
  [ElementFamily.OfficeMaterial]: false,
  [ElementFamily.SsomaSupply]: false,
  [ElementFamily.Ese]: true,
  [ElementFamily.Harness]: true,
  [ElementFamily.Measurement]: true,
};
