import { MODULE_METADATA } from '@nestjs/common/constants';
import { MetrikaOrdersModule } from 'src/metrika/orders/metrika-orders.module';
import { MarketplaceModule } from './marketplace.module';

describe('MarketplaceModule', () => {
  it('imports the module that provides the Ozon shipment outbox dependency', () => {
    const imports = Reflect.getMetadata(
      MODULE_METADATA.IMPORTS,
      MarketplaceModule,
    ) as unknown[];

    expect(imports).toContain(MetrikaOrdersModule);
  });
});
