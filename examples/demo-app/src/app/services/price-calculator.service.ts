import { Injectable, InjectionToken, inject } from '@angular/core';

export interface DiscountConfig {
  readonly bulkThreshold: number;
  readonly bulkDiscountRate: number;
}

export const DISCOUNT_CONFIG = new InjectionToken<DiscountConfig>('DISCOUNT_CONFIG', {
  factory: (): DiscountConfig => ({ bulkThreshold: 5, bulkDiscountRate: 0.1 }),
});

@Injectable({ providedIn: 'root' })
export class PriceCalculatorService {
  private readonly config = inject(DISCOUNT_CONFIG);

  public calculateTotal(unitPrice: number, quantity: number): number {
    if (quantity <= 0) {
      return 0;
    }

    const subtotal = unitPrice * quantity;

    if (quantity >= this.config.bulkThreshold) {
      return subtotal * (1 - this.config.bulkDiscountRate);
    }

    return subtotal;
  }
}
