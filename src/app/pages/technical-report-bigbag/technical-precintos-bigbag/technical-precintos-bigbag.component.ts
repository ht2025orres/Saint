import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../../services/auth.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { BigbagService } from 'src/app/services/bigbag.service';
import { RecepcionData, RecepcionCompleta } from 'src/app/models/RecepcionData.model';
import { FirmaDigitalComponent } from '../FirmaDigital/firma-digital.component';
import { Location } from '@angular/common';
import Swal from 'sweetalert2';

@Component({
  standalone: true,
  selector: 'app-technical-precintos-bigbag',
  imports: [FormsModule, CommonModule, FirmaDigitalComponent],
  templateUrl: './technical-precintos-bigbag.component.html',
  styleUrls: ['./technical-precintos-bigbag.component.css']
})
export class TechnicalPrecintosBigbagComponent implements OnInit {

  //======= FILTROS =================

  filtros = {
    fechaDesde: '',
    fechaHasta: '',
    nombre: '',
    color: ''
  };

  precintosFiltrados: any[] = [];
  coloresFiltro: string[] = ['verde', 'azul', 'blanco'];

  // ========== PROPIEDADES PRINCIPALES ==========
  coloresConsecutivos: any[] = [];
  operarios: any[] = [];
  precintos: any[] = [];
  documentos: any[] = [];

  // ========== CONTROL DE MODALES ==========
  mostrarModal: boolean = false;
  mostrarModalCompleto: boolean = false;
  mostrarModalFirma: boolean = false;

  // ========== CONTROL DE PRECINTOS ==========
  precintosDistribuidos: number = 0;
  cantidadDisponible: number = 0;

  // ========== CONTROL DE ALERTAS ==========
  mostrarAlerta: boolean = false;
  mensajeAlerta: string = '';

  // ========== DATOS DE RECEPCIÓN ==========
  numRecepcion: any;
  id_reporte_llegada: number = 0;
  datosRecepcion: RecepcionCompleta | null = null;
  tienesDatos: boolean = false;

  // ========== CONTROL DE CARGA Y EXPORTACIÓN ==========
cargandoPrecintos: boolean = false;
exportandoExcel: boolean = false;

  // Información del documento (simplificado)
  fechaRecepcion: string = '';
  horaLlegada: string = '';
  Planta: string = '';
  numRemision: string = '';
  cliente: string = '';
  cantidadRelacionada: number = 0;
  cantidad_fisico: number = 0;
  diferencia_reportada: string = '';
  estado: string = '';

  // ========== MODAL FIRMA Y NOVEDADES ==========
  cargandoFirma: boolean = false;
  errorCargandoFirma: boolean = false;
  mensajeErrorFirma: string = '';
  datosFirma: any = null;
  precintoSeleccionadoId: number = 0;

  // ========== NUEVAS PROPIEDADES PARA RANGOS ==========
  private rangoCalculado: string = '';
  private ultimoColorSeleccionado: string = '';
  private ultimaCantidadIngresada: string = '';

  // ========== FORMULARIO DE PRECINTOS ==========
  formularioPrecinto = {
    id_reporte_llegada: 0,
    area: '',
    nombre: '',
    id_operario: '',
    cedula: '',
    cantidad: '',
    rango: '',
    color_consecutivo: '',
    numeroPrecinto: '',
    fechaEntrega: '',
    observaciones: ''
  };

  // ========== CONSTRUCTOR ==========
  constructor(
    private location: Location,
    private bigbagService: BigbagService,
    public authService: AuthService
  ) { }

  // ========== LIFECYCLE HOOKS ==========
  ngOnInit(): void {
    this.inicializarComponente();
  }

  // ========== INICIALIZACIÓN ==========
  private inicializarComponente(): void {
    this.inicializarNumRecepcion();
    this.cargarDatosAdicionales();
    this.cargarDatosIniciales();
  }

  private cargarDatosIniciales(): void {
    Promise.all([
      this.cargarOperarios(),
      this.cargarColoresConsecutivos(),
      this.cargarPrecintos()
    ]).then(() => {
      console.log('Datos iniciales cargados correctamente');
    }).catch(error => {
      console.error('Error al cargar datos iniciales:', error);
    });
  }

  private inicializarNumRecepcion(): void {
    this.numRecepcion = RecepcionData.getNumRecepcion() ||
      RecepcionData.getNumRecepcion();

    if (this.numRecepcion) {
      RecepcionData.setNumRecepcion(this.numRecepcion);
      console.log('Número de recepción:', this.numRecepcion);
    } else {
      console.warn('No se encontró número de recepción');
    }
  }

  // ========== CARGA DE DATOS (PROMESAS) ==========
  private cargarOperarios(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.bigbagService.obtenerUsuarioOperario().subscribe({
        next: (operarios) => {
          this.operarios = operarios;
          console.log('Operarios cargados:', this.operarios.length);
          resolve();
        },
        error: (error) => {
          console.error('Error al cargar operarios:', error);
          reject(error);
        }
      });
    });
  }

  private cargarColoresConsecutivos(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.bigbagService.obtenerColorConsecutivo().subscribe({
        next: (colores) => {
          this.coloresConsecutivos = colores;
          console.log('Colores consecutivos cargados:', this.coloresConsecutivos.length);
          resolve();
        },
        error: (error) => {
          console.error('Error al cargar colores consecutivos:', error);
          reject(error);
        }
      });
    });
  }

 private cargarPrecintos(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!this.id_reporte_llegada) {
      resolve();
      return;
    }

    this.cargandoPrecintos = true; // Activar loading

    this.bigbagService.getPrecintosPorReporte(this.id_reporte_llegada).subscribe({
      next: (response) => {
        this.cargandoPrecintos = false; // Desactivar loading
        
        if (response.success) {
          this.precintos = response.data;
          this.calcularPrecintosDistribuidos();
         
          this.aplicarFiltros();
          console.log('Precintos cargados:', this.precintos.length);
        }
        resolve();
      },
      error: (error) => {
        this.cargandoPrecintos = false; // Desactivar loading en error
        console.error('Error al cargar precintos:', error);
        reject(error);
      }
    });
  });
}
  private cargarDatosAdicionales(): void {
    this.datosRecepcion = RecepcionData.getRecepcionData();

    if (this.datosRecepcion) {
      this.tienesDatos = true;
      this.mapearDatosRecepcion();
    } else {
      this.tienesDatos = false;
      console.log('No hay datos adicionales disponibles');
    }
  }

  private mapearDatosRecepcion(): void {
    if (!this.datosRecepcion) return;

    const {
      id_reporte_llegada_empaque = 0,
      fecha_ingreso = '',
      hora_llegada = '',
      planta = '',
      num_remision = '',
      cliente = '',
      cant_relacionada = 0,
      cantidad_fisico = 0,
      diferencia_reportada = '',
      estado = ''
    } = this.datosRecepcion;

    // Asignación directa usando destructuring
    Object.assign(this, {
      id_reporte_llegada: id_reporte_llegada_empaque,
      fechaRecepcion: fecha_ingreso,
      horaLlegada: hora_llegada,
      Planta: planta,
      numRemision: num_remision,
      cliente,
      cantidadRelacionada: cant_relacionada,
      cantidad_fisico,
      diferencia_reportada,
      estado
    });
  }

  // ========== NAVEGACIÓN ==========
  volver(): void {
    this.location.back();
  }

  // ========== CONTROL DE MODALES ==========
  abrirModal(): void {
    this.calcularPrecintosDistribuidos();

    if (this.precintosDistribuidos >= this.cantidad_fisico) {
      this.mostrarModalCompleto = true;
      return;
    }

    // Recargar los colores consecutivos para obtener el numero_actual actualizado
    // Esto asegura que el rango inicial se calcule correctamente después de asignaciones previas
    this.cargarColoresConsecutivos().then(() => {
      this.mostrarModal = true;
      this.formularioPrecinto.fechaEntrega = this.obtenerFechaActual();
      this.mostrarAlerta = false;
    }).catch(error => {
      console.error('Error al recargar colores consecutivos:', error);
      // Abrir el modal de todas formas si hay error
      this.mostrarModal = true;
      this.formularioPrecinto.fechaEntrega = this.obtenerFechaActual();
      this.mostrarAlerta = false;
    });
  }

  cerrarModal(): void {
    this.mostrarModal = false;
  }

  cerrarModalCompleto(): void {
    this.mostrarModalCompleto = false;
  }

  cerrarModalFirma(): void {
    this.mostrarModalFirma = false;
    this.resetearModalFirma();
  }

  private resetearModalFirma(): void {
    this.datosFirma = null;
    this.errorCargandoFirma = false;
    this.cargandoFirma = false;
    this.precintoSeleccionadoId = 0;
  }

  // ========== CÁLCULOS Y VALIDACIONES ==========
  calcularPrecintosDistribuidos(): void {
    this.precintosDistribuidos = this.precintos.reduce((total, precinto) => {
      return total + (parseInt(precinto.cantidad) || 0);
    }, 0);

    this.cantidadDisponible = this.cantidad_fisico - this.precintosDistribuidos;
  }

  private validarCantidad(): boolean {
    const cantidadSolicitada = parseInt(this.formularioPrecinto.cantidad) || 0;

    if (cantidadSolicitada <= 0) {
      return this.mostrarError('Ingresa una cantidad valida');
    }

    if (this.precintosDistribuidos + cantidadSolicitada > this.cantidad_fisico) {
      const disponibles = this.cantidad_fisico - this.precintosDistribuidos;
      return this.mostrarError(`No puedes distribuir ${cantidadSolicitada} precintos. Solo tienes ${disponibles} disponibles.`);
    }

    return this.limpiarError();
  }

  private mostrarError(mensaje: string): boolean {
    this.mostrarAlerta = true;
    this.mensajeAlerta = mensaje;
    return false;
  }

  private limpiarError(): boolean {
    this.mostrarAlerta = false;
    this.mensajeAlerta = '';
    return true;
  }

  /**
   * Validación completa antes de guardar
   */
  private validarCamposRequeridos(): boolean {
    const { area, nombre, id_operario, cedula, cantidad, color_consecutivo } = this.formularioPrecinto;

    const camposBasicos = !!(area && nombre && id_operario && cedula && cantidad);
    const colorValido = this.validarColorSeleccionado();

    return camposBasicos && colorValido;
  }

  /**
   * Valida que el color seleccionado exista y tenga datos válidos
   */
  private validarColorSeleccionado(): boolean {
    const colorSeleccionado = this.formularioPrecinto.color_consecutivo;

    if (!colorSeleccionado) {
      return this.mostrarError('Debe seleccionar un color para el precinto');
    }

    const colorData = this.coloresConsecutivos.find(color =>
      color.color === colorSeleccionado
    );

    if (!colorData) {
      return this.mostrarError('El color seleccionado no es válido');
    }

    const numeroActual = parseInt(colorData.numero_actual);
    if (isNaN(numeroActual) || numeroActual < 0) {
      return this.mostrarError('El número actual del color seleccionado no es válido');
    }

    return true;
  }

  // ========== MÉTODOS PARA CÁLCULO DE RANGOS ==========

  /**
   * Calcula el rango de precintos basado en el color seleccionado y la cantidad
   */
  private calcularRangoPrecinto(): void {
    const colorSeleccionado = this.formularioPrecinto.color_consecutivo;
    const cantidad = parseInt(this.formularioPrecinto.cantidad) || 0;

    // Limpiar rango si no hay datos suficientes
    if (!colorSeleccionado || cantidad <= 0) {
      this.formularioPrecinto.rango = '';
      this.formularioPrecinto.numeroPrecinto = '';
      return;
    }

    // Evitar recálculos innecesarios
    if (colorSeleccionado === this.ultimoColorSeleccionado &&
      this.formularioPrecinto.cantidad === this.ultimaCantidadIngresada) {
      return;
    }

    // Buscar el color en los datos cargados desde la BD
    const colorData = this.coloresConsecutivos.find(color =>
      color.color === colorSeleccionado
    );

    if (!colorData) {
      console.warn(`No se encontró información para el color: ${colorSeleccionado}`);
      this.formularioPrecinto.rango = '';
      this.formularioPrecinto.numeroPrecinto = '';
      return;
    }

    // Calcular el rango
    // Si numero_actual es 100 y asignamos 50 precintos, el rango debe ser 100 → 149
    const numeroActual = parseInt(colorData.numero_actual) || 0;
    const numeroInicio = numeroActual; // El rango inicia en el valor actual
    const numeroFin = numeroActual + cantidad - 1; // El rango termina en actual + cantidad - 1

    // Asignar valores calculados
    this.formularioPrecinto.rango = `${numeroInicio} - ${numeroFin}`;
    this.formularioPrecinto.numeroPrecinto = `PRE-09-${numeroInicio}`;

    // Guardar valores para evitar recálculos
    this.ultimoColorSeleccionado = colorSeleccionado;
    this.ultimaCantidadIngresada = this.formularioPrecinto.cantidad;
    this.rangoCalculado = this.formularioPrecinto.rango;

    console.log(`Rango calculado para ${colorSeleccionado}:, {
      numeroActual,
      cantidad,
      rango: this.formularioPrecinto.rango,
      numeroPrecinto: this.formularioPrecinto.numeroPrecinto
    }`);
  }

  /**
   * Actualiza el consecutivo en la base de datos después de guardar un precinto
   * @param color Color del precinto
   * @param cantidad Cantidad de precintos distribuidos
   */
  private actualizarConsecutivoEnBD(color: string, cantidad: number): Promise<void> {
    return new Promise((resolve, reject) => {
      // Buscar el color actual
      const colorData = this.coloresConsecutivos.find(c => c.color === color);

      if (!colorData) {
        reject(new Error(`Color ${color} no encontrado`));
        return;
      }

      const numeroActual = parseInt(colorData.numero_actual) || 0;
      const nuevoNumero = numeroActual + cantidad;

      // Actualizar en la base de datos
      this.bigbagService.actualizarConsecutivo(color, nuevoNumero).subscribe({
        next: (response) => {
          console.log(`Consecutivo actualizado para ${color}:, nuevoNumero`);

          // Actualizar el array local
          colorData.numero_actual = nuevoNumero.toString();

          resolve();
        },
        error: (error) => {
          console.error(`Error al actualizar consecutivo para ${color}:, error`);
          reject(error);
        }
      });
    });
  }

  // ========== EVENTOS DEL FORMULARIO ==========

  /**
   * Evento cuando cambia el color seleccionado
   */
 onColorChange(): void {
    console.log('Color cambiado a:', "${this.formularioPrecinto.color_consecutivo}");
    this.limpiarError();
    this.calcularRangoPrecinto();
}
  /**
   * Evento cuando cambia la cantidad
   */
  onCantidadChange(): void {
    this.validarCantidad();
    this.calcularRangoPrecinto();
  }

  onNombreChange(): void {
    const operarioSeleccionado = this.operarios.find(
      operario => operario.nombre_completo === this.formularioPrecinto.nombre
    );

    if (operarioSeleccionado) {
      this.formularioPrecinto.id_operario = operarioSeleccionado.id;
    } else {
      this.formularioPrecinto.id_operario = '';
      this.formularioPrecinto.cedula = '';
    }
  }


  debugearColorSeleccionado(): void {
    console.log('=== DEBUG COLOR SELECCIONADO ===');
    console.log('Valor en formulario:', "${this.formularioPrecinto.color_consecutivo}");
    console.log('Tipo:', typeof this.formularioPrecinto.color_consecutivo);
    console.log('Longitud:', this.formularioPrecinto.color_consecutivo?.length);
    console.log('Colores disponibles:', this.coloresConsecutivos.map(c => "${c.color}"));
    
    // Verificar coincidencias exactas
    const colorEncontrado = this.coloresConsecutivos.find(c => c.color === this.formularioPrecinto.color_consecutivo);
    console.log('Color encontrado en array:', colorEncontrado);
    console.log('===============================');
}


  // ========== EXPORTACIÓN A EXCEL ==========
exportarAExcel(): void {
  if (this.precintosFiltrados.length === 0) {
    return;
  }

  this.exportandoExcel = true;

  try {
    // Preparar datos para Excel
    const datosExcel = this.precintosFiltrados.map((precinto, index) => ({
      '#': index + 1,
      'Fecha Entrega': precinto.fecha_entrega,
      'Responsable': precinto.nombre_responsable,
      'Cédula': precinto.cedula,
      'Cantidad': precinto.cantidad,
      'N° Precinto': precinto.numero_precinto,
      'color': precinto.color_consecutivo,
      'Rango': precinto.rango_precintos,
      'Observaciones': precinto.observaciones || 'Sin observaciones'
    }));

    // Información del documento para el encabezado
    const infoDocumento = [
      ['REPORTE DE ENTREGA DE PRECINTOS'],
      [''],
      ['Documento:', this.numRecepcion],
      ['Cliente:', this.cliente],
      ['Planta:', this.Planta],
      ['Fecha Recepción:', this.fechaRecepcion],
      ['Cantidad Física:', this.cantidad_fisico],
      ['Precintos Distribuidos:', this.precintosDistribuidos],
      ['Fecha Exportación:', new Date().toLocaleDateString()],
      ['']
    ];

    // Crear workbook y worksheet
    import('xlsx').then((XLSX) => {
      const wb = XLSX.utils.book_new();
      
      // Crear hoja con información del documento
      const wsData = [
        ...infoDocumento,
        // Encabezados de la tabla
        Object.keys(datosExcel[0]),
        // Datos de la tabla
        ...datosExcel.map(row => Object.values(row))
      ];
      
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      
      // Aplicar estilos básicos (ancho de columnas)
      const columnWidths = [
        { wch: 5 },   // #
        { wch: 12 },  // Fecha
        { wch: 25 },  // Responsable
        { wch: 12 },  // Cédula
        { wch: 8 },   // Cantidad
        { wch: 15 },  // N° Precinto
        { wch: 20 },  // Rango
        { wch: 30 }   // Observaciones
      ];
      ws['!cols'] = columnWidths;
      
      // Agregar hoja al workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Precintos');
      
      // Generar nombre del archivo
      const fecha = new Date().toISOString().split('T')[0];
      const nombreArchivo = `Precintos_${this.numRecepcion}_${fecha}.xlsx`;
      
      // Descargar archivo
      XLSX.writeFile(wb, nombreArchivo);
      
      console.log(`Excel exportado: ${nombreArchivo}`);
      
    }).catch((error) => {
      console.error('Error al cargar la librería XLSX:', error);
      alert('Error al exportar. La librería XLSX no está disponible.');
    }).finally(() => {
      this.exportandoExcel = false;
    });

  } catch (error) {
    console.error('Error al exportar Excel:', error);
    alert('Error al exportar el archivo Excel');
    this.exportandoExcel = false;
  }
}

  // ========== GUARDADO ==========

  /**
   * Guarda el precinto y actualiza el consecutivo
   */
  guardarPrecinto(): void {
    // Agregar debug antes de las validaciones
    this.debugearColorSeleccionado();
    
    if (!this.validarCantidad() || !this.validarCamposRequeridos()) {
        return;
    }

    // Limpiar espacios en blanco del color antes de enviar
    const colorLimpio = this.formularioPrecinto.color_consecutivo?.trim();
    
    const datosAEnviar = {
        ...this.formularioPrecinto,
        color_consecutivo: colorLimpio, // Usar el color limpio
        id_reporte_llegada: this.id_reporte_llegada,
        accion: 'guardarPrecinto'
    };

    console.log('Datos a enviar:', datosAEnviar);

    this.bigbagService.guardarPrecinto(datosAEnviar).subscribe({
        next: (response) => {
            console.log('Precinto guardado:', response);
            this.procesarGuardadoExitoso();
        },
        error: (error) => {
            console.error('Error al guardar el precinto:', error);
        }
    });
}

  /**
   * Procesa el guardado exitoso y actualiza consecutivos
   */
private procesarGuardadoExitoso(): void {
  const color = this.formularioPrecinto.color_consecutivo;
  const cantidad = parseInt(this.formularioPrecinto.cantidad) || 0;

  this.actualizarConsecutivoEnBD(color, cantidad)
    .then(() => {
      console.log('Consecutivo actualizado correctamente');
      this.calcularPrecintosDistribuidos();
      this.cerrarModal();
      
      // 🎉 MOSTRAR SUCCESS ALERT AQUÍ
      this.mostrarExitoRepartoPrecinto(); // o this.mostrarExitoSimple();
      
      this.resetFormulario();
      return this.cargarPrecintos();
    })
    .catch((error) => {
      console.error('Error al actualizar consecutivo:', error);
      this.calcularPrecintosDistribuidos();
      this.cerrarModal();
      
      // Mostrar alerta de éxito incluso si hay error en consecutivo
      this.mostrarExitoRepartoPrecinto();
      
      this.resetFormulario();
      this.cargarPrecintos();
    });
}


  // ========== FIRMA Y NOVEDADES ==========
  obtenerFirmaPorPrecinto(precintoId: number): void {
    this.precintoSeleccionadoId = precintoId;
    this.cargandoFirma = true;
    this.errorCargandoFirma = false;
    this.datosFirma = null;
    this.mostrarModalFirma = true;

    this.bigbagService.obtenerFirmaTemporal(precintoId).subscribe({
      next: (response) => {
        this.cargandoFirma = false;

        if (response.error) {
          this.errorCargandoFirma = true;
          this.mensajeErrorFirma = response.error;
        } else {
          this.datosFirma = {
            url: response.url,
            novedades: response.novedades_precintos || 'Sin novedades registradas',
            debug: response.debug || []
          };
        }
      },
      error: (error) => {
        console.error('Error al obtener firma:', error);
        this.cargandoFirma = false;
        this.errorCargandoFirma = true;
        this.mensajeErrorFirma = 'Error de conexión al obtener la firma';
      }
    });
  }


 

  /**
   * Aplica todos los filtros a la lista de precintos
   */
  aplicarFiltros(): void {
    let precintosFiltrados = [...this.precintos];

    // Filtro por rango de fechas
    if (this.filtros.fechaDesde) {
      precintosFiltrados = precintosFiltrados.filter(precinto =>
        precinto.fecha_entrega >= this.filtros.fechaDesde
      );
    }

    if (this.filtros.fechaHasta) {
      precintosFiltrados = precintosFiltrados.filter(precinto =>
        precinto.fecha_entrega <= this.filtros.fechaHasta
      );
    }

    // Filtro por nombre (búsqueda parcial, insensible a mayúsculas)
    if (this.filtros.nombre) {
      const nombreBuscar = this.filtros.nombre.toLowerCase().trim();
      precintosFiltrados = precintosFiltrados.filter(precinto =>
        precinto.nombre_responsable?.toLowerCase().includes(nombreBuscar)
      );
    }

    // FILTRO POR COLOR CORREGIDO
    if (this.filtros.color) {
      precintosFiltrados = precintosFiltrados.filter(precinto => {
        // Comparar directamente con el campo color_consecutivo del precinto
        return precinto.color_consecutivo?.toLowerCase() === this.filtros.color.toLowerCase();
      });
    }

    this.precintosFiltrados = precintosFiltrados;

    console.log('Filtros aplicados:', this.filtros);
    console.log('Resultados:', this.precintosFiltrados.length, 'de', this.precintos.length);
  }


  /**
   * Extrae el color de un número de precinto
   * 
   * 
   * 
   */
  private extraerColorDePrecinto(numeroPrecinto: string): string {
    if (!numeroPrecinto) return '';

    const partes = numeroPrecinto.split('-');
    if (partes.length >= 2) {
      return partes[1].toLowerCase();
    }

    return '';
  }

  /**
   * Limpia todos los filtros y muestra todos los precintos
   */
  limpiarFiltros(): void {
    this.filtros = {
      fechaDesde: '',
      fechaHasta: '',
      nombre: '',
      color: ''
    };

    this.aplicarFiltros();
    console.log('Filtros limpiados');
  }

  // ========== UTILIDADES ==========

  /**
   * Resetea el formulario y limpia los caches de cálculo
   */
  private resetFormulario(): void {
    this.formularioPrecinto = {
      id_reporte_llegada: this.id_reporte_llegada,
      area: '',
      nombre: '',
      id_operario: '',
      cedula: '',
      cantidad: '',
      rango: '',
      color_consecutivo: '',
      numeroPrecinto: '',
      fechaEntrega: '',
      observaciones: ''
    };

    // Limpiar cache de cálculos
    this.rangoCalculado = '';
    this.ultimoColorSeleccionado = '';
    this.ultimaCantidadIngresada = '';
  }

  private obtenerFechaActual(): string {
    return new Date().toISOString().split('T')[0];
  }

  obtenerPrecintoSeleccionado(): any {
    return this.precintos.find(p => p.id === this.precintoSeleccionadoId);
  }

  onImagenError(event: any): void {
    console.error('Error al cargar la imagen:', event);
    event.target.style.display = 'none';
  }

  // ========== MÉTODOS ADICIONALES PARA EL TEMPLATE ==========
  trackByPrecintoId(index: number, precinto: any): any {
    return precinto.id;
  }

  getModalFirmaTitle(): string {
    if (this.cargandoFirma) return 'Cargando...';
    if (this.errorCargandoFirma) return 'Información del Precinto';
    return 'Firma y Novedades';
  }

  // ========== MÉTODOS DE LIMPIEZA ==========
  obtenerDato(campo: string): any {
    return this.datosRecepcion ? this.datosRecepcion[campo] : '';
  }

  limpiarDatosRecepcion(): void {
    RecepcionData.clearAll();
    this.datosRecepcion = null;
    this.tienesDatos = false;
    this.resetearVariables();
  }

  private resetearVariables(): void {
    Object.assign(this, {
      fechaRecepcion: '',
      horaLlegada: '',
      Planta: '',
      numRemision: '',
      cliente: '',
      cantidadRelacionada: 0,
      cantidad_fisico: 0,
      diferencia_reportada: '',
      estado: ''
    });
  }

private mostrarExitoRepartoPrecinto(): void {
  const cantidadRepartida = parseInt(this.formularioPrecinto.cantidad) || 0;
  const responsable = this.formularioPrecinto.nombre;
  const rangoPrecinto = this.formularioPrecinto.rango;
  const colorPrecinto = this.formularioPrecinto.color_consecutivo;

  Swal.fire({
    icon: 'success',
    title: '¡Precinto Repartido Exitosamente!',
    confirmButtonText: 'Cerrar',
    confirmButtonColor: '#28a745',
    timer: 5000,
    timerProgressBar: true,
    showConfirmButton: true,
    allowOutsideClick: true,
    customClass: {
      popup: 'swal-wide',
      title: 'swal-title-success'
    }
  });
}


  // ========== MÉTODO AUXILIAR PARA DEBUG ==========

  /**
   * Obtiene información detallada del estado actual de los colores
   * Útil para debugging
   */
  obtenerEstadoColores(): any {
    return this.coloresConsecutivos.map(color => ({
      color: color.color,
      numeroActual: color.numero_actual,
      numeroSiguiente: (parseInt(color.numero_actual) || 0) + 1
    }));
  }
}