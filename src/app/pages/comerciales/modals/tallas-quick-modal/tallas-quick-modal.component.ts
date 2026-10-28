import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { LocalItem } from '../../costeo-form/costeo-form.component';

@Component({
  selector: 'app-tallas-quick-modal',
  templateUrl: './tallas-quick-modal.component.html',
  styleUrls: ['./tallas-quick-modal.component.css']
})
export class TallasQuickModalComponent implements OnInit, OnChanges {
  @Input() item: LocalItem | null = null;
  @Input() tallasLetra: string[] = [];
  @Input() tallasNumericas: string[] = [];

  @Output() onAddTalla = new EventEmitter<string>();
  @Output() onRemoveTalla = new EventEmitter<number>();
  @Output() onTallasChanged = new EventEmitter<void>();
  @Output() onClose = new EventEmitter<void>();

  activeScale: 'letras' | 'numeros' = 'letras';

  ngOnInit(): void {
    this.determineDefaultScale();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['item']) {
      this.determineDefaultScale();
    }
  }

  determineDefaultScale(): void {
    if (!this.item) return;
    const text = `${this.item.descripcion || ''} ${this.item.moldName || ''} ${this.item.categoryName || ''}`.toLowerCase();
    const isInferior = ['pant', 'jean', 'bermud', 'falda', 'short', 'dril'].some(k => text.includes(k));
    const hasNumericTallas = (this.item.tallas || []).some(t => /^\d+$/.test((t.talla || '').trim()));

    if (isInferior || hasNumericTallas) {
      this.activeScale = 'numeros';
    } else {
      this.activeScale = 'letras';
    }
  }

  get currentTallasList(): string[] {
    return this.activeScale === 'numeros' ? this.tallasNumericas : this.tallasLetra;
  }

  isTallaSelected(talla: string): boolean {
    if (!this.item || !this.item.tallas) return false;
    return this.item.tallas.some(t => (t.talla || '').toUpperCase().trim() === talla.toUpperCase().trim());
  }

  getItemTotal(): number {
    if (!this.item || !this.item.tallas) return 0;
    return this.item.tallas.reduce((sum, t) => sum + (Number(t.cantidad) || 0), 0);
  }

  addTalla(talla: string): void {
    this.onAddTalla.emit(talla);
  }

  removeTalla(index: number): void {
    this.onRemoveTalla.emit(index);
  }

  onQuantityChange(): void {
    this.onTallasChanged.emit();
  }

  close(): void {
    this.onClose.emit();
  }
}

