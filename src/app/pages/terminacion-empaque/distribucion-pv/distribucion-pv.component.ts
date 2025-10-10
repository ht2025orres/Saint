import { Component, OnInit } from '@angular/core';
import { Modal } from 'bootstrap';
import { TerminacionEmpaqueService } from 'src/app/services/terminacion-empaque.service';
import { PaginationService, FilterFunction } from 'src/app/shared/pagination/pagination.service';
import { lastValueFrom } from 'rxjs';
import Swal from 'sweetalert2';
import { AuthService } from './../../../services/auth.service';

@Component({
  selector: 'app-distribucion-pv',
  templateUrl: './distribucion-pv.component.html',
  styleUrls: ['./distribucion-pv.component.css']
})
export class DistribucionPvComponent implements OnInit {
  paginatorId = 'distribucion-pv-paginator';
  itemsPaginatorId = 'items-modal-paginator';
  usuario_que_registra: number;

  opSeleccionada: number | null = null;
  assignmentPayload: any[] = []; // payload validado listo para enviar a la API (cuando lo implementes)
  
  // Datos originales y filtrados
  opsConPvs: any[] = []; // Datos originales completos
  currentOps: any[] = []; // Datos mostrados después de filtros y paginación

  // Items para el modal
  items: any[] = []; // Todos los items originales
  currentItems: any[] = []; // Items mostrados después de filtros y paginación
  pvSeleccionada: string | null = null;
  ocCliente: string | null = null;
  
  // Filtros
  filters = {
    busqueda: ''
  };

  // Filtros para items en el modal
  itemFilters = {
    busqueda: '',
    soloDisponibles: false
  };

  pvFilters: { [opCodigo: string]: string } = {};
  paginatedPvs: { [opCodigo: string]: any[] } = {};

  Math = Math;

  constructor(
    private terminacionEmpaqueService: TerminacionEmpaqueService,
    public paginationService: PaginationService,
    public AuthService: AuthService
  ) {}

  ngOnInit(): void {
    this.terminacionEmpaqueService.obtenerOPsPendientes().subscribe({
      next: (ops) => {
        this.cargarPVsParaOPs(ops);
      },
      error: () => Swal.fire('Error', 'No se pudieron cargar las OPs', 'error')
    });
  }

  async cargarPVsParaOPs(ops: any[]): Promise<void> {
    const peticiones = ops.map(async op => {
      try {
        // Esperar la respuesta de los PVs
        const pvsResp = await this.terminacionEmpaqueService.listarPVsPorOPDesdeApiLaravel(op).toPromise();
        const cadenaPVs: string = pvsResp[0]?.pvs || '';
        const numerosPV = (cadenaPVs.match(/\d+/g) || []).map(pv => ({
          numero_pv: pv,
          tieneDisponibles: false
        }));

        // Esperar el resultado de si tiene items pendientes
        const tieneItemsPendientes = await lastValueFrom(
          this.terminacionEmpaqueService.verificarSiOPTieneItemsPendientes(op)
        );

        return {
          codigo: op,
          pvs: numerosPV,
          tieneDisponibles: tieneItemsPendientes
        };
      } catch (error) {
        console.error(`Error procesando OP ${op}:`, error);
        return {
          codigo: op,
          pvs: [],
          tieneDisponibles: false
        };
      }
    });

    // Esperar a que todas las peticiones terminen
    const resultados = await Promise.all(peticiones);

    // Ordenar: primero los que tienen disponibles
    this.opsConPvs = resultados.sort((a, b) => {
      const dispoA = typeof a.tieneDisponibles === 'object' && a.tieneDisponibles !== null && 'data' in a.tieneDisponibles
        ? a.tieneDisponibles.data === true ? 1 : 0
        : a.tieneDisponibles === true ? 1 : 0;
      const dispoB = typeof b.tieneDisponibles === 'object' && b.tieneDisponibles !== null && 'data' in b.tieneDisponibles
        ? b.tieneDisponibles.data === true ? 1 : 0
        : b.tieneDisponibles === true ? 1 : 0;

      console.log('Comparando:', a.codigo, dispoA, 'vs', b.codigo, dispoB);

      return dispoB - dispoA;
    });

    console.log('OPs con PVs:', this.opsConPvs);
    
    // Inicializar paginación
    this.inicializarPaginacion();

    // Inicializar paginadores por PV para cada OP
    this.opsConPvs.forEach(op => {
      // guardar copia "original" (para filtrar sin perder datos)
      op.pvsOriginal = Array.isArray(op.pvs) ? [...op.pvs] : [];
      // Inicializar paginador de PVs para esta OP
      this.initPaginadorPV(op);
    });
  }

  /**
   * Inicializa el paginador con los datos cargados
   */
  inicializarPaginacion(): void {
    if (this.opsConPvs.length > 0) {
      this.paginationService.initializePaginator(
        this.paginatorId,
        this.opsConPvs,
        10, // Tamaño de página inicial
        this.filters,
        this.filterFunction
      ).subscribe(state => {
        this.currentOps = state.currentData;
      });
    }
  }

  initPaginadorPV(op: any, pageSize = 5): void {
    const instanceId = 'pv_' + op.codigo;
    // asegúrate de tener un filtro vacío inicial
    this.pvFilters[op.codigo] = this.pvFilters[op.codigo] || '';

    // inicializa el paginador para las PVs de esta OP
    this.paginationService
      .initializePaginator(
        instanceId,
        op.pvsOriginal || [],
        pageSize,
        { busqueda: this.pvFilters[op.codigo] || '' },
        this.pvFilterFunction
      )
      .subscribe(state => {
        // state.currentData contiene la página actual (pvs filtradas)
        op.pvsPaged = state.currentData || [];
      });
  }

  /**
   * Inicializa la paginación de items en el modal
   */
  initializarPaginacionItems(): void {
    if (this.items.length > 0) {
      this.paginationService.initializePaginator(
        this.itemsPaginatorId,
        this.items,
        5, // Tamaño de página inicial
        this.itemFilters,
        this.itemsFilterFunction
      ).subscribe(state => {
        this.currentItems = state.currentData || [];
      });
    }
  }

  /**
   * Aplica los filtros de búsqueda y actualiza la paginación
   */
  applyFilters(): void {
    this.paginationService.updatePaginator(
      this.paginatorId,
      this.opsConPvs,
      undefined, // Mantener tamaño de página actual
      this.filters,
      this.filterFunction
    );
    
    const state = this.paginationService.getPaginatorState(this.paginatorId);
    this.currentOps = state?.currentData || [];
  }

  /**
   * Aplica los filtros en el modal de items
   */
  applyItemFilters(): void {
    this.paginationService.updatePaginator(
      this.itemsPaginatorId,
      this.items,
      undefined, // Mantener tamaño de página actual
      this.itemFilters,
      this.itemsFilterFunction
    );
    
    const state = this.paginationService.getPaginatorState(this.itemsPaginatorId);
    this.currentItems = state?.currentData || [];
  }

  filtrarPVs(op: any): void {
    const instanceId = 'pv_' + op.codigo;
    const filtro = { busqueda: this.pvFilters[op.codigo] || '' };

    // updatePaginator tiene la misma firma que usaste para OPs:
    this.paginationService.updatePaginator(
      instanceId,
      op.pvsOriginal || [],
      undefined, // mantener pageSize actual
      filtro,
      this.pvFilterFunction
    );

    // actualizar el array que iteras en la vista
    const state = this.paginationService.getPaginatorState(instanceId);
    op.pvsPaged = state?.currentData || [];
  }

  /**
   * Función de filtrado para el paginador principal
   */
  filterFunction: FilterFunction = (item: any, filtros) => {
    const texto = filtros.busqueda.toLowerCase().trim();
    if (!texto) return true;
    
    // Buscar en el código de la OP
    return item.codigo?.toLowerCase().includes(texto);
  };

  /**
   * Función de filtrado para PVs
   */
  pvFilterFunction: FilterFunction = (pv: any, filtros: any) => {
    const texto = (filtros?.busqueda || '').toString().toLowerCase().trim();
    if (!texto) return true;
    // pv puede ser string o objeto { numero_pv: '...' }
    const numero = (pv.numero_pv ?? pv).toString().toLowerCase();
    return numero.includes(texto);
  };

  /**
   * Función de filtrado para items en el modal
   */
  itemsFilterFunction: FilterFunction = (item: any, filtros) => {
    // Filtro por texto de búsqueda
    const texto = (filtros.busqueda || '').toLowerCase().trim();
    let pasaBusqueda = true;
    
    if (texto) {
      const descripcionCorta = (item.descripcion_corta || '').toLowerCase();
      const descripcion = (item.descripcion || '').toLowerCase();
      const itemId = `${item.f120_id}-${item.id_color}-${item.id_talla}`.toLowerCase();
      const cliente = (item.cliente || '').toLowerCase();
      const color = (item.id_color || '').toLowerCase();
      const talla = (item.id_talla || '').toLowerCase();
      
      pasaBusqueda = descripcionCorta.includes(texto) ||
                   descripcion.includes(texto) ||
                   itemId.includes(texto) ||
                   cliente.includes(texto) ||
                   color.includes(texto) ||
                   talla.includes(texto);
    }

    // Filtro por disponibilidad
    let pasaDisponibilidad = true;
    if (filtros.soloDisponibles) {
      const cantidadRecibida = parseFloat(String(item.cantidad_recibida || 0)) || 0;
      const cantidadAsignada = parseFloat(String(item.cantidad_asignada || 0)) || 0;
      const cantidadRequerida = parseFloat(String(item.cantidad || 0)) || 0;

      // Disponible en la OP
      const disponibleOP = cantidadRecibida - cantidadAsignada;

      // Faltante respecto al requerido
      const faltantePorRequerido = cantidadRequerida - cantidadAsignada;

      // Disponible real
      const disponible = Math.max(0, Math.min(disponibleOP, faltantePorRequerido));

      pasaDisponibilidad = disponible > 0;
    }

    return pasaBusqueda && pasaDisponibilidad;
  };

  toggleExpandirOP(op: any): void {
    if (!op.expandir) {
      op.expandir = true;
      op.cargando = true;

      const pvs = op.pvsOriginal; // lista completa
      const itemsPorPV: any[] = [];
      let llamadasFinalizadas = 0;

      for (const pv of pvs) {
        this.terminacionEmpaqueService
          .listarItemsDePVDesdeApiLaravel(pv.numero_pv)
          .subscribe({
            next: (items) => {
              items = items.map((it: any) => ({
                ...it,
                cantidad_recibida: 0, // valor inicial que el usuario digitará
                valido: null // control visual
              }));
              itemsPorPV.push({
                numero_pv: pv.numero_pv,
                items,
                numero_op: op.codigo
              });

              llamadasFinalizadas++;

              if (llamadasFinalizadas === pvs.length) {
                // Verificamos disponibilidad
                this.terminacionEmpaqueService
                  .verificarItemsPendientesDePV(itemsPorPV)
                  .subscribe({
                    next: (resultado) => {
                      resultado.data.forEach((pvResultado: any) => {
                        const hayDisponibles = Array.isArray(pvResultado.items_validados)
                          ? pvResultado.items_validados.some(
                              (item: any) => item.disponible === true
                            )
                          : false;

                        const pvIndex = op.pvsOriginal.findIndex(
                          p => p.numero_pv === pvResultado.numero_pv
                        );

                        if (pvIndex !== -1) {
                          op.pvsOriginal[pvIndex].tieneDisponibles = hayDisponibles;
                        }
                      });

                      // Ordenamos PVs: disponibles primero
                      op.pvsOriginal.sort((a, b) => {
                        return (b.tieneDisponibles ? 1 : 0) - (a.tieneDisponibles ? 1 : 0);
                      });

                      // Regeneramos paginación
                      this.filtrarPVs(op);

                      op.cargando = false;
                    },
                    error: (err) => {
                      console.error('Error al verificar pendientes', err);
                      op.cargando = false;
                    }
                  });
              }
            },
            error: (err) => {
              console.error('Error al listar ítems de PV', err);
              llamadasFinalizadas++;
              if (llamadasFinalizadas === pvs.length) {
                op.cargando = false;
              }
            }
          });
      }
    } else {
      op.expandir = false;
    }
  }

  // DistribucionPvComponent (o RecepcionOpComponent si es allí)
  async verItemsDePV(op: number, pv: string): Promise<void> {
    this.pvSeleccionada = pv;
    this.opSeleccionada = op;
    try {
      const items = await this.terminacionEmpaqueService
        .listarItemsDePVDesdeApiLaravel(+pv, op)
        .toPromise();

      // Normalizar y preparar campos útiles para la UI
      this.items = items.map(i => {
        const cantidadTeorica = parseFloat(String(i.cantidad || 0)) || 0;
        const cantidadRecibida = parseFloat(String(i.cantidad_recibida || i.cantidad_recibida_total || 0)) || 0;
        const cantidadAsignada = parseFloat(String(i.cantidad_asignada || 0)) || 0;

        return {
          ...i,
          cantidad: cantidadTeorica,                 // cantidad teórica por fila (número)
          cantidad_recibida: cantidadRecibida,       // total recibido local (número)
          cantidad_asignada: cantidadAsignada,       // ya asignado (número)
          cantidad_a_asignar: 0                       // <-- valor que el usuario ingresará (empieza en 0)
        };
      });

      // Reinicializar filtros del modal
      this.itemFilters = {
        busqueda: '',
        soloDisponibles: false
      };

      // Inicializar paginación de items
      this.initializarPaginacionItems();

      this.pvSeleccionada = pv;
      this.ocCliente = items[0]?.oc_cliente || 'N/A';

      const modalEl = document.getElementById('itemsModal');
      if (modalEl) {
        const modal = new Modal(modalEl);
        modal.show();
      }
    } catch (err) {
      Swal.fire('Error', 'No se pudieron cargar los ítems de la PV', 'error');
      console.error('Error al cargar ítems de PV', op, pv, err);
    }
  }

  /** --------------------
   * Validaciones para iconos
   * -------------------- */
  esCantidadValida(item: any): boolean {
    const asignar = Number(item.cantidad_a_asignar) || 0;
    if (asignar <= 0) return false;

    const limiteTeorico = Number(item.cantidad) || 0;
    // disponible = lo recibido menos lo ya asignado en esta PV
    const disponible = Math.max(0, (Number(item.cantidad_recibida) || 0) - (Number(item.cantidad_asignada) || 0));

    return asignar <= limiteTeorico && asignar <= disponible;
  }

  excedeTeorica(item: any): boolean {
    const asignar = Number(item.cantidad_a_asignar) || 0;
    const limiteTeorico = Number(item.cantidad) || 0;
    return asignar > limiteTeorico;
  }

  excedeDisponible(item: any): boolean {
    const asignar = Number(item.cantidad_a_asignar) || 0;
    const disponible = Math.max(0, (Number(item.cantidad_recibida) || 0) - (Number(item.cantidad_asignada) || 0));
    return asignar > disponible;
  }

  /**
   * Calcula la cantidad disponible para un item
   * Toma en cuenta que no se debe asignar más de lo que requiere (item.cantidad).
   */
  getCantidadDisponible(item: any): number {
    const cantidadRecibida = parseFloat(String(item.cantidad_recibida || 0)) || 0;
    const cantidadAsignada = parseFloat(String(item.cantidad_asignada || 0)) || 0;
    const cantidadRequerida = parseFloat(String(item.cantidad || 0)) || 0;

    // Disponible en la OP
    const disponibleOP = cantidadRecibida - cantidadAsignada;

    // Disponible real considerando lo que falta por cubrir
    const faltantePorRequerido = cantidadRequerida - cantidadAsignada;

    return Math.max(0, Math.min(disponibleOP, faltantePorRequerido));
  }

  /**
   * Cuenta los items que todavía pueden recibir asignación
   */
  getItemsConCantidadParaAsignar(): number {
    return (this.items || []).filter(item => this.getCantidadDisponible(item) > 0).length;
  }

  /**
   * Verifica si hay items válidos para guardar
   */
  tieneItemsValidosParaGuardar(): boolean {
    return (this.items || []).some(item => this.esCantidadValida(item));
  }

  /**
   * Calcula el máximo permitido para un item
   */
  getMaximoPermitido(item: any): number {
    return Math.min(item.cantidad || 0, this.getCantidadDisponible(item));
  }

    /* -------------------
    Helpers y acciones
    ------------------- */
  roundValue(value: number, decimals = 2): number {
    if (isNaN(value) || value === null) return 0;
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

  /**
   * Asigna el máximo permitido solo a la fila dada
   */
  asignarMaximoItem(item: any): void {
    const maximo = this.getMaximoPermitido(item);
    item.cantidad_a_asignar = this.roundValue(maximo, 2);
    // actualizar paginación/filtrado si es necesario
    this.applyItemFilters();
  }

  /**
   * Asigna máximos para todas las filas visibles / cargadas
   * force = true -> sobrescribe cualquier valor ya digitado
   * force = false -> solo asigna donde cantidad_a_asignar === 0
   */
  asignarMaximos(force = false): void {
    if (!this.items || !this.items.length) return;
    this.items.forEach(item => {
      const disponible = this.getCantidadDisponible(item);
      if (disponible <= 0) return;
      if (force || !item.cantidad_a_asignar || Number(item.cantidad_a_asignar) === 0) {
        item.cantidad_a_asignar = this.roundValue(this.getMaximoPermitido(item), 2);
      } else {
        // si ya tiene valor y no forzamos, lo dejamos
      }
    });
    // refrescar paginación/filtrado
    this.applyItemFilters();
  }

  /**
   * Prepara y valida las asignaciones usando el servicio Angular.
   * Por ahora NO hace POST a la API: solo genera y valida el payload en el servicio.
   */
  prepararYValidarAsignaciones(): void {
    const itemsParaEnviar = (this.items || [])
      .filter(item => Number(item.cantidad_a_asignar) > 0)
      .map(item => ({
        ...item
        // aquí puedes seleccionar solo los campos que necesites
      }));

    if (itemsParaEnviar.length === 0) {
      Swal.fire('Atención', 'No hay ítems con cantidad a asignar.', 'warning');
      return;
    }

    this.usuario_que_registra = this.AuthService.user.id;

    this.terminacionEmpaqueService
      .registrarAsignaciones(itemsParaEnviar, this.pvSeleccionada, this.opSeleccionada, this.usuario_que_registra)
      .subscribe({
        next: (res: any) => {
          // Si la API solo devuelve message, mostramos eso directamente
          if (res.message) {
            Swal.fire('Éxito', res.message, 'success');
            return;
          }

          // Si en algún momento tu backend devuelve validación con items
          if (res.valid !== undefined) {
            if (!res.valid) {
              const errores = (res.items || [])
                .filter((r: any) => !r.valid)
                .map((r: any) => `Item ${r.f120_id || r.referencia || ''}: ${r.errors.join(', ')}`)
                .join('<br/>');

              Swal.fire({
                title: 'Errores en asignaciones',
                html: errores || 'Hay errores en algunas asignaciones',
                icon: 'error',
                width: 700
              });

              this.assignmentPayload = res.items || [];
            } else {
              this.assignmentPayload = res.items || [];
              Swal.fire({
                title: 'Asignaciones válidas',
                html: `Se validaron ${this.assignmentPayload.length} ítems.`,
                icon: 'success'
              }).then(() => {
                window.location.reload();
              });
            }
          }
        },
        error: (err) => {
          console.error('Error registrando asignaciones:', err);
          Swal.fire('Error', 'No se pudo registrar las asignaciones en el servicio.', 'error');
        }
      });
  }
}