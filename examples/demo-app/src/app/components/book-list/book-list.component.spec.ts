import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { BookListComponent } from './book-list.component';

describe('BookListComponent', () => {
  it('renders an empty list when the route has no resolved books', async () => {
    await TestBed.configureTestingModule({
      imports: [BookListComponent],
      providers: [{ provide: ActivatedRoute, useValue: { data: of({}) } }],
    }).compileComponents();

    const fixture = TestBed.createComponent(BookListComponent);
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelectorAll('li').length).toBe(0);
  });
});
