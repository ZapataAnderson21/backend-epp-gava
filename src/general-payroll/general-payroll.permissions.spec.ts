import 'reflect-metadata';

import { USER_TYPES_KEY } from 'src/decorators/user-types.decorator';
import { GeneralPayrollController } from './general-payroll.controller';

const effectiveMetadataFor = (methodName: string): string[] | undefined => {
  const handler: unknown = Object.getOwnPropertyDescriptor(
    GeneralPayrollController.prototype,
    methodName,
  )?.value;
  if (typeof handler !== 'function') {
    throw new Error(`Controller method not found: ${methodName}`);
  }
  return (
    (Reflect.getMetadata(USER_TYPES_KEY, handler) as string[] | undefined) ??
    (Reflect.getMetadata(
      USER_TYPES_KEY,
      GeneralPayrollController,
    ) as string[] | undefined)
  );
};

describe('General payroll permissions', () => {
  it.each([
    'findProjectTotals',
    'findByProject',
    'findWeeks',
    'findOne',
    'initialize',
    'configure',
    'updateProjectWorkers',
    'save',
  ])(
    'allows LOGISTICA to use %s',
    (methodName) => {
      expect(effectiveMetadataFor(methodName)).toContain('LOGISTICA');
    },
  );
});
