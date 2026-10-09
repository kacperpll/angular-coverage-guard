import { Component, OnDestroy, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { Book } from '../../resolvers/book.resolver';
import { PriceCalculatorService } from '../../services/price-calculator.service';
import { BadgeComponent } from '../badge/badge.component';

@Component({
  selector: 'app-book-list',
  imports: [BadgeComponent],
  templateUrl: './book-list.component.html',
})
export class BookListComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly priceCalculator = inject(PriceCalculatorService);
  private readonly destroy$ = new Subject<void>();

  protected books: Book[] = [];

  public constructor() {
    this.route.data.pipe(takeUntil(this.destroy$)).subscribe((data) => {
      this.books = (data['books'] as Book[] | undefined) ?? [];
    });
  }

  protected totalFor(book: Book): number {
    return this.priceCalculator.calculateTotal(book.price, 1);
  }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
