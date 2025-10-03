import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { Customer } from '../../../models/Customer';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { ErpIntegrationService } from '../../../services/erp-integration.service';
import Swal from 'sweetalert2';
import { InconsistenciaService } from '../../../services/inconsistencia.service';

import { AuthService } from '../../../services/auth.service';

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
      id_departamento: [this.authService.user.id_departamento_Sdp, Validators.required],
      codigo_inconsistencia: ['', Validators.required],
      correo_solicitante: [this.authService.user.email, Validators.required],
      inconsistencia: ['', Validators.required],
      cantidad_solicitada_op: ['', Validators.required],
      cantidad_inco: ['', Validators.required],
      unidad_medida: ['unidades', Validators.required],
      item: ['', Validators.required],
      tipo_inco: ['', Validators.required],
      codigo: ['', Validators.required],
      precio_unitario: ['', Validators.required],
      precio_total: [{ value: '', disabled: true }],
      situacion: ['', Validators.required],
      accion: [''],
      imagenes: [null]
    });
  }

  ngOnInit(): void {
    this.http.get<{ [key: string]: string }>('/assets/config/config.json')
      .subscribe({
        next: (res) => {
          this.tipos = res;
        },
        error: () => {
          console.error('Error cargando config.json');
        }
      });

    this.inconsistenciaForm.get('inconsistencia')?.valueChanges.subscribe(tipo => {
      this.mostrarGrupoImagenes = false;
      this.imagenesObligatorias = false;
      this.mostrarTablaAccion = false;
      this.accionObligatoria = false;

      const tipoCtrl = this.inconsistenciaForm.get('inconsistencia');
      const accionCtrl = this.inconsistenciaForm.get('accion');

      // Ajustar reglas por tipo seleccionado
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
        this.accionObligatoria ? accionCtrl.setValidators([Validators.required]) : accionCtrl.clearValidators();
        accionCtrl.updateValueAndValidity();
      }
    });

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
    console.log(this.authService.user);
    // this.inconsistenciasService.info().subscribe({
    //   next: (res) => {
    //     this.inconsistenciaForm.patchValue({ nombre_proceso: res.info['nombre_departamento'] });
    //     this.inconsistenciaForm.patchValue({ id_departamento: res.info['id_departamento'] });
    //   },
    //   error: (err) => {
    //     console.error('Error obteniendo el proceso', err);
    //   }
    // });
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

    this.calcularTotal();
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
    if (this.inconsistenciaForm.invalid) {
      const camposInvalidos = Object.entries(this.inconsistenciaForm.controls)
        .filter(([_, control]) => control.invalid)
        .map(([key, _]) => key);

      console.warn('Campos inválidos:', camposInvalidos);
      
      Swal.fire('Error', `Por favor llena todos los campos obligatorios: ${camposInvalidos.join(', ')}`, 'error');
      return;
    }

    const formData = new FormData();

    // Aseguramos el correo del usuario logueado por seguridad
    formData.append('correo_solicitante', this.authService.user.email);
    formData.append('action', 'generar');

    // Agrega todos los valores del formulario
    Object.entries(this.inconsistenciaForm.getRawValue()).forEach(([key, value]) => {
      if (key === 'imagenes' && value instanceof FileList) {
        Array.from(value).forEach((file) => {
          formData.append('imagenes[]', file);
        });
      } else if (value !== null && value !== '') {
        formData.append(key, value.toString());
      }
    });

    this.inconsistenciasService.registrarInconsistencia(formData).subscribe({
      next: (res) => {
        Swal.fire('Éxito', 'Inconsistencia registrada correctamente', 'success');
        this.inconsistenciaForm.reset();
        this.inicializarValoresPorDefecto(); // si tienes campos predefinidos (como fecha o unidad)
      },
      error: (err) => {
        console.error('Error al registrar inconsistencia:', err);
        Swal.fire('Error', 'Hubo un problema al registrar la inconsistencia', 'error');
      }
    });
  }

  inicializarValoresPorDefecto(): void {
    this.inconsistenciaForm.patchValue({
      action: 'generar',
      fecha: new Date().toISOString().split('T')[0], // formato yyyy-mm-dd
      unidad_medida: 'unidades',
      correo_solicitante: this.authService.user.email
    });

    // Si tienes campos deshabilitados, asegúrate de que sigan visibles
    this.inconsistenciaForm.get('fecha')?.disable();
    this.inconsistenciaForm.get('precio_total')?.disable();
  }
}
