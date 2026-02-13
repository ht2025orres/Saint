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

  // Variables para modal de ubicaciones distintas
  ubicDistPaginatorId = 'ubicaciones-distintas-paginator';
  itemsUbicacionesDistintas: any[] = [];
  currentUbicDistItems: any[] = [];
  cargandoUbicaciones = false;
  guardandoCambioUbicacion = false;
  opBuscadaUbicaciones: string = '';

  ubicDistFilters = {
    busqueda: '',
    ubicacion: ''
  };

  verFilters = {
    busqueda: '',
    soloPendientes: false
  };

  opSeleccionada: number | null = null;
  assignmentPayload: any[] = [];
  
  opsConPvs: any[] = [];
  currentOps: any[] = [];

  items: any[] = [];
  currentItems: any[] = [];
  pvSeleccionada: string | null = null;
  ocCliente: string | null = null;
  
  filters = {
    busqueda: ''
  };

  itemFilters = {
    busqueda: '',
    soloDisponibles: false
  };

  pvFilters: { [opCodigo: string]: string } = {};
  paginatedPvs: { [opCodigo: string]: any[] } = {};

  Math = Math;

  guardandoAsignacion = false;
  guardandoVerificacion = false;
  cargandoInicial = false;
  estadoCarga = "";

  constructor(
    private terminacionEmpaqueService: TerminacionEmpaqueService,
    public paginationService: PaginationService,
    public AuthService: AuthService
  ) {}

  ngOnInit(): void {
    this.cargandoInicial = true;
    this.estadoCarga = "Cargando OPs pendientes...";

    this.terminacionEmpaqueService.obtenerOPsPendientes().subscribe({
      next: (ops) => {
        this.cargarPVsParaOPs(ops);
      },
      error: () => {
        this.cargandoInicial = false;
        this.estadoCarga = "";
        Swal.fire('Error', 'No se pudieron cargar las OPs', 'error');
      }
    });
  }

  tieneRolEmpacadores(): boolean {
    if (this.AuthService.hasRole('Distribuidor PV Directo (Terminación y Empaque)')) {
      return false;
    }
    return this.AuthService.hasRole('Gestion empacadores (Terminación y Empaque)');
  }

  // ===== MÉTODOS PARA VERIFICACIÓN =====

  async abrirVerificacion(op: number, pv: string): Promise<void> {
    this.pvVerificacion = pv;
    this.opSeleccionada = op;

    try {
      const items = await this.terminacionEmpaqueService
        .obtenerItemsConAsignaciones(op, pv)
        .toPromise();

      this.itemsVerificacion = items.map(i => ({
        ...i,
        cantidad_fisica: Number(i.cantidad_verificada) || 0, // Iniciar con lo ya verificado
        nota_inconsistencia: '',
        verificado: (Number(i.cantidad_asignada) || 0) <= (Number(i.cantidad_verificada) || 0)
      }));

      this.verFilters = {
        busqueda: '',
        soloPendientes: false
      };

      this.initializarPaginacionVerificacion();

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

  applyVerFilters(): void {
    this.paginationService.updatePaginator(
      this.verPaginatorId,
      this.itemsVerificacion,
      undefined,
      this.verFilters,
      this.verFilterFunction,
      true
    );
    
    const state = this.paginationService.getPaginatorState(this.verPaginatorId);
    this.currentVerItems = state?.currentData || [];
  }

  verFilterFunction: FilterFunction = (item: any, filtros) => {
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

    let pasaPendientes = true;
    if (filtros.soloPendientes) {
      pasaPendientes = !item.verificado;
    }

    return pasaBusqueda && pasaPendientes;
  };

  getDiferencia(item: any): number {
    const fisica = parseFloat(String(item.cantidad_fisica || 0)) || 0;
    const asignada = parseFloat(String(item.cantidad_asignada || 0)) || 0;
    return fisica - asignada;
  }

  esVerificacionValida(item: any): boolean {
    const fisica = parseFloat(String(item.cantidad_fisica || 0)) || 0;
    const asignada = parseFloat(String(item.cantidad_asignada || 0)) || 0;
    
    if (fisica > asignada) return false;
    
    // if (fisica !== asignada) {
    //   return item.nota_inconsistencia && item.nota_inconsistencia.trim().length > 0;
    // }
    
    return fisica >= 0;
  }

  verificarItem(item: any): void {
    if (!this.esVerificacionValida(item)) {
      Swal.fire('Atención', 'Debes agregar una nota si hay diferencia en la cantidad', 'warning');
      return;
    }
    
    item.verificado = true;
    this.applyVerFilters();
  }

  desverificarItem(item: any): void {
    item.verificado = false;
    this.applyVerFilters();
  }

  getItemsVerificados(): number {
    return (this.itemsVerificacion || []).filter(i => i.verificado).length;
  }

  todosVerificados(): boolean {
    if (!this.itemsVerificacion || this.itemsVerificacion.length === 0) return false;
    return this.itemsVerificacion.every(i => i.verificado);
  }

  confirmarVerificacion(): void {
    const verificados = this.itemsVerificacion.filter(i => i.verificado);
    
    if (verificados.length === 0) {
      Swal.fire('Atención', 'Debes verificar al menos un item', 'warning');
      return;
    }

    const itemsConDiferencia = verificados.filter(i => this.getDiferencia(i) !== 0);
    
    const mensaje = this.todosVerificados() 
      ? `Se verificarán <strong>${verificados.length}</strong> items.`
      : `Se verificarán <strong>${verificados.length}</strong> de ${this.itemsVerificacion.length} items.<br>La PV quedará incompleta.`;
    
    Swal.fire({
      title: 'Confirmar verificación',
      html: mensaje + (itemsConDiferencia.length > 0 ? `<br><br><strong>${itemsConDiferencia.length}</strong> items con diferencias.` : ''),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, confirmar',
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (result.isConfirmed) {
        this.enviarVerificacion();
      }
    });
  }

  enviarVerificacion(): void {
    if (this.guardandoVerificacion) return;

    const payload = this.itemsVerificacion
      .filter(i => i.verificado)
      .map(item => ({
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
    
    this.guardandoVerificacion = true;

    this.terminacionEmpaqueService
      .registrarVerificacionAsignaciones(payload, this.pvVerificacion, this.opSeleccionada, usuario)
      .subscribe({
        next: (res: any) => {
          this.itemsVerificacion.forEach(item => {
            item.cantidad_fisica = 0;
            item.nota_inconsistencia = '';
            item.verificado = false;
          });

          Swal.fire('Éxito', res.message || 'Verificación registrada correctamente', 'success')
            .then(() => {
              const modalEl = document.getElementById('verificacionModal');
              if (modalEl) {
                const modal = Modal.getInstance(modalEl);
                modal?.hide();
              }
              
              const op = this.opsConPvs.find(o => o.codigo === this.opSeleccionada);
              if (op && op.pvsOriginal) {
                const pv = op.pvsOriginal.find(p => p.numero_pv === this.pvVerificacion);
                if (pv) {
                  pv.tieneAsignaciones = false;
                }
                this.filtrarPVs(op);
              }
              this.guardandoVerificacion = false;
            });
        },
        error: (err) => {
          console.error('Error al registrar verificación:', err);
          Swal.fire('Error', 'No se pudo registrar la verificación', 'error');
          this.guardandoVerificacion = false;
        }
      });
  }

  // ===== MODAL UBICACIONES DISTINTAS =====

  abrirModalUbicacionesDistintas(): void {
    this.opBuscadaUbicaciones = '';
    this.itemsUbicacionesDistintas = [];
    this.currentUbicDistItems = [];
    this.ubicDistFilters = {
      busqueda: '',
      ubicacion: ''
    };

    const modalEl = document.getElementById('ubicacionesDistintasModal');
    if (modalEl) {
      const modal = new Modal(modalEl);
      modal.show();
    }
  }

  async buscarUbicacionesPorOP(): Promise<void> {
    if (!this.opBuscadaUbicaciones || this.opBuscadaUbicaciones.trim() === '') {
      Swal.fire('Atención', 'Debe ingresar un número de OP', 'warning');
      return;
    }

    this.cargandoUbicaciones = true;
    this.itemsUbicacionesDistintas = [];
    this.currentUbicDistItems = [];

    try {
      const items = await this.terminacionEmpaqueService
        .obtenerItemsConUbicacionesDistintas(Number(this.opBuscadaUbicaciones))
        .toPromise();

      this.itemsUbicacionesDistintas = items.filter((i: any) => 
        i.ubicacion && i.ubicacion.toLowerCase() !== 'empaque'
      );

      if (this.itemsUbicacionesDistintas.length === 0) {
        Swal.fire('Sin resultados', `No hay items con ubicaciones distintas a Empaque para la OP ${this.opBuscadaUbicaciones}`, 'info');
      }

      this.ubicDistFilters = {
        busqueda: '',
        ubicacion: ''
      };

      this.initializarPaginacionUbicDist();
      this.cargandoUbicaciones = false;

    } catch (err) {
      console.error('Error cargando ubicaciones distintas:', err);
      Swal.fire('Error', 'No se pudieron cargar las ubicaciones para esta OP', 'error');
      this.cargandoUbicaciones = false;
    }
  }

  initializarPaginacionUbicDist(): void {
    if (this.itemsUbicacionesDistintas.length > 0) {
      this.paginationService.initializePaginator(
        this.ubicDistPaginatorId,
        this.itemsUbicacionesDistintas,
        10,
        this.ubicDistFilters,
        this.ubicDistFilterFunction
      ).subscribe(state => {
        this.currentUbicDistItems = state.currentData || [];
      });
    }
  }

  applyUbicDistFilters(): void {
    this.paginationService.updatePaginator(
      this.ubicDistPaginatorId,
      this.itemsUbicacionesDistintas,
      undefined,
      this.ubicDistFilters,
      this.ubicDistFilterFunction,
      true
    );
    
    const state = this.paginationService.getPaginatorState(this.ubicDistPaginatorId);
    this.currentUbicDistItems = state?.currentData || [];
  }

  ubicDistFilterFunction: FilterFunction = (item: any, filtros) => {
    const texto = (filtros.busqueda || '').toLowerCase().trim();
    let pasaBusqueda = true;
    
    if (texto) {
      const descripcionCorta = (item.descripcion_corta || '').toLowerCase();
      const descripcion = (item.descripcion || '').toLowerCase();
      const itemId = `${item.f120_id}-${item.id_color}-${item.id_talla}`.toLowerCase();
      const ubicacion = (item.ubicacion || '').toLowerCase();
      
      pasaBusqueda = descripcionCorta.includes(texto) ||
                    descripcion.includes(texto) ||
                    itemId.includes(texto) ||
                    ubicacion.includes(texto);
    }

    let pasaUbicacion = true;
    if (filtros.ubicacion) {
      pasaUbicacion = item.ubicacion === filtros.ubicacion;
    }

    return pasaBusqueda && pasaUbicacion;
  };

  cambiarUbicacionItem(item: any, nuevaUbicacion: string): void {
    if (this.guardandoCambioUbicacion) return;

    if ((nuevaUbicacion === 'Bordado' || nuevaUbicacion === 'Estampado') && !item.comentario) {
      Swal.fire({
        title: 'Comentario requerido',
        input: 'textarea',
        inputLabel: 'Ingrese el motivo del cambio:',
        inputPlaceholder: 'Escriba aquí...',
        showCancelButton: true,
        confirmButtonText: 'Guardar',
        cancelButtonText: 'Cancelar'
      }).then(result => {
        if (result.isConfirmed && result.value) {
          this.ejecutarCambioUbicacion(item, nuevaUbicacion, result.value);
        }
      });
    } else {
      Swal.fire({
        title: '¿Cambiar ubicación?',
        html: `¿Mover ${item.cantidad} unidades de <strong>${item.ubicacion}</strong> a <strong>${nuevaUbicacion}</strong>?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, cambiar',
        cancelButtonText: 'Cancelar'
      }).then(result => {
        if (result.isConfirmed) {
          this.ejecutarCambioUbicacion(item, nuevaUbicacion, item.comentario);
        }
      });
    }
  }

  private ejecutarCambioUbicacion(item: any, nuevaUbicacion: string, comentario?: string): void {
    this.guardandoCambioUbicacion = true;

    const payload = {
      op_codigo: this.opBuscadaUbicaciones,
      item_hash: item.item_hash,
      referencia: item.codigo,
      id_item: item.f120_id,
      descripcion: item.descripcion,
      id_color: item.id_color,
      id_talla: item.id_talla,
      cantidad_recibida: parseFloat(String(item.cantidad)) || 0,
      precio_unitario: item.precio_unitario || 0,
      usuario: this.AuthService.user.id,
      ubicacion_actual: item.ubicacion,
      ubicacion: nuevaUbicacion,
      comentario: comentario || ''
    };

    this.terminacionEmpaqueService.actualizarUbicacion(payload).subscribe({
      next: () => {
        item.ubicacion = nuevaUbicacion;
        item.comentario = comentario || '';
        this.applyUbicDistFilters();
        Swal.fire('Éxito', 'Ubicación actualizada correctamente', 'success');
        this.guardandoCambioUbicacion = false;
      },
      error: () => {
        Swal.fire('Error', 'No se pudo actualizar la ubicación', 'error');
        this.guardandoCambioUbicacion = false;
      }
    });
  }

  // ===== MÉTODOS EXISTENTES =====

async cargarPVsParaOPs(ops: any[]): Promise<void> {
  this.opsConPvs = (ops || []).map(op => ({
    codigo: op,
    pvs: [],
    pvsOriginal: [],
    tieneDisponibles: false,
    clientes: [],
    expandir: false,
    cargando: false,
    cargandoDetalle: true,
    estadoCarga: 'Pendiente de carga...'
  }));

  this.inicializarPaginacion();

  for (const opCodigo of ops || []) {
    const opUI = this.opsConPvs.find(o => o.codigo === opCodigo);
    if (!opUI) continue;

    try {
      this.estadoCarga = `OP ${opCodigo}: trayendo PVs...`;
      opUI.estadoCarga = 'Trayendo PVs...';
      this.refrescarPaginacionSinReinicio();
      await this.delay(200);

      const pvsResp: { pvs?: string, clientes?: any[] } | Array<{ pvs?: string, clientes?: any[] }> = await this.terminacionEmpaqueService
        .listarPVsPorOPDesdeApiLaravel(opCodigo)
        .toPromise();

      let cadenaPVs = '';
      let clientes = [];
      if (Array.isArray(pvsResp)) {
        cadenaPVs = pvsResp[0]?.pvs || '';
        clientes = pvsResp[0]?.clientes || [];
      } else {
        cadenaPVs = (pvsResp as { pvs?: string, clientes?: any[] })?.pvs || '';
        clientes = (pvsResp as { pvs?: string, clientes?: any[] })?.clientes || [];
      }

      const pvClienteMap = new Map<string, any>();
      clientes.forEach(cliente => {
        cliente.pvs.forEach((pvNum: number) => {
          pvClienteMap.set(pvNum.toString(), {
            nit: cliente.nit,
            nombre: cliente.nombre
          });
        });
      });

      const numerosPV = (cadenaPVs.match(/\d+/g) || []).map(pv => ({
        numero_pv: pv,
        tieneDisponibles: false,
        tieneAsignaciones: false,
        cliente: pvClienteMap.get(pv) || null
      }));

      opUI.pvs = numerosPV;
      opUI.pvsOriginal = [...numerosPV];
      opUI.clientes = clientes;
      this.initPaginadorPV(opUI);
      this.refrescarPaginacionSinReinicio();

      this.estadoCarga = `OP ${opCodigo}: verificando disponibles...`;
      opUI.estadoCarga = 'Verificando cantidades disponibles...';
      await this.delay(200);

      const tieneItemsPendientes = await lastValueFrom(
        this.terminacionEmpaqueService.verificarSiOPTieneItemsPendientes(opCodigo)
      );
      opUI.tieneDisponibles = tieneItemsPendientes['data'];

      if (numerosPV.length > 0) {
        await this.verificarDisponibilidadPorPV(opCodigo, numerosPV);
      }

      this.estadoCarga = `OP ${opCodigo}: verificando pendientes...`;
      opUI.estadoCarga = 'Verificando asignaciones pendientes...';
      await this.delay(200);

      await this.preCargarAsignacionesPendientes(opCodigo, numerosPV);

      this.ordenarPVs(opUI);
      this.filtrarPVs(opUI);
      opUI.cargandoDetalle = false;
      opUI.estadoCarga = 'Carga completada';
      this.refrescarPaginacionSinReinicio();
    } catch (error) {
      console.error(`Error procesando OP ${opCodigo}:`, error);
      opUI.cargandoDetalle = false;
      opUI.estadoCarga = 'Error cargando detalle';
      this.refrescarPaginacionSinReinicio();
    }
  }

  this.opsConPvs.sort((a, b) => {
    const dispoA = typeof a.tieneDisponibles === 'object' && a.tieneDisponibles !== null && 'data' in a.tieneDisponibles
      ? a.tieneDisponibles.data === true ? 1 : 0
      : a.tieneDisponibles === true ? 1 : 0;

    const dispoB = typeof b.tieneDisponibles === 'object' && b.tieneDisponibles !== null && 'data' in b.tieneDisponibles
      ? b.tieneDisponibles.data === true ? 1 : 0
      : b.tieneDisponibles === true ? 1 : 0;

    return dispoB - dispoA;
  });

  this.refrescarPaginacionSinReinicio();
  this.estadoCarga = '';
  this.cargandoInicial = false;
}

private refrescarPaginacionSinReinicio(): void {
  this.paginationService.updatePaginator(
    this.paginatorId,
    this.opsConPvs,
    undefined,
    this.filters,
    this.filterFunction,
    true
  );

  const state = this.paginationService.getPaginatorState(this.paginatorId);
  this.currentOps = state?.currentData || [];
}

private delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

private async verificarDisponibilidadPorPV(op: number, pvs: any[]): Promise<void> {
  const peticiones = pvs.map(async (pv) => {
    try {
      const items = await lastValueFrom(
        this.terminacionEmpaqueService.listarItemsDePVDesdeApiLaravel(pv.numero_pv, op)
      );

      const tieneDisponibles = items.some((item: any) => {
        const cantidadAsignada = parseFloat(String(item.cantidad_asignada || 0)) || 0;
        const cantidadTeorica = parseFloat(String(item.cantidad || 0)) || 0;
        
        if (cantidadAsignada >= cantidadTeorica) {
          return false;
        }
        
        let cantidadEmpaque = 0;
        
        if (Array.isArray(item.ubicaciones_distintas) && item.ubicaciones_distintas.length > 0) {
          const ubicacionEmpaque = item.ubicaciones_distintas.find(
            u => u.ubicacion?.toLowerCase().includes('empaque')
          );
          if (ubicacionEmpaque) {
            cantidadEmpaque = parseFloat(String(ubicacionEmpaque.cantidad || 0)) || 0;
          }
        } else {
          cantidadEmpaque = parseFloat(String(item.cantidad_recibida_total || 0)) || 0;
        }

        const disponible = cantidadEmpaque - cantidadAsignada;

        return disponible > 0;
      });

      pv.tieneDisponibles = tieneDisponibles;

    } catch (error) {
      console.error(`Error verificando disponibilidad para PV ${pv.numero_pv}:`, error);
      pv.tieneDisponibles = false;
    }
  });

  await Promise.all(peticiones);
}

itemCompletoTeorico(item: any): boolean {
  const cantidadAsignada = parseFloat(String(item.cantidad_asignada || 0)) || 0;
  const cantidadTeorica = parseFloat(String(item.cantidad || 0)) || 0;
  return cantidadAsignada >= cantidadTeorica;
}

private async preCargarAsignacionesPendientes(op: number, pvs: any[]): Promise<void> {
  try {
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
              
              return cantidadAsignada > 0 && cantidadVerificada < cantidadAsignada;
            })
          : false;

        const pvIndex = pvs.findIndex(p => p.numero_pv === pvResultado.numero_pv);
        if (pvIndex !== -1) {
          pvs[pvIndex].tieneAsignaciones = tieneAsignacionesSinVerificar;
        }
      });
    }
  } catch (error) {
    console.error(`Error precargando asignaciones para OP ${op}:`, error);
  }
}

private async cargarItemsBasicosParaPVs(op: number, pvs: any[]): Promise<any[]> {
  const itemsPorPV: any[] = [];
  
  const peticiones = pvs.map(async (pv) => {
    try {
      const items = await lastValueFrom(
        this.terminacionEmpaqueService.listarItemsDePVDesdeApiLaravel(pv.numero_pv, op)
      );

      itemsPorPV.push({
        numero_pv: pv.numero_pv,
        items: items.map((item: any) => ({
          f120_id: item.f120_id,
          id_color: item.id_color,
          id_talla: item.id_talla,
          cantidad: item.cantidad,
          cantidad_recibida: item.cantidad_recibida,
          cantidad_asignada: item.cantidad_asignada
        })),
        numero_op: op
      });

    } catch (error) {
      console.error(`Error cargando items básicos para PV ${pv.numero_pv}:`, error);
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

obtenerNombresClientes(op: any): string {
  if (!op.clientes || op.clientes.length === 0) {
    return '';
  }
  return op.clientes.map((c: any) => c.nombre).join(', ');
}

tieneMultiplesClientes(op: any): boolean {
  return op.clientes && op.clientes.length > 1;
}

obtenerPrimerCliente(op: any): any {
  return op.clientes && op.clientes.length > 0 ? op.clientes[0] : null;
}

obtenerCantidadClientes(op: any): number {
  return op.clientes ? op.clientes.length : 0;
}

  inicializarPaginacion(): void {
    if (this.opsConPvs.length > 0) {
      this.paginationService.initializePaginator(
        this.paginatorId,
        this.opsConPvs,
        10,
        this.filters,
        this.filterFunction
      ).subscribe(state => {
        this.currentOps = state.currentData;
      });
    }
  }

  initPaginadorPV(op: any, pageSize = 5): void {
    const instanceId = 'pv_' + op.codigo;
    this.pvFilters[op.codigo] = this.pvFilters[op.codigo] || '';

    this.paginationService
      .initializePaginator(
        instanceId,
        op.pvsOriginal || [],
        pageSize,
        { busqueda: this.pvFilters[op.codigo] || '' },
        this.pvFilterFunction
      )
      .subscribe(state => {
        op.pvsPaged = state.currentData || [];
      });
  }

  initializarPaginacionItems(): void {
    if (this.items.length > 0) {
      this.paginationService.initializePaginator(
        this.itemsPaginatorId,
        this.items,
        5,
        this.itemFilters,
        this.itemsFilterFunction
      ).subscribe(state => {
        this.currentItems = state.currentData || [];
      });
    }
  }

  applyFilters(): void {
    this.paginationService.updatePaginator(
      this.paginatorId,
      this.opsConPvs,
      undefined,
      this.filters,
      this.filterFunction,
      true
    );
    
    const state = this.paginationService.getPaginatorState(this.paginatorId);
    this.currentOps = state?.currentData || [];
  }

  applyItemFilters(): void {
    this.paginationService.updatePaginator(
      this.itemsPaginatorId,
      this.items,
      undefined,
      this.itemFilters,
      this.itemsFilterFunction,
      true
    );
    
    const state = this.paginationService.getPaginatorState(this.itemsPaginatorId);
    this.currentItems = state?.currentData || [];
  }

  filtrarPVs(op: any): void {
    const instanceId = 'pv_' + op.codigo;
    const filtro = { busqueda: this.pvFilters[op.codigo] || '' };

    this.paginationService.updatePaginator(
      instanceId,
      op.pvsOriginal || [],
      undefined,
      filtro,
      this.pvFilterFunction,
      true
    );

    const state = this.paginationService.getPaginatorState(instanceId);
    op.pvsPaged = state?.currentData || [];
  }

  filterFunction: FilterFunction = (item: any, filtros) => {
    const texto = filtros.busqueda.toLowerCase().trim();
    if (!texto) return true;
    
    return item.codigo?.toLowerCase().includes(texto);
  };

  pvFilterFunction: FilterFunction = (pv: any, filtros: any) => {
    const texto = (filtros?.busqueda || '').toString().toLowerCase().trim();
    if (!texto) return true;
    const numero = (pv.numero_pv ?? pv).toString().toLowerCase();
    return numero.includes(texto);
  };

  itemsFilterFunction: FilterFunction = (item: any, filtros) => {
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

    let pasaDisponibilidad = true;
    if (filtros.soloDisponibles) {
      const cantidadRecibida = parseFloat(String(item.cantidad_recibida || 0)) || 0;
      const cantidadAsignada = parseFloat(String(item.cantidad_asignada || 0)) || 0;
      const cantidadRequerida = parseFloat(String(item.cantidad || 0)) || 0;

      const disponibleOP = cantidadRecibida - cantidadAsignada;
      const faltantePorRequerido = cantidadRequerida - cantidadAsignada;
      const disponible = Math.max(0, Math.min(disponibleOP, faltantePorRequerido));

      pasaDisponibilidad = disponible > 0;
    }

    return pasaBusqueda && pasaDisponibilidad;
  };

  toggleExpandirOP(op: any): void {
    if (!op.expandir) {
      op.expandir = true;
      op.cargando = true;
      
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

private ordenarPVs(op: any): void {
  if (!op.pvsOriginal || !Array.isArray(op.pvsOriginal)) return;
  
  op.pvsOriginal.sort((a, b) => {
    if (a.tieneAsignaciones !== b.tieneAsignaciones) {
      return (b.tieneAsignaciones ? 1 : 0) - (a.tieneAsignaciones ? 1 : 0);
    }
    if (a.tieneDisponibles !== b.tieneDisponibles) {
      return (b.tieneDisponibles ? 1 : 0) - (a.tieneDisponibles ? 1 : 0);
    }
    return parseInt(a.numero_pv) - parseInt(b.numero_pv);
  });
}

  tienePVsConAsignacionesPendientes(op: any): boolean {
    if (!op.pvsOriginal || !Array.isArray(op.pvsOriginal)) return false;
    return op.pvsOriginal.some(pv => pv.tieneAsignaciones === true);
  }

  async verItemsDePV(op: number, pv: string): Promise<void> {
    this.pvSeleccionada = pv;
    this.opSeleccionada = op;

    try {
      await this.cargarItemsParaPV(op, pv, true);
    } catch (err) {
      Swal.fire('Error', 'No se pudieron cargar los ítems de la PV', 'error');
      console.error('Error al cargar ítems de PV', op, pv, err);
    }
  }

  private async cargarItemsParaPV(op: number, pv: string, mostrarModal: boolean): Promise<void> {
    const items = await this.terminacionEmpaqueService
      .listarItemsDePVDesdeApiLaravel(+pv, op)
      .toPromise();

    this.items = items.map(i => {
      const cantidadTeorica = parseFloat(String(i.cantidad || 0)) || 0;
      const cantidadRecibida = parseFloat(String(i.cantidad_recibida || i.cantidad_recibida_total || 0)) || 0;
      const cantidadAsignada = parseFloat(String(i.cantidad_asignada || 0)) || 0;

      let cantidadEmpaque = 0;
      if (Array.isArray(i.ubicaciones_distintas)) {
        const ubicacionEmpaque = i.ubicaciones_distintas.find(
          u => u.ubicacion?.toLowerCase() === 'empaque'
        );
        if (ubicacionEmpaque) {
          cantidadEmpaque = parseFloat(String(ubicacionEmpaque.cantidad || 0)) || 0;
        }
      } else if (i.ubicacion?.toLowerCase() === 'empaque') {
        cantidadEmpaque = parseFloat(String(i.cantidad || 0)) || 0;
      }

      return {
        ...i,
        cantidad: cantidadTeorica,
        cantidad_recibida: cantidadRecibida,
        cantidad_asignada: cantidadAsignada,
        cantidad_en_empaque: cantidadEmpaque,
        cantidad_a_asignar: 0
      };
    });

    this.itemFilters = { busqueda: '', soloDisponibles: false };
    this.initializarPaginacionItems();

    this.pvSeleccionada = pv;
    this.ocCliente = this.items[0]?.oc_cliente || 'N/A';

    if (mostrarModal) {
      const modalEl = document.getElementById('itemsModal');
      if (modalEl) {
        const modal = new Modal(modalEl);
        modal.show();
      }
    }
  }

  private async refrescarDespuesAsignacion(): Promise<void> {
    if (!this.opSeleccionada || !this.pvSeleccionada) return;

    try {
      await this.cargarItemsParaPV(this.opSeleccionada, this.pvSeleccionada, false);

      const op = this.opsConPvs.find(o => o.codigo === this.opSeleccionada);
      if (op?.pvsOriginal) {
        await this.verificarDisponibilidadPorPV(op.codigo, op.pvsOriginal);
        await this.preCargarAsignacionesPendientes(op.codigo, op.pvsOriginal);
        this.ordenarPVs(op);
        this.filtrarPVs(op);
      }
    } catch (error) {
      console.error('Error al refrescar datos después de asignar:', error);
    }
  }

  esCantidadValida(item: any): boolean {
    const asignar = Number(item.cantidad_a_asignar) || 0;
    if (asignar <= 0) return false;
    const max = this.getMaximoPermitido(item);
    return asignar <= max;
  }

  getCantidadDisponible(item: any): number {
    if (item.cantidad_disponible_real !== undefined) {
      const disponible = parseFloat(String(item.cantidad_disponible_real || 0));
      return disponible > 0 ? disponible : 0;
    }

    const teorico = parseFloat(String(item.cantidad || 0));
    const asignadoTotal = parseFloat(String(item.cantidad_asignada_total || 0));
    const disponibleFallback = teorico - asignadoTotal;

    return disponibleFallback > 0 ? disponibleFallback : 0;
  }

  getItemsConCantidadParaAsignar(): number {
    return (this.items || []).filter(item => this.getCantidadDisponible(item) > 0).length;
  }

  tieneItemsValidosParaGuardar(): boolean {
    return (this.items || []).some(item => this.esCantidadValida(item));
  }

  getMaximoPermitido(item: any): number {
    const teorica = item.cantidad ?? 0;
    const yaAsignado = item.cantidad_asignada ?? 0;
    const recibidaTotal = item.cantidad_recibida_total ?? 0;
    const enEmpaque = item.cantidad_en_empaque ?? 0;
    const disponible = this.getCantidadDisponible(item) ?? 0;

    const faltantePV = Math.max(teorica - yaAsignado, 0);
    const utilDisponible = Math.max(disponible - enEmpaque, 0);

    return Math.min(faltantePV, utilDisponible, teorica, disponible);
  }

  roundValue(value: number, decimals = 2): number {
    if (isNaN(value) || value === null) return 0;
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

  asignarMaximoItem(item: any): void {
    const maximo = this.getMaximoPermitido(item);
    item.cantidad_a_asignar = this.roundValue(maximo, 2);
    this.applyItemFilters();
  }

  asignarMaximos(force = false): void {
    if (!this.items || !this.items.length) return;

    this.items.forEach(item => {
      const maxPermitido = this.getMaximoPermitido(item);

      if (maxPermitido <= 0) {
        item.cantidad_a_asignar = 0;
        return;
      }

      const valorActual = Number(item.cantidad_a_asignar) || 0;

      if (force) {
        item.cantidad_a_asignar = this.roundValue(maxPermitido, 2);
        return;
      }

      if (valorActual === 0) {
        item.cantidad_a_asignar = this.roundValue(maxPermitido, 2);
        return;
      }

      if (valorActual < 0 || valorActual > maxPermitido || isNaN(valorActual)) {
        item.cantidad_a_asignar = this.roundValue(maxPermitido, 2);
        return;
      }
    });

    this.applyItemFilters();
  }

  prepararYValidarAsignaciones(): void {
    if (this.guardandoAsignacion) return;

    const errores: string[] = [];
    const itemsInvalidos: any[] = [];

    (this.items || []).forEach(item => {
      const asignar = Number(item.cantidad_a_asignar) || 0;
      const max = this.getMaximoPermitido(item);

      if (asignar <= 0) return;

      const erroresItem: string[] = [];

      if (asignar > max) {
        erroresItem.push(`Cantidad a asignar (${asignar}) excede el máximo permitido (${max}).`);
      }

      if (asignar > (item.cantidad || 0)) {
        erroresItem.push(`Excede la cantidad teórica (${item.cantidad}).`);
      }

      if (asignar > this.getCantidadDisponible(item)) {
        erroresItem.push(`Excede la cantidad disponible (${this.getCantidadDisponible(item)}).`);
      }

      if (asignar < 0) {
        erroresItem.push(`Cantidad negativa no permitida.`);
      }

      if (erroresItem.length > 0) {
        errores.push(`<b>Item ${item.f120_id || item.referencia}:</b><br>• ${erroresItem.join('<br>• ')}`);
        itemsInvalidos.push(item);
      }
    });

    if (errores.length > 0) {
      Swal.fire({
        title: 'Errores en asignaciones',
        html: errores.join('<br><br>'),
        icon: 'error',
        width: 750
      });
      return;
    }

    const itemsParaEnviar = (this.items || [])
      .filter(item => Number(item.cantidad_a_asignar) > 0)
      .map(item => ({ ...item }));

    if (itemsParaEnviar.length === 0) {
      Swal.fire('Atención', 'No hay ítems con cantidad a asignar.', 'warning');
      return;
    }

    this.usuario_que_registra = this.AuthService.user.id;
    const esDistribuidorPvDirecto = this.AuthService.hasRole('Distribuidor PV Directo (Terminación y Empaque)');
    
    this.guardandoAsignacion = true;

    const servicio = esDistribuidorPvDirecto
      ? this.terminacionEmpaqueService.registrarAsignacionesDirecto(itemsParaEnviar, this.pvSeleccionada, this.opSeleccionada, this.usuario_que_registra)
      : this.terminacionEmpaqueService.registrarAsignaciones(itemsParaEnviar, this.pvSeleccionada, this.opSeleccionada, this.usuario_que_registra);

    servicio.subscribe({
      next: async (res: any) => {
        this.items.forEach(item => item.cantidad_a_asignar = 0);

        try {
          if (res.message) {
            await Swal.fire('Éxito', res.message, 'success');
            await this.refrescarDespuesAsignacion();
          } else if (res.valid !== undefined) {
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
              await Swal.fire({
                title: 'Asignaciones válidas',
                html: `Se validaron ${this.assignmentPayload.length} ítems.`,
                icon: 'success'
              });
              await this.refrescarDespuesAsignacion();
            }
          }
        } finally {
          this.guardandoAsignacion = false;
        }
      },
      error: () => {
        Swal.fire('Error', 'No se pudo registrar las asignaciones.', 'error');
        this.guardandoAsignacion = false;
      }
    });
  }
}
