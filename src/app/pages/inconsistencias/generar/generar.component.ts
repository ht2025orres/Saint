import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { Customer } from '../../../models/Customer';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ErpIntegrationService } from '../../../services/erp-integration.service';
import Swal from 'sweetalert2';
import { InconsistenciaService } from '../../../services/inconsistencia.service';
import { AuthService } from '../../../services/auth.service';
import { debounceTime } from 'rxjs/operators';
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

@Component({
  selector: 'app-generar',
  templateUrl: './generar.component.html',
  styleUrls: ['./generar.component.css']
})
export class GenerarComponent implements OnInit {
  title = 'Generar Inconsistencias';
  inconsistenciaForm: FormGroup;
  tipos: { [key: string]: string } = {};
  customers: Customer[] = [];
  ordenesDisponibles: any[] = [];

  itemsDisponibles: any[] = [];

  tiposQueRequierenImagen = [
    'prenda_imperfectos',
    'dano_maquina',
    'retal_incompleto',
    'imperfeccion_tela',
    'insumo_imperfecto',
    'empate_tendido',
    'faltante_rollo',
    'perdida_insumos',
    'perdida_piezas',
    'devolucion_materiales'
  ];

  mostrarGrupoImagenes = false;
  imagenesObligatorias = false;
  mostrarTablaAccion = false;
  accionObligatoria = false;


  cantidadInconsistenciaValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.parent) {
      return null;
    }

    const cantidadInco = parseFloat(control.value?.toString().replace(/,/g, '') || '0');
    const cantidadSolicitada = parseFloat(
      control.parent.get('cantidad_solicitada_op')?.value?.toString().replace(/,/g, '') || '0'
    );

    if (cantidadInco > cantidadSolicitada && cantidadSolicitada > 0) {
      return { cantidadExcedida: true };
    }

    return null;
  };
}

  constructor(
    private fb: FormBuilder,
    private inconsistenciasService: InconsistenciaService,
    private http: HttpClient,
    private erpIntegrationService: ErpIntegrationService,
    private authService: AuthService,
  ) {
    this.inconsistenciaForm = this.fb.group({
  fecha: [{ value: new Date().toISOString().split('T')[0], disabled: true }, Validators.required],
  cliente: ['', Validators.required],
  nombre_proceso: [this.authService.user.nombre_departamento_Sdp, Validators.required],
  jefe_inmediato: [this.authService.user.id_lider, Validators.required],
  lider_nombre: [this.authService.user.lider_nombre, Validators.required],
  id_departamento: [this.authService.user.id_departamento_Sdp, Validators.required],
  id_solicitante: [this.authService.user.id_Sdp, Validators.required],
  codigo_inconsistencia: ['', Validators.required],
  correo_solicitante: [this.authService.user.email, Validators.required],
  inconsistencia: ['', Validators.required],
  cantidad_solicitada_op: ['', Validators.required],
  cantidad_inco: ['', [Validators.required, this.cantidadInconsistenciaValidator()]],
  unidad_medida: ['unidades', Validators.required],
  item: ['', Validators.required],
  nombre_item: ['', Validators.required],
  tipo_inco: ['', Validators.required],
  codigo: ['', Validators.required],
  precio_unitario: ['', Validators.required],
  precio_total: [{ value: '', disabled: true }],
  situacion: ['', Validators.required],
  accion: [''],
  imagenes: [null],
  estado_op: ['Pendiente', Validators.required],
});
  }

  ngOnInit(): void {

    
    // Cargar configuraciones
    this.http.get<{ [key: string]: string }>('/assets/config/config.json').subscribe({
      next: (res) => {
        this.tipos = res;
      },
      error: () => {
        console.error('Error cargando config.json');
      }
    });

    // Control de comportamiento según tipo de inconsistencia
    this.inconsistenciaForm.get('inconsistencia')?.valueChanges.subscribe(tipo => {
      this.mostrarGrupoImagenes = false;
      this.imagenesObligatorias = false;
      this.mostrarTablaAccion = false;
      this.accionObligatoria = false;

      const tipoCtrl = this.inconsistenciaForm.get('inconsistencia');
      const accionCtrl = this.inconsistenciaForm.get('accion');

      if (this.tiposQueRequierenImagen.includes(tipo)) {
        this.mostrarGrupoImagenes = true;
        this.imagenesObligatorias = true;
      } else if (tipo === 'error_operario') {
        this.mostrarGrupoImagenes = true;
        this.imagenesObligatorias = false;
      }

      if (tipo === 'aprovechamiento_insumos') {
        tipoCtrl?.clearValidators();
      } else {
        tipoCtrl?.setValidators([Validators.required]);
      }
      tipoCtrl?.updateValueAndValidity();

      if (tipo === 'documental_contabilidad') {
        this.mostrarGrupoImagenes = true;
        this.imagenesObligatorias = true;
        this.mostrarTablaAccion = true;
        this.accionObligatoria = true;
      }

      if (accionCtrl) {
        this.accionObligatoria
          ? accionCtrl.setValidators([Validators.required])
          : accionCtrl.clearValidators();
        accionCtrl.updateValueAndValidity();
      }
    });

    // Obtener último código de inconsistencia
    this.inconsistenciasService.obtenerUltimoCodigo().subscribe({
      next: (res) => {
        this.inconsistenciaForm.patchValue({
          codigo_inconsistencia: res.codigo
        });
      },
      error: () => {
        console.error('Error obteniendo código de inconsistencia');
      }
    });

    // 👇 Escuchar cambios en cliente y tipo de orden, y consultar automáticamente
    this.inconsistenciaForm.get('cliente')?.valueChanges
      .pipe(debounceTime(500))
      .subscribe(() => this.consultarCodigoOrden());

    this.inconsistenciaForm.get('tipo_inco')?.valueChanges
      .pipe(debounceTime(500))
      .subscribe(() => this.consultarCodigoOrden());
  }

  // ===========================
  // 🔹 MÉTODOS AUXILIARES
  // ===========================

  isPrecioVacioOCero(): boolean {
    const precioValue = this.inconsistenciaForm.get('precio_unitario')?.value;
    
    // Si es null, undefined o string vacío
    if (!precioValue || precioValue === '') return true;
    
    // Convertir a número eliminando formato
    const precioNumerico = parseFloat(precioValue.toString().replace(/,/g, ''));
    
    // Verificar si es 0 o NaN
    return isNaN(precioNumerico) || precioNumerico === 0;
  }

  private formatNumber(value: any): string {
    if (!value) return '';

    // Convertir a número y formatear con comas
    const numero = parseFloat(value.toString().replace(/,/g, ''));

    if (isNaN(numero)) return '';

    return numero.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4
    });
  }

  private consultarCodigoOrden(): void {
    const tipo_inco = this.inconsistenciaForm.get('tipo_inco')?.value;

    if (!tipo_inco) {
      this.ordenesDisponibles = [];
      return;
    }

    this.inconsistenciasService.obtenerCodigoOrden({
      orden_compra: tipo_inco
    }).subscribe({
      next: (res) => {
        if (res.data && Array.isArray(res.data)) {
          this.ordenesDisponibles = res.data;
          console.log('Órdenes disponibles:', this.ordenesDisponibles);
        } else {
          this.ordenesDisponibles = [];
          console.log('No se encontraron órdenes para el tipo seleccionado');
        }
      },
      error: (err) => {
        console.error('Error obteniendo códigos:', err);
        this.ordenesDisponibles = [];
      }
    });
  }

  searchCustomer(content: HTMLInputElement): void {
    const term = content.value.trim();
    if (term.length > 2) {
      this.erpIntegrationService.searchCustomer(term).subscribe({
        next: (resp) => {
          this.customers = resp;
        },
        error: () => {
          this.customers = [];
          console.error('Error buscando clientes');
        }
      });
    }
  }



  // Agregar este método
  consultarItem(): void {
    const codigo = this.inconsistenciaForm.get('codigo')?.value;
    const cliente = this.inconsistenciaForm.get('cliente')?.value;

    if (!codigo) {
      Swal.fire('Advertencia', 'Por favor ingrese un código', 'warning');
      return;
    }

    if (!cliente) {
      Swal.fire('Advertencia', 'Por favor seleccione un cliente', 'warning');
      return;
    }

    this.inconsistenciasService.consultarItem(codigo, cliente).subscribe({
      next: (res) => {
        if (res.success && res.data && res.data.items) {
          this.itemsDisponibles = res.data.items;
          console.log('Items disponibles:', this.itemsDisponibles);

          Swal.fire({
            icon: 'success',
            title: 'Éxito',
            text: `Se encontraron ${this.itemsDisponibles.length} items`,
            timer: 2000,
            showConfirmButton: false
          });
        } else {
          this.itemsDisponibles = [];
          Swal.fire('Info', 'No se encontraron items para el código especificado', 'info');
        }
      },
      error: (err) => {
        console.error('Error consultando ítem:', err);
        this.itemsDisponibles = [];
        Swal.fire('Error', 'Error al consultar los items', 'error');
      }
    });
  }



  assingCustomerValues(content: HTMLInputElement): void {
    const nombre = content.value.trim();
    if (nombre !== '') {
      const cliente = this.customers.find(c => c.customerName === nombre);
      if (cliente) {
        this.inconsistenciaForm.patchValue({
          cliente: cliente.customerName
        });
      }
    } else {
      this.inconsistenciaForm.patchValue({
        cliente: ''
      });
    }
  }

  onItemSelect(event: Event): void {
  const input = event.target as HTMLInputElement;
  const f120IdSeleccionado = input.value.trim();

  if (!f120IdSeleccionado) return;

  // Buscar el item seleccionado en el array
  const itemEncontrado = this.itemsDisponibles.find(
    item => item.f120_id === f120IdSeleccionado
  );

  if (itemEncontrado) {
    const precioUnitario = parseFloat(itemEncontrado.precio_unitario) || 0;
    
    // Rellenar automáticamente los campos del formulario
    this.inconsistenciaForm.patchValue({
      nombre_item: itemEncontrado.f120_id,
      item: [itemEncontrado.descripcion, itemEncontrado.id_color, itemEncontrado.id_talla]
        .filter(Boolean)
        .join(' - '),
      cantidad_solicitada_op: this.formatNumber(itemEncontrado.cantidad),
      precio_unitario: precioUnitario > 0 ? this.formatNumber(precioUnitario) : '0',
      estado_op: itemEncontrado.estado_op || 'Pendiente' // 👈 AGREGAR: Asignar estado de la orden
    });

    // 👇 Validar si el precio es cero y mostrar alerta
    if (precioUnitario === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Precio no disponible',
        text: 'Este ítem no tiene precio unitario registrado. Por favor, ingrese el precio manualmente.',
        confirmButtonText: 'Entendido'
      });
      
      // Hacer foco en el campo de precio unitario
      setTimeout(() => {
        const precioInput = document.getElementById('precio_unitario') as HTMLInputElement;
        if (precioInput) {
          precioInput.focus();
        }
      }, 500);
    } else {
      // Calcular el total automáticamente solo si hay precio
      this.calcularTotal();
    }

    console.log('Item seleccionado:', itemEncontrado);
    console.log('Estado de la orden:', itemEncontrado.estado_op); // 👈 Log para debug
  }
}

  onFileChange(event: any): void {
    const files = event.target.files;
    if (files.length > 0) {
      this.inconsistenciaForm.patchValue({ imagenes: files });
    }
  }

formatearMiles(event: Event) {
  const input = event.target as HTMLInputElement;
  let valor = input.value.replace(/,/g, '');
  if (isNaN(+valor)) return;

  let partes = valor.split('.');
  partes[0] = parseInt(partes[0] || '0', 10).toLocaleString('en-US');
  input.value = partes.join('.');

  // Revalidar cantidad_inco cuando cambie cualquier cantidad
  if (input.id === 'cantidad_solicitada_op' || input.id === 'cantidad_inco') {
    this.inconsistenciaForm.get('cantidad_inco')?.updateValueAndValidity();
  }
  
  // 👇 También revalidar cuando cambie el precio
  if (input.id === 'precio_unitario' || input.id === 'cantidad_inco') {
    this.calcularTotal();
  }
}

  calcularTotal(): void {
    const precioRaw = this.inconsistenciaForm.get('precio_unitario')?.value || '0';
    const cantidadRaw = this.inconsistenciaForm.get('cantidad_inco')?.value || '0';

    const precio = parseFloat(precioRaw.toString().replace(/,/g, '').replace(/\./g, '.')) || 0;
    const cantidad = parseFloat(cantidadRaw.toString().replace(/,/g, '').replace(/\./g, '.')) || 0;

    const total = precio * cantidad;

    this.inconsistenciaForm.patchValue({
      precio_total: total.toLocaleString('en-US', { maximumFractionDigits: 2 })
    });
  }

  

 enviar(): void {
  // Validar formulario
  if (this.inconsistenciaForm.invalid) {
    const camposInvalidos = Object.entries(this.inconsistenciaForm.controls)
      .filter(([_, control]) => control.invalid)
      .map(([key, _]) => key);

    Swal.fire('Error', `Por favor llena todos los campos obligatorios: ${camposInvalidos.join(', ')}`, 'error');
    return;
  }

  const tipoInconsistencia = this.inconsistenciaForm.get('inconsistencia')?.value;
  const imagenes = this.inconsistenciaForm.get('imagenes')?.value;

  // Validar imágenes obligatorias
  if (this.tiposQueRequierenImagen.includes(tipoInconsistencia)) {
    if (!imagenes || imagenes.length === 0) {
      Swal.fire('Error', 'Este tipo de inconsistencia requiere adjuntar imágenes', 'error');
      return;
    }
  }

  // Construir FormData
  const formData = new FormData();
  
  // Agregar campos del formulario (incluyendo los disabled)
  const formValues = this.inconsistenciaForm.getRawValue();
  
  // 👇 DEBUG: Verificar el valor de estado_op antes de enviarlo
  console.log('📤 Valores del formulario antes de enviar:', formValues);
  console.log('📋 Estado de la orden que se enviará:', formValues.estado_op);
  
  Object.entries(formValues).forEach(([key, value]) => {
    if (key === 'imagenes') {
      // Las imágenes se manejan por separado
      return;
    }
    
    if (value !== null && value !== undefined && value !== '') {
      // Convertir la fecha al formato correcto si está deshabilitada
      if (key === 'fecha') {
        formData.append(key, value.toString());
      } else {
        formData.append(key, value.toString());
      }
    }
  });

  // 👇 DEBUG: Verificar que estado_op se agregó al FormData
  console.log('✅ FormData - estado_op:', formData.get('estado_op'));

  // Agregar imágenes si existen
  if (imagenes && imagenes instanceof FileList && imagenes.length > 0) {
    Array.from(imagenes).forEach((file: File, index: number) => {
      formData.append(`imagenes[]`, file, file.name);
    });
  }

  // Mostrar loading
  Swal.fire({
    title: 'Procesando...',
    text: 'Registrando inconsistencia',
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  console.log("🧩 FORM DATA FINAL:");
formData.forEach((val, key) => {
  console.log(key, val);
});


  // Enviar datos
  this.inconsistenciasService.generarInconsistencia(formData).subscribe({
    next: (response) => {
      Swal.fire({
        icon: 'success',
        title: 'Éxito',
        text: 'Inconsistencia registrada correctamente',
        confirmButtonText: 'Aceptar'
      });
      
      // Limpiar formulario y reinicializar
      this.inconsistenciaForm.reset();
      this.itemsDisponibles = [];
      this.ordenesDisponibles = [];
      this.inicializarValoresPorDefecto();
      
      // Obtener nuevo código
      this.inconsistenciasService.obtenerUltimoCodigo().subscribe({
        next: (res) => {
          this.inconsistenciaForm.patchValue({
            codigo_inconsistencia: res.codigo
          });
        }
      });
    },
    error: (err) => {
      console.error('Error al registrar inconsistencia:', err);
      
      let mensajeError = 'Hubo un problema al registrar la inconsistencia';
      
      if (err.error?.message) {
        mensajeError = err.error.message;
   } else if (err.error?.errors) {
  const errores = [].concat(...Object.values(err.error.errors));
  mensajeError = errores.join('\n');
}

      
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: mensajeError,
        confirmButtonText: 'Aceptar'
      });
    }
  });
}

inicializarValoresPorDefecto(): void {
  this.inconsistenciaForm.patchValue({
    fecha: new Date().toISOString().split('T')[0],
    unidad_medida: 'unidades',
    correo_solicitante: this.authService.user.email,
    id_solicitante: this.authService.user.id_Sdp,
    nombre_proceso: this.authService.user.nombre_departamento_Sdp,
    jefe_inmediato: this.authService.user.id_lider,
    lider_nombre: this.authService.user.lider_nombre,
    id_departamento: this.authService.user.id_departamento_Sdp,
    estado_op: 'Pendiente'
  });

  this.inconsistenciaForm.get('fecha')?.disable();
  this.inconsistenciaForm.get('precio_total')?.disable();
  
  // Resetear visibilidad de secciones condicionales
  this.mostrarGrupoImagenes = false;
  this.imagenesObligatorias = false;
  this.mostrarTablaAccion = false;
  this.accionObligatoria = false;
}


}