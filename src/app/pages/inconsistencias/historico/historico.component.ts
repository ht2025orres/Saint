import { Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { BsModalService, BsModalRef } from 'ngx-bootstrap/modal';
import { InconsistenciaService } from '../../../services/inconsistencia.service';
import { PaginationService, FilterFunction  } from '../../../shared/pagination/pagination.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-historico-inconsistencias',
  templateUrl: './historico.component.html',
  styleUrls: ['./historico.component.css']
})
export class HistoricoInconsistenciasComponent implements OnInit {
  title = 'Histórico de Inconsistencias';
  inconsistencias: any[] = [];
  currentData: any[] = [];
  tipos_inco: any = {};
  paginatorId = 'historicoPaginator';
  modalRef?: BsModalRef;

  mostrarDepartamento = false;
  mostrarEstado = true;
  esLiderEspecial = false;

  filters = {
    busqueda: '',
    mes: '',
    fechaInicio: '',
    fechaFin: '',
    anuladas: ''
  };

  @ViewChild('modalTexto') modalTexto!: TemplateRef<any>;

  constructor(
    private inconsistenciasService: InconsistenciaService,
    public paginationService: PaginationService,
    private modalService: BsModalService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.cargarTiposInconsistencias();
    this.cargarInconsistencias();
  }

  cargarTiposInconsistencias(): void {
    fetch('/assets/config/config.json')
      .then(r => r.json())
      .then(json => this.tipos_inco = json);
  }

  cargarInconsistencias(): void {
    this.inconsistenciasService.listarHistorico(this.authService.user.id_departamento_Sdp).subscribe({
      next: (res) => {
        this.inconsistencias = res;
        this.paginationService.initializePaginator(
          this.paginatorId,
          this.inconsistencias,
          10,
          this.filters,
          this.filtroCustomizado
        ).subscribe(state => {
          this.currentData = state.currentData;
        });
      },
      error: (err) => {
        console.error('Error al cargar histórico', err);
      }
    });
  }

  filtroCustomizado = (item: any, filtros: any): boolean => {
    const texto = filtros.busqueda?.toLowerCase() || '';

    const coincideBusqueda = !texto || Object.values(item).some(valor =>
      valor?.toString().toLowerCase().includes(texto)
    );

    const coincideMes = filtros.mes
      ? (() => {
          const [anioFiltro, mesFiltro] = filtros.mes.split('-').map(Number);
          const fechaItem = new Date(item.fecha_inconsistencia);
          return (
            fechaItem.getFullYear() === anioFiltro &&
            fechaItem.getMonth() + 1 === mesFiltro
          );
        })()
      : true;

    const fechaInconsistencia = new Date(item.fecha_inconsistencia);
    const coincideRango =
      (!filtros.fechaInicio || fechaInconsistencia >= new Date(filtros.fechaInicio)) &&
      (!filtros.fechaFin || fechaInconsistencia <= new Date(filtros.fechaFin));

    const coincideAnuladas = filtros.anuladas === ''
      ? true
      : filtros.anuladas === 'true'
        ? !!item.razon_anulacion
        : !item.razon_anulacion;

    const usarRango = filtros.fechaInicio || filtros.fechaFin;
    const usarMes = filtros.mes;

    if (usarMes && usarRango) return false; // Exclusión mutua

    return coincideBusqueda && coincideAnuladas && (usarMes ? coincideMes : coincideRango);
  };

  applyFilters(): void {
    this.paginationService.updatePaginator(
      this.paginatorId,
      this.inconsistencias,
      undefined,
      this.filters,
      this.filtroCustomizado
    );
  }

  verDetalle(texto: string, titulo: string): void {
    this.modalRef = this.modalService.show(this.modalTexto, {
      initialState: {
        titulo,
        contenido: texto
      }
    });
  }

  verEvidencias(inco: any): void {
    console.log('Ver evidencias de:', inco);
    // Aquí iría lógica adicional si deseas mostrar un modal con imágenes/PDFs
  }

  // Métodos auxiliares
  onMesChange(): void {
    if (this.filters.mes) {
      this.filters.fechaInicio = '';
      this.filters.fechaFin = '';
    }
    this.applyFilters();
  }

  onRangoChange(): void {
    if (this.filters.fechaInicio || this.filters.fechaFin) {
      this.filters.mes = '';
    }
    this.applyFilters();
  }
}
