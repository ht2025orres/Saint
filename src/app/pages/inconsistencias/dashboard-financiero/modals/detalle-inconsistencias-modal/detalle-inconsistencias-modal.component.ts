import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { InconsistenciaService } from '../../../../../services/inconsistencia.service';
import { getDetallesHtml, generarTiemposHtml, generarEvidenciasHtml } from '../../../../../shared/templates/detalles-popup.template';
import { TIPOS_INCONSISTENCIA, getNombreInconsistencia } from '../../../../../shared/constants/inconsistencias.constants';

@Component({
  selector: 'app-detalle-inconsistencias-modal',
  templateUrl: './detalle-inconsistencias-modal.component.html',
  styleUrls: ['./detalle-inconsistencias-modal.component.css']
})
export class DetalleInconsistenciasModalComponent implements OnChanges {
  @Input() visible: boolean = false;
  @Input() origen: string = 'total';
  @Input() titulo: string = 'Detalle de Inconsistencias';
  @Input() filtros: any = {};

  @Output() onClose = new EventEmitter<void>();

  items: any[] = [];
  isLoading: boolean = false;
  busqueda: string = '';
  filtroCorregidas: boolean = false;
  paginaActual: number = 1;
  itemsPorPagina: number = 10;

  constructor(private inconsistenciaService: InconsistenciaService) { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && this.visible) {
      this.busqueda = '';
      this.filtroCorregidas = false;
      this.paginaActual = 1;
      this.cargarDetalles();
    } else if (this.visible && (changes['filtros'] || changes['origen'])) {
      this.cargarDetalles();
    }
  }

  cargarDetalles(): void {
    this.isLoading = true;
    this.items = [];

    this.inconsistenciaService.getDetalleInconsistencias(this.origen, this.filtros).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.items = res.data;
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error cargando detalle de inconsistencias', err);
        this.isLoading = false;
      }
    });
  }

  close(): void {
    this.onClose.emit();
  }

  setFiltroCorregidas(valor: boolean): void {
    this.filtroCorregidas = valor;
    this.paginaActual = 1;
  }

  get cantidadCorregidas(): number {
    return this.items.filter(item => !!item.reclasificacion_logistica).length;
  }

  get itemsFiltrados(): any[] {
    let result = this.items;
    if (this.filtroCorregidas) {
      result = result.filter(item => !!item.reclasificacion_logistica);
    }
    if (!this.busqueda || !this.busqueda.trim()) {
      return result;
    }
    const term = this.busqueda.toLowerCase().trim();
    return result.filter(item => {
      const op = (item.op || '').toLowerCase();
      const num = (item.id_inconsistencia || '').toString().toLowerCase();
      const cliente = (item.Cliente || '').toLowerCase();
      const it = (item.item || '').toLowerCase();
      const nombreItem = (item.nombre_item || '').toLowerCase();
      const tipo = (this.getNombreInconsistencia(item.tipo_inconsistencia) || '').toLowerCase();
      const reclasif = (this.getNombreInconsistencia(item.reclasificacion_logistica) || '').toLowerCase();
      const etapa = (item.etapa || '').toLowerCase();
      const estadoInc = (item.estado_inconsistencia || '').toLowerCase();
      const estadoCons = (item.estado_consumo || '').toLowerCase();

      return op.includes(term) ||
        num.includes(term) ||
        cliente.includes(term) ||
        it.includes(term) ||
        nombreItem.includes(term) ||
        tipo.includes(term) ||
        reclasif.includes(term) ||
        etapa.includes(term) ||
        estadoInc.includes(term) ||
        estadoCons.includes(term);
    });
  }

  get totalPaginas(): number {
    return Math.ceil(this.itemsFiltrados.length / this.itemsPorPagina) || 1;
  }

  get itemsPaginados(): any[] {
    const start = (this.paginaActual - 1) * this.itemsPorPagina;
    return this.itemsFiltrados.slice(start, start + this.itemsPorPagina);
  }

  cambiarPagina(delta: number): void {
    const nueva = this.paginaActual + delta;
    if (nueva >= 1 && nueva <= this.totalPaginas) {
      this.paginaActual = nueva;
    }
  }

  get sumaTotal(): number {
    return this.itemsFiltrados.reduce((acc, curr) => acc + (parseFloat(curr.precio_total_inconsistencia) || 0), 0);
  }

  verDetallesInconsistencia(item: any): void {
    if (!item) return;

    const win = window.open('', '_blank', 'width=920,height=780,scrollbars=yes,resizable=yes');
    if (win) {
      win.document.write('<p style="font-family:sans-serif;text-align:center;padding:24px;">Cargando detalles de la inconsistencia...</p>');
    }

    this.inconsistenciaService.obtenerTiemposProceso(item.id_inconsistencia || item.id).subscribe({
      next: (res: any) => {
        const traducirEtapa = (etapa: string) => {
          if (!etapa) return 'Sin etapa';
          const etapaStr = String(etapa).toLowerCase();
          const etapas: { [key: string]: string } = {
            'terminada': 'Terminada',
            'espera': 'En Espera',
            'lider': 'Líder',
            'contabilidad': 'Contabilidad',
            'calidad': 'Calidad',
            'logistica': 'Logística',
            'cartera': 'Cartera',
            'patronaje': 'Patronaje',
            'trazo': 'Trazo'
          };
          return etapas[etapaStr] || etapaStr.charAt(0).toUpperCase() + etapaStr.slice(1);
        };

        const tiemposHtml = generarTiemposHtml(res, traducirEtapa);
        const evidenciasHtml = generarEvidenciasHtml(item.evidencias_urls || item.evidencias || []);

        const htmlContent = getDetallesHtml(
          item,
          tiemposHtml,
          evidenciasHtml,
          '',
          TIPOS_INCONSISTENCIA,
          traducirEtapa,
          {
            mostrarSeccionAnulacion: false,
            mostrarFooter: true,
            mostrarInfoEconomica: true,
            mostrarBotonesAccion: false
          }
        );

        if (win) {
          win.document.open();
          win.document.write(htmlContent);
          win.document.close();
        }
      },
      error: () => {
        if (win) {
          win.document.body.innerHTML = '<p style="color:red; text-align:center; padding:24px;">Error al cargar tiempos del proceso.</p>';
        }
      }
    });
  }

  getNombreInconsistencia(key: string): string {
    return getNombreInconsistencia(key);
  }

  formatCurrency(value: any): string {
    const num = parseFloat(value) || 0;
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  }

  formatNumber(value: any): string {
    const num = parseFloat(value) || 0;
    return new Intl.NumberFormat('es-CO').format(num);
  }
}

