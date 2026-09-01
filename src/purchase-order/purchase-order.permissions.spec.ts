import 'reflect-metadata';

import { USER_TYPES_KEY } from '../decorators/user-types.decorator';
import { PurchaseOrderConditionController } from '../purchase-order-condition/purchase-order-condition.controller';
import { PurchaseOrderController } from './purchase-order.controller';

const allowedUserTypes = (handler: object) =>
  Reflect.getMetadata(USER_TYPES_KEY, handler) as string[] | undefined;

const controllerHandler = (controller: object, methodName: string) => {
  const handler: unknown = Object.getOwnPropertyDescriptor(
    controller,
    methodName,
  )?.value;

  if (typeof handler !== 'function') {
    throw new Error(`Controller method not found: ${methodName}`);
  }

  return handler;
};

describe('Purchase order permissions', () => {
  it.each(['create', 'update', 'duplicate', 'remove'])(
    'allows LOGISTICA to %s purchase orders',
    (operation) => {
      expect(
        allowedUserTypes(
          controllerHandler(PurchaseOrderController.prototype, operation),
        ),
      ).toContain('LOGISTICA');
    },
  );

  it('allows LOGISTICA to save reusable purchase order conditions', () => {
    expect(
      allowedUserTypes(
        controllerHandler(PurchaseOrderConditionController.prototype, 'create'),
      ),
    ).toContain('LOGISTICA');
  });
});
