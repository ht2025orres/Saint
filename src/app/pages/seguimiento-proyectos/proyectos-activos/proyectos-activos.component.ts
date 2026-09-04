import { Component, OnInit } from '@angular/core';
import { SeguimientoProyectosService, ProyectoFinanciero, ProyectoListResponse } from 'src/app/services/seguimiento-proyectos.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-proyectos-activos',
  templateUrl: './proyectos-activos.component.html',
  styleUrls: ['./proyectos-activos.component.scss']
})
export class ProyectosActivosComponent implements OnInit {
  proyectos: ProyectoFinanciero[] = [];
  loading = false;
  sincronizando = false;

  // Paginación
  currentPage = 1;
  totalPages = 1;
  totalItems = 0;
  perPage = 15;

  // Filtros
  searchTerm = '';
  estadoFiltro = 'todos';
  margenFiltro = 'todos';
  ejecucionFiltro = 'todos';
  procesoFiltro = 'todos';
  todasFechas = false;
  fechaInicio = '';
  fechaFin = '';
  searchTimeout: any;

  // Permisos y usuario Siesa
  usuarioSiesa = '';
  puedeVerTodos = true;
  procesoDefecto = 'todos';
  procesosPermitidos: string[] | null = null;

  // KPIs totales
  totales = {
    total_proyectos: 0,
    total_facturacion_presupuestada: 0,
    total_costo_presupuestado: 0,
    total_facturacion_real: 0,
    total_costo_real: 0
  };

  // Modal control
  proyectoSeleccionado: ProyectoFinanciero | null = null;
  mostrarModalDetalle = false;
  mostrarModalEditar = false;
  mostrarModalSincronizar = false;

  constructor(private spService: SeguimientoProyectosService) {}

  ngOnInit(): void {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    this.fechaInicio = this.formatDate(firstDay);
    this.fechaFin = this.formatDate(lastDay);

    // 1. Carga inmediata en <50ms desde la BD local
    this.cargarProyectos(1, true);

    // 2. Sincronización en segundo plano con Siesa sin bloquear al usuario
    this.sincronizarEnSegundoPlano();
  }

  onTodasFechasChange(): void {
    this.cargarProyectos(1);
  }

  private formatDate(date: Date): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  sincronizarEnSegundoPlano(): void {
    if (this.sincronizando) return;
    this.sincronizando = true;

    this.spService.sincronizarSiesa().subscribe({
      next: (resp) => {
        this.sincronizando = false;
        // Refrescar los datos locales silenciosamente
        this.cargarProyectos(this.currentPage, false);
      },
      error: (err) => {
        this.sincronizando = false;
        console.error('Error en la sincronización en segundo plano con Siesa:', err);
      }
    });
  }

  sincronizarYListar(): void {
    this.sincronizarEnSegundoPlano();
  }

  cargarProyectos(page: number = 1, showLoading: boolean = true): void {
    if (showLoading) {
      this.loading = true;
    }
    this.currentPage = page;

    this.spService.getProyectos({
      search: this.searchTerm || undefined,
      estado: this.estadoFiltro !== 'todos' ? this.estadoFiltro : undefined,
      margen: this.margenFiltro !== 'todos' ? this.margenFiltro : undefined,
      ejecucion: this.ejecucionFiltro !== 'todos' ? this.ejecucionFiltro : undefined,
      proceso: this.procesoFiltro !== 'todos' ? this.procesoFiltro : undefined,
      fecha_inicio: !this.todasFechas ? (this.fechaInicio || undefined) : undefined,
      fecha_fin: !this.todasFechas ? (this.fechaFin || undefined) : undefined,
      todas_fechas: this.todasFechas,
      page: this.currentPage,
      per_page: this.perPage
    }).subscribe({
      next: (resp: ProyectoListResponse) => {
        if (resp.success) {
          this.proyectos = resp.data;
          this.totales = resp.totales;
          this.totalPages = resp.paginacion.last_page;
          this.totalItems = resp.paginacion.total;
          
          if (resp.usuario_siesa) this.usuarioSiesa = resp.usuario_siesa;
          if (resp.puede_ver_todos !== undefined) this.puedeVerTodos = resp.puede_ver_todos;
          if (resp.proceso_defecto) {
            this.procesoDefecto = resp.proceso_defecto;
            if (!this.puedeVerTodos && resp.proceso_defecto !== 'todos') {
              // Solo forzar el primer proceso como default si no hay múltiples permitidos
              if (!resp.procesos_permitidos || resp.procesos_permitidos.length <= 1) {
                this.procesoFiltro = resp.proceso_defecto;
              }
            }
          }
          if (resp.procesos_permitidos) {
            this.procesosPermitidos = resp.procesos_permitidos;
          }
        }
        this.loading = false;
      },
      error: () => {
        if (showLoading) {
          Swal.fire('Error', 'No se pudieron cargar los proyectos', 'error');
        }
        this.loading = false;
      }
    });
  }

  onSearchChange(): void {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => this.cargarProyectos(1), 400);
  }

  onEstadoChange(): void {
    this.cargarProyectos(1);
  }

  onProcesoChange(): void {
    this.cargarProyectos(1);
  }

  esProcesoVisible(codigo: string): boolean {
    if (this.puedeVerTodos) return true;
    if (!this.procesosPermitidos || this.procesosPermitidos.length === 0) return true;
    return this.procesosPermitidos.includes(codigo);
  }

  onPerPageChange(): void {
    this.cargarProyectos(1);
  }

  getProcesoBadgeClass(codigo?: string): string {
    switch (codigo) {
      case 'formacion_providencia': return 'bg-indigo-100 text-indigo-700 border border-indigo-200';
      case 'mantenimiento': return 'bg-amber-100 text-amber-800 border border-amber-200';
      case 'talleres_industriales': return 'bg-blue-100 text-blue-700 border border-blue-200';
      case 'confecciones': return 'bg-purple-100 text-purple-700 border border-purple-200';
      case 'academicas': return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
      case 'renueva': return 'bg-rose-100 text-rose-700 border border-rose-200';
      default: return 'bg-slate-100 text-slate-600 border border-slate-200';
    }
  }

  cambiarPagina(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.cargarProyectos(page);
    }
  }

  getPagesArray(): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(this.totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }

  // ─── MODALES Y NOTAS ─────────────────────────
  abrirDetalle(proyecto: ProyectoFinanciero): void {
    this.proyectoSeleccionado = proyecto;
    this.mostrarModalDetalle = true;
  }

  cerrarDetalle(): void {
    this.mostrarModalDetalle = false;
    this.proyectoSeleccionado = null;
  }

  abrirEditarNotaDesdeDetalle(proyecto: ProyectoFinanciero): void {
    this.cerrarDetalle();
    this.editarNotaRapida(proyecto);
  }

  editarNotaRapida(proyecto: ProyectoFinanciero): void {
    if (!this.puedeVerTodos) {
      Swal.fire('Acceso restringido', 'Solo el usuario con permiso general de todos los proyectos puede agregar o editar notas.', 'warning');
      return;
    }

    Swal.fire({
      title: `Nota Propia / Comentario — ${proyecto.codigo_proyecto}`,
      input: 'textarea',
      inputLabel: 'Nota o agregado personalizado al proyecto:',
      inputValue: proyecto.nota_adicional || '',
      inputPlaceholder: 'Escribe aquí tu nota o comentario interno del proyecto...',
      inputAttributes: {
        'aria-label': 'Escribe tu nota aquí',
        'rows': '5'
      },
      showCancelButton: true,
      confirmButtonText: 'Guardar Nota',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#4f46e5',
      cancelButtonColor: '#64748b',
      showLoaderOnConfirm: true,
      preConfirm: (nota) => {
        return this.spService.actualizarProyecto(proyecto.id, { nota_adicional: nota })
          .toPromise()
          .then(resp => {
            if (!resp || !resp.success) {
              throw new Error(resp?.message || 'Error al guardar la nota');
            }
            return resp.data;
          })
          .catch(err => {
            const errorMsg = err?.error?.message || err?.message || 'No se pudo guardar la nota';
            Swal.showValidationMessage(errorMsg);
          });
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        proyecto.nota_adicional = result.value.nota_adicional;
        Swal.fire({
          icon: 'success',
          title: 'Nota Guardada',
          text: 'Comentario propio actualizado exitosamente en el proyecto.',
          timer: 2000,
          showConfirmButton: false
        });
        this.cargarProyectos(this.currentPage, false);
      }
    });
  }

  abrirEditar(proyecto: ProyectoFinanciero | null = null): void {
    this.proyectoSeleccionado = proyecto;
    this.mostrarModalEditar = true;
  }

  cerrarEditar(actualizado: boolean = false): void {
    this.mostrarModalEditar = false;
    this.proyectoSeleccionado = null;
    if (actualizado) this.cargarProyectos(this.currentPage);
  }

  abrirSincronizar(): void {
    this.mostrarModalSincronizar = true;
  }

  cerrarSincronizar(sincronizado: boolean = false): void {
    this.mostrarModalSincronizar = false;
    if (sincronizado) this.cargarProyectos(1);
  }

  exportarExcel(): void {
    Swal.fire({
      title: 'Generando Excel...',
      text: 'Obteniendo la totalidad de los proyectos listados...',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    this.spService.getProyectos({
      search: this.searchTerm || undefined,
      estado: this.estadoFiltro !== 'todos' ? this.estadoFiltro : undefined,
      margen: this.margenFiltro !== 'todos' ? this.margenFiltro : undefined,
      ejecucion: this.ejecucionFiltro !== 'todos' ? this.ejecucionFiltro : undefined,
      proceso: this.procesoFiltro !== 'todos' ? this.procesoFiltro : undefined,
      fecha_inicio: !this.todasFechas ? (this.fechaInicio || undefined) : undefined,
      fecha_fin: !this.todasFechas ? (this.fechaFin || undefined) : undefined,
      todas_fechas: this.todasFechas,
      page: 1,
      per_page: 999999
    }).subscribe({
      next: (resp: ProyectoListResponse) => {
        const todosProyectos = resp.data || [];

        if (todosProyectos.length === 0) {
          Swal.fire('Atención', 'No hay datos en la lista para exportar', 'warning');
          return;
        }

        import('xlsx').then((XLSX) => {
          const datosExportar = todosProyectos.map((p) => ({
            'Código Proyecto': p.codigo_proyecto,
            'Nombre del Proyecto': p.nombre_proyecto || '',
            'Cliente': p.cliente || '',
            'Proceso / Área': p.proceso_nombre || '',
            'Estado': p.estado || '',
            'Fecha Inicio': p.fecha_inicio || '',
            'Fecha Fin': p.fecha_fin || '',
            'Facturación Presupuestada ($)': p.facturacion_presupuestada || 0,
            'Facturación Real ($)': p.facturacion_real || 0,
            'Variación Facturación ($)': p.variacion_facturacion || 0,
            'Costo Presupuestado ($)': p.costo_presupuestado || 0,
            'Costo Real ($)': p.costo_real || 0,
            'Variación Costos ($)': p.variacion_costos || 0,
            'Margen Presupuestado (%)': p.margen_presupuestado || 0,
            'Margen Real (%)': p.margen_real || 0,
            'Nota Adicional': p.nota_adicional || ''
          }));

          const worksheet = XLSX.utils.json_to_sheet(datosExportar);
          const workbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(workbook, worksheet, 'Proyectos Activos');

          const fecha = new Date().toISOString().slice(0, 10);
          const nombreArchivo = `Seguimiento_Proyectos_Completo_${fecha}.xlsx`;
          XLSX.writeFile(workbook, nombreArchivo);

          Swal.fire({
            icon: 'success',
            title: 'Excel Exportado',
            text: `Se descargaron ${todosProyectos.length} proyectos en el archivo Excel.`,
            timer: 2500,
            showConfirmButton: false
          });
        }).catch(err => {
          console.error('Error al generar Excel:', err);
          Swal.fire('Error', 'No se pudo generar el archivo Excel', 'error');
        });
      },
      error: (err) => {
        console.error('Error al consultar todos los proyectos para Excel:', err);
        Swal.fire('Error', 'No se pudieron consultar los datos completos para exportar', 'error');
      }
    });
  }

  // ─── HELPERS DE FORMATO ─────────────────────────
  formatCurrency(value: number): string {
    if (value === null || value === undefined) return '$ 0';
    return '$ ' + Math.round(value).toLocaleString('es-CO');
  }

  formatPercent(value: number): string {
    if (value === null || value === undefined) return '0%';
    return Math.round(value) + '%';
  }

  getEstadoBadgeClass(estado: string): string {
    switch (estado?.toLowerCase()) {
      case 'activo': return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
      case 'inactivo': return 'bg-slate-100 text-slate-600 border border-slate-200';
      default: return 'bg-slate-100 text-slate-600';
    }
  }

  getVariacionClass(valor: number): string {
    if (valor > 0) return 'text-emerald-600';
    if (valor < 0) return 'text-rose-600';
    return 'text-slate-500';
  }

  getMargenClass(margen: number): string {
    if (margen >= 30) return 'text-emerald-600 font-semibold';
    if (margen >= 20) return 'text-amber-600 font-semibold';
    return 'text-rose-600 font-bold';
  }

  eliminarProyecto(proyecto: ProyectoFinanciero): void {
    Swal.fire({
      title: '¿Eliminar proyecto?',
      text: `Se eliminará ${proyecto.codigo_proyecto}. Esta acción se puede revertir.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (result.isConfirmed) {
        this.spService.eliminarProyecto(proyecto.id).subscribe({
          next: () => {
            Swal.fire('Eliminado', 'Proyecto eliminado correctamente', 'success');
            this.cargarProyectos(this.currentPage);
          },
          error: () => Swal.fire('Error', 'No se pudo eliminar el proyecto', 'error')
        });
      }
    });
  }
}
