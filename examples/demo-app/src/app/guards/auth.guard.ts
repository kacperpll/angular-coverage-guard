import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const authGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const token = route.queryParamMap.get('token');

  if (!token) {
    return router.createUrlTree(['/']);
  }

  return true;
};
