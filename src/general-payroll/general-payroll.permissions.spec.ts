import 'reflect-metadata';

import { USER_TYPES_KEY } from 'src/decorators/user-types.decorator';
import { GeneralPayrollController } from './general-payroll.controller';

const metadataFor = (methodName: string): string[] | undefined => {
  const handler: unknown = Object.getOwnPropertyDescriptor(
    GeneralPayrollController.prototype,
    methodName,
  )?.value;
  if (typeof handler !== 'function') {
    throw new Error(`Controller method not found: ${methodName}`);
  }
  return Reflect.getMetadata(USER_TYPES_KEY, handler) as string[] | undefined;
};

describe('General payroll permissions', () => {
  it.each(['findProjectTotals', 'findByProject', 'findWeeks', 'findOne'])(
    'allows LOGISTICA to read through %s',
    (methodName) => {
      expect(metadataFor(methodName)).toContain('LOGISTICA');
    },
  );

  it.each(['initialize', 'configure', 'save'])(
    'does not grant LOGISTICA write access through %s',
    (methodName) => {
      expect(metadataFor(methodName)).toBeUndefined();
    },
  );
});
