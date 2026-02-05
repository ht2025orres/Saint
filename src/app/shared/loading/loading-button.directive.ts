import {
  Directive,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  Renderer2
} from '@angular/core';
import { Subscription } from 'rxjs';
import { LoadingService } from './loading.service';

@Directive({
  selector: 'button'
})
export class LoadingButtonDirective implements OnInit, OnDestroy {
  private subscription?: Subscription;
  private isLoading = false;
  private awaitingRequest = false;
  private restoreDisabled = false;
  private pendingTimeoutId?: number;

  constructor(
    private elementRef: ElementRef<HTMLButtonElement>,
    private renderer: Renderer2,
    private loadingService: LoadingService
  ) {}

  ngOnInit(): void {
    this.subscription = this.loadingService.pending$.subscribe(count => {
      if (!this.awaitingRequest) return;

      if (count > 0 && !this.isLoading) {
        this.setLoadingState(true);
        return;
      }

      if (count === 0 && this.isLoading) {
        this.setLoadingState(false);
        this.awaitingRequest = false;
      }
    });
  }

  @HostListener('click')
  onClick(): void {
    if (this.isLoading) return;

    this.awaitingRequest = true;
    this.restoreDisabled = !this.elementRef.nativeElement.disabled;
    this.renderer.setProperty(this.elementRef.nativeElement, 'disabled', true);

    if (this.pendingTimeoutId) {
      window.clearTimeout(this.pendingTimeoutId);
    }

    this.pendingTimeoutId = window.setTimeout(() => {
      if (!this.loadingService.hasPending() && this.awaitingRequest) {
        this.awaitingRequest = false;
        this.setLoadingState(false);
      }
    }, 300);
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    if (this.pendingTimeoutId) {
      window.clearTimeout(this.pendingTimeoutId);
    }
  }

  private setLoadingState(loading: boolean): void {
    this.isLoading = loading;

    if (loading) {
      this.renderer.addClass(this.elementRef.nativeElement, 'app-loading-button');
      this.renderer.setAttribute(this.elementRef.nativeElement, 'aria-busy', 'true');
      return;
    }

    this.renderer.removeClass(this.elementRef.nativeElement, 'app-loading-button');
    this.renderer.removeAttribute(this.elementRef.nativeElement, 'aria-busy');

    if (this.restoreDisabled) {
      this.renderer.setProperty(this.elementRef.nativeElement, 'disabled', false);
    }
  }
}
