import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, Inject } from '@angular/core';
import { DOCUMENT, CommonModule } from '@angular/common';
import { DocumentoSeguimiento, SeguimientoDocumentosService, ItemDetalle, ItemsResponse } from 'src/app/services/seguimiento-documentos.service';

@Component({
  selector: 'app-modal-detalle',
  templateUrl: './modal-detalle.component.html',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    .modal-overlay {
      background-color: rgba(15, 23, 42, 0.45);
      backdrop-filter: blur(4px);
    }
  `]
})
export class ModalDetalleComponent implements OnInit, OnDestroy {
  @Input() documento: DocumentoSeguimiento | null = null;
  @Output() close = new EventEmitter<void>();

  // Items
  items: ItemDetalle[] = [];
  filteredItems: ItemDetalle[] = [];
  itemsLoading = false;
  itemsError = '';
  itemsResumen: { total: number; completos: number; parciales: number; pendientes: number; faltantes: number } = {
    total: 0, completos: 0, parciales: 0, pendientes: 0, faltantes: 0
  };

  // Filtros activos
  filtroEstado: 'COMPLETO' | 'PARCIAL' | 'PENDIENTE' | null = null;
  filtroOc: string | null = null;

  // Tab activo
  activeTab: 'info' | 'items' = 'info';

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private seguimientoService: SeguimientoDocumentosService
  ) {}

  ngOnInit(): void {
    this.loadTailwind();
  }

  private loadTailwind(): void {
    const link = this.document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css';
    this.document.head.appendChild(link);
  }

  ngOnDestroy(): void {
    // No eliminamos bootstrap-icons para evitar desconfigurar otros componentes
  }

  onClose(): void {
    this.close.emit();
  }

  switchTab(tab: 'info' | 'items'): void {
    this.activeTab = tab;
    if (tab === 'items' && this.items.length === 0 && !this.itemsLoading) {
      this.cargarItems();
    }
  }

  cargarItems(): void {
    if (!this.documento) return;

    this.itemsLoading = true;
    this.itemsError = '';

    this.seguimientoService.obtenerItems(this.documento.tipo_ss, this.documento.nro_ss).subscribe({
      next: (res: ItemsResponse) => {
        this.items = res.items || [];
        this.itemsResumen = {
          total: res.total_items,
          completos: res.items_completos,
          faltantes: res.items_faltantes,
          parciales: this.items.filter(i => i.estado_visual === 'PARCIAL').length,
          pendientes: this.items.filter(i => i.estado_visual === 'PENDIENTE').length
        };
        this.aplicarFiltros();
      },
      error: (err) => {
        this.itemsError = err.error?.message || 'Error al cargar los items del documento.';
      },
      complete: () => {
        this.itemsLoading = false;
      }
    });
  }

  // Lógica de filtrado
  aplicarFiltros(): void {
    this.filteredItems = this.items.filter(item => {
      // Filtro por estado
      if (this.filtroEstado && item.estado_visual !== this.filtroEstado) {
        return false;
      }
      // Filtro por OC
      if (this.filtroOc) {
        const itemOc = item.oc_tipo && item.oc_consecutivo ? `${item.oc_tipo}-${item.oc_consecutivo}` : 'SIN_OC';
        if (itemOc !== this.filtroOc) {
          return false;
        }
      }
      return true;
    });
  }

  filtrarPorEstado(estado: 'COMPLETO' | 'PARCIAL' | 'PENDIENTE'): void {
    if (this.filtroEstado === estado) {
      this.filtroEstado = null; // Toggle off
    } else {
      this.filtroEstado = estado;
    }
    this.aplicarFiltros();
  }

  filtrarPorOc(ocCodigo: string): void {
    this.filtroOc = ocCodigo || null;
    this.aplicarFiltros();
  }

  onOcFilterChange(event: any): void {
    this.filtrarPorOc(event.target.value);
  }

  verItemsDeOrden(tipo: string, consecutivo: string): void {
    this.filtroOc = `${tipo}-${consecutivo}`;
    this.switchTab('items');
    this.aplicarFiltros();
  }

  limpiarFiltros(): void {
    this.filtroEstado = null;
    this.filtroOc = null;
    this.aplicarFiltros();
  }

  get ocsDisponibles(): string[] {
    const ocs = new Set<string>();
    this.items.forEach(item => {
      if (item.oc_tipo && item.oc_consecutivo) {
        ocs.add(`${item.oc_tipo}-${item.oc_consecutivo}`);
      }
    });
    return Array.from(ocs).sort();
  }
}
