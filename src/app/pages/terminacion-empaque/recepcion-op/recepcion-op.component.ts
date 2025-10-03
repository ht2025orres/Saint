import { Component, OnInit } from '@angular/core';
import { TerminacionEmpaqueService } from 'src/app/services/terminacion-empaque.service';
import { PaginationService, FilterFunction } from 'src/app/shared/pagination/pagination.service';
import { AuthService } from './../../../services/auth.service';
import md5 from 'blueimp-md5';
import { forkJoin } from 'rxjs';
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
  item: ItemRecepcion;
  cantidad: number;
  mostrar: boolean;
  ubicacionSeleccionada: string;
  comentario: string;
}

interface ModalVerUbicacionesData {
  item: ItemRecepcion;
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
    { value: 'Terminacion', label: 'Terminación' },
    { value: 'Bordado', label: 'Bordado' },
    { value: 'Estampado', label: 'Estampado' }
  ];

  constructor(
    private terminacionEmpaqueService: TerminacionEmpaqueService,
    public paginationService: PaginationService,
    private authService: AuthService    
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

  esDistribuidor(): boolean {
    const roles = (this.authService.user.roles || []).map((role: any) => typeof role === 'string' ? role : role.name || role);
    console.log(roles);
    return roles.includes('Distribuidor PV (Terminación y Empaque)');
  }

  buscarPVs(): void {
    this.busquedaIniciada = true;
    this.cargando = true;
    const opEncontrada = this.listaOPs.find(op => op.codigo === this.codigoOPSeleccionada);
    if (!opEncontrada) {
      this.cargando = false;
      Swal.fire('Advertencia', 'Debes seleccionar una OP válida', 'warning');
      return;
    }

    this.opSeleccionada = opEncontrada;

    this.terminacionEmpaqueService
    .listarPVsPorOPDesdeApiLaravel(opEncontrada.id)
    .subscribe({
      next: (respuesta) => {
        const cadenaPVs: string = respuesta[0]?.pvs || '';
        const numerosPV = cadenaPVs.match(/\d+/g) || [];

        if (numerosPV.length === 0) {
          Swal.fire('Sin PVs', 'La OP no tiene PVs asociadas', 'info');
          return;
        }

        const peticiones = numerosPV.map(pv =>
          this.terminacionEmpaqueService.listarItemsDePVDesdeApiLaravel(+pv)
        );

        forkJoin(peticiones).subscribe({
          next: (respuestas: any[][]) => {
            const items: any[] = [].concat(...respuestas);

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
                  .subscribe({
                    next: (response) => {
                      hashes.forEach(hash => {
                        const itemData = response['data'][hash];
                        if (itemData !== undefined) {
                          itemsUnificados[hash].cantidad_recibida_total = itemData.cantidad_recibida_total || 0;
                          if (itemData.ubicaciones_distintas) {
                            itemsUnificados[hash].ubicaciones_distintas = itemData.ubicaciones_distintas;
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
                    },
                    error: () => {
                      this.cargando = false;
                      Swal.fire('Error', 'No se pudo cargar cantidades recibidas locales', 'error');
                    }
                  });
              });
          },
          error: () => {
            this.cargando = false;  
            Swal.fire('Error', 'Error al obtener ítems de las PVs', 'error');
          }
        });
      },
      error: () => {
        this.cargando = false;  
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
  }

  cerrarModalRecepcionPTs() {
    this.modalRecepcionPTs.mostrar = false;
    this.busquedaIniciada = false;
  }

  buscarItemsEnModal() {
    const pt = (this.modalRecepcionPTs.ptIngresado || '').toString().trim();
    if (!pt) {
      Swal.fire('Atención', 'Debes ingresar un número de PT', 'warning');
      return;
    }

    this.modalRecepcionPTs.cargando = true;
    this.busquedaIniciada = true;
    this.modalRecepcionPTs.items = [];
    this.currentItemsModal = [];

    this.terminacionEmpaqueService.listarItemsDePVDesdeApiLaravel(+pt).subscribe({
      next: (res: any[]) => {
        if (!res || res.length === 0) {
          this.modalRecepcionPTs.cargando = false;
          Swal.fire('Atención', 'No se encontraron ítems para esta PT', 'info');
          return;
        }

        // ====== Extraer número de PV desde las notas ======
        const notaEjemplo = res[0]?.notas_completas || '';
        const matchPv = notaEjemplo.match(/PV\s*(\d+)/i);
        if (matchPv) {
          this.modalRecepcionPTs.pv = matchPv[1]; // Solo el número
          console.log('PV detectada desde notas:', this.modalRecepcionPTs.pv);
        }

        // ====== Unificar ítems por hash ======
        this.terminacionEmpaqueService.generarHashes(res).subscribe({
          next: (hashesGenerados: any[]) => {
            const itemsUnificados: Record<string, any> = {};

            res.forEach((item, i) => {
              const hash = hashesGenerados[i].hash;
              console.log('item de PT:', item);
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
              .subscribe({
                next: (response) => {
                  hashes.forEach(hash => {
                    const itemData = response['data'][hash];
                    if (itemData !== undefined) {
                      itemsUnificados[hash].cantidad_recibida_total =
                        itemData.cantidad_recibida_total || 0;

                      if (itemData.ubicaciones_distintas) {
                        itemsUnificados[hash].ubicaciones_distintas =
                          itemData.ubicaciones_distintas;
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
                },
                error: () => {
                  this.modalRecepcionPTs.cargando = false;
                  Swal.fire('Error', 'No se pudo cargar cantidades recibidas locales', 'error');
                }
              });
          },
          error: () => {
            this.modalRecepcionPTs.cargando = false;
            Swal.fire('Error', 'Error generando hashes para los ítems', 'error');
          }
        });
      },
      error: (err) => {
        console.error('Error cargando items PT:', err);
        this.modalRecepcionPTs.cargando = false;
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
      this.itemsFilterFunctionModal
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
    // console.log('Calculando total recibido modal:', this.modalRecepcionPTs.items);
    // console.log(this.modalRecepcionPTs);
    return (this.modalRecepcionPTs.items || []).reduce((sum, it) => sum + (Number(it.cantidad_recibida) || 0), 0);
  }

  guardarRecepcionModal() {
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
        const usuario = this.authService.user.id || 0;
        
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
              ubicacion: 'Terminacion',
              comentario: ''
            }));

            console.log('Recibidos a guardar:', recibidos);
            console.log(itemsParaGuardar)

            const ptCodigo = this.modalRecepcionPTs.ptIngresado;
            const pvCodigo = this.modalRecepcionPTs.pv;
            
            this.terminacionEmpaqueService
              .registrarRecepcionPT(recibidos, ptCodigo, pvCodigo, usuario)
              .subscribe({
                next: () => {
                  Swal.fire('Éxito', 'Recepción de PT guardada correctamente', 'success');
                  this.cerrarModalRecepcionPTs();
                },
                error: () => Swal.fire('Error', 'No se pudo guardar la recepción', 'error')
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
  }

  cerrarModalUbicacion(): void {
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
    if (!item.ubicaciones_distintas) {
      item.ubicaciones_distintas = [];
    }

    const ubicacionExistente = item.ubicaciones_distintas.find(
      u => u.ubicacion === this.modalUbicacion.ubicacionSeleccionada
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
        fecha: new Date()
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
  }

  cerrarModalVerUbicaciones(): void {
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
    usuario: this.authService.user.id, // <- asegúrate de tener este valor en tu componente
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
    return item.ubicaciones_distintas && item.ubicaciones_distintas.length > 0;
  }

  // Obtener total de cantidades en ubicaciones distintas
  getTotalUbicacionesDistintas(item: ItemRecepcion): number {
    if (!item.ubicaciones_distintas) return 0;
    return item.ubicaciones_distintas.reduce((sum, ub) => sum + ub.cantidad, 0);
  }

  applyFilters(): void {
    this.paginationService.updatePaginator(
      this.paginatorId,
      this.items,
      undefined,
      this.filters,
      this.filterFunction
    );
    this.currentItems = this.paginationService.getPaginatorState(this.paginatorId)?.currentData || [];
  }

  filterFunction: FilterFunction = (item, filtros) => {
    const texto = filtros.busqueda.toLowerCase();
    return !texto || Object.values(item).some(v => v?.toString().toLowerCase().includes(texto));
  };

  guardarRecepcion(): void {
    if (!this.opSeleccionada) {
      Swal.fire('Error', 'Selecciona una OP primero', 'error');
      return;
    }

    const usuario = this.authService.user.id || 0;

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
        i.ubicaciones_distintas!.map(ub => ({
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
              Swal.fire('Éxito', 'Recepción guardada', 'success');
              this.items.forEach(i => {
                i.cantidad_recibida_total += i.cantidad_recibida;
                i.cantidad_recibida = 0;
                i.ubicaciones_distintas = [];
              });
              this.applyFilters();
            },
            error: () => Swal.fire('Error', 'No se pudo guardar', 'error')
          });
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