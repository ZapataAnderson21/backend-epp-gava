export enum ElementType {
  Epp = 'epp',
  Operative = 'operative',
}

export const ElementTypeLabelEs: Record<ElementType, string> = {
  [ElementType.Epp]: 'EPP',
  [ElementType.Operative]: 'Operativo',
};

export enum ElementControlType {
  Consumable = 'consumable',
  Returnable = 'returnable',
  Individual = 'individual',
}

export const ElementControlTypeLabelEs: Record<ElementControlType, string> = {
  [ElementControlType.Consumable]: 'Consumible',
  [ElementControlType.Returnable]: 'Retornable',
  [ElementControlType.Individual]: 'Individual',
};

export enum ElementFamily {
  Epp = 'epp',
  Epi = 'epi',
  Ese = 'ese',
  Measurement = 'measurement',
  Consumible = 'consumible',
}

export const ElementFamilyLabelEs: Record<ElementFamily, string> = {
  [ElementFamily.Epp]: 'EPP',
  [ElementFamily.Epi]: 'EPI',
  [ElementFamily.Ese]: 'ESE',
  [ElementFamily.Measurement]: 'Equipos de Medicion',
  [ElementFamily.Consumible]: 'Consumibles SSOMA',
};

export const ElementFamilyControlType: Record<
  ElementFamily,
  ElementControlType
> = {
  [ElementFamily.Epp]: ElementControlType.Returnable,
  [ElementFamily.Epi]: ElementControlType.Individual,
  [ElementFamily.Ese]: ElementControlType.Returnable,
  [ElementFamily.Measurement]: ElementControlType.Individual,
  [ElementFamily.Consumible]: ElementControlType.Consumable,
};

export const ElementFamilyReturnsToOffice: Record<ElementFamily, boolean> = {
  [ElementFamily.Epp]: true,
  [ElementFamily.Epi]: false,
  [ElementFamily.Ese]: true,
  [ElementFamily.Measurement]: true,
  [ElementFamily.Consumible]: true,
};

export const ElementFamilyRequiresCode: Record<ElementFamily, boolean> = {
  [ElementFamily.Epp]: false,
  [ElementFamily.Epi]: false,
  [ElementFamily.Ese]: true,
  [ElementFamily.Measurement]: true,
  [ElementFamily.Consumible]: false,
};

export const ElementFamilyUsesDecimalQuantity: Record<
  ElementFamily,
  boolean
> = {
  [ElementFamily.Epp]: false,
  [ElementFamily.Epi]: false,
  [ElementFamily.Ese]: false,
  [ElementFamily.Measurement]: false,
  [ElementFamily.Consumible]: true,
};

export const ElementFamilyUsesUniqueInventory: Record<
  ElementFamily,
  boolean
> = {
  [ElementFamily.Epp]: false,
  [ElementFamily.Epi]: false,
  [ElementFamily.Ese]: true,
  [ElementFamily.Measurement]: true,
  [ElementFamily.Consumible]: false,
};
