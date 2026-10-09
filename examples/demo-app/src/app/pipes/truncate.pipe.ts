import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'truncate' })
export class TruncatePipe implements PipeTransform {
  public transform(value: string, maxLength = 20): string {
    if (value.length <= maxLength) {
      return value;
    }

    return `${value.slice(0, maxLength)}…`;
  }
}
