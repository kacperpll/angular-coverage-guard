import { Component, input } from '@angular/core';

@Component({
  selector: 'app-badge',
  template: `<span class="badge">{{ label() }}</span>`,
})
export class BadgeComponent {
  public readonly label = input.required<string>();
}
