import type { Prisma } from '@kajai/db';

type ProductAvailabilityWithDecimalPrices = {
  price: Prisma.Decimal | null;
  unitPrice: Prisma.Decimal | null;
};

export type ProductAvailabilityResponse<
  T extends ProductAvailabilityWithDecimalPrices,
> = Omit<T, 'price' | 'unitPrice'> & {
  price: number | null;
  unitPrice: number | null;
};

export function mapProductAvailabilityResponse<
  T extends ProductAvailabilityWithDecimalPrices,
>(availability: T): ProductAvailabilityResponse<T> {
  return {
    ...availability,
    price: availability.price?.toNumber() ?? null,
    unitPrice: availability.unitPrice?.toNumber() ?? null,
  };
}

