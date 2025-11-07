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
  currentData: any[] = [];

  filters = {
    busqueda: ''
  };

  mostrarAccionTomar = false;

  private subscription = new Subscription();

  mostrarDepartamento = true;
  mostrarEstado = true;

  loading: boolean = false;

  constructor(
    private inconsistenciasService: InconsistenciaService,
    public authService: AuthService,
    public paginationService: PaginationService
  ) { }

  ngOnInit(): void {
    this.cargarInconsistencias();
    this.obtenerTipos();
     this.verificarRolLogistica(); // 👈 Agregar esta línea
  }

  obtenerTipos() {
    fetch('/assets/config/config.json')
      .then(r => r.json())
      .then(json => this.tipos_inco = json);
  }

cargarInconsistencias(): void {
  this.loading = true;

  // ✅ 1. Obtener y filtrar los roles del usuario relacionados con inconsistencias
  const rolesUsuario: string[] = (this.authService.user.roles || []).map((rol: any) => String(rol));
  const rolesInconsistencias = rolesUsuario.filter(rol =>
    rol.toLowerCase().includes('(inconsistencias)')
  );

  // Si no tiene ningún rol de inconsistencias, detener la carga
  if (rolesInconsistencias.length === 0) {
    console.warn('El usuario no tiene roles asociados a inconsistencias.');
    this.loading = false;
    this.inconsistencias = [];
    this.currentData = [];
    return;
  }

  // ✅ 2. Tomar el primer rol de inconsistencias
  const rolInconsistencia = rolesInconsistencias[0];

  // ✅ 3. Llamar al servicio SIN id_departamento
  this.subscription.add(
    this.inconsistenciasService
      .listarInconsistenciasPorDepartamento(rolInconsistencia) // 👈 Solo el rol
      .subscribe({
        next: (res: any) => {
          console.log(rolInconsistencia);
          console.log('Respuesta del backend:', res); // 👈 DEBUG

          if (res && res.success && Array.isArray(res.data)) {
            this.inconsistencias = res.data;
          } else if (Array.isArray(res)) {
            this.inconsistencias = res;
          } else {
            this.inconsistencias = [];
          }

          this.loading = false;

          this.paginationService.initializePaginator(
            this.paginatorId,
            this.inconsistencias,
            10
          ).subscribe({
            next: (state) => {
              this.currentData = state.currentData;
            },
            error: (err) => {
              console.error('Error al inicializar paginador:', err);
              this.currentData = [];
            }
          });
        },
        error: (err) => {
          console.error('Error al cargar inconsistencias:', err);
          this.loading = false;
          this.inconsistencias = [];
          this.currentData = [];
        }
      })
  );
}



verificarRolLogistica(): void {
  const rolesUsuario: string[] = (this.authService.user.roles || []).map((rol: any) => String(rol));
  
  // DEBUG: Ver qué roles tiene el usuario
  console.log(' Verificando rol  - Roles del usuario:', rolesUsuario);
  
  this.mostrarAccionTomar = rolesUsuario.some(rol => {
    const rolLower = rol.toLowerCase();
    const esLogistica = rolLower === 'logisitica (inconsistencias)'; 
    console.log(` Comparando: "${rolLower}" === "logisitica (inconsistencias)"`, esLogistica);
    return esLogistica;
  });
  
  console.log(' ¿Mostrar columna Acción a tomar?:', this.mostrarAccionTomar);
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
        // Usa el dominio actual de la app (útil en desarrollo y producción)
        const baseUrl = 'http://localhost:8000';

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

  // Construye el HTML para mostrar imágenes o PDF igual que en MisInconsistenciasComponent
  const evidenciasHtml = archivos.map((url: string) => {
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
        ${evidenciasHtml}
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

aprobarInconsistencia(inco: any): void {
  // Verificar si el usuario tiene el rol de Calidad
  const rolesUsuario: string[] = (this.authService.user.roles || []).map((rol: any) => String(rol));

  const esRolCalidad = rolesUsuario.some(rol => rol.toLowerCase() === 'calidad (inconsistencias)');

  // Configurar el modal según el rol
  const modalConfig: any = {
    title: '¿Aprobar inconsistencia?',
    text: `¿Deseas aprobar la inconsistencia #${inco.id_inconsistencia}?`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Sí, aprobar',
    cancelButtonText: 'Cancelar'
  };

  // Si es rol Calidad, agregar input de acción
  if (esRolCalidad) {
    modalConfig.html = `
      <p>¿Deseas aprobar la inconsistencia #${inco.id_inconsistencia}?</p>
      <div class="mt-3">
        <label for="accion-tomar" class="form-label fw-bold">Acción a tomar:</label>
        <textarea 
          id="accion-tomar" 
          class="form-control" 
          rows="4" 
          placeholder="Describe la acción correctiva o preventiva a implementar..."
        ></textarea>
      </div>
    `;
    delete modalConfig.text;

    modalConfig.preConfirm = () => {
      const accion = (document.getElementById('accion-tomar') as HTMLTextAreaElement)?.value;
      if (!accion || accion.trim() === '') {
        Swal.showValidationMessage('La acción a tomar es obligatoria');
        return false;
      }
      return accion;
    };
  }

  Swal.fire(modalConfig).then(result => {
    if (result.isConfirmed) {
      this.loading = true;

      const accionTomar = esRolCalidad ? result.value : null;

      this.inconsistenciasService.aprobarInconsistencia(
        inco.id_inconsistencia,
        this.authService.user.id_Sdp,
        inco.tipo_inconsistencia,
        accionTomar
      ).subscribe({
        next: (res: any) => {
          this.loading = false;
          if (res.success) {
            Swal.fire('Aprobada', 'La inconsistencia ha sido aprobada correctamente.', 'success');
            this.inconsistencias = this.inconsistencias.filter(i => i.id_inconsistencia !== inco.id_inconsistencia);
            this.applyFilters();
          } else {
            Swal.fire('Error', res.message || 'No se pudo aprobar la inconsistencia.', 'error');
          }
        },
        error: (err) => {
          this.loading = false;
          console.error('Error al aprobar:', err);
          Swal.fire('Error', 'Ocurrió un error al aprobar.', 'error');
        }
      });
    }
  });
}

// Método para poner inconsistencia en espera
ponerEnEspera(inco: any): void {
  // 1. Verificar que el usuario tiene el rol de Logística
  const rolesUsuario: string[] = (this.authService.user.roles || []).map((rol: any) => String(rol));
  const esRolLogistica = rolesUsuario.some(rol => rol.toLowerCase() === 'logisitica (inconsistencias)');

  if (!esRolLogistica) {
    Swal.fire({
      icon: 'warning',
      title: 'Acceso denegado',
      text: 'Solo el departamento de Logística puede poner inconsistencias en espera.',
      confirmButtonText: 'Entendido'
    });
    return;
  }

  // 2. Mostrar modal de confirmación con motivo
  Swal.fire({
    title: 'Poner en espera',
    html: `
      <p>¿Deseas poner en espera la inconsistencia #${inco.id_inconsistencia}?</p>
      <div class="mt-3">
        <label for="motivo-espera" class="form-label fw-bold">Motivo de espera:</label>
        <textarea 
          id="motivo-espera" 
          class="form-control" 
          rows="4" 
          placeholder="Describe el motivo por el cual se pone en espera..."
        ></textarea>
      </div>
    `,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Sí, poner en espera',
    cancelButtonText: 'Cancelar',
    preConfirm: () => {
      const motivo = (document.getElementById('motivo-espera') as HTMLTextAreaElement)?.value;
      if (!motivo || motivo.trim() === '') {
        Swal.showValidationMessage('El motivo es obligatorio');
        return false;
      }
      return motivo;
    }
  }).then(result => {
    if (result.isConfirmed) {
      const motivo = result.value;
      this.loading = true;

      // 3. Llamar al servicio ponerEnEspera
      this.inconsistenciasService.ponerEnEspera(
        inco.id_inconsistencia,
        this.authService.user.id_Sdp,
        motivo
      ).subscribe({
        next: (res: any) => {
          this.loading = false;
          if (res.success) {
            Swal.fire('En Espera', 'La inconsistencia ha sido puesta en espera correctamente.', 'success');
            this.inconsistencias = this.inconsistencias.filter(i => i.id_inconsistencia !== inco.id_inconsistencia);
            this.applyFilters();
          } else {
            Swal.fire('Error', res.message || 'No se pudo poner en espera la inconsistencia.', 'error');
          }
        },
        error: (err) => {
          this.loading = false;
          console.error('Error al poner en espera:', err);
          Swal.fire('Error', 'Ocurrió un error al poner en espera.', 'error');
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
        this.loading = true;
        this.inconsistenciasService.denegarInconsistencia(
          inco.id_inconsistencia,
          this.authService.user.id_Sdp,
          motivo
        ).subscribe({
          next: (res: any) => {
            this.loading = false;
            if (res.success) {
              Swal.fire('Denegada', 'La inconsistencia fue denegada correctamente.', 'success');
              this.inconsistencias = this.inconsistencias.filter(i => i.id_inconsistencia !== inco.id_inconsistencia);
              this.applyFilters();
            } else {
              Swal.fire('Error', res.message || 'No se pudo denegar la inconsistencia.', 'error');
            }
          },
          error: (err) => {
            this.loading = false;
            console.error('Error al denegar:', err);
            Swal.fire('Error', 'Ocurrió un error al denegar.', 'error');
          }
        });
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

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}