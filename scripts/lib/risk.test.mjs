import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyTier, hasLogicSignal } from './risk.mjs';

test('classifies a functional guard by content, 2016 naming', () => {
  const content = `export const authGuard: CanActivateFn = () => true;`;
  assert.equal(classifyTier('src/app/guards/auth.guard.ts', content), 1);
});

test('classifies a functional guard by content, 2025 naming (no suffix)', () => {
  const content = `export const authGuard: CanActivateFn = () => true;`;
  assert.equal(classifyTier('src/app/guards/auth.ts', content), 1);
});

test('classifies a class-based guard by "implements CanActivate"', () => {
  const content = `export class AuthGuard implements CanActivate { canActivate() { return true; } }`;
  assert.equal(classifyTier('src/app/auth.ts', content), 1);
});

test('classifies a functional interceptor by content regardless of naming', () => {
  const content = `export const authInterceptor: HttpInterceptorFn = (req, next) => next(req);`;
  assert.equal(classifyTier('src/app/auth.ts', content), 1);
});

test('classifies a functional resolver by content regardless of naming', () => {
  const content = `export const bookResolver: ResolveFn<Book[]> = () => of([]);`;
  assert.equal(classifyTier('src/app/book.ts', content), 1);
});

test('classifies an @Injectable service by content, 2025 naming', () => {
  const content = `@Injectable({ providedIn: 'root' })\nexport class PriceCalculator {}`;
  assert.equal(classifyTier('src/app/price-calculator.ts', content), 2);
});

test('classifies an @Pipe by content, 2025 naming', () => {
  const content = `@Pipe({ name: 'truncate' })\nexport class Truncate implements PipeTransform {}`;
  assert.equal(classifyTier('src/app/truncate.ts', content), 2);
});

test('classifies an @Directive by content', () => {
  const content = `@Directive({ selector: '[appHighlight]' })\nexport class Highlight {}`;
  assert.equal(classifyTier('src/app/highlight.ts', content), 2);
});

test('classifies an @Component by content, 2025 naming', () => {
  const content = `@Component({ selector: 'app-badge', template: '' })\nexport class Badge {}`;
  assert.equal(classifyTier('src/app/components/badge/badge.ts', content), 3);
});

test('falls back to filename suffix when no content signal matches, 2016 naming', () => {
  assert.equal(classifyTier('src/app/services/price-calculator.service.ts', 'export const x = 1;'), 2);
  assert.equal(classifyTier('src/app/guards/auth.guard.ts', 'export const x = 1;'), 1);
});

test('falls back to a path-based utils/helpers match when nothing else matches', () => {
  assert.equal(classifyTier('src/app/utils/array.util.ts', 'export function chunk() {}'), 2);
  assert.equal(classifyTier('src/app/helpers/format.ts', 'export function format() {}'), 2);
});

test('defaults to tier 3 when nothing matches', () => {
  assert.equal(classifyTier('src/app/app.config.ts', 'export const appConfig = {};'), 3);
});

test('hasLogicSignal detects inject(), subscribe(), and constructor injection', () => {
  assert.equal(hasLogicSignal('const x = inject(Router);'), true);
  assert.equal(hasLogicSignal('this.route.data.subscribe(() => {});'), true);
  assert.equal(hasLogicSignal('constructor(private readonly svc: Svc) {}'), true);
  assert.equal(hasLogicSignal('export const label = input.required<string>();'), false);
});
