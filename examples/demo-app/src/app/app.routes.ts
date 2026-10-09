import { Routes } from '@angular/router';
import { BookListComponent } from './components/book-list/book-list.component';
import { authGuard } from './guards/auth.guard';
import { bookResolver } from './resolvers/book.resolver';

export const routes: Routes = [
  {
    path: 'books',
    component: BookListComponent,
    canActivate: [authGuard],
    resolve: { books: bookResolver },
  },
];
