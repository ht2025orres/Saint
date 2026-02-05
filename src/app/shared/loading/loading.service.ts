import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  private pendingCount = 0;
  private readonly pendingSubject = new BehaviorSubject<number>(0);

  readonly pending$ = this.pendingSubject.asObservable();

  increment(): void {
    this.pendingCount += 1;
    this.pendingSubject.next(this.pendingCount);
  }

  decrement(): void {
    this.pendingCount = Math.max(0, this.pendingCount - 1);
    this.pendingSubject.next(this.pendingCount);
  }

  hasPending(): boolean {
    return this.pendingCount > 0;
  }
}
