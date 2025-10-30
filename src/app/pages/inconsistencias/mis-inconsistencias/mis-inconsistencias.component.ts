import { PaginationService, FilterFunction } from '../../../shared/pagination/pagination.service';
import { InconsistenciaService } from '../../../services/inconsistencia.service';
import { Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { AuthService } from '../../../services/auth.service';
import { User } from 'src/app/models/User';
import { Subscription, tap, switchMap } from 'rxjs';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-mis-inconsistencias',
  templateUrl: './mis-inconsistencias.component.html',
  styleUrl: './mis-inconsistencias.component.css'
})
export class MisInconsistenciasComponent implements OnInit {

  currentUser: User;


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
      this.inconsistenciasService.listarPorUsuario(+this.authService.user.id_Sdp).pipe(
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
        this.inconsistenciasService.anularInconsistencia(
          inco.id_inconsistencia,
          motivo,
          this.authService.user.id_Sdp // o el campo que uses como ID del usuario logueado
        )
        .subscribe({
          next: () => {
            Swal.fire('Anulada', 'La inconsistencia fue anulada correctamente.', 'success');
            this.cargarInconsistencias();
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
  // Primero verifica evidencias_urls
  if (inco.evidencias_urls && inco.evidencias_urls.length > 0) {
    return true;
  }
  // Si no, parsea evidencias
  try {
    const archivos = JSON.parse(inco.evidencias || '[]');
    return archivos.length > 0;
  } catch {
    return false;
  }
}

 tieneImagen(inco: any): boolean {
  // Verifica evidencias_urls primero
  if (inco.evidencias_urls && inco.evidencias_urls.length > 0) {
    return inco.evidencias_urls.some((url: string) => 
      /\.(jpg|jpeg|png|gif|webp)$/i.test(url)
    );
  }
  // Si no, parsea evidencias
  try {
    const archivos = JSON.parse(inco.evidencias || '[]');
    return archivos.some((archivo: string) => 
      /\.(jpg|jpeg|png|gif|webp)$/i.test(archivo)
    );
  } catch {
    return false;
  }
}

 
tienePdf(inco: any): boolean {
  // Verifica evidencias_urls primero
  if (inco.evidencias_urls && inco.evidencias_urls.length > 0) {
    return inco.evidencias_urls.some((url: string) => /\.pdf$/i.test(url));
  }
  // Si no, parsea evidencias
  try {
    const archivos = JSON.parse(inco.evidencias || '[]');
    return archivos.some((archivo: string) => /\.pdf$/i.test(archivo));
  } catch {
    return false;
  }
}

  verEvidencias(inco: any): void {
  // Primero intenta obtener evidencias_urls (que vienen del backend ya parseadas)
  let archivos = inco.evidencias_urls;
  
  // Si no existen evidencias_urls, intenta parsear evidencias (formato antiguo)
  if (!archivos || archivos.length === 0) {
    try {
      const evidenciasParsed = JSON.parse(inco.evidencias || '[]');
      // Convierte las rutas relativas a URLs completas
      archivos = evidenciasParsed.map((ruta: string) => {
        // Asume que tu API Laravel está en el mismo dominio
        // Ajusta la URL base según tu configuración
        const baseUrl = window.location.origin; // O usa tu URL específica
        return `${baseUrl}/${ruta}`;
      });
    } catch (error) {
      archivos = [];
    }
  }

  if (!archivos || archivos.length === 0) {
    Swal.fire({
      icon: 'info',
      title: 'Sin evidencia',
      text: 'Esta inconsistencia no tiene evidencias adjuntas.',
      confirmButtonText: 'Entendido'
    });
    return;
  }

  // Mostrar modal con galería de imágenes
   const imagenesHtml = archivos.map((url: string) => {
    const extension = url.split('.').pop()?.toLowerCase();
    
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '')) {
      return `
        <div class="mb-3">
          <img src="${url}" 
               alt="Evidencia" 
               class="img-fluid rounded shadow-sm"
               style="max-width: 100%; max-height: 70vh; width: auto; cursor: pointer;"
               onclick="window.open('${url}', '_blank')">
        </div>
      `;
    } else if (extension === 'pdf') {
      return `
        <div class="mb-3">
          <a href="${url}" target="_blank" class="btn btn-danger btn-lg">
            <i class="fas fa-file-pdf me-2"></i>Abrir PDF
          </a>
        </div>
      `;
    } else {
      return `
        <div class="mb-3">
          <a href="${url}" target="_blank" class="btn btn-secondary btn-lg">
            <i class="fas fa-file me-2"></i>Abrir archivo
          </a>
        </div>
      `;
    }
  }).join('');

  Swal.fire({
    title: 'Evidencias',
    html: `
      <div class="text-center">
        ${imagenesHtml}
  
      </div>
    `,
    width: '40%',  
    showCloseButton: true,
    showConfirmButton: false,
    customClass: {
      popup: 'p-4'
    }
  });
}
}
