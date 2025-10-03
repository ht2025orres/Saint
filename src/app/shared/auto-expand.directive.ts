import { Directive, ElementRef, Renderer2, AfterViewInit, HostListener, Input } from '@angular/core';

@Directive({
  selector: '[appAutoExpand]'
})
export class AutoExpandDirective implements AfterViewInit {
  private originalText: string = '';
  private isExpanded: boolean = false;
  
  @Input() maxLength: number = 50;
  @Input() maxWidth: number = 200;
  @Input() expandOn: 'hover' | 'click' = 'hover';

  constructor(
    private el: ElementRef,
    private renderer: Renderer2
  ) {}

  ngAfterViewInit() {
    this.originalText = this.el.nativeElement.textContent?.trim() || '';
    this.setupTruncation();
  }

  private setupTruncation() {
    if (this.shouldTruncate()) {
      this.renderer.setStyle(this.el.nativeElement, 'cursor', 'pointer');
      this.renderer.setStyle(this.el.nativeElement, 'display', 'table-cell');
      this.renderer.setStyle(this.el.nativeElement, 'max-width', `${this.maxWidth}px`);
      this.renderer.setStyle(this.el.nativeElement, 'white-space', 'nowrap');
      this.renderer.setStyle(this.el.nativeElement, 'overflow', 'hidden');
      this.renderer.setStyle(this.el.nativeElement, 'text-overflow', 'ellipsis');
      this.showTruncated();
    }
  }

  private shouldTruncate(): boolean {
    return this.originalText.length > this.maxLength || 
           this.el.nativeElement.scrollWidth > this.maxWidth;
  }

  private showTruncated() {
    let truncatedText = this.originalText;
    if (this.originalText.length > this.maxLength) {
      truncatedText = this.originalText.substring(0, this.maxLength) + '...';
    }
    this.renderer.setProperty(this.el.nativeElement, 'textContent', truncatedText);
    this.isExpanded = false;
  }

  private showFull() {
    this.el.nativeElement.innerText = this.originalText;
    this.renderer.setStyle(this.el.nativeElement, 'white-space', 'normal');
    this.renderer.setStyle(this.el.nativeElement, 'overflow', 'visible');
    this.renderer.setStyle(this.el.nativeElement, 'text-overflow', 'clip');
    this.isExpanded = true;
  }

  @HostListener('mouseenter')
  onMouseEnter() {
    if (this.shouldTruncate() && this.expandOn === 'hover') {
      this.showFull();
    }
  }

  @HostListener('mouseleave', ['$event']) 
  onMouseLeave(event: MouseEvent) {
    if (this.shouldTruncate() && this.expandOn === 'hover' && this.isExpanded) {
      setTimeout(() => {
        if (!this.isMouseOverElement(event)) {
          this.showTruncated();
        }
      }, 200);
    }
  }

  private isMouseOverElement(event: MouseEvent): boolean {
    const element = this.el.nativeElement;
    const rect = element.getBoundingClientRect();
    const mouseX = event.clientX;
    const mouseY = event.clientY;
    
    return (
      mouseX >= rect.left &&
      mouseX <= rect.right &&
      mouseY >= rect.top &&
      mouseY <= rect.bottom
    );
  }

  @HostListener('click')
  onClick() {
    if (this.expandOn === 'click' && this.shouldTruncate()) {
      if (this.isExpanded) {
        this.showTruncated();
      } else {
        this.showFull();
      }
    }
  }
}