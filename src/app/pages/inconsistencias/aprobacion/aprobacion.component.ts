import { PaginationService, FilterFunction } from '../../../shared/pagination/pagination.service';
import { InconsistenciaService } from '../../../services/inconsistencia.service';
import { AuthService } from '../../../services/auth.service';
import { Subscription, tap, switchMap } from 'rxjs';
import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-aprobacion-inconsistencias',
  templateUrl: './aprobacion.component.html',
  styleUrls: ['./aprobacion.component.css']
})
export class AprobacionComponent implements OnInit {
  title = 'Inconsistencias Pendientes de Aprobación';
  paginatorId = 'inconsistencias-aprobar-paginator';
  tipos_inco: { [key: string]: string } = {};

  inconsistencias: any[] = [];
  currentData: any[] = []; // Datos actuales de la página

  // Filtros (personaliza según tu interfaz)
  filters = {
    // Define aquí los filtros específicos de tu interfaz
    busqueda: ''
  };

  private subscription = new Subscription();

  mostrarDepartamento = true;
  mostrarEstado = true;
  
  estadoSeleccionado: string = 'pendientes';
  loading: boolean = false;

  estadoFiltro: string = 'pendientes'; // Para el filtro por estado

  modalRef: any; // Para el modal bootstrap o ng-bootstrap

  constructor(
    private inconsistenciasService: InconsistenciaService,
    public authService: AuthService,
    public paginationService: PaginationService
  ) {}

  ngOnInit(): void {
    this.cargarInconsistencias();
    this.obtenerTipos();
  }

  obtenerTipos() {
    fetch('/assets/config/config.json')
      .then(r => r.json())
      .then(json => this.tipos_inco = json);
  }

  cargarInconsistencias(): void {
    this.loading = true;
    // this.inconsistenciasService.listarInconsistenciasPorRol(this.authService.user.roles, this.authService.user.id_Sdp)
    //   .subscribe({
    //     next: (res) => {
    //       this.inconsistencias = res;
    //       this.loading = false;
    //     },
    //     error: (err) => {
    //       console.error('Error al cargar inconsistencias:', err);
    //       this.loading = false;
    //       Swal.fire('Error', 'No se pudieron cargar las inconsistencias', 'error');
    //     }
    //   });
    this.subscription.add(
      this.inconsistenciasService.listarInconsistenciasPorRol(this.authService.user.roles, this.authService.user.id_Sdp).pipe(
        tap(res => this.inconsistencias = res),
        switchMap(() => this.paginationService.initializePaginator(this.paginatorId, this.inconsistencias, 10))
      ).subscribe(state => {
        this.currentData = state.currentData;
      })
    );
  }

  cambiarEstadoFiltro(): void {
    this.cargarInconsistencias();
  }

  verEvidencias(inco: any): void {
    const evidencias: string[] = JSON.parse(inco.evidencias || '[]');
    if (!evidencias.length) {
      Swal.fire('Sin evidencias', 'No hay archivos adjuntos.', 'info');
      return;
    }

    const baseUrl = 'https://colegioprovidencia.edu.co';

    const urls = evidencias.map(file => 
      file.startsWith('http') ? file : `${baseUrl}${file}`
    );

    const imagenes = urls.filter(file =>
      /\.(jpe?g|png|gif|bmp|webp|svg)$/i.test(file)
    );
    const pdfs = urls.filter(file =>
      /\.pdf$/i.test(file)
    );

    // Abrir PDFs en nueva pestaña
    pdfs.forEach(pdf => {
      window.open(pdf, '_blank');
    });

    // Mostrar imágenes con SweetAlert2
    if (imagenes.length === 1) {
      Swal.fire({
        title: 'Evidencia',
        imageUrl: imagenes[0],
        imageAlt: 'Evidencia',
        confirmButtonText: 'Cerrar'
      });
    } else if (imagenes.length > 1) {
      let index = 0;

      const showImage = (i: number) => {
        Swal.fire({
          title: `Evidencia ${i + 1} de ${imagenes.length}`,
          imageUrl: imagenes[i],
          imageAlt: `Evidencia ${i + 1}`,
          showCancelButton: i < imagenes.length - 1,
          showConfirmButton: i > 0,
          confirmButtonText: i > 0 ? 'Anterior' : 'Cerrar',
          cancelButtonText: i < imagenes.length - 1 ? 'Siguiente' : 'Cerrar'
        }).then((result) => {
          if (result.isConfirmed && i > 0) {
            showImage(i - 1);
          } else if (result.dismiss === Swal.DismissReason.cancel && i < imagenes.length - 1) {
            showImage(i + 1);
          }
        });
      };

      showImage(index);
    }
  }

  aceptarInconsistencia(inco: any): void {
    Swal.fire({
      title: '¿Deseas aceptar esta inconsistencia?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, aceptar',
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (result.isConfirmed) {
        const idInconsistencia = inco.id;
        const idUsuario = this.authService.user.id_Sdp;
        const tipoInconsistencia = inco.tipo_inco;
        const etapa = inco.etapa

        this.inconsistenciasService.aprobarInconsistencia(idInconsistencia, idUsuario, tipoInconsistencia, etapa).subscribe({
          next: (res) => {
            Swal.fire('Éxito', 'Inconsistencia aceptada correctamente.', 'success');
            // Recargar la lista o actualizar la tabla
            this.cargarInconsistencias(); 
          },
          error: (err) => {
            console.error(err);
            Swal.fire('Error', 'No se pudo aceptar la inconsistencia.', 'error');
          }
        });
      }
    });
  }

  denegarInconsistencia(inco: any): void {
    Swal.fire({
      title: 'Motivo de denegación',
      input: 'textarea',
      inputPlaceholder: 'Escribe el motivo...',
      showCancelButton: true,
      confirmButtonText: 'Denegar',
      cancelButtonText: 'Cancelar',
      preConfirm: (motivo) => {
        if (!motivo) {
          Swal.showValidationMessage('El motivo es obligatorio');
          return false;
        }
        return motivo;
      }
    }).then(result => {
      if (result.isConfirmed) {
        const motivo = result.value;
        console.log('Denegada', { inco, motivo });
        // Aquí llamarías al servicio para denegar
      }
    });
  }

  filterFunction: FilterFunction = (item, filtros) => {
    const texto = filtros.busqueda.toLowerCase();

    const coincideBusqueda =
      !texto ||
      Object.values(item).some(valor =>
        valor?.toString().toLowerCase().includes(texto)
      );

    return coincideBusqueda;
  };

  applyFilters() {
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
}
