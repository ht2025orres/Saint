import { PaginationService, FilterFunction } from '../../../shared/pagination/pagination.service';
import { InconsistenciaService } from 'src/app/services/inconsistencia.service';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { AuthService } from '../../../services/auth.service';
import { Subscription, tap, switchMap, finalize } from 'rxjs';
import { getDetallesHtml, generarTiemposHtml, generarEvidenciasHtml } from '../../../shared/templates/detalles-popup.template';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-revision-consumo',
  templateUrl: './revision-consumo.component.html',
  styleUrls: ['./revision-consumo.component.css']
})
export class RevisionConsumoComponent implements OnInit, OnDestroy {
  title = 'Inconsistencias Pendientes de Consumo';
  paginatorId = 'inconsistencias-revision-paginator';

  inconsistencias: any[] = [];
  currentData: any[] = [];
  tipos: any = {};
  loading = false;

  // Filtros
  filters = {
    busqueda: '',
    estadoConsumo: '',
    etapa: ''
  };

  private subscription = new Subscription();

  constructor(
    private inconsistenciasService: InconsistenciaService,
    public authService: AuthService,
    public paginationService: PaginationService
  ) { }

  ngOnInit(): void {
    this.inicializarComponente();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  private inicializarComponente(): void {
    this.cargarTipos();
    this.cargarDatos();
  }

  cargarTipos(): void {
    this.loading = true;
    fetch('/assets/config/config.json')
      .then(response => {
        if (!response.ok) {
          throw new Error('Error al cargar configuración');
        }
        return response.json();
      })
      .then(json => {
        this.tipos = json || {};
      })
      .catch(error => {
        this.tipos = {};
        Swal.fire('Error', 'No se pudo cargar la configuración de tipos', 'warning');
      })
      .finally(() => {
        this.loading = false;
      });
  }

  cargarDatos(): void {
    this.loading = true;

    // Validar que el usuario esté autenticado
    if (!this.authService.user || !this.authService.user.roles) {
      Swal.fire('Error', 'Usuario no autenticado correctamente', 'error');
      this.loading = false;
      return;
    }

    this.subscription.add(
      this.inconsistenciasService.obtenerInconsistenciasListasParaConsumir() // CAMBIO AQUÍ
        .pipe(
          tap(res => {
            this.inconsistencias = Array.isArray(res) ? res : [];
          }),
          switchMap(() => {
            if (this.inconsistencias.length === 0) {
              this.currentData = [];
              return [];
            }
            return this.paginationService.initializePaginator(
              this.paginatorId,
              this.inconsistencias,
              10
            );
          }),
          finalize(() => {
            this.loading = false;
          })
        ).subscribe({
          next: (state) => {
            if (state && state.currentData) {
              this.currentData = state.currentData;
            }
          },
          error: (error) => {
            this.inconsistencias = [];
            this.currentData = [];
            Swal.fire('Error', 'No se pudieron cargar las inconsistencias', 'error');
          }
        })
    );
  }
  filtrarDatos(): void {
    let datosFiltrados = [...this.inconsistencias];

    // Filtro por búsqueda de texto
    if (this.filters.busqueda && this.filters.busqueda.trim() !== '') {
      const texto = this.filters.busqueda.toLowerCase().trim();
      datosFiltrados = datosFiltrados.filter(item => {
        if (!item) return false;

        return Object.values(item).some(value => {
          if (value === null || value === undefined) return false;
          return value.toString().toLowerCase().includes(texto);
        });
      });
    }

    // Filtro por estado de consumo
    if (this.filters.estadoConsumo) {
      datosFiltrados = datosFiltrados.filter(item =>
        item?.estado_consumo === this.filters.estadoConsumo
      );
    }

    // Filtro por etapa
    if (this.filters.etapa) {
      datosFiltrados = datosFiltrados.filter(item =>
        item?.etapa === this.filters.etapa
      );
    }

    // Reinicializar paginación con datos filtrados
    this.subscription.add(
      this.paginationService.initializePaginator(
        this.paginatorId,
        datosFiltrados,
        10
      ).subscribe(state => {
        this.currentData = state.currentData;
      })
    );
  }

  onSearchInput(event: any): void {
    this.filters.busqueda = event.target.value;
    this.filtrarDatos();
  }

  onEstadoConsumoChange(event: any): void {
    this.filters.estadoConsumo = event.target.value;
    this.filtrarDatos();
  }

  onEtapaChange(event: any): void {
    this.filters.etapa = event.target.value;
    this.filtrarDatos();
  }

  getColorEtapa(etapa: string): string {
    if (!etapa) return 'secondary';

    const etapaNormalizada = etapa.toLowerCase();
    switch (etapaNormalizada) {
      case 'logistica':
        return 'danger';
      case 'terminada':
        return 'success';
      case 'espera':
        return 'warning';
      default:
        return 'secondary';
    }
  }

  getColorConsumo(estado: string): string {
    if (!estado) return 'secondary';

    const estadoNormalizado = estado.toUpperCase();
    switch (estadoNormalizado) {
      case 'CONSUMIDO':
        return 'success';
      case 'POR CONSUMIR':
        return 'danger';
      default:
        return 'secondary';
    }
  }

  verDetalles(item: any): void {
    if (!item) {
      Swal.fire('Error', 'No se pueden mostrar los detalles', 'error');
      return;
    }

    // Obtener URLs de evidencias
    let archivos: string[] = [];
    if (Array.isArray(item.evidencias_urls) && item.evidencias_urls.length > 0) {
      archivos = item.evidencias_urls;
    } else if (Array.isArray(item.evidencias) && item.evidencias.length > 0) {
      archivos = item.evidencias;
    }

    // Abrir ventana nativa (pop-up) de inmediato para evitar bloqueos del navegador
    const win = window.open('', '_blank', 'width=900,height=750,scrollbars=yes,resizable=yes');
    if (win) {
      win.document.write('<p style="font-family:sans-serif;text-align:center;padding:20px;">Cargando detalles...</p>');
    }

    // Obtener los tiempos del proceso
    this.inconsistenciasService.obtenerTiemposProceso(item.id_inconsistencia || item.id).subscribe({
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
        const evidenciasHtml = generarEvidenciasHtml(archivos);

        const htmlContent = getDetallesHtml(
          item,
          tiemposHtml,
          evidenciasHtml,
          '', // Sin botones adicionales
          this.tipos || {},
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
      error: (err) => {
        if (win) {
          win.document.body.innerHTML = '<p style="color:red; text-align:center; padding:20px;">Error al cargar los tiempos de proceso.</p>';
        }
      }
    });
  }

  puedeConsumir(item: any): boolean {
    if (!item) return false;
    return item.etapa === 'terminada' && item.estado_consumo !== 'CONSUMIDO';
  }

  consumirInconsistencia(item: any): void {
    if (!this.puedeConsumir(item)) {
      Swal.fire('Error', 'Esta inconsistencia no se puede consumir.', 'error');
      return;
    }

    // Crear HTML personalizado con select y inputs
    const htmlContent = `
    <div class="swal-custom-form">
      <div class="mb-3">
        <label for="tipo-consumo" class="form-label fw-bold">Tipo de consumo:</label>
        <select id="tipo-consumo" class="form-select">
          <option value="">Selecciona una opción</option>
          <option value="consumo">Consumo</option>
          <option value="gasto">Gasto</option>
          <option value="devolucion">Devolución</option>
        </select>
      </div>
      
      <!-- Container para Devolución y Gasto (un solo input) -->
      <div id="codigo-simple-container" class="mb-3" style="display: none;">
        <label id="codigo-simple-label" class="form-label fw-bold">Código:</label>
        <input 
          type="text" 
          id="codigo-simple" 
          class="form-control" 
          placeholder="Ingresa el código"
        />
        <small id="codigo-simple-hint" class="form-text text-muted"></small>
      </div>

      <!-- Container para Consumo (dos inputs) -->
      <div id="codigo-consumo-container" style="display: none;">
        <div class="mb-3">
          <label for="codigo-trn" class="form-label fw-bold">Código TRN:</label>
          <input 
            type="text" 
            id="codigo-trn" 
            class="form-control" 
            placeholder="Ej: TRN-12345"
          />
          <small class="form-text text-muted">Ingresa el código de transferencia</small>
        </div>
        <div class="mb-3">
          <label for="codigo-consumo" class="form-label fw-bold">Código de Consumo:</label>
          <input 
            type="text" 
            id="codigo-consumo" 
            class="form-control" 
            placeholder="Ej: CONS-12345"
          />
          <small class="form-text text-muted">Ingresa el código de consumo</small>
        </div>
      </div>
    </div>
  `;

    Swal.fire({
      title: 'Registrar Consumo',
      html: htmlContent,
      showCancelButton: true,
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
      width: '600px',
      didOpen: () => {
        const tipoSelect = document.getElementById('tipo-consumo') as HTMLSelectElement;
        const codigoSimpleContainer = document.getElementById('codigo-simple-container') as HTMLDivElement;
        const codigoConsumoContainer = document.getElementById('codigo-consumo-container') as HTMLDivElement;
        const codigoSimpleLabel = document.getElementById('codigo-simple-label') as HTMLLabelElement;
        const codigoSimpleInput = document.getElementById('codigo-simple') as HTMLInputElement;
        const codigoSimpleHint = document.getElementById('codigo-simple-hint') as HTMLElement;
        const codigoTrnInput = document.getElementById('codigo-trn') as HTMLInputElement;
        const codigoConsumoInput = document.getElementById('codigo-consumo') as HTMLInputElement;

        // Listener para mostrar los inputs según el tipo seleccionado
        tipoSelect.addEventListener('change', (e) => {
          const tipo = (e.target as HTMLSelectElement).value;

          // Ocultar todos los containers
          codigoSimpleContainer.style.display = 'none';
          codigoConsumoContainer.style.display = 'none';

          // Limpiar valores
          codigoSimpleInput.value = '';
          codigoTrnInput.value = '';
          codigoConsumoInput.value = '';

          if (tipo === 'consumo') {
            // Mostrar los dos inputs para Consumo
            codigoConsumoContainer.style.display = 'block';
          } else if (tipo === 'devolucion') {
            // Mostrar un solo input para Devolución
            codigoSimpleContainer.style.display = 'block';
            codigoSimpleLabel.textContent = 'Código EI:';
            codigoSimpleInput.placeholder = 'Ej: EI-12345';
            codigoSimpleHint.textContent = 'Ingresa el código de entrada de inventario';
          } else if (tipo === 'gasto') {
            // Mostrar un solo input para Gasto
            codigoSimpleContainer.style.display = 'block';
            codigoSimpleLabel.textContent = 'Código SRC:';
            codigoSimpleInput.placeholder = 'Ej: SRC-12345';
            codigoSimpleHint.textContent = 'Ingresa el código de solicitud de recursos';
          }
        });
      },
      preConfirm: () => {
        const tipoSelect = document.getElementById('tipo-consumo') as HTMLSelectElement;
        const codigoSimpleInput = document.getElementById('codigo-simple') as HTMLInputElement;
        const codigoTrnInput = document.getElementById('codigo-trn') as HTMLInputElement;
        const codigoConsumoInput = document.getElementById('codigo-consumo') as HTMLInputElement;

        const tipo = tipoSelect.value;

        if (!tipo) {
          Swal.showValidationMessage('Debes seleccionar un tipo de consumo');
          return false;
        }

        if (tipo === 'consumo') {
          const trn = codigoTrnInput.value.trim();
          const consumo = codigoConsumoInput.value.trim();

          if (!trn) {
            Swal.showValidationMessage('Debes ingresar el código TRN');
            return false;
          }

          if (!consumo) {
            Swal.showValidationMessage('Debes ingresar el código de consumo');
            return false;
          }

          return { tipo, codigoTrn: trn, codigoConsumo: consumo };
        } else {
          const codigo = codigoSimpleInput.value.trim();

          if (!codigo) {
            Swal.showValidationMessage('Debes ingresar el código de validación');
            return false;
          }

          return { tipo, codigo };
        }
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        this.confirmarConsumo(item, result.value);
      }
    });
  }

  confirmarConsumo(item: any, datos: any): void {
    const tipoTexto = datos.tipo === 'consumo' ? 'Consumo' :
      datos.tipo === 'gasto' ? 'Gasto' : 'Devolución';

    let codigosHtml = '';
    if (datos.tipo === 'consumo') {
      codigosHtml = `
      <p><strong>Código TRN:</strong> ${datos.codigoTrn}</p>
      <p><strong>Código Consumo:</strong> ${datos.codigoConsumo}</p>
    `;
    } else {
      codigosHtml = `<p><strong>Código:</strong> ${datos.codigo}</p>`;
    }

    Swal.fire({
      title: '¿Confirmar consumo?',
      html: `
      <div class="text-start">
        <p><strong>Tipo:</strong> ${tipoTexto}</p>
        ${codigosHtml}
      </div>
    `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, confirmar',
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (result.isConfirmed) {
        this.procesarConsumo(item, datos);
      }
    });
  }

  private procesarConsumo(item: any, datos: any): void {
    this.loading = true;

    this.subscription.add(
      this.inconsistenciasService.consumirInconsistencia(
        item.id_inconsistencia,
        datos
      )
        .pipe(
          finalize(() => {
            this.loading = false;
          })
        )
        .subscribe({
          next: (response) => {
            Swal.fire({
              title: 'Éxito',
              text: 'Consumo registrado correctamente',
              icon: 'success',
              confirmButtonText: 'OK'
            });
            this.cargarDatos();
          },
          error: (error) => {
            const mensaje = error?.error?.message || 'No se pudo procesar el consumo';
            Swal.fire({
              title: 'Error',
              text: mensaje,
              icon: 'error',
              confirmButtonText: 'OK'
            });
          }
        })
    );
  }
}