import { TestBed } from '@angular/core/testing';
import { PriceCalculatorService } from './price-calculator.service';

describe('PriceCalculatorService', () => {
  let service: PriceCalculatorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PriceCalculatorService);
  });

  it('returns 0 for a non-positive quantity', () => {
    expect(service.calculateTotal(10, 0)).toBe(0);
  });

  it('returns the plain subtotal below the bulk threshold', () => {
    expect(service.calculateTotal(10, 2)).toBe(20);
  });
});
