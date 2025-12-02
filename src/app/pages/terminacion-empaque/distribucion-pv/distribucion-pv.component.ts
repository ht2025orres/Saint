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

  verPaginatorId = 'verificacion-items-paginator';
  pvVerificacion: string | null = null;
  itemsVerificacion: any[] = [];
  currentVerItems: any[] = [];

  verFilters = {
    busqueda: '',
    soloPendientes: false
  };

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
    console.log('ROL VALIDO:', this.AuthService.hasRole('Gestion empacadores (Terminación y Empaque)'));
  }

  tieneRolEmpacadores(): boolean {
    // Si tiene el rol de Distribuidor PV Directo, retorna false siempre
    if (this.AuthService.hasRole('Distribuidor PV Directo (Terminación y Empaque)')) {
      return false;
    }

    // En caso contrario, evalúa normalmente si tiene el rol de Gestión empacadores
    return this.AuthService.hasRole('Gestion empacadores (Terminación y Empaque)');
  }

  // ===== MÉTODOS PARA VERIFICACIÓN =====

  /**
   * Abre el modal de verificación con los items asignados de una PV
   */
  async abrirVerificacion(op: number, pv: string): Promise<void> {
    this.pvVerificacion = pv;
    this.opSeleccionada = op;

    try {
      // Obtener items con asignaciones de esta PV
      const items = await this.terminacionEmpaqueService
        .obtenerItemsConAsignaciones(op, pv)
        .toPromise();

        this.itemsVerificacion = items.map(i => ({
          ...i,
          cantidad_fisica: Number(i.cantidad_asignada) || 0, // Inicialmente igual a lo asignado
          nota_inconsistencia: '',
          verificado: (Number(i.cantidad_asignada) || 0) <= (Number(i.cantidad_verificada) || 0) // Comparación numérica real
        }));

      console.log('Items para verificación:', this.itemsVerificacion);

      // Reinicializar filtros
      this.verFilters = {
        busqueda: '',
        soloPendientes: false
      };

      // Inicializar paginación
      this.initializarPaginacionVerificacion();

      // Abrir modal
      const modalEl = document.getElementById('verificacionModal');
      if (modalEl) {
        const modal = new Modal(modalEl);
        modal.show();
      }
    } catch (err) {
      Swal.fire('Error', 'No se pudieron cargar los items para verificación', 'error');
      console.error('Error al cargar items para verificación:', err);
    }
  }

  /**
   * Inicializa la paginación para items de verificación
   */
  initializarPaginacionVerificacion(): void {
    if (this.itemsVerificacion.length > 0) {
      this.paginationService.initializePaginator(
        this.verPaginatorId,
        this.itemsVerificacion,
        10,
        this.verFilters,
        this.verFilterFunction
      ).subscribe(state => {
        this.currentVerItems = state.currentData || [];
      });
    }
  }

  /**
   * Aplica filtros en el modal de verificación
   */
  applyVerFilters(): void {
    this.paginationService.updatePaginator(
      this.verPaginatorId,
      this.itemsVerificacion,
      undefined,
      this.verFilters,
      this.verFilterFunction
    );
    
    const state = this.paginationService.getPaginatorState(this.verPaginatorId);
    this.currentVerItems = state?.currentData || [];
  }

  /**
   * Función de filtrado para verificación
   */
  verFilterFunction: FilterFunction = (item: any, filtros) => {
    // Filtro por texto
    const texto = (filtros.busqueda || '').toLowerCase().trim();
    let pasaBusqueda = true;
    
    if (texto) {
      const descripcionCorta = (item.descripcion_corta || '').toLowerCase();
      const descripcion = (item.descripcion || '').toLowerCase();
      const itemId = `${item.f120_id}-${item.id_color}-${item.id_talla}`.toLowerCase();
      const color = (item.id_color || '').toLowerCase();
      const talla = (item.id_talla || '').toLowerCase();
      
      pasaBusqueda = descripcionCorta.includes(texto) ||
                    descripcion.includes(texto) ||
                    itemId.includes(texto) ||
                    color.includes(texto) ||
                    talla.includes(texto);
    }

    // Filtro por pendientes
    let pasaPendientes = true;
    if (filtros.soloPendientes) {
      pasaPendientes = !item.verificado;
    }

    return pasaBusqueda && pasaPendientes;
  };

  /**
   * Calcula la diferencia entre cantidad física y asignada
   */
  getDiferencia(item: any): number {
    const fisica = parseFloat(String(item.cantidad_fisica || 0)) || 0;
    const asignada = parseFloat(String(item.cantidad_asignada || 0)) || 0;
    return fisica - asignada;
  }

  /**
   * Valida si un item puede ser verificado
   */
  esVerificacionValida(item: any): boolean {
    const fisica = parseFloat(String(item.cantidad_fisica || 0)) || 0;
    const asignada = parseFloat(String(item.cantidad_asignada || 0)) || 0;
    
    // Si hay diferencia, debe tener nota
    if (fisica !== asignada) {
      return item.nota_inconsistencia && item.nota_inconsistencia.trim().length > 0;
    }
    
    return fisica >= 0 && fisica <= asignada;
  }

  /**
   * Marca un item como verificado
   */
  verificarItem(item: any): void {
    if (!this.esVerificacionValida(item)) {
      Swal.fire('Atención', 'Debes agregar una nota si hay diferencia en la cantidad', 'warning');
      return;
    }
    
    item.verificado = true;
    this.applyVerFilters();
  }

  /**
   * Revierte la verificación de un item
   */
  desverificarItem(item: any): void {
    item.verificado = false;
    this.applyVerFilters();
  }

  /**
   * Cuenta items verificados
   */
  getItemsVerificados(): number {
    return (this.itemsVerificacion || []).filter(i => i.verificado).length;
  }

  /**
   * Verifica si todos los items están verificados
   */
  todosVerificados(): boolean {
    if (!this.itemsVerificacion || this.itemsVerificacion.length === 0) return false;
    return this.itemsVerificacion.every(i => i.verificado);
  }

  /**
   * Confirma la verificación y envía los datos al backend
   */
  confirmarVerificacion(): void {
    if (!this.todosVerificados()) {
      Swal.fire('Atención', 'Debes verificar todos los items antes de confirmar', 'warning');
      return;
    }

    const itemsConDiferencia = this.itemsVerificacion.filter(i => this.getDiferencia(i) !== 0);
    
    if (itemsConDiferencia.length > 0) {
      Swal.fire({
        title: 'Confirmar inconsistencias',
        html: `Se encontraron <strong>${itemsConDiferencia.length}</strong> items con diferencias.<br>¿Deseas continuar?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, confirmar',
        cancelButtonText: 'Cancelar'
      }).then(result => {
        if (result.isConfirmed) {
          this.enviarVerificacion();
        }
      });
    } else {
      this.enviarVerificacion();
    }
  }

  // /**
  //  * Envía la verificación al backend
  //  */
  // enviarVerificacion(): void {
  //   const payload = this.itemsVerificacion.map(item => ({
  //     f120_id: item.f120_id,
  //     id_color: item.id_color,
  //     id_talla: item.id_talla,
  //     cantidad_asignada: item.cantidad_asignada,
  //     cantidad_fisica: item.cantidad_fisica,
  //     nota_inconsistencia: item.nota_inconsistencia || null,
  //     diferencia: this.getDiferencia(item)
  //   }));

  //   const usuario = this.AuthService.user.id;

  //   this.terminacionEmpaqueService
  //     .registrarVerificacionAsignaciones(payload, this.pvVerificacion, this.opSeleccionada, usuario)
  //     .subscribe({
  //       next: (res: any) => {
  //         Swal.fire('Éxito', res.message || 'Verificación registrada correctamente', 'success')
  //           .then(() => {
  //             // Cerrar modal
  //             const modalEl = document.getElementById('verificacionModal');
  //             if (modalEl) {
  //               const modal = Modal.getInstance(modalEl);
  //               modal?.hide();
  //             }
              
  //             // Recargar datos
  //             this.ngOnInit();
  //           });
  //       },
  //       error: (err) => {
  //         console.error('Error al registrar verificación:', err);
  //         Swal.fire('Error', 'No se pudo registrar la verificación', 'error');
  //       }
  //     });
  // }

async cargarPVsParaOPs(ops: any[]): Promise<void> {
  const peticiones = ops.map(async op => {
    try {
      // ✅ Obtener PVs de Laravel
      const pvsResp: { pvs?: string, clientes?: any[] } | Array<{ pvs?: string, clientes?: any[] }> = await this.terminacionEmpaqueService
        .listarPVsPorOPDesdeApiLaravel(op)
        .toPromise();

      console.log('PVs para OP', op, pvsResp);

      // ✅ Normalizar siempre string y obtener clientes
      let cadenaPVs = '';
      let clientes = [];
      if (Array.isArray(pvsResp)) {
        cadenaPVs = pvsResp[0]?.pvs || '';
        clientes = pvsResp[0]?.clientes || [];
      } else {
        cadenaPVs = (pvsResp as { pvs?: string, clientes?: any[] })?.pvs || '';
        clientes = (pvsResp as { pvs?: string, clientes?: any[] })?.clientes || [];
      }

      // ✅ Crear un mapa de PV -> Cliente para acceso rápido
      const pvClienteMap = new Map<string, any>();
      clientes.forEach(cliente => {
        cliente.pvs.forEach((pvNum: number) => {
          pvClienteMap.set(pvNum.toString(), {
            nit: cliente.nit,
            nombre: cliente.nombre
          });
        });
      });

      // ✅ Extraer números de PVs y asignar cliente correspondiente
      const numerosPV = (cadenaPVs.match(/\d+/g) || []).map(pv => ({
        numero_pv: pv,
        tieneDisponibles: false, // Inicialmente false
        tieneAsignaciones: false,
        cliente: pvClienteMap.get(pv) || null
      }));

      // ✅ Consultar si OP tiene ítems pendientes
      const tieneItemsPendientes = await lastValueFrom(
        this.terminacionEmpaqueService.verificarSiOPTieneItemsPendientes(op)
      );
      
      console.log('Items pendientes para OP', op, tieneItemsPendientes['data']);

      // ✅ NUEVO: Verificar disponibilidad para cada PV individualmente
      if (numerosPV.length > 0) {
        await this.verificarDisponibilidadPorPV(op, numerosPV);
      }

      // ✅ NUEVO: Precargar información de asignaciones pendientes
      await this.preCargarAsignacionesPendientes(op, numerosPV);
      
      return {
        codigo: op,
        pvs: numerosPV,
        pvsOriginal: [...numerosPV],
        tieneDisponibles: tieneItemsPendientes['data'],
        clientes: clientes,
        expandir: false,
        cargando: false
      };

    } catch (error) {
      console.error(`Error procesando OP ${op}:`, error);
      return {
        codigo: op,
        pvs: [],
        pvsOriginal: [],
        tieneDisponibles: false,
        clientes: [],
        expandir: false,
        cargando: false
      };
    }
  });

  // ✅ Esperar todas las peticiones
  const resultados = await Promise.all(peticiones);

  // ✅ Ordenar OPs: primero las que tienen disponibilidad
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

  // ✅ Inicializar paginación
  this.inicializarPaginacion();

  // ✅ Inicializar paginadores por OP
  this.opsConPvs.forEach(op => {
    this.initPaginadorPV(op);
  });
}
/**
 * Verifica la disponibilidad de items para cada PV individualmente
 */
private async verificarDisponibilidadPorPV(op: number, pvs: any[]): Promise<void> {
  const peticiones = pvs.map(async (pv) => {
    try {
      // ✅ Cargar items de la PV específica
      const items = await lastValueFrom(
        this.terminacionEmpaqueService.listarItemsDePVDesdeApiLaravel(pv.numero_pv, op)
      );
      
      console.log(`Items cargados para PV ${pv.numero_pv}:`, items);

      // ✅ Verificar si hay al menos un item con disponibilidad
      const tieneDisponibles = items.some((item: any) => {
        const cantidadAsignada = parseFloat(String(item.cantidad_asignada || 0)) || 0;
        
        // ✅ Calcular cantidad en empaque según la nueva lógica
        let cantidadEmpaque = 0;
        
        if (Array.isArray(item.ubicaciones_distintas) && item.ubicaciones_distintas.length > 0) {
          // ✅ CON ubicaciones distintas: buscar específicamente empaque
          const ubicacionEmpaque = item.ubicaciones_distintas.find(
            u => u.ubicacion?.toLowerCase().includes('empaque')
          );
          if (ubicacionEmpaque) {
            cantidadEmpaque = parseFloat(String(ubicacionEmpaque.cantidad || 0)) || 0;
          }
          // Si no hay ubicación empaque en el array, cantidadEmpaque queda en 0
        } else {
          // ✅ SIN ubicaciones distintas: toda la cantidad_recibida_total está en empaque
          cantidadEmpaque = parseFloat(String(item.cantidad_recibida_total || 0)) || 0;
        }

        const disponible = cantidadEmpaque - cantidadAsignada;
        
        console.log(`Item ${item.f120_id}-${item.id_color}-${item.id_talla}:`, {
          cantidadEmpaque,
          cantidadAsignada,
          disponible,
          tieneUbicacionesDistintas: Array.isArray(item.ubicaciones_distintas) && item.ubicaciones_distintas.length > 0,
          cantidadRecibidaTotal: item.cantidad_recibida_total
        });

        return disponible > 0;
      });

      pv.tieneDisponibles = tieneDisponibles;
      console.log(`PV ${pv.numero_pv} - Tiene disponibles:`, tieneDisponibles);

    } catch (error) {
      console.error(`Error verificando disponibilidad para PV ${pv.numero_pv}:`, error);
      pv.tieneDisponibles = false;
    }
  });

  await Promise.all(peticiones);
}

/**
 * Precarga información de asignaciones pendientes para una OP
 * SIN necesidad de cargar todos los items
 */
private async preCargarAsignacionesPendientes(op: number, pvs: any[]): Promise<void> {
  try {
    // ✅ Cargar items básicos para cada PV (solo lo necesario para la verificación)
    const itemsPorPV = await this.cargarItemsBasicosParaPVs(op, pvs);
    
    if (itemsPorPV.length > 0) {
      const resultado = await lastValueFrom(
        this.terminacionEmpaqueService.verificarItemsPendientesDePV(itemsPorPV)
      );

      resultado.data.forEach((pvResultado: any) => {
        const tieneAsignacionesSinVerificar = Array.isArray(pvResultado.items_validados)
          ? pvResultado.items_validados.some((item: any) => {
              const cantidadAsignada = parseFloat(item.asignado?.cantidad_asignada || '0');
              const cantidadVerificada = parseFloat(item.asignado?.cantidad_verificada || '0');
              
              // Tiene asignación pero NO está completamente verificada
              return cantidadAsignada > 0 && cantidadVerificada < cantidadAsignada;
            })
          : false;

        const pvIndex = pvs.findIndex(p => p.numero_pv === pvResultado.numero_pv);
        if (pvIndex !== -1) {
          pvs[pvIndex].tieneAsignaciones = tieneAsignacionesSinVerificar;
          console.log(`PV ${pvResultado.numero_pv} - Asignaciones pendientes:`, tieneAsignacionesSinVerificar);
        }
      });
    }
  } catch (error) {
    console.error(`Error precargando asignaciones para OP ${op}:`, error);
  }
}

/**
 * Carga información básica de items para las PVs (solo lo necesario para verificar asignaciones)
 */
private async cargarItemsBasicosParaPVs(op: number, pvs: any[]): Promise<any[]> {
  const itemsPorPV: any[] = [];
  
  const peticiones = pvs.map(async (pv) => {
    try {
      // ✅ Cargar items básicos de la PV
      const items = await lastValueFrom(
        this.terminacionEmpaqueService.listarItemsDePVDesdeApiLaravel(pv.numero_pv, op)
      );

      // ✅ Solo necesitamos la estructura básica para la verificación
      itemsPorPV.push({
        numero_pv: pv.numero_pv,
        items: items.map((item: any) => ({
          f120_id: item.f120_id,
          id_color: item.id_color,
          id_talla: item.id_talla,
          // Incluir solo campos necesarios para la verificación
          cantidad: item.cantidad,
          cantidad_recibida: item.cantidad_recibida,
          cantidad_asignada: item.cantidad_asignada
        })),
        numero_op: op
      });

    } catch (error) {
      console.error(`Error cargando items básicos para PV ${pv.numero_pv}:`, error);
      // ✅ Añadir estructura vacía para no romper la verificación
      itemsPorPV.push({
        numero_pv: pv.numero_pv,
        items: [],
        numero_op: op
      });
    }
  });

  await Promise.all(peticiones);
  return itemsPorPV;
}

/**
 * NUEVO MÉTODO: Verificar asignaciones pendientes para todas las PVs de una OP
 */
private async verificarAsignacionesPendientesOP(op: number, pvs: any[]): Promise<void> {
  try {
    const itemsPorPV = pvs.map(pv => ({
      numero_pv: pv.numero_pv,
      items: [], // No necesitamos los items, solo la estructura
      numero_op: op
    }));

    const resultado = await lastValueFrom(
      this.terminacionEmpaqueService.verificarItemsPendientesDePV(itemsPorPV)
    );

    resultado.data.forEach((pvResultado: any) => {
      const tieneAsignacionesSinVerificar = Array.isArray(pvResultado.items_validados)
        ? pvResultado.items_validados.some((item: any) => {
            const cantidadAsignada = parseFloat(item.asignado?.cantidad_asignada || '0');
            const cantidadVerificada = parseFloat(item.asignado?.cantidad_verificada || '0');
            
            // Tiene asignación pero NO está completamente verificada
            return cantidadAsignada > 0 && cantidadVerificada < cantidadAsignada;
          })
        : false;

      const pvIndex = pvs.findIndex(p => p.numero_pv === pvResultado.numero_pv);
      if (pvIndex !== -1) {
        pvs[pvIndex].tieneAsignaciones = tieneAsignacionesSinVerificar;
        console.log(`PV ${pvResultado.numero_pv} - Asignaciones pendientes:`, tieneAsignacionesSinVerificar);
      }
    });

  } catch (error) {
    console.error(`Error verificando asignaciones para OP ${op}:`, error);
  }
}

/**
 * Obtener nombres de clientes de una OP
 */
obtenerNombresClientes(op: any): string {
  if (!op.clientes || op.clientes.length === 0) {
    return '';
  }
  return op.clientes.map((c: any) => c.nombre).join(', ');
}

/**
 * Verificar si tiene múltiples clientes
 */
tieneMultiplesClientes(op: any): boolean {
  return op.clientes && op.clientes.length > 1;
}

/**
 * Obtener primer cliente
 */
obtenerPrimerCliente(op: any): any {
  return op.clientes && op.clientes.length > 0 ? op.clientes[0] : null;
}

/**
 * Obtener cantidad de clientes
 */
obtenerCantidadClientes(op: any): number {
  return op.clientes ? op.clientes.length : 0;
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
      
      // ✅ Recargar datos de disponibilidad al expandir
      this.verificarDisponibilidadPorPV(op.codigo, op.pvsOriginal)
        .then(() => {
          op.cargando = false;
          this.ordenarPVs(op);
          this.filtrarPVs(op);
        })
        .catch(() => {
          op.cargando = false;
          this.ordenarPVs(op);
          this.filtrarPVs(op);
        });
        
    } else {
      op.expandir = false;
    }
  }

/**
 * Ordena PVs basado en datos precargados
 */
private ordenarPVs(op: any): void {
  if (!op.pvsOriginal || !Array.isArray(op.pvsOriginal)) return;
  
  op.pvsOriginal.sort((a, b) => {
    // Prioridad 1: Asignaciones sin verificar
    if (a.tieneAsignaciones !== b.tieneAsignaciones) {
      return (b.tieneAsignaciones ? 1 : 0) - (a.tieneAsignaciones ? 1 : 0);
    }
    // Prioridad 2: Disponibles
    if (a.tieneDisponibles !== b.tieneDisponibles) {
      return (b.tieneDisponibles ? 1 : 0) - (a.tieneDisponibles ? 1 : 0);
    }
    // Prioridad 3: Orden numérico de PV
    return parseInt(a.numero_pv) - parseInt(b.numero_pv);
  });
}

  /**
   * Verifica si una OP tiene PVs con asignaciones pendientes de verificar
   */
  tienePVsConAsignacionesPendientes(op: any): boolean {
    if (!op.pvsOriginal || !Array.isArray(op.pvsOriginal)) return false;
    // console.log('Verificando asignaciones pendientes para OP', op.codigo, op.pvsOriginal, (op.pvsOriginal.some(pv => pv.tieneAsignaciones === true)));
    return op.pvsOriginal.some(pv => pv.tieneAsignaciones === true);
  }

  private async verificarAsignacionesDePVs(op: number, pvs: any[]): Promise<void> {
    const itemsPorPV = pvs.map(pv => ({
      numero_pv: pv.numero_pv,
      items: [],
      numero_op: op
    }));

    try {
      const resultado = await lastValueFrom(
        this.terminacionEmpaqueService.verificarItemsPendientesDePV(itemsPorPV)
      );

      resultado.data.forEach((pvResultado: any) => {
        const tieneAsignacionesSinVerificar = Array.isArray(pvResultado.items_validados)
          ? pvResultado.items_validados.some((item: any) => {
              const cantidadAsignada = parseFloat(item.asignado?.cantidad_asignada || '0');
              const cantidadVerificada = parseFloat(item.asignado?.cantidad_verificada || '0');
              return cantidadAsignada > 0 && cantidadVerificada < cantidadAsignada;
            })
          : false;

        const pvIndex = pvs.findIndex(p => p.numero_pv === pvResultado.numero_pv);
        if (pvIndex !== -1) {
          pvs[pvIndex].tieneAsignaciones = tieneAsignacionesSinVerificar;
        }
      });
    } catch (error) {
      console.error('Error verificando asignaciones:', error);
    }
  }

  enviarVerificacion(): void {
  const payload = this.itemsVerificacion.map(item => ({
    f120_id: item.f120_id,
    id_color: item.id_color,
    id_talla: item.id_talla,
    referencia: item.referencia,
    descripcion: item.descripcion,
    cantidad_asignada: item.cantidad_asignada,
    cantidad_fisica: item.cantidad_fisica,
    nota_inconsistencia: item.nota_inconsistencia || null,
    diferencia: this.getDiferencia(item)
  }));

  const usuario = this.AuthService.user.id;

  this.terminacionEmpaqueService
    .registrarVerificacionAsignaciones(payload, this.pvVerificacion, this.opSeleccionada, usuario)
    .subscribe({
      next: (res: any) => {
        Swal.fire('Éxito', res.message || 'Verificación registrada correctamente', 'success')
          .then(() => {
            // Cerrar modal
            const modalEl = document.getElementById('verificacionModal');
            if (modalEl) {
              const modal = Modal.getInstance(modalEl);
              modal?.hide();
            }
            
            // ✅ Actualizar estado local de la PV para que desaparezca el botón
            const op = this.opsConPvs.find(o => o.codigo === this.opSeleccionada);
            if (op && op.pvsOriginal) {
              const pv = op.pvsOriginal.find(p => p.numero_pv === this.pvVerificacion);
              if (pv) {
                pv.tieneAsignaciones = false; // Ya no tiene asignaciones pendientes
              }
              this.filtrarPVs(op); // Refrescar vista
            }
          });
      },
      error: (err) => {
        console.error('Error al registrar verificación:', err);
        Swal.fire('Error', 'No se pudo registrar la verificación', 'error');
      }
    });
}

  // DistribucionPvComponent (o RecepcionOpComponent si es allí)
  async verItemsDePV(op: number, pv: string): Promise<void> {
    this.pvSeleccionada = pv;
    this.opSeleccionada = op;

    try {
      const items = await this.terminacionEmpaqueService
        .listarItemsDePVDesdeApiLaravel(+pv, op)
        .toPromise();

      // ✅ Mostrar todos los ítems, pero calcular disponibilidad solo por lo que está en empaque
      this.items = items.map(i => {
        const cantidadTeorica = parseFloat(String(i.cantidad || 0)) || 0;
        const cantidadRecibida = parseFloat(String(i.cantidad_recibida || i.cantidad_recibida_total || 0)) || 0;
        const cantidadAsignada = parseFloat(String(i.cantidad_asignada || 0)) || 0;

        // 🔹 Buscar en "ubicaciones_distintas" cuánto hay en empaque
        let cantidadEmpaque = 0;
        if (Array.isArray(i.ubicaciones_distintas)) {
          const ubicacionEmpaque = i.ubicaciones_distintas.find(
            u => u.ubicacion?.toLowerCase() === 'empaque'
          );
          if (ubicacionEmpaque) {
            cantidadEmpaque = parseFloat(String(ubicacionEmpaque.cantidad || 0)) || 0;
          }
        } else if (i.ubicacion?.toLowerCase() === 'empaque') {
          // Si el campo directo indica que el ítem está en empaque
          cantidadEmpaque = parseFloat(String(i.cantidad || 0)) || 0;
        }

        return {
          ...i,
          cantidad: cantidadTeorica,                 // cantidad teórica total del ítem
          cantidad_recibida: cantidadRecibida,       // total recibido
          cantidad_asignada: cantidadAsignada,       // ya asignado
          cantidad_en_empaque: cantidadEmpaque,      // 🔹 nueva propiedad
          cantidad_a_asignar: 0                      // campo editable del usuario
        };
      });

      // 🔄 Reiniciar filtros y paginación
      this.itemFilters = { busqueda: '', soloDisponibles: false };
      this.initializarPaginacionItems();

      this.pvSeleccionada = pv;
      this.ocCliente = this.items[0]?.oc_cliente || 'N/A';

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
    let cantidadEmpaque = 0;

    // ✅ Misma lógica que en verificarDisponibilidadPorPV
    if (Array.isArray(item.ubicaciones_distintas) && item.ubicaciones_distintas.length > 0) {
      // ✅ CON ubicaciones distintas: buscar específicamente empaque
      const enEmpaque = item.ubicaciones_distintas.find((u: any) => 
        u.ubicacion?.toLowerCase().includes('empaque')
      );
      if (enEmpaque) {
        cantidadEmpaque = parseFloat(String(enEmpaque.cantidad || 0));
      }
      // Si no hay ubicación empaque, cantidadEmpaque queda en 0
    } else {
      // ✅ SIN ubicaciones distintas: toda la cantidad_recibida_total está en empaque
      cantidadEmpaque = parseFloat(String(item.cantidad_recibida_total || 0));
    }

    const cantidadAsignada = parseFloat(String(item.cantidad_asignada || 0));
    const disponible = cantidadEmpaque - cantidadAsignada;

    return disponible > 0 ? disponible : 0;
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

    // 🔹 Detectar si el usuario es "Distribuidor PV Directo"
    const esDistribuidorPvDirecto = this.AuthService.hasRole('Distribuidor PV Directo (Terminación y Empaque)');

    if (esDistribuidorPvDirecto) {
      // 👉 Flujo alternativo para Distribuidor PV Directo
      this.terminacionEmpaqueService
        .registrarAsignacionesDirecto(itemsParaEnviar, this.pvSeleccionada, this.opSeleccionada, this.usuario_que_registra)
        .subscribe({
          next: (res: any) => {
            Swal.fire('Éxito', res.message || 'Asignaciones registradas (Distribuidor PV Directo).', 'success')
              .then(() => window.location.reload());
          },
          error: (err) => {
            console.error('Error registrando asignaciones (Distribuidor PV Directo):', err);
            Swal.fire('Error', 'No se pudo registrar las asignaciones para Distribuidor PV Directo.', 'error');
          }
        });

    } else {
      // 👉 Flujo normal para los demás usuarios
      this.terminacionEmpaqueService
        .registrarAsignaciones(itemsParaEnviar, this.pvSeleccionada, this.opSeleccionada, this.usuario_que_registra)
        .subscribe({
          next: (res: any) => {
            if (res.message) {
              Swal.fire('Éxito', res.message, 'success');
              return;
            }

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
                }).then(() => window.location.reload());
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
}