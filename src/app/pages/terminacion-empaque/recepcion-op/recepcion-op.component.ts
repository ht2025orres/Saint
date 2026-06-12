import { TerminacionEmpaqueService } from 'src/app/services/terminacion-empaque.service';
import { PaginationService, FilterFunction } from 'src/app/shared/pagination/pagination.service';
import { AuthService } from './../../../services/auth.service';
import { Component, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import { Modal } from 'bootstrap';
import Swal from 'sweetalert2';

interface OP {
  id: number;
  codigo: string;
}

interface UbicacionDistinta {
  ubicacion: string;
  cantidad: number;
  comentario?: string;
  fecha?: Date;
  esNueva?: boolean;
}

interface ItemRecepcion {
  hash: string;
  f120_id: number;
  codigo: string;
  descripcion_corta: string;
  descripcion: string;
  id_talla: string;
  id_color: string;
  unidad_medida: string;
  cliente: string;
  cantidad_teorica_total: number;
  cantidad_recibida_total: number;
  cantidad_recibida: number;
  precio_unitario?: number;
  ubicaciones_distintas?: UbicacionDistinta[];
}

interface ModalUbicacionData {
  item: ItemRecepcion | null;
  cantidad: number;
  mostrar: boolean;
  ubicacionSeleccionada: string;
  comentario: string;
}

interface ModalVerUbicacionesData {
  item: ItemRecepcion | null;
  mostrar: boolean;
}

interface ModalRecepcionPTs {
  mostrar: boolean;
  ptIngresado: string;
  pv: string;
  items: any[];
  cargando: boolean;
}

@Component({
  selector: 'app-recepcion-op',
  templateUrl: './recepcion-op.component.html',
  styleUrls: ['./recepcion-op.component.css']
})
export class RecepcionOpComponent implements OnInit {
  paginatorId = 'op-recepcion-paginator';
  itemsPaginatorId = 'recepcion-pt-items-paginator';
  mostrarNotificacion = 0;

  filters = {
    busqueda: ''
  };

  // Variables para paginador modal
  currentItemsModal: any[] = [];
  itemFiltersModal = { busqueda: '' };

  listaOPs: OP[] = [];
  opSeleccionada: OP | null = null;
  codigoOPSeleccionada: string = '';
  items: ItemRecepcion[] = [];
  PTs: string[] = [];
  estadoPTs: { pt: string; estado: string }[] = []; // Guarda el estado de cada PT consultada
  currentItems: ItemRecepcion[] = [];
  busquedaIniciada = false;
  cargando = false;

  // ====== NUEVAS BANDERAS DE CARGA ======
  loadingBuscarItems = false;
  loadingGuardarRecepcion = false;
  loadingBuscarModal = false;
  loadingGuardarModal = false;
  // ====================================

  // Modales
  modalUbicacion: ModalUbicacionData = {
    item: null,
    cantidad: 0,
    mostrar: false,
    ubicacionSeleccionada: 'Terminacion',
    comentario: ''
  };

  modalVerUbicaciones: ModalVerUbicacionesData = {
    item: null,
    mostrar: false
  };

  // Modal de recepción de PTs
  modalRecepcionPTs: ModalRecepcionPTs = {
    mostrar: false,
    ptIngresado: '',
    pv: '',
    items: [],
    cargando: false
  };

  ubicacionesDisponibles = [
    { value: 'Empaque', label: 'Empaque' },
    { value: 'Terminacion', label: 'Terminación' },
    { value: 'Bordado', label: 'Bordado' },
    { value: 'Estampado', label: 'Estampado' }
  ];

  constructor(
    private terminacionEmpaqueService: TerminacionEmpaqueService,
    public paginationService: PaginationService,
    public authService: AuthService    
  ) {}

  ngOnInit(): void {
    this.mostrarNotificacion = 1;
    this.terminacionEmpaqueService.listarOPsDesdeApiLaravel().subscribe({
      next: (ops) => {
        this.listaOPs = ops;
        this.mostrarNotificacion = 2
        setTimeout(() => this.mostrarNotificacion = 0, 3000);
      },
      error: () => {
        Swal.fire('Error', 'Error al cargar OPs desde API Laravel', 'error');
      }
    });
  }

  buscarPVs(): void {
    // Evitar múltiples clics
    if (this.loadingBuscarItems) {
      return;
    }

    this.busquedaIniciada = true;
    this.loadingBuscarItems = true; // ← Activar loading
    this.cargando = true;
    
    const opEncontrada = this.listaOPs.find(op => op.codigo === this.codigoOPSeleccionada);
    if (!opEncontrada) {
      this.cargando = false;
      this.loadingBuscarItems = false; // ← Desactivar loading
      Swal.fire('Advertencia', 'Debes seleccionar una OP válida', 'warning');
      return;
    }

    this.opSeleccionada = opEncontrada;

    this.terminacionEmpaqueService
    .listarPVsPorOPDesdeApiLaravel(opEncontrada.id)
    .subscribe({
      next: (respuesta) => {
        const numerosPV: number[] = respuesta.pvs.map((pv: any) => pv.numero_pv);

        if (numerosPV.length === 0) {
          this.loadingBuscarItems = false; // ← Desactivar loading
          Swal.fire('Sin PVs', 'La OP no tiene PVs asociadas', 'info');
          return;
        }

        const peticiones = numerosPV.map(pv =>
          this.terminacionEmpaqueService.listarItemsDePVDesdeApiLaravel(+pv)
        );

        forkJoin(peticiones).subscribe({
          next: (respuestas: any[][]) => {
            const items: any[] = ([] as any).concat(...respuestas);

            this.terminacionEmpaqueService
              .generarHashes(items)
              .subscribe(hashesGenerados => {
                const itemsUnificados: Record<string, ItemRecepcion> = {};

                items.forEach((item, i) => {
                  const hash = hashesGenerados[i].hash;
                  if (item.PT != 'N/A' && !this.PTs.includes(item.PT)) {
                    this.PTs.push(item.PT);
                  }
                  if (!itemsUnificados[hash]) {
                    itemsUnificados[hash] = {
                      hash: hash,
                      f120_id: item.f120_id,
                      codigo: item.referencia,
                      descripcion: item.descripcion,
                      descripcion_corta: item.descripcion_corta,
                      id_talla: item.id_talla,
                      id_color: item.id_color,
                      unidad_medida: item.unidad_medida,
                      cliente: item.cliente,
                      cantidad_teorica_total: 0,
                      cantidad_recibida_total: 0,
                      cantidad_recibida: 0,
                      precio_unitario: item.precio_unitario || 0,
                      ubicaciones_distintas: []
                    };
                  }

                  itemsUnificados[hash].cantidad_teorica_total += +item.cantidad || 0;
                });

                console.log('PTs' , this.PTs);

                this.verificarEstadoPTs();

                console.log(this.estadoPTs);

                const hashes = Object.keys(itemsUnificados);

                this.terminacionEmpaqueService
                  .obtenerCantidadRecibida(this.opSeleccionada!.codigo, hashes)
                  .subscribe((response: { [hash: string]: any }) => {
                    hashes.forEach(hash => {
                      const itemData = response['data'][hash];
                      if (itemData !== undefined) {
                        itemsUnificados[hash].cantidad_recibida_total = itemData.cantidad_recibida_total || 0;
                        if (itemData.ubicaciones_distintas) {
                          // ← Marcar como NO nuevas las que vienen de BD
                          itemsUnificados[hash].ubicaciones_distintas = itemData.ubicaciones_distintas.map((ub: UbicacionDistinta) => ({
                            ...ub,
                            esNueva: false
                          }));
                        }
                      }
                    });

                    this.items = Object.values(itemsUnificados);

                    this.paginationService.initializePaginator(
                      this.paginatorId,
                      this.items,
                      10,
                      this.filters,
                      this.filterFunction
                    ).subscribe(state => this.currentItems = state.currentData);
                    
                    this.cargando = false;
                    this.loadingBuscarItems = false; // ← Desactivar loading
                  }, () => {
                    this.cargando = false;
                    this.loadingBuscarItems = false; // ← Desactivar loading
                    Swal.fire('Error', 'No se pudo cargar cantidades recibidas locales', 'error');
                  });
              });
          },
          error: () => {
            this.cargando = false;
            this.loadingBuscarItems = false; // ← Desactivar loading
            Swal.fire('Error', 'Error al obtener ítems de las PVs', 'error');
          }
        });
      },
      error: () => {
        this.cargando = false;
        this.loadingBuscarItems = false; // ← Desactivar loading
        Swal.fire('Error', 'Error al obtener PVs desde API Laravel', 'error');
      }
    });
  }

  get PTsNumeros(): string[] {
    return this.PTs.map(pt => pt.replace(/\D+/g, '')).filter(num => num !== '');
  }

  verificarEstadoPTs(): void {
    if (!this.PTs || this.PTs.length === 0) {
      return;
    }

    this.terminacionEmpaqueService.verificarEstadoPTs(this.PTs).subscribe(
      (res: any) => {
        // res: { "47488": { estado: 'parcial', total_recibida: 15 }, ... }
        console.log('Estados recibidos de PTs:', res);

        // Convertir a array [{ pt, estado }]
        const estadosArray = Object.keys(res || {}).map(pt => {
          const d = res[pt] || { estado: 'sin_empezar', total_recibida: 0 };
          return {
            pt,
            estado: d.estado
          };
        });

        // Orden: completas -> parciales -> sin empezar
        const orden: Record<string, number> = { completa: 1, parcial: 2, sin_empezar: 3 };
        this.estadoPTs = estadosArray.sort(
          (a, b) => (orden[a.estado] || 99) - (orden[b.estado] || 99)
        );
      },
      (err) => {
        console.error('Error consultando estado de PTs:', err);
      }
    );
  }

  // Métodos para modal de recepción de PTs
  abrirModalRecepcionPTs() {
    this.modalRecepcionPTs = {
      mostrar: true,
      ptIngresado: '',
      pv: '',
      items: [],
      cargando: false
    };
    this.busquedaIniciada = false;
    this.loadingBuscarModal = false; // ← Reset loading

    const modalEl = document.getElementById('recepcionPTsModal');
    if (modalEl) {
      const modal = new Modal(modalEl);
      modal.show();
    }
  }

  cerrarModalRecepcionPTs() {
    const modalEl = document.getElementById('recepcionPTsModal');
    if (modalEl) {
      const modal = Modal.getInstance(modalEl);
      modal?.hide();
    }
    this.modalRecepcionPTs.mostrar = false;
    this.busquedaIniciada = false;
    this.loadingBuscarModal = false; // ← Reset loading
  }

  buscarItemsPorPTModal() {
    // Evitar múltiples clics
    if (this.loadingBuscarModal) {
      return;
    }

    const pt = (this.modalRecepcionPTs.ptIngresado || '').toString().trim();
    if (!pt) {
      Swal.fire('Atención', 'Debes ingresar un número de PT', 'warning');
      return;
    }

    this.loadingBuscarModal = true; // ← Activar loading
    this.modalRecepcionPTs.cargando = true;
    this.busquedaIniciada = true;
    this.modalRecepcionPTs.items = [];
    this.currentItemsModal = [];

    this.terminacionEmpaqueService.listarItemsDePVDesdeApiLaravel(+pt).subscribe({
      next: (res: any[]) => {
        console.log('Items recibidos para PT', pt, ':', res);
        if (!res || res.length === 0) {
          this.modalRecepcionPTs.cargando = false;
          this.loadingBuscarModal = false; // ← Desactivar loading
          Swal.fire('Atención', 'No se encontraron ítems para esta PT', 'info');
          return;
        }

        // ====== Extraer número de PV desde las notas con lógica ROBUSTA ======
        const notaLimpia = (res[0]?.notas_completas || '').toString().toUpperCase().trim();

        // 1. Prioridad: Complemento (maneja variaciones de digitación)
        // Busca: 'COMPLEMENTA', 'COMPLEMENTO', 'COMPLE', 'COMP' seguido opcionalmente de 'LA', 'DE', 'DE LA' y un número
        const complementaRegex = /\bCOMP(?:LEMENT[AO]|LE|L)?\s*(?:LA|DE|DE\s*LA)?\s*(\d+)\b/i;
        const complementaMatch = notaLimpia.match(complementaRegex);

        // 2. Prioridad: Producto Terminado (maneja variaciones de digitación)
        // Busca: 'P. TERMINADO', 'P TERMINADO', 'PRODUCTO TERMINADO', 'PV DE PT', 'PV PT'
        const terminadoRegex = /\b(?:P\.?\s*TERMINADO|PRODUCTO\s*TERMINADO|PV\s*DE\s*PT|PV\s*PT|P\.?T\.?)\b/i;
        const terminadoMatch = notaLimpia.match(terminadoRegex);

        if (complementaMatch) {
          this.modalRecepcionPTs.pv = complementaMatch[1];
          console.log('Detectado como COMPLEMENTO (Robusto):', this.modalRecepcionPTs.pv);
        } else if (terminadoMatch) {
          this.modalRecepcionPTs.pv = pt;
          console.log('Detectado como PRODUCTO TERMINADO (Robusto). Usando PT como PV:', this.modalRecepcionPTs.pv);
        } else {
          // Fallback final: Buscar cualquier número si no hay coincidencias claras
          const fallbackMatch =
            notaLimpia.match(/PV\s*(\d+)/i) ||
            notaLimpia.match(/(\d+)/);
            
          if (fallbackMatch) {
            this.modalRecepcionPTs.pv = fallbackMatch[1];
            console.log('Detectado mediante fallback robusto:', this.modalRecepcionPTs.pv);
          }
        }

        // ====== Unificar ítems por hash ======
        this.terminacionEmpaqueService.generarHashes(res).subscribe({
          next: (hashesGenerados: any[]) => {
            const itemsUnificados: Record<string, any> = {};

            res.forEach((item, i) => {
              const hash = hashesGenerados[i].hash;
              if (!itemsUnificados[hash]) {
                itemsUnificados[hash] = {
                  hash: hash,
                  f120_id: item.f120_id,
                  codigo: item.referencia,
                  descripcion: item.descripcion,
                  descripcion_corta: item.descripcion_corta,
                  id_talla: item.id_talla,
                  id_color: item.id_color,
                  unidad_medida: item.unidad_medida,
                  cliente: item.cliente,
                  cantidad_teorica_total: 0,
                  cantidad_recibida_total: 0,
                  cantidad_recibida: 0,
                  precio_unitario: item.precio_unitario,
                  ubicaciones_distintas: []
                };
              }

              itemsUnificados[hash].cantidad_teorica_total += +item.cantidad || 0;
            });

            const hashes = Object.keys(itemsUnificados);

            // ====== Consultar cantidades recibidas acumuladas ======
            this.terminacionEmpaqueService
              .obtenerCantidadRecibidaPT(pt, hashes)
              .subscribe(
                (response: { [hash: string]: any }) => {
                  hashes.forEach(hash => {
                    const itemData = response['data'][hash];
                    if (itemData !== undefined) {
                      itemsUnificados[hash].cantidad_recibida_total =
                        itemData.cantidad_recibida_total;

                      if (itemData.ubicaciones_distintas) {
                        // ← Marcar como NO nuevas
                        itemsUnificados[hash].ubicaciones_distintas =
                          itemData.ubicaciones_distintas.map((ub: UbicacionDistinta) => ({
                            ...ub,
                            esNueva: false
                          }));
                      }
                    }
                  });

                  this.modalRecepcionPTs.items = Object.values(itemsUnificados);

                  // ====== Inicializar paginación en el modal ======
                  this.paginationService.initializePaginator(
                    this.itemsPaginatorId, // ID separado para el modal
                    this.modalRecepcionPTs.items,
                    10,
                    this.itemFiltersModal,
                    this.itemsFilterFunctionModal   
                  ).subscribe(state => this.currentItemsModal = state.currentData);

                  this.modalRecepcionPTs.cargando = false;
                  this.loadingBuscarModal = false; // ← Desactivar loading
                },
                () => {
                  this.modalRecepcionPTs.cargando = false;
                  this.loadingBuscarModal = false; // ← Desactivar loading
                  Swal.fire('Error', 'No se pudo cargar cantidades recibidas locales', 'error');
                }
              );
          },
          error: () => {
            this.modalRecepcionPTs.cargando = false;
            this.loadingBuscarModal = false; // ← Desactivar loading
            Swal.fire('Error', 'Error generando hashes para los ítems', 'error');
          }
        });
      },
      error: (err) => {
        console.error('Error cargando items PT:', err);
        this.modalRecepcionPTs.cargando = false;
        this.loadingBuscarModal = false; // ← Desactivar loading
        Swal.fire('Error', 'No se pudieron cargar los ítems de la PT', 'error');
      }
    });
  }

  // Paginador de items modal
  inicializarPaginacionItemsModal(pageSize = 10) {
    if ((this.modalRecepcionPTs.items || []).length === 0) {
      this.currentItemsModal = [];
      return;
    }

    this.paginationService.initializePaginator(
      this.itemsPaginatorId,
      this.modalRecepcionPTs.items,
      pageSize,
      this.itemFiltersModal,
      this.itemsFilterFunctionModal
    ).subscribe(state => {
      this.currentItemsModal = state.currentData || [];
    });
  }

  applyItemFiltersModal() {
    this.paginationService.updatePaginator(
      this.itemsPaginatorId,
      this.modalRecepcionPTs.items,
      undefined,
      this.itemFiltersModal,
      this.itemsFilterFunctionModal,
      true
    );

    const state = this.paginationService.getPaginatorState(this.itemsPaginatorId);
    this.currentItemsModal = state?.currentData || [];
  }

  itemsFilterFunctionModal: FilterFunction = (item: any, filtros: any) => {
    const texto = (filtros.busqueda || '').toLowerCase().trim();
    if (!texto) return true;

    const descripcionCorta = (item.descripcion_corta || '').toString().toLowerCase();
    const descripcion = (item.descripcion || '').toString().toLowerCase();
    const itemId = `${item.f120_id}-${item.id_color}-${item.id_talla}`.toLowerCase();

    return descripcionCorta.includes(texto) || descripcion.includes(texto) || itemId.includes(texto);
  };

  // Reglas de validación / cálculo
  getMaximoPermitidoModal(item: any): number {
    const teorica = Number(item.cantidad_teorica_total || 0);
    const acumulada = Number(item.cantidad_recibida_total || 0);
    return Math.max(0, teorica - acumulada);
  }

  asignarMaximoItemModal(item: any) {
    item.cantidad_recibida = this.roundValue(this.getMaximoPermitidoModal(item), 2);
    this.applyItemFiltersModal();
  }

  asignarMaximosGeneralesModal(force = false) {
    (this.modalRecepcionPTs.items || []).forEach(item => {
      const disponible = this.getMaximoPermitidoModal(item);
      if (disponible <= 0) return;
      if (force || !item.cantidad_recibida || Number(item.cantidad_recibida) === 0) {
        item.cantidad_recibida = this.roundValue(disponible, 2);
      }
    });
    this.applyItemFiltersModal();
  }

  roundValue(value: number, decimals = 2): number {
    if (isNaN(value) || value === null) return 0;
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

  esCantidadValidaModal(item: any): boolean {
    const asignar = Number(item.cantidad_recibida) || 0;
    if (asignar <= 0) return false;
    const limite = Number(item.cantidad_teorica_total || 0);
    const acumulada = Number(item.cantidad_recibida_total || 0);
    const disponible = Math.max(0, limite - acumulada);
    return asignar <= disponible && asignar <= limite;
  }

  excedeTeoricaModal(item: any): boolean {
    const asignar = Number(item.cantidad_recibida) || 0;
    const limite = Number(item.cantidad_teorica_total || 0);
    return asignar > limite;
  }

  get totalRecibidoModal(): number {
    return (this.modalRecepcionPTs.items || []).reduce((sum, it) => sum + (Number(it.cantidad_recibida) || 0), 0);
  }

  guardarRecepcionModal() {
    // Evitar múltiples clics
    if (this.loadingGuardarModal) {
      return;
    }

    const itemsParaGuardar = (this.modalRecepcionPTs.items || [])
      .filter(i => Number(i.cantidad_recibida) > 0)
      .map(i => ({
        f120_id: i.f120_id,
        codigo: i.codigo,
        descripcion: i.descripcion,
        id_color: i.id_color,
        id_talla: i.id_talla,
        cantidad_teorica: Number(i.cantidad_teorica_total),
        cantidad_recibida: Number(i.cantidad_recibida),
        precio_unitario: i.precio_unitario
      }));

    if (itemsParaGuardar.length === 0) {
      Swal.fire('Atención', 'No hay cantidades para guardar', 'warning');
      return;
    }

    Swal.fire({
      title: 'Confirmar recepción',
      html: `Se guardarán <strong>${itemsParaGuardar.length}</strong> ítems con un total de <strong>${this.totalRecibidoModal}</strong> unidades.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, guardar',
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (result.isConfirmed) {
        this.loadingGuardarModal = true; // ← Activar loading

        const usuario = this.authService.user?.id || 0;
        
        // Generar hashes para los items del modal
        this.terminacionEmpaqueService.generarHashes(itemsParaGuardar)
          .subscribe(hashesGenerados => {
            const recibidos = itemsParaGuardar.map((item, idx) => ({
              hash: hashesGenerados[idx].hash,
              referencia: item.codigo,
              id_item: item.f120_id,
              descripcion: item.descripcion,
              id_color: item.id_color,
              id_talla: item.id_talla,
              cantidad_teorica: item.cantidad_teorica,
              cantidad_recibida: item.cantidad_recibida,
              precio_unitario: item.precio_unitario,
              ubicacion: 'Empaque',
              comentario: ''
            }));

            console.log('Recibidos a guardar:', recibidos);
            console.log(itemsParaGuardar)

            console.log('Modal PT:', this.modalRecepcionPTs);

            const ptCodigo = this.modalRecepcionPTs.ptIngresado;
            const pvCodigo = this.modalRecepcionPTs.pv;
            
            this.terminacionEmpaqueService
              .registrarRecepcionPT(recibidos, ptCodigo, pvCodigo, usuario)
              .subscribe({
                next: () => {
                  this.loadingGuardarModal = false; // ← Desactivar loading
                  Swal.fire('Éxito', 'Recepción de PT guardada correctamente', 'success');
                  
                  // ====== LIMPIAR Y ACTUALIZAR ======
                  // Limpiar inputs del modal
                  this.modalRecepcionPTs.ptIngresado = '';
                  this.modalRecepcionPTs.pv = '';
                  
                  // Limpiar cantidades recibidas de los items
                  this.modalRecepcionPTs.items.forEach(item => {
                    item.cantidad_recibida_total += item.cantidad_recibida;
                    item.cantidad_recibida = 0;
                  });
                  
                  // Actualizar la vista
                  this.applyItemFiltersModal();
                  
                  // Cerrar el modal
                  this.cerrarModalRecepcionPTs();
                },
                error: () => {
                  this.loadingGuardarModal = false; // ← Desactivar loading
                  Swal.fire('Error', 'No se pudo guardar la recepción', 'error');
                }
              });
          });
      }
    });
  }

  // Funciones para el modal de ubicación distinta
  abrirModalUbicacion(item: ItemRecepcion): void {
    this.modalUbicacion = {
      item: item,
      cantidad: item.cantidad_recibida,
      mostrar: true,
      ubicacionSeleccionada: 'Terminacion',
      comentario: ''
    };

    const modalEl = document.getElementById('ubicacionModal');
    if (modalEl) {
      const modal = new Modal(modalEl);
      modal.show();
    }
  }

  cerrarModalUbicacion(): void {
    const modalEl = document.getElementById('ubicacionModal');
    if (modalEl) {
      const modal = Modal.getInstance(modalEl);
      modal?.hide();
    }
    this.modalUbicacion.mostrar = false;
    this.modalUbicacion.comentario = '';
    this.modalUbicacion.ubicacionSeleccionada = 'Terminacion';
  }

  confirmarUbicacionDistinta(): void {
    if (!this.modalUbicacion.cantidad || this.modalUbicacion.cantidad <= 0) {
      Swal.fire('Error', 'Debe ingresar una cantidad válida', 'error');
      return;
    }

    if ((this.modalUbicacion.ubicacionSeleccionada === 'Bordado' || this.modalUbicacion.ubicacionSeleccionada === 'Estampado') 
        && !this.modalUbicacion.comentario.trim()) {
      Swal.fire('Error', 'Debe ingresar un comentario para ubicaciones distintas a Terminación', 'error');
      return;
    }

    const item = this.modalUbicacion.item;
    if (!item) {
      Swal.fire('Error', 'No se ha seleccionado un ítem válido', 'error');
      return;
    }

    // *** VALIDAR QUE NO EXCEDA LA CANTIDAD TEÓRICA ***
    const totalRecibidoActual = item.cantidad_recibida_total + item.cantidad_recibida + this.getTotalUbicacionesDistintas(item);
    if (totalRecibidoActual + this.modalUbicacion.cantidad > item.cantidad_teorica_total) {
      Swal.fire('Error', `No puede recepcionar más de ${item.cantidad_teorica_total} unidades. Ya tiene ${totalRecibidoActual} recepcionadas.`, 'error');
      return;
    }

    if (!item.ubicaciones_distintas) {
      item.ubicaciones_distintas = [];
    }

    const ubicacionExistente = item.ubicaciones_distintas.find(
      u => u.ubicacion === this.modalUbicacion.ubicacionSeleccionada && u.esNueva === true
    );

    if (ubicacionExistente) {
      ubicacionExistente.cantidad += this.modalUbicacion.cantidad;
      if (this.modalUbicacion.comentario.trim()) {
        ubicacionExistente.comentario = this.modalUbicacion.comentario;
      }
    } else {
      item.ubicaciones_distintas.push({
        ubicacion: this.modalUbicacion.ubicacionSeleccionada,
        cantidad: this.modalUbicacion.cantidad,
        comentario: this.modalUbicacion.comentario || '',
        fecha: new Date(),
        esNueva: true
      });
    }

    item.cantidad_recibida = 0;
    
    this.cerrarModalUbicacion();
    this.applyFilters();
    
    Swal.fire('Éxito', 'Ubicación asignada correctamente, Aún se debe guardar la recepción', 'success');
  }

  // Funciones para ver ubicaciones distintas
  abrirModalVerUbicaciones(item: ItemRecepcion): void {
    this.modalVerUbicaciones = {
      item: item,
      mostrar: true
    };

    const modalEl = document.getElementById('verUbicacionesModal');
    if (modalEl) {
      const modal = new Modal(modalEl);
      modal.show();
    }
  }

  cerrarModalVerUbicaciones(): void {
    const modalEl = document.getElementById('verUbicacionesModal');
    if (modalEl) {
      const modal = Modal.getInstance(modalEl);
      modal?.hide();
    }
    this.modalVerUbicaciones.mostrar = false;
  }

  cambiarUbicacion(item: any, ubicacionDistinta: UbicacionDistinta, nuevaUbicacion: string): void {
    Swal.fire({
      title: '¿Cambiar ubicación?',
      text: `¿Desea mover ${ubicacionDistinta.cantidad} unidades de ${ubicacionDistinta.ubicacion} a ${nuevaUbicacion}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, cambiar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        if ((nuevaUbicacion === 'Bordado' || nuevaUbicacion === 'Estampado') && !ubicacionDistinta.comentario) {
          Swal.fire({
            title: 'Comentario requerido',
            input: 'textarea',
            html: '<label>Ingrese el motivo del cambio:</label>',
            inputPlaceholder: 'Escriba aquí el motivo...',
            showCancelButton: true,
            confirmButtonText: 'Guardar',
            cancelButtonText: 'Cancelar'
          }).then((comentarioResult) => {
            if (comentarioResult.isConfirmed && comentarioResult.value) {
              this.guardarCambioUbicacion(item, ubicacionDistinta, nuevaUbicacion, comentarioResult.value);
            }
          });
        } else {
          this.guardarCambioUbicacion(item, ubicacionDistinta, nuevaUbicacion, ubicacionDistinta.comentario);
        }
      }
    });
  }

  private guardarCambioUbicacion(
    item: any,
    ubicacionDistinta: UbicacionDistinta,
    nuevaUbicacion: string,
    comentario?: string
  ) {
    const payload = {
      op_codigo: this.opSeleccionada!.codigo,
      item_hash: item.hash,
      referencia: item.codigo,
      id_item: item.f120_id,
      descripcion: item.descripcion,
      id_color: item.id_color,
      id_talla: item.id_talla,
      cantidad_recibida: ubicacionDistinta.cantidad, // la cantidad que se mueve
      precio_unitario: item.precio_unitario,
      usuario: this.authService.user?.id ?? '', // <- asegúrate de tener este valor en tu componente
      ubicacion_actual: ubicacionDistinta.ubicacion,
      ubicacion: nuevaUbicacion,
      comentario: comentario ?? ''
    };

    this.terminacionEmpaqueService.actualizarUbicacion(payload).subscribe({
      next: (res) => {
        ubicacionDistinta.ubicacion = nuevaUbicacion;
        ubicacionDistinta.fecha = new Date();
        ubicacionDistinta.comentario = comentario ?? '';
        Swal.fire('Éxito', 'Ubicación cambiada correctamente', 'success');
      },
      error: () => {
        Swal.fire('Error', 'No se pudo actualizar la ubicación', 'error');
      }
    });
  }

  // Verificar si el item tiene ubicaciones distintas
  tieneUbicacionesDistintas(item: ItemRecepcion): boolean {
    console.log('Verificando ubicaciones distintas para item:', item);
    return !!(item.ubicaciones_distintas && item.ubicaciones_distintas.length > 0);
  }

  // Obtener total de cantidades en ubicaciones distintas
  getTotalUbicacionesDistintas(item: ItemRecepcion): number {
    if (!item.ubicaciones_distintas) return 0;
    return item.ubicaciones_distintas
      .filter(ub => ub.esNueva === true)
      .reduce((sum, ub) => sum + ub.cantidad, 0);
  }

  applyFilters(): void {
    this.paginationService.updatePaginator(
      this.paginatorId,
      this.items,
      undefined,
      this.filters,
      this.filterFunction,
      true
    );
    this.currentItems = this.paginationService.getPaginatorState(this.paginatorId)?.currentData || [];
  }

  filterFunction: FilterFunction = (item, filtros) => {
    const texto = filtros.busqueda.toLowerCase();
    return !texto || Object.values(item).some(v => v?.toString().toLowerCase().includes(texto));
  };

  guardarRecepcion(): void {
    // Evitar múltiples clics
    if (this.loadingGuardarRecepcion) {
      return;
    }

    if (!this.opSeleccionada) {
      Swal.fire('Error', 'Selecciona una OP primero', 'error');
      return;
    }

    const usuario = this.authService.user?.id ?? 0;

    const itemsNormales = this.items
      .filter(i => i.cantidad_recibida > 0)
      .map(i => ({
        f120_id: i.f120_id,
        codigo: i.codigo,
        descripcion: i.descripcion,
        id_color: i.id_color,
        id_talla: i.id_talla,
        cantidad_recibida: i.cantidad_recibida,
        precio_unitario: i.precio_unitario || 0
      }));

    const itemsUbicacionesDistintas = this.items
      .filter(i => this.tieneUbicacionesDistintas(i))
      .map(i => 
        i.ubicaciones_distintas!
          .filter(ub => ub.esNueva === true) // ← FILTRAR SOLO NUEVAS
          .map(ub => ({
            f120_id: i.f120_id,
            codigo: i.codigo,
            descripcion: i.descripcion,
            id_color: i.id_color,
            id_talla: i.id_talla,
            cantidad_recibida: ub.cantidad,
            precio_unitario: i.precio_unitario || 0,
            ubicacion: ub.ubicacion,
            comentario: ub.comentario
          }))
      )
      .reduce((acc, val) => acc.concat(val), []);

    const todosLosItems = [...itemsNormales, ...itemsUbicacionesDistintas];

    if (todosLosItems.length === 0) {
      Swal.fire('Aviso', 'Debes ingresar al menos una cantidad recibida.', 'info');
      return;
    }

    Swal.fire({
      title: 'Confirmar recepción',
      html: `Se guardarán <strong>${todosLosItems.length}</strong> registros con un total de <strong>${this.totalRecibido}</strong> unidades.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, guardar',
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (result.isConfirmed) {
        this.loadingGuardarRecepcion = true; // ← Activar loading

        this.terminacionEmpaqueService.generarHashes(todosLosItems)
          .subscribe(hashesGenerados => {
            const recibidos = todosLosItems.map((item, idx) => ({
              hash: hashesGenerados[idx].hash,
              referencia: item.codigo,
              id_item: item.f120_id,
              descripcion: item.descripcion,
              id_color: item.id_color,
              id_talla: item.id_talla,
              cantidad_recibida: item.cantidad_recibida,
              precio_unitario: item.precio_unitario || 0,
              ubicacion: (item as any).ubicacion || 'Terminacion',
              comentario: (item as any).comentario || ''
            }));

            this.terminacionEmpaqueService
              .registrarRecepcion(recibidos, this.opSeleccionada!.codigo, usuario)
              .subscribe({
                next: () => {
                  this.loadingGuardarRecepcion = false; // ← Desactivar loading
                  Swal.fire('Éxito', 'Recepción guardada', 'success');
                  
                  // ====== LIMPIAR Y ACTUALIZAR ======
                  this.items.forEach(i => {
                    // Sumar cantidades normales
                    if (i.cantidad_recibida > 0) {
                      i.cantidad_recibida_total += i.cantidad_recibida;
                    }
                    
                    // Sumar y marcar ubicaciones distintas como guardadas
                    if (i.ubicaciones_distintas && i.ubicaciones_distintas.length > 0) {
                      i.ubicaciones_distintas.forEach(ub => {
                        if (ub.esNueva) {
                          i.cantidad_recibida_total += ub.cantidad;
                          ub.esNueva = false; // ← Marcar como guardada
                        }
                      });
                    }
                    
                    // Limpiar solo cantidad normal
                    i.cantidad_recibida = 0;
                  });
                  
                  // Actualizar vista
                  this.applyFilters();
                  
                  // Verificar estado de PTs
                  this.verificarEstadoPTs();
                },
                error: () => {
                  this.loadingGuardarRecepcion = false; // ← Desactivar loading
                  Swal.fire('Error', 'No se pudo guardar', 'error');
                }
              });
          });
      }
    });
  }

  get totalRecibido(): number {
    return this.items.reduce((sum, i) => {
      const normal = i.cantidad_recibida || 0;
      const ubicacionesDistintas = this.getTotalUbicacionesDistintas(i);
      return sum + normal + ubicacionesDistintas;
    }, 0);
  }
}