import { PaginationService, FilterFunction } from '../../../shared/pagination/pagination.service';
import { InconsistenciaService } from '../../../services/inconsistencia.service';
import { Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { AuthService } from '../../../services/auth.service';
import { Subscription, tap, switchMap } from 'rxjs';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-mis-inconsistencias',
  templateUrl: './mis-inconsistencias.component.html',
  styleUrl: './mis-inconsistencias.component.css'
})
export class MisInconsistenciasComponent implements OnInit {
  title = 'Mis Inconsistencias';
  
  // Identificador único para este paginador
  paginatorId = 'inconsistencias-paginator';
  
  // Datos
  public inconsistencias: any[] = [];
  currentData: any[] = []; // ← Los datos actuales de la página
  
  // Filtros (personaliza según tu interfaz)
  filters = {
    // Define aquí los filtros específicos de tu interfaz
    estado: 'todos',
    busqueda: '',
  };

  private subscription = new Subscription();
  
  tipos: { [key: string]: string } = {};
  modalRef: NgbModalRef | null = null;

  @ViewChild('modalTexto') modalTexto!: TemplateRef<any>;

  constructor(
    private inconsistenciasService: InconsistenciaService,
    private authService: AuthService,
    private modalService: NgbModal,
    public paginationService: PaginationService
  ) {}

  ngOnInit(): void {
    this.obtenerTipos();
    this.cargarInconsistencias();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    this.paginationService.destroyPaginator(this.paginatorId);
  }

  obtenerTipos() {
    fetch('/assets/config/config.json')
      .then(r => r.json())
      .then(json => this.tipos = json);
  }

  cargarInconsistencias() {
    this.subscription.add(
      this.inconsistenciasService.listarPorUsuario(this.authService.user.email).pipe(
        tap(res => this.inconsistencias = res),
        switchMap(() => this.paginationService.initializePaginator(this.paginatorId, this.inconsistencias, 10))
      ).subscribe(state => {
        this.currentData = state.currentData;
      })
    );
  }

  // Función de filtrado (personaliza según tus necesidades)
  filterFunction: FilterFunction = (item, filtros) => {
    const texto = filtros.busqueda.toLowerCase();

    const coincideBusqueda =
      !texto ||
      Object.values(item).some(valor =>
        valor?.toString().toLowerCase().includes(texto)
      );

    let coincideEstado = true;

    if (filtros.estado === 'pendientes') {
      coincideEstado = item.etapa !== 'terminada' && !item.razon_anulacion;
    } else if (filtros.estado === 'terminadas') {
      coincideEstado = item.etapa === 'terminada';
    } else if (filtros.estado === 'anuladas') {
      coincideEstado = !!item.razon_anulacion;
    }

    return coincideBusqueda && coincideEstado;
  };

  applyFilters(): void {
    this.paginationService.updatePaginator(
      this.paginatorId,
      this.inconsistencias,
      undefined,
      this.filters,
      this.filterFunction
    );
    const state = this.paginationService.getPaginatorState(this.paginatorId);
    this.currentData = state?.currentData || [];
  }

  abrirModal(tipo: string, contenido: string) {
    this.modalRef = this.modalService.open(this.modalTexto);
    this.modalRef.componentInstance.data = {
      titulo: tipo === 'item' ? 'Descripción del Ítem' : 'Descripción de la Situación',
      contenido
    };
  }

  abrirAnular(inco: any) {
    Swal.fire({
      title: 'Motivo de Anulación',
      html: '<label for="swal2-textarea">Escribe el motivo</label>',
      input: 'textarea',
      inputPlaceholder: 'Motivo por el cual estás anulando esta inconsistencia...',
      inputAttributes: {
        'aria-label': 'Motivo de anulación',
        'id': 'swal2-textarea'
      },
      showCancelButton: true,
      confirmButtonText: 'Anular',
      cancelButtonText: 'Cancelar',
      inputValidator: (value) => {
        if (!value) {
          return 'Debes escribir un motivo para anular.';
        }
        return null;
      }
    }).then((result) => {
      if (result.isConfirmed) {
        const motivo = result.value as string;

        // Llama al backend (a través del service)
        this.inconsistenciasService.anularInconsistencia(inco.id_inconsistencia, motivo)
          .subscribe({
            next: () => {
              Swal.fire('Anulada', 'La inconsistencia fue anulada correctamente.', 'success');
              this.cargarInconsistencias(); // Recargar la lista si quieres
            },
            error: () => {
              Swal.fire('Error', 'Hubo un problema al anular la inconsistencia.', 'error');
            }
          });
      }
    });
  }

  verRazonAnulacion(inco: any): void {
    Swal.fire({
      title: 'Razón de Anulación',
      text: inco.razon_anulacion || 'No se especificó una razón',
      icon: 'info',
      confirmButtonText: 'Cerrar'
    });
  }


  verObservacion(obs: string) {
    Swal.fire('Observación', obs || 'Sin observación', 'info');
  }

  tieneEvidencia(inco: any): boolean {
    const archivos = JSON.parse(inco.evidencias || '[]');
    return archivos.length > 0;
  }

  tieneImagen(inco: any): boolean {
    const archivos = JSON.parse(inco.evidencias || '[]');
    return archivos.some((archivo: string) => /\.(jpg|jpeg|png|gif)$/i.test(archivo));
  }

  tienePdf(inco: any): boolean {
    const archivos = JSON.parse(inco.evidencias || '[]');
    return archivos.some((archivo: string) => /\.pdf$/i.test(archivo));
  }

  verEvidencias(inco: any): void {
    const archivos = JSON.parse(inco.evidencias || '[]');

    if (!archivos.length) {
      Swal.fire({
        icon: 'info',
        title: 'Sin evidencia',
        text: 'Esta inconsistencia no tiene evidencias adjuntas.',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    archivos.forEach((archivo: string) => {
      window.open(archivo, '_blank');
    });
  }
}
