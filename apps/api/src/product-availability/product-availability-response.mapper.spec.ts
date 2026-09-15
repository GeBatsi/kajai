import { Prisma } from '@kajai/db';
import { mapProductAvailabilityResponse } from './product-availability-response.mapper';

describe('mapProductAvailabilityResponse', () => {
  it('maps Decimal prices to numbers', () => {
    const availability = {
      id: 'availability-id',
      price: new Prisma.Decimal('1.99'),
      unitPrice: new Prisma.Decimal('0.50'),
    };

    expect(mapProductAvailabilityResponse(availability)).toEqual({
      id: 'availability-id',
      price: 1.99,
      unitPrice: 0.5,
    });
  });

  it('preserves null prices', () => {
    const availability = {
      id: 'availability-id',
      price: null,
      unitPrice: null,
    };

    expect(mapProductAvailabilityResponse(availability)).toEqual({
      id: 'availability-id',
      price: null,
      unitPrice: null,
    });
  });
});
