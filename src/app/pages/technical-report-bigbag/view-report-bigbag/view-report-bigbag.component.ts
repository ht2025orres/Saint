import { Component, OnInit } from '@angular/core';
import { BigbagService } from 'src/app/services/bigbag.service';
import { AuthService } from '../../../services/auth.service';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { ErpIntegrationService } from '../../../services/erp-integration.service';
import { Customer } from '../../../models/Customer';
import Swal from 'sweetalert2';
import { Router } from '@angular/router';
import { RecepcionData, RecepcionCompleta } from '../../../models/RecepcionData.model';

@Component({
  selector: 'app-view-report-bigbag',
  templateUrl: './view-report-bigbag.component.html',
  styleUrls: ['./view-report-bigbag.component.css']
})
export class ViewReportBigbagComponent implements OnInit {


  // modales historico de documentos
  mostrarModalHistorial: boolean = false;
  historialCambios: any[] = [];
  cargandoHistorial: boolean = false; // Nueva propiedad

  // Modal firma 
  mostrarModalFirma: boolean = false;
  firmaUrl: string = '';
  tipoFirmaActual: string = '';
  cargandoFirma: boolean = false;
  errorFirma: string = '';

  // Documentos recepcion backend
  documentos: any[] = [];
  searchText: string = '';
  currentPage: number = 1;
  itemsPerPage: number = 10;
  tiempo: string = '';

  // Propiedades para el modal de detalles
  mostrarModal: boolean = false;
  documentoSeleccionado: any = null;

  // Propiedades para el modal de edición
  mostrarModalEdicion: boolean = false;
  documentoEditar: any = null;
  formEdicion = {
    cant_relacionada: 0,
    cantidad_fisico: 0,
    justificacion: ''
  };

  // Estados de carga y error
  cargandoActualizacion: boolean = false;
  errorActualizacion: string = '';
  exitoActualizacion: boolean = false;

  // ID del usuario
  usuarioId: string | number = '';


  // ===== ESTADO LOCAL (MOVIDO DESDE EL SERVICIO) =====
private recepcionSeleccionada: string = '';

  // ===== NUEVAS PROPIEDADES PARA FILTROS AVANZADOS =====
  mostrarFiltrosAvanzados: boolean = false;

  // Filtros de fecha
  filtroFechaInicio: string = '';
  filtroFechaFin: string = '';

  // Filtros por campos específicos
  filtroEstado: string = '';
  filtroPlanta: string = '';
  filtroDiferencia: string = '';
  filtroCliente: string = '';

  // Arrays para opciones de filtros
  plantasUnicas: string[] = [];
  estadosUnicos: string[] = [];
  clientesUnicos: string[] = [];

  constructor(
    private documentoService: BigbagService,
    public authService: AuthService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.documentoService.obtenerDocumentos().subscribe({
      next: (data) => {
        console.log('Datos recibidos del backend:', data);
        this.documentos = data;

        // Inicializar opciones de filtros
        this.inicializarOpcionesFiltros();

        if (data.length > 0) {
          console.log('Primer documento:', data[0]);
        }

        const user = this.authService.user;
        console.log('Usuario autenticado:', user);

        this.obtenerUsuarioId();
      },
      error: (error) => {
        console.error('Error al obtener documentos:', error);
      }
    });

    this.tiempo = '';
  }




  
  // ===== MÉTODOS PARA FILTROS AVANZADOS =====

  /**
   * Inicializa las opciones disponibles para los filtros
   */
  private inicializarOpcionesFiltros(): void {
    // Obtener plantas únicas
    this.plantasUnicas = [...new Set(this.documentos.map(doc => doc.planta))]
      .filter(Boolean)
      .sort();

    // Obtener estados únicos
    this.estadosUnicos = [...new Set(this.documentos.map(doc => doc.estado))]
      .filter(Boolean)
      .sort();

    this.clientesUnicos = [...new Set(this.documentos.map(doc => doc.cliente))]
      .filter(Boolean)
      .sort();
  }



  /**
   * Toggle para mostrar/ocultar filtros avanzados
   */
  toggleFiltrosAvanzados(): void {
    this.mostrarFiltrosAvanzados = !this.mostrarFiltrosAvanzados;
  }

  /**
   * Aplica todos los filtros activos
   */
  aplicarFiltros(): void {
    // Resetear a la primera página cuando se aplican filtros
    this.currentPage = 1;
  }

  /**
   * Limpia la búsqueda de texto
   */
  limpiarBusqueda(): void {
    this.searchText = '';
    this.onSearchChange();
  }

  /**
   * Limpia todos los filtros
   */
  limpiarTodosFiltros(): void {
    this.searchText = '';
    this.filtroFechaInicio = '';
    this.filtroFechaFin = '';
    this.filtroEstado = '';
    this.filtroPlanta = '';
    this.filtroDiferencia = '';
    this.filtroCliente = '';
    this.currentPage = 1;
  }

  /**
   * Verifica si hay filtros activos
   */
  tienesFiltrosActivos(): boolean {
    return !!(
      this.searchText ||
      this.filtroFechaInicio ||
      this.filtroFechaFin ||
      this.filtroEstado ||
      this.filtroPlanta ||
      this.filtroDiferencia ||
      this.filtroCliente
    );
  }

  /**
   * Verifica si una fecha está en el rango especificado
   */
  private estaEnRangoFecha(fechaDoc: string): boolean {
    if (!this.filtroFechaInicio && !this.filtroFechaFin) {
      return true;
    }

    if (!fechaDoc) {
      return false;
    }

    // Convertir fecha del documento a formato Date
    const fechaDocumento = new Date(fechaDoc);

    if (isNaN(fechaDocumento.getTime())) {
      return false;
    }

    // Verificar fecha inicio
    if (this.filtroFechaInicio) {
      const fechaInicio = new Date(this.filtroFechaInicio);
      if (fechaDocumento < fechaInicio) {
        return false;
      }
    }

    // Verificar fecha fin
    if (this.filtroFechaFin) {
      const fechaFin = new Date(this.filtroFechaFin);
      // Agregar 1 día a la fecha fin para incluir todo el día
      fechaFin.setDate(fechaFin.getDate() + 1);
      if (fechaDocumento >= fechaFin) {
        return false;
      }
    }

    return true;
  }

  /**
   * Verifica si el documento cumple con el filtro de diferencia
   */
  private cumpleFiltrodDiferencia(doc: any): boolean {
    if (!this.filtroDiferencia) {
      return true;
    }

    const diferencia = doc.diferencia_reportada?.toLowerCase() || '';

    switch (this.filtroDiferencia) {
      case 'coinciden':
        return diferencia.includes('coinciden');
      case 'faltantes':
        return diferencia.includes('faltantes');
      case 'sobrantes':
        return diferencia.includes('de más');
      default:
        return true;
    }
  }

  // ===== GETTER MEJORADO PARA DOCUMENTOS FILTRADOS =====
  get filteredDocumentos() {
    let documentosFiltrados = [...this.documentos];

    // Filtro por texto de búsqueda
    if (this.searchText && this.searchText.trim() !== '') {
    const textoBusqueda = this.searchText.toLowerCase().trim();
    
    documentosFiltrados = documentosFiltrados.filter(doc => {
      const campos = [
        doc.num_recepcion?.toString(),
        doc.fecha_ingreso,
        doc.hora_llegada,
        doc.planta,
        doc.num_remision?.toString(),
        doc.estado,
        doc.nom_operario,
        doc.nom_conductor,
        doc.nom_transportador,
        doc.placa_vehiculo,
        doc.cliente
      ];

      return campos.some(campo => 
        campo && campo.toLowerCase().includes(textoBusqueda)
      );
    });
  }

    // Filtro por rango de fechas
    documentosFiltrados = documentosFiltrados.filter(doc =>
      this.estaEnRangoFecha(doc.fecha_ingreso)
    );

    // Filtro por estado
    if (this.filtroEstado) {
      documentosFiltrados = documentosFiltrados.filter(doc =>
        doc.estado?.toLowerCase() === this.filtroEstado.toLowerCase()
      );
    }

    // Filtro por planta
    if (this.filtroPlanta) {
      documentosFiltrados = documentosFiltrados.filter(doc =>
        doc.planta === this.filtroPlanta
      );
    }

    // Filtro por diferencias
    documentosFiltrados = documentosFiltrados.filter(doc =>
      this.cumpleFiltrodDiferencia(doc)
    );

    if (this.filtroCliente) {
      documentosFiltrados = documentosFiltrados.filter(doc =>
        doc.cliente === this.filtroCliente
      );
    }

    return documentosFiltrados;
  }

  // ===== MÉTODOS EXISTENTES CORREGIDOS =====

  private obtenerUsuarioId(): void {
    if (this.documentos.length > 0) {
      this.usuarioId = this.documentos[0].user_id;
    }

    if (!this.usuarioId) {
      this.usuarioId = localStorage.getItem('user_id') || '';
    }

    if (!this.usuarioId) {
      const user = this.authService.user;
      this.usuarioId = user.id || '';
    }
  }

  setRecepcionSeleccionada(num: string): void {
  this.recepcionSeleccionada = num;
}

getRecepcionSeleccionada(): string {
  return this.recepcionSeleccionada;
}

// ===== LÓGICA DE ACTUALIZACIÓN (MOVIDA DESDE EL SERVICIO) =====
private construirDataActualizacion(
  numRecepcion: string, 
  cantRelacionada: number, 
  cantidadFisica: number, 
  justificacion: string,
  diferenciaReportada: string,
  usuarioId: string | number,
  firstName: string,
  lastName: string
): any {
  return {
    num_recepcion: numRecepcion,
    cant_relacionada: cantRelacionada,
    cantidad_fisico: cantidadFisica,
    justificacion: justificacion,
    diferencia_reportada: diferenciaReportada,
    usuario_id: usuarioId,
    firts_name: firstName,
    last_name: lastName
  };
}

private calcularDiferenciaDescriptiva(cantRelacionada: number, cantidadFisica: number): string {
  const diferencia = cantRelacionada - cantidadFisica;

  if (diferencia > 0) {
    return `${diferencia} empaques faltantes`;
  } else if (diferencia < 0) {
    return `${Math.abs(diferencia)} empaques de más`;
  } else {
    return 'Las cantidades coinciden';
  }
}

  irADetalle(doc: any): void {
    const datosCompletos: RecepcionCompleta = {
      id_reporte_llegada_empaque: doc.id_reporte_llegada_empaque,
      num_recepcion: doc.num_recepcion || '',
      fecha_ingreso: doc.fecha_ingreso || '',
      hora_llegada: doc.hora_llegada || '',
      planta: doc.planta || '',
      num_remision: doc.num_remision || '',
      cliente: doc.cliente || '',
      cant_relacionada: doc.cant_relacionada || 0,
      cantidad_fisico: doc.cantidad_fisico || 0,
      diferencia_reportada: doc.diferencia_reportada || '',
      estado: doc.estado || '',
      timestamp: new Date().getTime()
    };

    console.log('Documento original:', doc);
    console.log('Datos completos preparados:', datosCompletos);

    RecepcionData.setNumRecepcion(doc.num_recepcion);
    RecepcionData.setRecepcionData(datosCompletos);
    this.setRecepcionSeleccionada(doc.num_recepcion);

    this.router.navigate(['/technical-precintos-bigbag']);
  }

  getNombreCompleto(doc: any): string {
    const user = this.authService.user;

    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    } else if (user.firstName) {
      return user.firstName;
    } else if (user.lastName) {
      return user.lastName;
    }
    return '';
  }

  get paginatedDocumentos() {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredDocumentos.slice(startIndex, startIndex + this.itemsPerPage);
  }

  get totalPages() {
    return Math.ceil(this.filteredDocumentos.length / this.itemsPerPage);
  }

  onItemsPerPageChange() {
    this.currentPage = 1;
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = this.totalPages;
    }
  }

  onSearchChange() {
    this.currentPage = 1;
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  getPageRange(): number[] {
    const totalPages = this.totalPages;
    const currentPage = this.currentPage;
    const range: number[] = [];

    if (totalPages <= 10) {
      for (let i = 1; i <= totalPages; i++) {
        range.push(i);
      }
    } else {
      if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) {
          range.push(i);
        }
        range.push(-1);
        range.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        range.push(1);
        range.push(-1);
        for (let i = totalPages - 4; i <= totalPages; i++) {
          range.push(i);
        }
      } else {
        range.push(1);
        range.push(-1);
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          range.push(i);
        }
        range.push(-1);
        range.push(totalPages);
      }
    }

    return range;
  }

  getPaginationInfo(): string {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage + 1;
    const endIndex = Math.min(this.currentPage * this.itemsPerPage, this.filteredDocumentos.length);
    const total = this.filteredDocumentos.length;

    if (total === 0) {
      return 'No hay documentos para mostrar';
    }

    return `Mostrando ${startIndex} a ${endIndex} de ${total} documentos`;
  }

  verDocumento(doc: any) {
    this.documentoSeleccionado = doc;
    this.mostrarModal = true;
  }

  cerrarModal() {
    this.mostrarModal = false;
    this.documentoSeleccionado = null;
  }

  editarDocumento(doc: any) {
    if (this.mostrarModal) {
      this.cerrarModal();
    }

    this.documentoEditar = { ...doc };
    this.formEdicion = {
      cant_relacionada: doc.cant_relacionada || 0,
      cantidad_fisico: doc.cantidad_fisico || 0,
      justificacion: ''
    };

    this.errorActualizacion = '';
    this.exitoActualizacion = false;
    this.mostrarModalEdicion = true;
  }

  cerrarModalEdicion() {
    this.mostrarModalEdicion = false;
    this.documentoEditar = null;
    this.formEdicion = {
      cant_relacionada: 0,
      cantidad_fisico: 0,
      justificacion: ''
    };
    this.errorActualizacion = '';
    this.exitoActualizacion = false;
  }

  guardarCambios() {
  // Validaciones iniciales
  if (this.formEdicion.cant_relacionada < 0 || this.formEdicion.cantidad_fisico < 0) {
    this.errorActualizacion = 'Las cantidades no pueden ser negativas';
    return;
  }
  
  if (!this.documentoEditar) {
    this.errorActualizacion = 'Error: No se ha seleccionado un documento';
    return;
  }

  this.cargandoActualizacion = true;
  this.errorActualizacion = '';

  // Calcular diferencia descriptiva usando el método local
  const mensajeDescriptivo = this.calcularDiferenciaDescriptiva(
    this.formEdicion.cant_relacionada,
    this.formEdicion.cantidad_fisico
  );

  const user = this.authService.user;

  // Construir datos usando el método local
  const dataActualizacion = this.construirDataActualizacion(
    this.documentoEditar.num_recepcion,
    this.formEdicion.cant_relacionada,
    this.formEdicion.cantidad_fisico,
    this.formEdicion.justificacion,
    mensajeDescriptivo,
    this.usuarioId,
    user.firstName || '',
    user.lastName || ''
  );

  // Llamar al servicio simplificado
  this.documentoService.actualizarRecepcion(dataActualizacion).subscribe({
    next: (response) => {
      this.cargandoActualizacion = false;

      if (response.success) {
        // Actualizar el documento en la lista local
        const index = this.documentos.findIndex(doc => 
          doc.num_recepcion === this.documentoEditar.num_recepcion
        );
        
        if (index !== -1) {
          this.documentos[index] = {
            ...this.documentos[index],
            cant_relacionada: this.formEdicion.cant_relacionada,
            cantidad_fisico: this.formEdicion.cantidad_fisico,
            diferencia_reportada: mensajeDescriptivo
          };
        }

        this.exitoActualizacion = true;

        Swal.fire({
          icon: 'success',
          title: 'Documento actualizado',
          text: mensajeDescriptivo,
          timer: 2000,
          showConfirmButton: false
        });

        setTimeout(() => {
          this.cerrarModalEdicion();
        }, 2000);

      } else {
        this.errorActualizacion = response.message || 'Error al actualizar el documento';
      }
    },
    error: (error) => {
      this.cargandoActualizacion = false;
      console.error('Error al actualizar:', error);
      this.errorActualizacion = 'Error de conexión. Intente nuevamente.';
    }
  });
}

  calcularDiferencia(): number {
    return this.formEdicion.cant_relacionada - this.formEdicion.cantidad_fisico;
  }

  obtenerMensajeDiferencia(): string {
  return this.calcularDiferenciaDescriptiva(
    this.formEdicion.cant_relacionada,
    this.formEdicion.cantidad_fisico
  );
}

  calcularDiferenciaCambio(valorAnterior: string | number, valorNuevo: string | number): string {
  const anterior = parseFloat(valorAnterior?.toString() || '0');
  const nuevo = parseFloat(valorNuevo?.toString() || '0');
  
  const diferencia = nuevo - anterior;
  
  if (diferencia > 0) {
    return `+${diferencia}`;
  } else if (diferencia < 0) {
    return `${diferencia}`; // Ya incluye el signo negativo
  } else {
    return '0';
  }
}

/**
 * Obtiene la clase CSS apropiada para el cambio de cantidad
 */
obtenerClaseCambioCantidad(valorAnterior: string | number, valorNuevo: string | number): string {
  const anterior = parseFloat(valorAnterior?.toString() || '0');
  const nuevo = parseFloat(valorNuevo?.toString() || '0');
  
  if (nuevo > anterior) {
    return 'aumento';
  } else if (nuevo < anterior) {
    return 'disminucion';
  } else {
    return 'sin-cambio';
  }
}

  obtenerClaseDiferencia(): string {
    const diferencia = this.calcularDiferencia();

    if (diferencia > 0) {
      return 'diferencia-negativa';
    } else if (diferencia < 0) {
      return 'diferencia-positiva';
    } else {
      return 'diferencia-cero';
    }
  }

  verFirma(tipoFirma: 'operario' | 'conductor') {
    if (!this.documentoSeleccionado?.id_reporte_llegada_empaque) {
      alert('No se puede obtener la firma. ID de recepción no disponible.');
      return;
    }

    this.cargandoFirma = true;
    this.errorFirma = '';
    this.tipoFirmaActual = tipoFirma;

    this.documentoService.obtenerFirmaDigital(
      this.documentoSeleccionado.id_reporte_llegada_empaque,
      tipoFirma
    ).subscribe({
      next: (response) => {
        this.cargandoFirma = false;
        if (response.success && response.url) {
          this.firmaUrl = response.url;
          this.mostrarModalFirma = true;
        } else {
          this.errorFirma = response.error || 'No se pudo obtener la firma';
          alert(this.errorFirma);
        }
      },
      error: (error) => {
        this.cargandoFirma = false;
        console.error('Error al obtener firma:', error);
        this.errorFirma = 'Error de conexión al obtener la firma';
        alert(this.errorFirma);
      }
    });
  }

  cerrarModalFirma() {
    this.mostrarModalFirma = false;
    this.firmaUrl = '';
    this.tipoFirmaActual = '';
    this.errorFirma = '';
  }

  getNombreCompletoUsuario(): string {
    const user = this.authService.user;

    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    } else if (user.firstName) {
      return user.firstName;
    } else if (user.lastName) {
      return user.lastName;
    }
    return 'Usuario no identificado';
  }

  getPrimerNombre(): string {
    const user = this.authService.user;
    return user.firstName || '';
  }

  getApellido(): string {
    const user = this.authService.user;
    return user.lastName || '';
  }

  getDiferenciaClass(diferencia: string): string {
    if (!diferencia) return '';

    if (diferencia.includes('faltantes')) {
      return 'diferencia-negativa';
    } else if (diferencia.includes('de más')) {
      return 'diferencia-positiva';
    } else if (diferencia.includes('coinciden')) {
      return 'diferencia-cero';
    }

    return '';
  }

  getEstadoIcon(estado: string): string {
    switch (estado?.toLowerCase()) {
      case 'activo':
        return 'mdi-check-circle';
      case 'cerrado':
        return 'mdi-close-circle';
      default:
        return 'mdi-help-circle';
    }
  }


  verHistorialCambios(): void {
  if (!this.documentoSeleccionado?.num_recepcion) {
    console.error('No hay documento seleccionado');
    return;
  }

  this.cargandoHistorial = true;

  this.documentoService.getVersiones(this.documentoSeleccionado.num_recepcion).subscribe({
    next: (response) => {
      console.log('Historial recibido:', response);
      this.cargandoHistorial = false;

      // Mapear los datos del backend incluyendo valores antiguos y nuevos
      this.historialCambios = (response.data || response || []).map((cambio: any) => ({
        // Identificadores
        id_version: cambio.id_version,
        id_log: cambio.id_log,
        num_recepcion: cambio.num_recepcion,
        
        // Valores ANTERIORES (antes del cambio)
        old_cantidad_relacional: cambio.old_cantidad_relacional,
        old_cantidad_fisico: cambio.old_cantidad_fisico,
        old_diferencia_reportada: cambio.old_diferencia_reportada,
        
        // Valores NUEVOS (después del cambio)
        new_cantidad_relacional: cambio.new_cantidad_relacional,
        new_cantidad_fisico: cambio.new_cantidad_fisico,
        new_diferencia_reportada: cambio.new_diferencia_reportada,
        
        // Información del cambio
        fecha_modificacion: cambio.fecha_version,
        hora_modificacion: cambio.hora_edicion || '00:00:00',
        justificacion: cambio.comentario,
        usuario_modificacion: cambio.responsable_edicion|| 'Sistema',
        
        // Mantener campos para compatibilidad
        cant_relacionada_anterior: cambio.old_cantidad_relacional,
        cantidad_fisico_anterior: cambio.old_cantidad_fisico,
        diferencia_reportada_anterior: cambio.old_diferencia_reportada,
        cant_relacionada: cambio.old_cantidad_relacional,
        cantidad_fisico: cambio.old_cantidad_fisico,
        diferencia_reportada: cambio.old_diferencia_reportada,
        fecha: cambio.fecha_version,
        hora: cambio.hora_version || '00:00:00'
      }));

      console.log('Historial procesado con comparaciones:', this.historialCambios);

      this.mostrarModalHistorial = true;
      this.mostrarModal = false;
    },
    error: (error) => {
      console.error('Error al cargar historial:', error);
      this.cargandoHistorial = false;
      this.historialCambios = [];
      this.mostrarModalHistorial = true;
      this.mostrarModal = false;
    }
  });
}

obtenerResumenCambio(cambio: any): string {
  const cambiosCantidad = [];
  
  // Verificar cambios en cantidad relacionada
  if (cambio.old_cantidad_relacional !== cambio.new_cantidad_relacional) {
    const diferencia = this.calcularDiferenciaCambio(
      cambio.old_cantidad_relacional, 
      cambio.new_cantidad_relacional
    );
    cambiosCantidad.push(`Rel: ${cambio.old_cantidad_relacional} → ${cambio.new_cantidad_relacional} (${diferencia})`);
  }
  
  // Verificar cambios en cantidad física
  if (cambio.old_cantidad_fisico !== cambio.new_cantidad_fisico) {
    const diferencia = this.calcularDiferenciaCambio(
      cambio.old_cantidad_fisico, 
      cambio.new_cantidad_fisico
    );
    cambiosCantidad.push(`Fís: ${cambio.old_cantidad_fisico} → ${cambio.new_cantidad_fisico} (${diferencia})`);
  }
  
  return cambiosCantidad.length > 0 ? cambiosCantidad.join(' | ') : 'Sin cambios en cantidades';
}

/**
 * Determina si hubo cambios significativos en el registro
 */
tieneCambiosSignificativos(cambio: any): boolean {
  return cambio.old_cantidad_relacional !== cambio.new_cantidad_relacional ||
         cambio.old_cantidad_fisico !== cambio.new_cantidad_fisico ||
         cambio.old_diferencia_reportada !== cambio.new_diferencia_reportada;
}

  cerrarModalHistorial(): void {
    this.mostrarModalHistorial = false;
    this.mostrarModal = true;
  }



  // Método auxiliar para extraer valor numérico de la diferencia
  private extraerValorDiferencia(diferencia: string): number {
    if (!diferencia) return 0;

    // Buscar números en el texto
    const match = diferencia.match(/(\d+)/);
    if (!match) return 0;

    const valor = parseInt(match[1]);

    // Si contiene "faltantes", el valor es negativo
    if (diferencia.includes('faltantes')) {
      return -valor;
    }
    // Si contiene "de más", el valor es positivo
    else if (diferencia.includes('de más')) {
      return valor;
    }
    // Si coinciden, es 0
    else {
      return 0;
    }
  }

  // Método auxiliar para formatear diferencia como texto visual
  private formatearDiferenciaTexto(diferencia: string): string {
    if (!diferencia) return '';

    const valorNumerico = this.extraerValorDiferencia(diferencia);

    if (valorNumerico > 0) {
      return `+${valorNumerico}`;
    } else if (valorNumerico < 0) {
      return `${valorNumerico}`;
    } else {
      return '0';
    }
  }

  exportarAExcel(): void {
    try {
      const datosExportar = this.filteredDocumentos.map(doc => {
        const user = this.authService.user;
        const valorDiferencia = this.extraerValorDiferencia(doc.diferencia_reportada || '');

        return {
          'Número Recepción': doc.num_recepcion || '',
          'Fecha Ingreso': doc.fecha_ingreso || '',
          'Hora Llegada': doc.hora_llegada || '',
          'Planta': doc.planta || '',
          'Número Remisión': doc.num_remision || '',
          'Estado': doc.estado || '',
          'Hora Creación': doc.hora_creacion || '',
          'Tiempo Procesamiento': this.calcularTiempoProcesamiento(doc.fecha_ingreso, doc.fecha_creacion, doc.hora_llegada, doc.hora_creacion),

          // CAMPOS NUMÉRICOS MEJORADOS
          'Cantidad Relacionada': parseInt(doc.cant_relacionada) || 0,
          'Cantidad Física': parseInt(doc.cantidad_fisico) || 0,
          'Diferencia (Numérico)': valorDiferencia, // Valor numérico puro
          'Diferencia (Visual)': this.formatearDiferenciaTexto(doc.diferencia_reportada || ''), // Formato visual

          'Diferencia Reportada Original': doc.diferencia_reportada || '', // Texto original por referencia
          'Nombre Operario': doc.nom_operario || '',
          'Firma Operario': doc.firma_operario || '',
          'Nombre Conductor': doc.nom_conductor || '',
          'Placa Vehículo': doc.placa_vehiculo || '',
          'Nombre Transportador': doc.nom_transportador || '',
          'Firma Conductor': doc.firma_conductor || '',
          'Observaciones': doc.observaciones || 'Sin observaciones',
          'Usuario ID': doc.user_id || this.usuarioId,
          'Usuario Nombre': user.firstName || '',
          'Usuario Apellido': user.lastName || ''
        };
      });

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(datosExportar);

      // Configurar ancho de columnas
      const columnWidths = Array(22).fill({ wch: 15 });
      // Hacer más anchas las columnas de diferencia
      columnWidths[11] = { wch: 18 }; // Diferencia (Numérico)
      columnWidths[12] = { wch: 18 }; // Diferencia (Visual)
      columnWidths[13] = { wch: 25 }; // Diferencia Reportada Original
      worksheet['!cols'] = columnWidths;

      // Aplicar formato numérico a las columnas específicas
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

      for (let rowIndex = 1; rowIndex <= range.e.r; rowIndex++) {
        // Cantidad Relacionada (columna I = índice 8)
        const cellCantRelacionada = worksheet[XLSX.utils.encode_cell({ r: rowIndex, c: 8 })];
        if (cellCantRelacionada) {
          cellCantRelacionada.t = 'n'; // Tipo numérico
          cellCantRelacionada.z = '0'; // Formato con 2 decimales
        }

        // Cantidad Física (columna J = índice 9)
        const cellCantFisica = worksheet[XLSX.utils.encode_cell({ r: rowIndex, c: 9 })];
        if (cellCantFisica) {
          cellCantFisica.t = 'n'; // Tipo numérico
          cellCantFisica.z = '0'; // Formato con 2 decimales
        }

        // Diferencia Numérica (columna K = índice 10)
        const cellDifNum = worksheet[XLSX.utils.encode_cell({ r: rowIndex, c: 10 })];
        if (cellDifNum) {
          cellDifNum.t = 'n'; // Tipo numérico
          cellDifNum.z = '+0;-0;0'; // Formato con signo
        }
      }

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Documentos BigBag');

      if (datosExportar.length > 0) {
        const resumen = this.crearHojaResumenMejorada(datosExportar);
        const worksheetResumen = XLSX.utils.json_to_sheet(resumen);
        worksheetResumen['!cols'] = [{ wch: 25 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(workbook, worksheetResumen, 'Resumen');
      }

      const fecha = new Date().toISOString().split('T')[0];
      const hora = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
      const nombreArchivo = `Documentos_BigBag_${fecha}_${hora}.xlsx`;

      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      saveAs(blob, nombreArchivo);

      Swal.fire({
        icon: 'success',
        title: '¡Exportación exitosa!',
        text: `Excel exportado con valores numéricos: ${nombreArchivo}`,
        confirmButtonColor: '#3085d6'
      });

    } catch (error) {
      console.error('Error al exportar a Excel:', error);

      Swal.fire({
        icon: 'error',
        title: 'Error al exportar',
        text: 'Error al exportar el archivo Excel. Intente nuevamente.',
        confirmButtonColor: '#d33'
      });
    }
  }

  private crearHojaResumenMejorada(datos: any[]): any[] {
    const totalDocumentos = datos.length;
    const documentosActivos = datos.filter(doc => doc.Estado?.toLowerCase() === 'activo').length;
    const documentosCerrados = datos.filter(doc => doc.Estado?.toLowerCase() === 'cerrado').length;

    // Usar valores numéricos para cálculos
    const totalCantidadRelacionada = datos.reduce((sum, doc) => sum + (doc['Cantidad Relacionada'] || 0), 0);
    const totalCantidadFisica = datos.reduce((sum, doc) => sum + (doc['Cantidad Física'] || 0), 0);
    const totalDiferenciaNumerica = datos.reduce((sum, doc) => sum + (doc['Diferencia (Numérico)'] || 0), 0);

    // Análisis de diferencias
    const conFaltantes = datos.filter(doc => (doc['Diferencia (Numérico)'] || 0) < 0).length;
    const conSobrantes = datos.filter(doc => (doc['Diferencia (Numérico)'] || 0) > 0).length;
    const sinDiferencias = datos.filter(doc => (doc['Diferencia (Numérico)'] || 0) === 0).length;

    const plantasUnicas = [...new Set(datos.map(doc => doc.Planta))].filter(Boolean);
    const user = this.authService.user;

    return [
      { 'Concepto': 'RESUMEN DE EXPORTACIÓN', 'Valor': '' },
      { 'Concepto': '═══════════════════════', 'Valor': '' },
      { 'Concepto': 'Total de documentos', 'Valor': totalDocumentos },
      { 'Concepto': 'Documentos activos', 'Valor': documentosActivos },
      { 'Concepto': 'Documentos cerrados', 'Valor': documentosCerrados },
      { 'Concepto': '', 'Valor': '' },
      { 'Concepto': 'ANÁLISIS NUMÉRICO', 'Valor': '' },
      { 'Concepto': '═══════════════════════', 'Valor': '' },
      { 'Concepto': 'Total cantidad relacionada', 'Valor': totalCantidadRelacionada },
      { 'Concepto': 'Total cantidad física', 'Valor': totalCantidadFisica },
      { 'Concepto': 'Diferencia total (numérica)', 'Valor': totalDiferenciaNumerica },
      { 'Concepto': 'Documentos con faltantes', 'Valor': conFaltantes },
      { 'Concepto': 'Documentos con sobrantes', 'Valor': conSobrantes },
      { 'Concepto': 'Documentos sin diferencias', 'Valor': sinDiferencias },
      { 'Concepto': '', 'Valor': '' },
      { 'Concepto': 'FILTROS APLICADOS', 'Valor': '' },
      { 'Concepto': '═══════════════════════', 'Valor': '' },
      { 'Concepto': 'Búsqueda texto', 'Valor': this.searchText || 'Ninguna' },
      { 'Concepto': 'Fecha inicio', 'Valor': this.filtroFechaInicio || 'No aplicado' },
      { 'Concepto': 'Fecha fin', 'Valor': this.filtroFechaFin || 'No aplicado' },
      { 'Concepto': 'Estado filtrado', 'Valor': this.filtroEstado || 'Todos' },
      { 'Concepto': 'Planta filtrada', 'Valor': this.filtroPlanta || 'Todas' },
      { 'Concepto': 'Diferencia filtrada', 'Valor': this.filtroDiferencia || 'Todas' },
      { 'Concepto': 'Cliente filtrado', 'Valor': this.filtroCliente || 'Todos' },
      { 'Concepto': '', 'Valor': '' },
      { 'Concepto': 'INFORMACIÓN ADICIONAL', 'Valor': '' },
      { 'Concepto': '═══════════════════════', 'Valor': '' },
      { 'Concepto': 'Plantas involucradas', 'Valor': plantasUnicas.length },
      { 'Concepto': 'Lista de plantas', 'Valor': plantasUnicas.join(', ') },
      { 'Concepto': 'Usuario exportador', 'Valor': `${user.firstName || ''} ${user.lastName || ''}`.trim() },
      { 'Concepto': 'Fecha de exportación', 'Valor': new Date().toLocaleDateString('es-CO') },
      { 'Concepto': 'Hora de exportación', 'Valor': new Date().toLocaleTimeString('es-CO') },
      { 'Concepto': 'Total registros sistema', 'Valor': this.documentos.length },
      { 'Concepto': 'Registros exportados', 'Valor': totalDocumentos }
    ];
  }

  exportarPaginaActual(): void {
    try {
      const datosExportar = this.paginatedDocumentos.map(doc => {
        const user = this.authService.user;
        const valorDiferencia = this.extraerValorDiferencia(doc.diferencia_reportada || '');

        return {
          'Número Recepción': doc.num_recepcion || '',
          'Fecha Ingreso': doc.fecha_ingreso || '',
          'Hora Llegada': doc.hora_llegada || '',
          'Planta': doc.planta || '',
          'Número Remisión': doc.num_remision || '',
          'Estado': doc.estado || '',
          'Hora Creación': doc.hora_creacion || '',
          'Tiempo Procesamiento': this.calcularTiempoProcesamiento(doc.fecha_ingreso, doc.hora_llegada, doc.fecha_creacion, doc.hora_creacion),

          // CAMPOS NUMÉRICOS
          'Cantidad Relacionada': parseInt(doc.cant_relacionada) || 0,
          'Cantidad Física': parseInt(doc.cantidad_fisico) || 0,
          'Diferencia ': valorDiferencia,


          'Nombre Operario': doc.nom_operario || '',
          'Nombre Conductor': doc.nom_conductor || '',
          'Placa Vehículo': doc.placa_vehiculo || '',
          'Nombre Transportador': doc.nom_transportador || '',
          'Observaciones': doc.observaciones || 'Sin observaciones'
          // 'Usuario Completo': this.getNombreCompleto(doc),
          // 'Fecha Exportación': new Date().toLocaleDateString('es-CO'),
          // 'Hora Exportación': new Date().toLocaleTimeString('es-CO')
        };
      });

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(datosExportar);

      // Aplicar formato numérico
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      for (let rowIndex = 1; rowIndex <= range.e.r; rowIndex++) {
        // Aplicar formato a campos numéricos
        ['I', 'J', 'K'].forEach((col, index) => {
          const cell = worksheet[col + (rowIndex + 1)];
          if (cell) {
            cell.t = 'n';
            if (index === 2) { // Diferencia
              cell.z = '+0;-0;0';
            } else { // Cantidades
              cell.z = '0';
            }
          }
        });
      }

      worksheet['!cols'] = Array(19).fill({ wch: 15 });
      XLSX.utils.book_append_sheet(workbook, worksheet, `Página ${this.currentPage}`);

      const fecha = new Date().toISOString().split('T')[0];
      const nombreArchivo = `Documentos_BigBag_Pagina${this.currentPage}_${fecha}.xlsx`;

      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      saveAs(blob, nombreArchivo);

      Swal.fire({
        icon: 'success',
        title: '¡Exportación exitosa!',
        text: `El archivo ${nombreArchivo} ha sido exportado con valores numéricos.`,
        confirmButtonColor: '#3085d6'
      });

    } catch (error) {
      console.error('Error al exportar página actual:', error);

      Swal.fire({
        icon: 'error',
        title: 'Error al exportar',
        text: 'Ocurrió un error al exportar el archivo Excel. Intente nuevamente.',
        confirmButtonColor: '#d33'
      });
    }
  }

  

  calcularTiempoProcesamiento(
    fechaLlegada: string,
    horaLlegada: string,
    fechaCreacion: string,
    horaCreacion: string
  ): string {
    if (!fechaLlegada || !horaLlegada || !fechaCreacion || !horaCreacion) {
      return 'N/A - Datos incompletos';
    }

    try {
      const llegada = new Date(`${fechaLlegada}T${horaLlegada}`);
      const creacion = new Date(`${fechaCreacion}T${horaCreacion}`);

      if (isNaN(llegada.getTime()) || isNaN(creacion.getTime())) {
        console.warn('Fechas inválidas:', { fechaLlegada, horaLlegada, fechaCreacion, horaCreacion });
        return 'Formato de fecha inválido';
      }

      const diffMs = creacion.getTime() - llegada.getTime();

      if (diffMs < 0) {
        console.warn('La fecha de creación es anterior a la llegada');
        return 'Error: Fechas inconsistentes';
      }

      const totalMinutos = Math.floor(diffMs / (1000 * 60));
      const days = Math.floor(totalMinutos / (24 * 60));
      const hours = Math.floor((totalMinutos % (24 * 60)) / 60);
      const minutes = totalMinutos % 60;

      const partes: string[] = [];
      if (days > 0) partes.push(`${days} ${days === 1 ? 'día' : 'días'}`);
      if (hours > 0) partes.push(`${hours} ${hours === 1 ? 'hora' : 'horas'}`);
      if (minutes > 0 || partes.length === 0) partes.push(`${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`);

      return partes.join(', ');

    } catch (error) {
      console.error('Error calculando tiempo de procesamiento:', error);
      return 'Error en el cálculo';
    }
  }
}