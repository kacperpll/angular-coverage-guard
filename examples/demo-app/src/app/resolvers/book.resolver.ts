import { ResolveFn } from '@angular/router';
import { of } from 'rxjs';

export interface Book {
  id: string;
  title: string;
  price: number;
}

export const bookResolver: ResolveFn<Book[]> = (route) => {
  const id = route.paramMap.get('id');

  return of([{ id: id ?? 'unknown', title: 'Sample Book', price: 10 }]);
};
