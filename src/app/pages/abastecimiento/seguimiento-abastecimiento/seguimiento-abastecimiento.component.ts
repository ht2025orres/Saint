import { Component, OnInit, OnDestroy, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Router } from '@angular/router';
import { ComercialService } from '../../../services/comercial.service';
import { AuthService } from '../../../services/auth.service';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-seguimiento-abastecimiento',
  templateUrl: './seguimiento-abastecimiento.component.html',
  styleUrls: ['./seguimiento-abastecimiento.component.css']
})
export class SeguimientoAbastecimientoComponent implements OnInit, OnDestroy {
  solicitudes: any[] = [];
  filteredSolicitudes: any[] = [];
  isLoading = false;

  // Filtros
  searchTerm = '';
  searchSubject = new Subject<string>();
  private searchSub?: Subscription;

  filtroSemaforo: 'TODOS' | 'PENDIENTES' | 'PARCIALES' | 'COMPLETOS' = 'TODOS';
  filtroTipoMaterial: 'TODOS' | 'TELA' | 'INSUMO' = 'TODOS';

  // Métricas Globales
  kpis = {
    totalSolicitudes: 0,
    totalMateriales: 0,
    pendientes: 0,
    parciales: 0,
    completos: 0,
    porcentajeGlobal: 0
  };

  // Solicitud desplegada / expandida
  expandedSolicitudId: number | null = null;

  // Modal de Despacho
  showDespachoModal = false;
  selectedMaterial: any = null;
  selectedSolicitud: any = null;
  despachoCantidad = 1;
  despachoEsTotal = false;
  despachoModo: 'acumular' | 'fijar' = 'acumular';
  despachoObservaciones = '';
  isSavingDespacho = false;

  // Modal de Adición de Insumo / Tela
  showAddMaterialModal = false;
  targetSolicitudId: number | null = null;
  materialModalTab: 'siesa' | 'manual' = 'siesa';
  siesaSoloConStock: boolean = true;
  siesaSearchQuery = '';
  siesaSearchResults: any[] = [];
  isSearchingSiesa = false;
  siesaSelectedCategory = 'TODOS';

  nuevoMaterial: any = {
    id: null,
    solicitud_item_id: null,
    tipo_material: 'INSUMO',
    grupo_insumo: 'BOTONES',
    origen_asignacion: 'SIESA',
    siesa_id_item: '',
    siesa_referencia: '',
    siesa_descripcion: '',
    siesa_id_color: '',
    siesa_color: '',
    descripcion_personalizada: '',
    cantidad_requerida: 1,
    unidad_medida: 'UND',
  };

  constructor(
    private comercialService: ComercialService,
    public authService: AuthService,
    private router: Router,
    @Inject(DOCUMENT) private document: Document
  ) {}

  ngOnInit(): void {
    this.loadTailwind();
    this.setupSearchDebounce();
    this.cargarSolicitudes();
  }

  ngOnDestroy(): void {
    if (this.searchSub) {
      this.searchSub.unsubscribe();
    }
  }

  private loadTailwind(): void {
    if (!this.document.getElementById('tw-cdn-abast')) {
      const link = this.document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css';
      link.id = 'tw-cdn-abast';
      this.document.head.appendChild(link);
    }
    if (!this.document.getElementById('bi-cdn-abast')) {
      const icons = this.document.createElement('link');
      icons.rel = 'stylesheet';
      icons.href = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css';
      icons.id = 'bi-cdn-abast';
      this.document.head.appendChild(icons);
    }
  }

  private setupSearchDebounce(): void {
    this.searchSub = this.searchSubject
      .pipe(debounceTime(350), distinctUntilChanged())
      .subscribe(() => {
        this.cargarSolicitudes();
      });
  }

  onSearchInput(): void {
    this.searchSubject.next(this.searchTerm);
  }

  setFiltroSemaforo(filtro: 'TODOS' | 'PENDIENTES' | 'PARCIALES' | 'COMPLETOS'): void {
    this.filtroSemaforo = filtro;
    this.cargarSolicitudes();
  }

  cargarSolicitudes(): void {
    this.isLoading = true;
    const params: any = {
      q: this.searchTerm.trim() || undefined,
      estado_entrega: this.filtroSemaforo !== 'TODOS' ? this.filtroSemaforo : undefined,
      per_page: 50
    };

    this.comercialService.listarSolicitudesAbastecimiento(params).subscribe({
      next: (res) => {
        this.solicitudes = res.data || [];
        this.calcularKpis();
        this.isLoading = false;
      },
      error: (err) => {
        Swal.fire('Error', 'No se pudieron cargar las solicitudes de abastecimiento', 'error');
        this.isLoading = false;
      }
    });
  }

  calcularKpis(): void {
    let totalMats = 0;
    let pendientes = 0;
    let parciales = 0;
    let completos = 0;

    this.solicitudes.forEach((sol) => {
      const sem = sol.metricas_abastecimiento?.semaforo;
      if (sem === 'COMPLETO') completos++;
      else if (sem === 'PARCIAL') parciales++;
      else pendientes++;

      totalMats += (sol.materiales?.length || 0);
    });

    const totalSols = this.solicitudes.length;
    this.kpis = {
      totalSolicitudes: totalSols,
      totalMateriales: totalMats,
      pendientes,
      parciales,
      completos,
      porcentajeGlobal: totalSols > 0 ? Math.round((completos / totalSols) * 100) : 0
    };
  }

  toggleExpand(solicitudId: number): void {
    this.expandedSolicitudId = this.expandedSolicitudId === solicitudId ? null : solicitudId;
  }

  // ==================== OPERACIÓN LOGÍSTICA: LISTO PARA RECOGER & COSTOS ====================

  toggleListoParaRecoger(mat: any, sol?: any): void {
    const yaEstaListo = mat.estado_entrega === 'ENTREGADO';
    const nuevoEstado = yaEstaListo ? 'PENDIENTE' : 'ENTREGADO';
    const nuevaCant = yaEstaListo ? 0 : (mat.cantidad_requerida || 1);

    const payload = {
      cantidad_despachada: nuevaCant,
      modo_despacho: 'fijar',
      es_entrega_total: !yaEstaListo,
      estado_entrega: nuevoEstado,
      observaciones_despacho: yaEstaListo ? 'Desmarcado de listo para recoger' : 'Marcado listo para recoger en bodega'
    };

    this.comercialService.despacharMaterial(mat.id, payload).subscribe({
      next: () => {
        mat.estado_entrega = nuevoEstado;
        mat.cantidad_entregada = nuevaCant;
        mat.fecha_ultimo_despacho = yaEstaListo ? null : new Date().toISOString();

        if (sol && sol.materiales) {
          const total = sol.materiales.length;
          const entregados = sol.materiales.filter((m: any) => m.estado_entrega === 'ENTREGADO').length;
          const parciales = sol.materiales.filter((m: any) => m.estado_entrega === 'PARCIAL').length;
          const pendientes = total - entregados - parciales;
          const porcentaje = total > 0 ? Math.round((entregados / total) * 100) : 0;
          let semaforo = 'PENDIENTE';
          if (total > 0 && entregados === total) semaforo = 'COMPLETO';
          else if (entregados > 0 || parciales > 0) semaforo = 'PARCIAL';

          sol.metricas_abastecimiento = {
            total_materiales: total,
            entregados,
            parciales,
            pendientes,
            porcentaje_entrega: porcentaje,
            semaforo
          };
        }

        const Toast = Swal.mixin({
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 1800,
          timerProgressBar: true
        });
        Toast.fire({
          icon: yaEstaListo ? 'info' : 'success',
          title: yaEstaListo ? 'Vuelto a pendiente' : '¡Listo para recoger en bodega!'
        });
      },
      error: (err) => {
        Swal.fire('Error', err.error?.message || 'No se pudo actualizar el estado', 'error');
      }
    });
  }

  marcarTodosListosParaRecoger(sol: any): void {
    if (!sol?.id) return;

    Swal.fire({
      title: '¿Marcar todos listos para recoger?',
      html: `
        <div class="text-left text-xs space-y-2">
          <p>Se marcarán como <strong>alistados y listos para recoger</strong> todos los materiales de la solicitud <strong>${sol.codigo || ('SOL-' + sol.id)}</strong>.</p>
          <p class="text-slate-500 mb-0 font-medium">Taller de confección podrá pasar por todos los insumos a bodega.</p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, marcar todos listos',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#059669'
    }).then((res) => {
      if (res.isConfirmed) {
        this.comercialService.despacharTodosMateriales(sol.id).subscribe({
          next: () => {
            if (sol.materiales) {
              sol.materiales.forEach((m: any) => {
                m.estado_entrega = 'ENTREGADO';
                m.cantidad_entregada = m.cantidad_requerida;
                m.fecha_ultimo_despacho = new Date().toISOString();
              });
              sol.metricas_abastecimiento = {
                total_materiales: sol.materiales.length,
                entregados: sol.materiales.length,
                parciales: 0,
                pendientes: 0,
                porcentaje_entrega: 100,
                semaforo: 'COMPLETO'
              };
            }

            Swal.fire({
              title: '¡Todos Listos!',
              text: 'Todos los materiales han quedado marcados como listos para recoger en bodega.',
              icon: 'success',
              timer: 1800,
              showConfirmButton: false
            });
          },
          error: (err) => {
            Swal.fire('Error', err.error?.message || 'No se pudo marcar todos', 'error');
          }
        });
      }
    });
  }

  editarCostoManual(mat: any): void {
    const costoActual = mat.costo_vigente_final || mat.ultimo_costo_siesa || '';

    Swal.fire({
      title: 'Ajustar Costo Vigente (Logística)',
      html: `
        <div class="text-left text-xs space-y-2 mb-3">
          <p class="font-bold text-slate-800 mb-0.5">Ítem: ${mat.nombre_material || mat.siesa_descripcion || 'Insumo'}</p>
          <p class="text-slate-500 font-mono text-[11px] mb-1">Ref SIESA: ${mat.siesa_referencia || 'N/A'}</p>
          <div class="text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200">
            <i class="bi bi-info-circle-fill mr-1"></i>
            Si el precio del sistema está sin movimientos o desactualizado, digita el costo unitario real.
          </div>
        </div>
      `,
      input: 'number',
      inputValue: costoActual,
      inputPlaceholder: 'Ingresa el costo unitario en COP',
      inputAttributes: {
        min: '0',
        step: '0.01'
      },
      showCancelButton: true,
      confirmButtonText: 'Guardar Costo',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#2563eb',
      inputValidator: (val) => {
        if (!val || Number(val) < 0) {
          return 'Ingresa un costo válido mayor o igual a 0';
        }
        return null;
      }
    }).then((res) => {
      if (res.isConfirmed && res.value !== undefined) {
        const nuevoCosto = Number(res.value);
        this.comercialService.actualizarCostoLogistica(mat.id, {
          costo_vigente_logistica: nuevoCosto,
          notas: 'Ajustado manualmente por Logística'
        }).subscribe({
          next: () => {
            mat.costo_vigente_final = nuevoCosto;
            mat.costo_vigente_logistica = nuevoCosto;
            mat.fuente_costo = 'LOGISTICA';
            mat.estado_costo = 'VIGENTE';

            const Toast = Swal.mixin({
              toast: true,
              position: 'top-end',
              showConfirmButton: false,
              timer: 2000,
              timerProgressBar: true
            });
            Toast.fire({
              icon: 'success',
              title: 'Costo actualizado correctamente'
            });
          },
          error: (err) => {
            Swal.fire('Error', err.error?.message || 'No se pudo actualizar el costo', 'error');
          }
        });
      }
    });
  }

  getClaseAntiguedadCosto(mat: any): string {
    if (mat.fuente_costo === 'LOGISTICA') {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    const estado = mat.estado_costo || 'SIN_MOVIMIENTO';
    switch (estado) {
      case 'VIGENTE':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'ALERTA':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'DESACTUALIZADO':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-50 text-slate-500 border-slate-200';
    }
  }

  getTextoAntiguedadCosto(mat: any): string {
    if (mat.fuente_costo === 'LOGISTICA') {
      return 'Fijado Logística';
    }
    const dias = mat.antiguedad_dias;
    if (dias === null || dias === undefined) {
      return 'Sin movimiento';
    }
    if (dias === 0) return 'Hoy';
    if (dias === 1) return 'Hace 1 día';
    if (dias < 30) return `Hace ${dias} días`;
    const meses = Math.floor(dias / 30);
    if (meses === 1) return 'Hace 1 mes';
    return `Hace ${meses} meses`;
  }

  abreviarUnidad(unidad?: string): string {
    if (!unidad) return '';
    const u = unidad.trim().toUpperCase();
    if (u === 'METROS' || u === 'METRO') return 'MTR';
    if (u === 'UNIDAD' || u === 'UNIDADES') return 'UND';
    if (u === 'KILOS' || u === 'KILOGRAMOS') return 'KG';
    if (u === 'CONOS' || u === 'CONO') return 'CONO';
    return u;
  }

  getPartesUbicacion(ubicacion?: string): { bodega: string | null; zona: string } {
    if (!ubicacion) return { bodega: null, zona: 'Sin zona' };
    if (ubicacion.includes(' · ')) {
      const parts = ubicacion.split(' · ');
      return { bodega: parts[0], zona: parts[1] };
    }
    return { bodega: null, zona: ubicacion };
  }

  // ==================== DESPACHO DE MATERIALES ====================

  abrirModalDespacho(material: any, solicitud: any): void {
    this.selectedMaterial = material;
    this.selectedSolicitud = solicitud;
    
    // Por defecto sugerir saldo pendiente
    const pendiente = Math.max(0, (material.cantidad_requerida || 0) - (material.cantidad_entregada || 0));
    this.despachoCantidad = pendiente > 0 ? pendiente : (material.cantidad_requerida || 1);
    this.despachoEsTotal = this.despachoCantidad >= (material.cantidad_requerida || 0);
    this.despachoModo = 'acumular';
    this.despachoObservaciones = '';
    this.showDespachoModal = true;
  }

  cerrarModalDespacho(): void {
    this.showDespachoModal = false;
    this.selectedMaterial = null;
    this.selectedSolicitud = null;
  }

  sugerirSaldoTotal(): void {
    if (!this.selectedMaterial) return;
    const req = Number(this.selectedMaterial.cantidad_requerida) || 0;
    const ent = Number(this.selectedMaterial.cantidad_entregada) || 0;
    this.despachoCantidad = Math.max(0, req - ent);
    this.despachoEsTotal = true;
    this.despachoModo = 'acumular';
  }

  guardarDespacho(): void {
    if (!this.selectedMaterial) return;
    if (this.despachoCantidad <= 0 && this.despachoModo === 'acumular') {
      Swal.fire('Atención', 'Ingresa una cantidad a despachar mayor a 0', 'warning');
      return;
    }

    this.isSavingDespacho = true;
    const payload = {
      cantidad_despachada: this.despachoCantidad,
      modo_despacho: this.despachoModo,
      es_entrega_total: this.despachoEsTotal,
      observaciones_despacho: this.despachoObservaciones.trim() || undefined
    };

    this.comercialService.despacharMaterial(this.selectedMaterial.id, payload).subscribe({
      next: () => {
        Swal.fire({
          icon: 'success',
          title: '¡Despacho Registrado!',
          text: `Entrega de ${this.despachoCantidad} ${this.selectedMaterial.unidad_medida} registrada correctamente.`,
          timer: 1600,
          showConfirmButton: false
        });
        this.isSavingDespacho = false;
        this.cerrarModalDespacho();
        this.cargarSolicitudes();
      },
      error: (err) => {
        this.isSavingDespacho = false;
        Swal.fire('Error', err.error?.message || 'No se pudo registrar el despacho', 'error');
      }
    });
  }

  // ==================== AGREGAR MATERIAL DIRECTO DESDE LOGÍSTICA ====================

  abrirModalAgregarMaterial(solicitudId: number): void {
    this.targetSolicitudId = solicitudId;
    this.nuevoMaterial = {
      id: null,
      solicitud_item_id: null,
      tipo_material: 'INSUMO',
      grupo_insumo: 'BOTONES',
      origen_asignacion: 'SIESA',
      siesa_id_item: '',
      siesa_referencia: '',
      siesa_descripcion: '',
      siesa_id_color: '',
      siesa_color: '',
      descripcion_personalizada: '',
      cantidad_requerida: 1,
      unidad_medida: 'UND',
    };
    this.siesaSearchQuery = '';
    this.siesaSearchResults = [];
    this.materialModalTab = 'siesa';
    this.showAddMaterialModal = true;
    this.buscarInsumosSiesa();
  }

  cerrarModalAddMaterial(): void {
    this.showAddMaterialModal = false;
    this.targetSolicitudId = null;
  }

  setMaterialModalTab(tab: 'siesa' | 'manual'): void {
    this.materialModalTab = tab;
    this.nuevoMaterial.origen_asignacion = tab === 'siesa' ? 'SIESA' : 'MANUAL';
  }

  toggleSiesaStock(): void {
    this.siesaSoloConStock = !this.siesaSoloConStock;
    this.buscarInsumosSiesa();
  }

  buscarInsumosSiesa(): void {
    this.isSearchingSiesa = true;
    this.comercialService.buscarInsumosSiesa({
      q: this.siesaSearchQuery,
      con_stock: this.siesaSoloConStock,
      bodega: 'MP001',
      grupo: this.siesaSelectedCategory !== 'TODOS' ? this.siesaSelectedCategory : undefined
    }).subscribe({
      next: (res) => {
        this.siesaSearchResults = res.data || [];
        this.isSearchingSiesa = false;
      },
      error: () => {
        this.siesaSearchResults = [];
        this.isSearchingSiesa = false;
      }
    });
  }

  seleccionarInsumoSiesa(item: any): void {
    this.nuevoMaterial.siesa_id_item = item.id_item;
    this.nuevoMaterial.siesa_referencia = item.referencia;
    this.nuevoMaterial.siesa_descripcion = item.descripcion;
    this.nuevoMaterial.siesa_id_color = item.id_color;
    this.nuevoMaterial.siesa_color = item.color;
    this.nuevoMaterial.tipo_material = item.es_tela ? 'TELA' : 'INSUMO';
    this.nuevoMaterial.grupo_insumo = item.grupo;
    this.nuevoMaterial.unidad_medida = item.es_tela ? 'METROS' : 'UND';
    this.nuevoMaterial.descripcion_personalizada = `${item.referencia} - ${item.descripcion} (${item.color || 'ESTÁNDAR'})`;
  }

  guardarNuevoMaterial(): void {
    if (!this.targetSolicitudId) return;

    if (this.materialModalTab === 'manual' && !this.nuevoMaterial.descripcion_personalizada?.trim()) {
      Swal.fire('Atención', 'Por favor ingresa el nombre o descripción del insumo/tela', 'warning');
      return;
    }

    if (this.materialModalTab === 'siesa' && !this.nuevoMaterial.siesa_referencia) {
      Swal.fire('Atención', 'Por favor selecciona un material del catálogo de SIESA o escribe en modo manual', 'warning');
      return;
    }

    if (!this.nuevoMaterial.cantidad_requerida || this.nuevoMaterial.cantidad_requerida <= 0) {
      Swal.fire('Atención', 'Ingresa una cantidad requerida válida', 'warning');
      return;
    }

    const payload = {
      materiales: [this.nuevoMaterial],
      creado_por_rol: 'INGENIERIA'
    };

    this.comercialService.guardarMateriales(this.targetSolicitudId, payload).subscribe({
      next: () => {
        Swal.fire({
          icon: 'success',
          title: 'Material Agregado',
          text: 'El requerimiento se añadió al pedido',
          timer: 1500,
          showConfirmButton: false
        });
        this.cerrarModalAddMaterial();
        this.cargarSolicitudes();
      },
      error: (err) => {
        Swal.fire('Error', err.error?.message || 'No se pudo guardar el material', 'error');
      }
    });
  }

  eliminarMaterial(materialId: number): void {
    Swal.fire({
      title: '¿Eliminar requerimiento?',
      text: 'Se removerá este material del pedido de abastecimiento',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((res) => {
      if (res.isConfirmed) {
        this.comercialService.eliminarMaterial(materialId).subscribe({
          next: () => {
            Swal.fire('Eliminado', 'Material eliminado correctamente', 'success');
            this.cargarSolicitudes();
          },
          error: () => {
            Swal.fire('Error', 'No se pudo eliminar el material', 'error');
          }
        });
      }
    });
  }

  // ==================== PLANO RQT Y ANCLAJE SIESA ====================

  generarPlanoRqt(sol: any, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    Swal.fire({
      title: 'Generando Plano RQT SIESA...',
      text: 'Estructurando archivo de Requisición de Taller para importación en SIESA',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    this.comercialService.generarArchivoPlanoRqt(sol.id).subscribe({
      next: (res) => {
        Swal.close();
        if (res.success && res.data) {
          const blob = new Blob([res.data.contenido], { type: 'text/plain;charset=utf-8' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = res.data.nombre_archivo;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);

          Swal.fire({
            title: '¡Plano RQT Descargado!',
            html: `
              <div class="text-left text-xs space-y-2">
                <p>Archivo: <strong>${res.data.nombre_archivo}</strong></p>
                <p>Total registros: <strong>${res.data.total_lineas}</strong></p>
                ${res.data.opm_asociada ? `<p class="text-emerald-700 font-bold">OPM vinculada: #${res.data.opm_asociada}</p>` : '<p class="text-amber-600 font-semibold">⚠️ Advertencia: No tiene OPM vinculada aún.</p>'}
                <p class="text-slate-500 italic mt-2">Importa este archivo en SIESA para crear la Requisición de Taller (RQT) en Bodega MP001.</p>
              </div>
            `,
            icon: 'success'
          });
        }
      },
      error: (err) => {
        Swal.fire('Error', err.error?.message || 'No se pudo generar el plano RQT', 'error');
      }
    });
  }

  abrirModalAnclarRqt(sol: any, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    Swal.fire({
      title: 'Anclar Consecutivo RQT de SIESA',
      text: `Ingresa el número oficial de la Requisición de Taller generada en SIESA para la solicitud ${sol.codigo}:`,
      input: 'text',
      inputValue: sol.siesa_rqt_consecutivo || '',
      inputPlaceholder: 'Ej: 00014523 o 14523',
      showCancelButton: true,
      confirmButtonText: 'Guardar y Anclar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#059669',
      inputValidator: (value) => {
        if (!value || !value.trim()) {
          return 'Debes ingresar un consecutivo válido';
        }
        return null;
      }
    }).then((res) => {
      if (res.isConfirmed && res.value) {
        const consecutivo = res.value.trim();
        this.comercialService.anclarRqtSiesa(sol.id, consecutivo).subscribe({
          next: () => {
            sol.siesa_rqt_consecutivo = consecutivo;
            const Toast = Swal.mixin({
              toast: true,
              position: 'top-end',
              showConfirmButton: false,
              timer: 2500,
              timerProgressBar: true
            });
            Toast.fire({
              icon: 'success',
              title: `RQT #${consecutivo} anclada exitosamente`
            });
          },
          error: (err) => {
            Swal.fire('Error', err.error?.message || 'No se pudo anclar la RQT', 'error');
          }
        });
      }
    });
  }
}
