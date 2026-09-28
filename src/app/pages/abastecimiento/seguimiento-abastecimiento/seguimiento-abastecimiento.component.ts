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

  verDetalleMuestra(solicitudId: number): void {
    this.router.navigate(['/muestras/detalle', solicitudId]);
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
}
