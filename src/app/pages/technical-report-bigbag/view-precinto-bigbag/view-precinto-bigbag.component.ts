import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { User } from '../../../models/User';
import { AuthService } from 'src/app/services/auth.service';
import { BigbagService } from 'src/app/services/bigbag.service';
import { FirmaDigitalComponent } from '../FirmaDigital/firma-digital.component';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';


@Component({
  selector: 'app-view-precinto-bigbag',
  standalone: true,
  imports: [CommonModule, FormsModule, FirmaDigitalComponent],
  templateUrl: './view-precinto-bigbag.component.html',
  styleUrl: './view-precinto-bigbag.component.css'
})
export class ViewPrecintoBigbagComponent {

  //url firma
  firmaUrl: string | null = null;

  userLogged: User; 
  userInfo = {
    id: 0,
    name: '',
  };

  //datos sobre la novedad de una distribucion del recinto 
  firmaBase64: string = '';

  onFirmaGuardada(data: string) {
    this.firmaBase64 = data;
    console.log('Firma guardada (base64):', this.firmaBase64);
  }

  modalAbierto = false;
  precintoSeleccionado: any = null;
  novedad: string = '';
  firma: any = null;
  
  // Nueva propiedad para controlar si se muestra el formulario o el mensaje
  mostrarFormulario = true;

  // Datos
  precintos: any[] = []; 
  precintosFiltrados: any[] = [];
  precintosPaginados: any[] = [];
  areasDisponibles: string[] = [];

  // Filtros actualizados con fechas
  filtros = {
    color: '',
    busqueda: '',
    area: '',
    fechaDesde: '',
    fechaHasta: ''
  };

  // Paginación
  paginacion = {
    paginaActual: 1,
    itemsPorPagina: 10,
    totalPaginas: 0,
    inicio: 0,
    fin: 0
  };

  // Páginas visibles en la paginación
  paginasVisibles: number[] = [];

  constructor(
    private authService: AuthService,
    private bigbagService: BigbagService
  ) {}

  ngOnInit(): void {
    const user = this.authService.user;
    this.userLogged = user;

    this.userInfo = {
      id: user.id,
      name: `${user.firstName} ${user.lastName}`
    };

    this.enviarUsuarioAlBackend();
  }

  enviarUsuarioAlBackend(): void {
    this.bigbagService.enviarUsuarioId(this.userInfo.id).subscribe({
      next: (response) => {
        this.precintos = response;
        this.precintosFiltrados = [...this.precintos];
        this.extraerAreasDisponibles();
        this.calcularPaginacion();
        this.actualizarPrecintosPaginados();
        console.log('Precintos asignados:', this.precintos);
      },
      error: (error) => {
        console.error('Error al obtener precintos:', error);
      }
    });
  }

  extraerAreasDisponibles(): void {
    const areas = [...new Set(this.precintos.map(p => p.area_precinto))];
    this.areasDisponibles = areas.filter(area => area && area.trim() !== '');
  }

  // Método mejorado para aplicar todos los filtros
  aplicarFiltros(): void {
    this.precintosFiltrados = this.precintos.filter(precinto => {
      // Filtro por color
      const cumpleColor = !this.filtros.color || 
                         (precinto.color_consecutivo && 
                          precinto.color_consecutivo.toLowerCase().includes(this.filtros.color.toLowerCase()));
      
      // Filtro por búsqueda (número de precinto, documento de recepción, cliente, planta o remisión)
      const cumpleBusqueda = !this.filtros.busqueda || 
                            (precinto.numero_precinto && 
                             precinto.numero_precinto.toString().toLowerCase().includes(this.filtros.busqueda.toLowerCase())) ||
                            (precinto.num_recepcion && 
                             precinto.num_recepcion.toString().toLowerCase().includes(this.filtros.busqueda.toLowerCase())) ||
                            (precinto.rango_precintos && 
                             precinto.rango_precintos.toString().toLowerCase().includes(this.filtros.busqueda.toLowerCase())) ||
                            (precinto.cliente && 
                             precinto.cliente.toString().toLowerCase().includes(this.filtros.busqueda.toLowerCase())) ||
                            (precinto.planta && 
                             precinto.planta.toString().toLowerCase().includes(this.filtros.busqueda.toLowerCase())) ||
                            (precinto.num_remision && 
                             precinto.num_remision.toString().toLowerCase().includes(this.filtros.busqueda.toLowerCase()));
      
      // Filtro por área
      const cumpleArea = !this.filtros.area || 
                        (precinto.area_precinto && 
                         precinto.area_precinto.toLowerCase() === this.filtros.area.toLowerCase());

      // Filtro por rango de fechas
      let cumpleFecha = true;
      if (this.filtros.fechaDesde || this.filtros.fechaHasta) {
        const fechaPrecinto = new Date(precinto.fecha_entrega);
        
        if (this.filtros.fechaDesde) {
          const fechaDesde = new Date(this.filtros.fechaDesde);
          fechaDesde.setHours(0, 0, 0, 0);
          fechaPrecinto.setHours(0, 0, 0, 0);
          cumpleFecha = cumpleFecha && fechaPrecinto >= fechaDesde;
        }
        
        if (this.filtros.fechaHasta) {
          const fechaHasta = new Date(this.filtros.fechaHasta);
          fechaHasta.setHours(23, 59, 59, 999);
          fechaPrecinto.setHours(23, 59, 59, 999);
          cumpleFecha = cumpleFecha && fechaPrecinto <= fechaHasta;
        }
      }

      return cumpleColor && cumpleBusqueda && cumpleArea && cumpleFecha;
    });

    // Resetear a la primera página cuando se aplican filtros
    this.paginacion.paginaActual = 1;
    this.calcularPaginacion();
    this.actualizarPrecintosPaginados();
  }

  // Método mejorado para limpiar filtros
  limpiarFiltros(): void {
    this.filtros = {
      color: '',
      busqueda: '',
      area: '',
      fechaDesde: '',
      fechaHasta: ''
    };
    this.aplicarFiltros();
  }

  // Método mejorado para exportar a Excel con mejor feedback y validaciones
  exportarAExcel(): void {
    // Verificar si hay datos filtrados para exportar
    if (this.precintosFiltrados.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'No hay datos para exportar',
        text: 'No hay registros que coincidan con los filtros aplicados.',
        confirmButtonColor: '#3085d6',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    // Mostrar confirmación con información sobre qué se va a exportar
    const mensaje = this.precintosFiltrados.length === this.precintos.length 
      ? `¿Desea exportar todos los ${this.precintosFiltrados.length} registros a Excel?`
      : `¿Desea exportar los ${this.precintosFiltrados.length} registros filtrados de un total de ${this.precintos.length} registros?`;

    Swal.fire({
      title: 'Confirmar exportación',
      text: mensaje,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#28a745',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, exportar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.procesarExportacion();
      }
    });
  }

  // Método separado para procesar la exportación
  private procesarExportacion(): void {
    try {
      // Preparar los datos para exportar (solo los filtrados)
      const datosParaExportar = this.precintosFiltrados.map((precinto, index) => ({
        'N°': index + 1,
        'Cliente': precinto.cliente || 'N/A',
        'Planta': precinto.planta || 'N/A',
        'N° Remisión': precinto.num_remision || 'N/A',
        'Doc Recepción': precinto.num_recepcion || 'N/A',
        'Número Precinto': precinto.numero_precinto || 'N/A',
        'Fecha Entrega': this.formatearFecha(precinto.fecha_entrega),
        'Cantidad': precinto.cantidad || 0,
        'Rango': precinto.rango_precintos || 'N/A',
        'Color': precinto.color_consecutivo || 'N/A',
        'Área': precinto.area_precinto || 'N/A',
        'Novedad': this.formatearNovedad(precinto.novedades_precintos),
        'Estado Firma': this.formatearEstadoFirma(precinto.firmado_por)
      }));

      // Crear el libro de Excel
      const workbook = XLSX.utils.book_new();
      
      // Crear la hoja con los datos
      const worksheet = XLSX.utils.json_to_sheet(datosParaExportar);
      
      // Configurar el ancho de las columnas
      const columnWidths = [
        { wch: 5 },  // N°
        { wch: 30 }, // Cliente
        { wch: 30 }, // Planta
        { wch: 15 }, // N° Remisión
        { wch: 15 }, // Doc Recepción
        { wch: 15 }, // Número Precinto
        { wch: 12 }, // Fecha Entrega
        { wch: 10 }, // Cantidad
        { wch: 20 }, // Rango
        { wch: 10 }, // Color
        { wch: 15 }, // Área
        { wch: 30 }, // Novedad
        { wch: 12 }  // Estado Firma
      ];
      worksheet['!cols'] = columnWidths;
      
      // Agregar metadatos a la hoja
      const metadata = {
        'Exportado por': this.userInfo.name,
        'Fecha de exportación': new Date().toLocaleString('es-ES'),
        'Total de registros': this.precintosFiltrados.length,
        'Filtros aplicados': this.obtenerFiltrosAplicados()
      };
      
      // Agregar la hoja principal al libro
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Precintos');
      
      // Crear una segunda hoja con información del reporte
      const metadataSheet = XLSX.utils.json_to_sheet([metadata]);
      XLSX.utils.book_append_sheet(workbook, metadataSheet, 'Información del Reporte');
      
      // Generar el nombre del archivo con fecha y hora actual
      const fechaActual = new Date();
      const fechaFormateada = fechaActual.toISOString().split('T')[0];
      const horaFormateada = fechaActual.toTimeString().split(' ')[0].replace(/:/g, '-');
      const nombreArchivo = `precintos_${this.userInfo.name.replace(/\s+/g, '_')}_${fechaFormateada}_${horaFormateada}.xlsx`;
      
      // Descargar el archivo
      XLSX.writeFile(workbook, nombreArchivo);
      
      // Mostrar mensaje de éxito
      Swal.fire({
        icon: 'success',
        title: 'Exportación exitosa',
        html: `
          <p>Se han exportado <strong>${this.precintosFiltrados.length}</strong> registros a Excel.</p>
          <p><small>Archivo: ${nombreArchivo}</small></p>
        `,
        confirmButtonColor: '#28a745',
        confirmButtonText: 'Continuar'
      });
      
    } catch (error) {
      console.error('Error al exportar a Excel:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error de exportación',
        text: 'No se pudo exportar el archivo. Por favor, intente nuevamente.',
        confirmButtonColor: '#d33',
        confirmButtonText: 'Reintentar'
      });
    }
  }

  // Método auxiliar para formatear el estado de la novedad
  private formatearNovedad(novedad: any): string {
    if (!novedad || novedad.toString().trim() === '') {
      return 'Sin novedad';
    }
    return novedad.toString();
  }

  // Método auxiliar para formatear el estado de la firma
  private formatearEstadoFirma(firmadoPor: any): string {
    if (!firmadoPor || firmadoPor.toString().trim() === '') {
      return 'No firmado';
    }
    return 'Firmado';
  }

  // Método auxiliar para obtener descripción de filtros aplicados
  private obtenerFiltrosAplicados(): string {
    const filtrosActivos = [];
    
    if (this.filtros.color) {
      filtrosActivos.push(`Color: ${this.filtros.color}`);
    }
    if (this.filtros.busqueda) {
      filtrosActivos.push(`Búsqueda: ${this.filtros.busqueda}`);
    }
    if (this.filtros.area) {
      filtrosActivos.push(`Área: ${this.filtros.area}`);
    }
    if (this.filtros.fechaDesde) {
      filtrosActivos.push(`Fecha desde: ${this.filtros.fechaDesde}`);
    }
    if (this.filtros.fechaHasta) {
      filtrosActivos.push(`Fecha hasta: ${this.filtros.fechaHasta}`);
    }
    
    return filtrosActivos.length > 0 ? filtrosActivos.join(', ') : 'Sin filtros';
  }

  // Método auxiliar para formatear fechas
  private formatearFecha(fecha: string | Date): string {
    if (!fecha) return 'N/A';
    
    try {
      const fechaObj = new Date(fecha);
      return fechaObj.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (error) {
      return 'Fecha inválida';
    }
  }

  cambiarItemsPorPagina(): void {
    this.paginacion.paginaActual = 1;
    this.calcularPaginacion();
    this.actualizarPrecintosPaginados();
  }

  calcularPaginacion(): void {
    const total = this.precintosFiltrados.length;
    this.paginacion.totalPaginas = Math.ceil(total / this.paginacion.itemsPorPagina);
    
    // Asegurar que la página actual esté dentro del rango válido
    if (this.paginacion.paginaActual > this.paginacion.totalPaginas) {
      this.paginacion.paginaActual = Math.max(1, this.paginacion.totalPaginas);
    }

    this.paginacion.inicio = (this.paginacion.paginaActual - 1) * this.paginacion.itemsPorPagina;
    this.paginacion.fin = Math.min(this.paginacion.inicio + this.paginacion.itemsPorPagina, total);

    this.calcularPaginasVisibles();
  }

  calcularPaginasVisibles(): void {
    const totalPaginas = this.paginacion.totalPaginas;
    const paginaActual = this.paginacion.paginaActual;
    const maxPaginasVisibles = 5;

    if (totalPaginas <= maxPaginasVisibles) {
      this.paginasVisibles = Array.from({ length: totalPaginas }, (_, i) => i + 1);
    } else {
      let inicio = Math.max(1, paginaActual - Math.floor(maxPaginasVisibles / 2));
      let fin = Math.min(totalPaginas, inicio + maxPaginasVisibles - 1);

      if (fin - inicio + 1 < maxPaginasVisibles) {
        inicio = Math.max(1, fin - maxPaginasVisibles + 1);
      }

      this.paginasVisibles = Array.from({ length: fin - inicio + 1 }, (_, i) => inicio + i);
    }
  }

  actualizarPrecintosPaginados(): void {
    const inicio = this.paginacion.inicio;
    const fin = this.paginacion.fin;
    this.precintosPaginados = this.precintosFiltrados.slice(inicio, fin);
  }

  irAPagina(pagina: number): void {
    if (pagina >= 1 && pagina <= this.paginacion.totalPaginas) {
      this.paginacion.paginaActual = pagina;
      this.calcularPaginacion();
      this.actualizarPrecintosPaginados();
    }
  }

  // Método actualizado para verificar si ya existe novedad y firma
  abrirModalFirma(precinto: any) {
    this.precintoSeleccionado = precinto;
    
    // IMPORTANTE: Resetear la firmaUrl SIEMPRE al abrir el modal
    this.firmaUrl = null;
    
    // Verificar si ya existe novedad y firma (ambos diferentes de null)
    const tieneNovedad = precinto.novedades_precintos !== null && 
                         precinto.novedades_precintos !== undefined && 
                         precinto.novedades_precintos.trim() !== '';
    const tieneFirma = precinto.firmado_por !== null && 
                       precinto.firmado_por !== undefined && 
                       precinto.firmado_por.trim() !== '';
    
    if (tieneNovedad && tieneFirma) {
      // Si ambos existen, obtener la firma desde el backend
      this.obtenerFirmaDelBackend(precinto.id);
      this.mostrarFormulario = false;
    } else {
      // Si alguno falta, mostrar el formulario
      this.mostrarFormulario = true;
      this.novedad = '';
      this.firmaBase64 = '';
      this.firma = null;
      this.firmaUrl = null;
    }
    
    this.modalAbierto = true;
  }

  // Nuevo método para obtener la firma del backend
  obtenerFirmaDelBackend(precintoId: number): void {
    // Resetear la URL antes de hacer la petición para evitar mostrar firma anterior
    this.firmaUrl = null;
    
    this.bigbagService.obtenerFirmaTemporal(precintoId).subscribe({
      next: (response) => {
        if (response && response.url) {
          this.firmaUrl = response.url;
          console.log('Firma obtenida del backend para precinto', precintoId, ':', this.firmaUrl);
        } else {
          console.log('No se encontró URL en la respuesta para precinto', precintoId, ':', response);
          this.firmaUrl = null;
        }
      },
      error: (error) => {
        console.error('Error al obtener la firma para precinto', precintoId, ':', error);
        this.firmaUrl = null;
      }
    });
  }

  cerrarModal() {
    this.modalAbierto = false;
    this.mostrarFormulario = true;
  }

  guardarFirmaYnov() {
    // Validaciones básicas usando SweetAlert2
    if (!this.novedad.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Campo requerido',
        text: 'Por favor, ingrese una novedad.',
        confirmButtonColor: '#3085d6',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    if (!this.firmaBase64) {
      Swal.fire({
        icon: 'warning',
        title: 'Firma requerida',
        text: 'Por favor, proporcione una firma digital.',
        confirmButtonColor: '#3085d6',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    // Preparar los datos para enviar
    const data = {
      precinto_id: this.precintoSeleccionado.id,
      numero_precinto: this.precintoSeleccionado.numero_precinto,
      user_id: this.userInfo.id,
      novedad: this.novedad.trim(),
      firma_digital: this.firmaBase64
    };

    console.log('Enviando datos:', data);

    // Enviar al backend
    this.bigbagService.enviarNovedadYFirma(data).subscribe({
      next: (response) => {
        console.log('Respuesta del servidor:', response);
        
        Swal.fire({
          icon: 'success',
          title: '¡Éxito!',
          text: 'Novedad y firma guardadas exitosamente.',
          confirmButtonColor: '#28a745',
          confirmButtonText: 'Continuar'
        });
        
        this.novedad = '';
        this.firmaBase64 = '';
        this.cerrarModal();
        this.enviarUsuarioAlBackend();
      },
      error: (error) => {
        console.error('Error al guardar novedad y firma:', error);
        
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Error al guardar la información. Por favor, intente nuevamente.',
          confirmButtonColor: '#d33',
          confirmButtonText: 'Reintentar'
        });
      }
    });
  }
}