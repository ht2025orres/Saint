import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BigbagService } from '../../../services/bigbag.service';
import { User } from '../../../models/User';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuthService } from '../../../services/auth.service';
import { ErpIntegrationService } from '../../../services/erp-integration.service';
import { Customer } from '../../../models/Customer';

// Interface movida del servicio
export interface BigBagResponse {
  success: boolean;
  mensaje: string;
  datos?: {
    id: number;
    fecha_creacion: string;
    numero_recepcion: string;
    user_id: number;
  };
  error?: string;
}

interface StepState {
  active: boolean;
  completed: boolean;
}

interface StepStates {
  [key: number]: StepState;
}

@Component({
  selector: 'app-technical-report-bigbag',
  templateUrl: './technical-report-bigbag.component.html',
  styleUrls: ['./technical-report-bigbag.component.css']
})
export class TechnicalReportBigbagComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  customers: Customer[] = [];

  // Listas estáticas para datalists
  clientesEstaticos: string[] = [
    'INGENIO DEL CAUCA S.A.S',
    'INGENIO PROVIDENCIA S.A.',
    'RIOPAILA CASTILLA S.A.',
    'INGENIO PICHICHI S.A.',
    'MANUELITA S.A.',
    'COMPAÑIA DE GALLETAS NOEL S.A.S',
    'INDUSTRIA MOLINERA DE CALDAS S.A',
    'CARVAJAL EMPAQUES S.A.',
    'SIDERURGICA DEL OCCIDENTE S.A.S'
  ];

  plantas: string[] = [
    'MOLINOS SANTA MARTA',
    'INCAUCA',
    'PROVIDENCIA',
    'CASTILLA',
    'PICHICHI',
    'MANUELITA',
    'MOLINERA',
    'CAMPO',
    'MANGAS',
    'ALDOR',
    'ALPINA',
    'ALTEA FARMA',
    'BAVARIA BARRANQUILLA',
    'BAVARIA TOCANCIPA',
    'BOGOTÁ',
    'CERVECERIA DEL VALLE',
    'CERVECERIA UNION',
    'COCA-COLA TOCANCIPA',
    'COCA-COLA EMBOSA',
    'COLOMBINA',
    'GLACIAL EMBEBIDAS',
    'KELLOGS',
    'NACIONAL DE CHOCOLATE RIONEGRO',
    'NACIONAL DE CHOCOLATE BOGOTA',
    'UNILEVER',
    'AJE',
    'ASSOCIATED BRANDS COLOMBIA',
    'ENALIA',
    'NESTLE BUGALAGRANDE',
    'NESTLE DTA',
    'LEVAPAN',
    'RAMO',
    'AMERICANDY',
    'DULCES LA AMERICANA',
    'CABARRIA IQA',
    'SUCROAL',
    'TECNOLOGIA ALIMENTICIAS',
    'BELLO',
    'LUX BOGOTA',
    'LUX PIEDECUESTA',
    'MALAMBO',
    'POSTOBON PEREIRA',
    'INDUSTRIAS JUMBO',
    'CENTRAL CERVECERA',
    'GASEOSAS COLOMBIANAS',
    'POSTOBON YUMBO',
    'OTRO'
  ];

  bigbagForm: FormGroup;
  currentStep: number = 1;
  readonly totalSteps: number = 3;

  stepStates: StepStates = {};
  isSubmitting: boolean = false;
  submitError: string = '';
  submitSuccess: boolean = false;
  currentUser: User | null = null;
  showSuccessModal: boolean = false;
  numeroRecepcion: string = '';

  // Configuración de campos por paso
  private readonly stepFieldsConfig: { [key: number]: string[] } = {
    1: ['fechaIngreso', 'horaIngreso', 'planta', 'remision', 'cantidadRelacionada', 'nomOperario', 'observaciones'],
    2: ['nomConductor', 'placaVehiculo', 'empresaTransporte', 'firmaConductor'],
    3: ['cantidadFisico']
  };

  constructor(
    private fb: FormBuilder,
    private bigbagService: BigbagService,
    public authService: AuthService,
    private erpIntegrationService: ErpIntegrationService
  ) {
    this.bigbagForm = this.fb.group({});
    this.initializeForm();
    this.initializeStepStates();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnInit(): void {
    this.updateStepDisplay();
    this.initializeForm();
    this.loadCurrentUser();
  }

  // === INICIALIZACIÓN ===
  private initializeStepStates(): void {
    this.stepStates = {};
    for (let i = 1; i <= this.totalSteps; i++) {
      this.stepStates[i] = {
        active: i === 1,
        completed: false
      };
    }
  }

  private loadCurrentUser(): void {
    const user = this.authService.user ?? ({} as any);

    const userFullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();

    this.currentUser = {
      id: user.id ?? null,
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      email: user.email ?? 'juan.perez@example.com',
      password: '',
      enabled: user.enabled ?? true,
      roles: user.roles ?? [],
      permissions: user.permissions ?? [],
      modules: user.modules ?? [],
      id_Sdp: user.id_Sdp ?? null,
      nombre_departamento_Sdp: user.nombre_departamento_Sdp ?? '',
      id_departamento_Sdp: user.id_departamento_Sdp ?? null,
      nombre_completo: userFullName,
      id_lider: user.id_lider ?? null,
      lider_nombre: user.lider_nombre ?? ''
    } as any;

    // Establecer el nombre del operario
    this.bigbagForm.patchValue({
      nomOperario: userFullName
    });
  }

  private initializeForm(): void {
    this.bigbagForm = this.fb.group({
      fechaIngreso: [this.getTodayDate(), Validators.required],
      horaIngreso: [this.getCurrentTime(), Validators.required],
      planta: ['', Validators.required],
      remision: ['', Validators.required],
      cantidadRelacionada: ['', [Validators.required, Validators.min(1)]],
      nomOperario: ['', Validators.required],
      firma: ['', Validators.required],
      observaciones: ['', Validators.required],
      nomConductor: ['', Validators.required],
      placaVehiculo: ['', Validators.required],
      empresaTransporte: ['', Validators.required],
      firmaConductor: ['', Validators.required],
      cantidadFisico: ['', [Validators.required, Validators.min(0)]],
      diferenciaReportada: [''],
      cliente: ['', Validators.required]
    });

    // Suscripciones para cálculo automático
    this.setupCalculationSubscriptions();
  }

  private setupCalculationSubscriptions(): void {
    const cantidadFields = ['cantidadRelacionada', 'cantidadFisico'];

    cantidadFields.forEach(field => {
      this.bigbagForm.get(field)?.valueChanges
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
        this.calcularDiferenciaReportada();
      });
    });
  }

  // === NAVEGACIÓN DE PASOS (Refactorizada) ===
  siguientePaso(): void {
    if (this.isCurrentStepValid() && this.currentStep < this.totalSteps) {
      this.navigateToStep(this.currentStep + 1, true);
    } else {
      this.markCurrentStepFieldsAsTouched();
    }
  }

  pasoAnterior(): void {
    if (this.currentStep > 1) {
      this.navigateToStep(this.currentStep - 1, false);
    }
  }

  irAPaso(step: number): void {
    if (step <= this.currentStep || this.stepStates[step - 1]?.completed) {
      this.navigateToStep(step, false);
    }
  }

  // Método modificado para asignar valores de cliente
  assingCustomerValues(content: HTMLInputElement): void {
    const nombre = content.value.trim();
    if (nombre !== '') {
      // Primero buscar en clientes estáticos
      const clienteEstatico = this.clientesEstaticos.find(c => c === nombre);
      if (clienteEstatico) {
        this.bigbagForm.patchValue({
          cliente: clienteEstatico
        });
      } else {
        // Si no está en estáticos, buscar en la lista dinámica (ERP)
        const cliente = this.customers.find(c => c.customerName === nombre);
        if (cliente) {
          this.bigbagForm.patchValue({
            cliente: cliente.customerName
          });
        }
      }
    } else {
      this.bigbagForm.patchValue({
        cliente: ''
      });
    }
  }

  // Nuevo método para asignar valores de planta
  assignPlantaValues(content: HTMLInputElement): void {
    const nombre = content.value.trim();
    if (nombre !== '') {
      const planta = this.plantas.find(p => p === nombre);
      if (planta) {
        this.bigbagForm.patchValue({
          planta: planta
        });
      }
    } else {
      this.bigbagForm.patchValue({
        planta: ''
      });
    }
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

  private navigateToStep(targetStep: number, markCurrentAsCompleted: boolean = false): void {
    // Actualizar estado del paso actual
    this.stepStates[this.currentStep].active = false;
    if (markCurrentAsCompleted) {
      this.stepStates[this.currentStep].completed = true;
    }

    // Navegar al nuevo paso
    this.currentStep = targetStep;
    this.stepStates[this.currentStep].active = true;

    // Si vamos hacia atrás, marcar como no completado
    if (!markCurrentAsCompleted) {
      this.stepStates[this.currentStep].completed = false;
    }

    this.updateStepDisplay();
  }

  // === MANEJO DE FIRMAS (Refactorizado) ===
  onSignatureData(dataURL: string): void {
    this.handleSignatureData(dataURL, 'firma', 'Firma recibida');
  }

  onConductorSignatureData(dataURL: string): void {
    this.handleSignatureData(dataURL, 'firmaConductor', 'Firma conductor recibida');
  }

  private handleSignatureData(dataURL: string, fieldName: string, logMessage: string): void {
    console.log(logMessage + ':', dataURL);

    if (dataURL && dataURL.startsWith('data:image/')) {
      this.bigbagForm.get(fieldName)?.setValue(dataURL);
    } else {
      console.error(`DataURL de ${fieldName} inválido:`, dataURL);
      this.bigbagForm.get(fieldName)?.setValue('');
    }
  }

  // === CÁLCULOS ===
  calcularDiferenciaReportada(): void {
    const cantidadRelacionada = parseFloat(this.bigbagForm.get('cantidadRelacionada')?.value);
    const cantidadFisico = parseFloat(this.bigbagForm.get('cantidadFisico')?.value);

    if (!isNaN(cantidadRelacionada) && !isNaN(cantidadFisico)) {
      const diferencia = cantidadFisico - cantidadRelacionada;
      const mensaje = this.generateDifferenceMessage(diferencia);

      this.bigbagForm.patchValue({ diferenciaReportada: mensaje });
    }
  }

  private generateDifferenceMessage(diferencia: number): string {
    if (diferencia > 0) {
      return `${diferencia} empaques de más`;
    } else if (diferencia < 0) {
      return `${Math.abs(diferencia)} empaques faltantes`;
    } else {
      return 'Las cantidades coinciden';
    }
  }

  // === LÓGICA DE ENVÍO MOVIDA DEL SERVICIO ===

  /**
   * Construir FormData con los datos del formulario
   */
  private buildFormData(formData: any): FormData {
    const formDataToSend = new FormData();

    // Datos del usuario
    formDataToSend.append('userId', this.currentUser!.id.toString());
    formDataToSend.append('firstName', this.currentUser!.firstName);
    formDataToSend.append('lastName', this.currentUser!.lastName);

    // Datos del formulario
    Object.keys(formData).forEach(key => {
      if (formData[key] !== null && formData[key] !== '') {
        // CAMBIO PRINCIPAL: Las firmas se envían como strings base64, no como archivos
        if (key === 'firma' || key === 'firmaConductor') {
          // Enviar directamente el data URL como string
          formDataToSend.append(key, formData[key]);
          console.log(`${key} enviada como base64 string`);
        } else {
          formDataToSend.append(key, formData[key]);
        }
      }
    });

    formDataToSend.append('timestamp', new Date().toISOString());
    return formDataToSend;
  }

  /**
   * Convertir dataURL a File
   */
  private dataURLToFile(dataURL: string, filename: string): File | null {
    try {
      if (!dataURL || !dataURL.startsWith('data:')) {
        console.error('DataURL inválido:', dataURL);
        return null;
      }

      const arr = dataURL.split(',');
      if (arr.length !== 2) {
        console.error('Formato de dataURL incorrecto');
        return null;
      }

      const mimeMatch = arr[0].match(/:(.*?);/);
      if (!mimeMatch) {
        console.error('No se pudo extraer el tipo MIME');
        return null;
      }

      const mime = mimeMatch[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);

      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }

      return new File([u8arr], filename, { type: mime });
    } catch (error) {
      console.error('Error al convertir dataURL a File:', error);
      return null;
    }
  }

  // === ENVÍO DE FORMULARIO ===
  onSubmit(): void {
    if (!this.validateUserForSubmission()) return;
    if (this.bigbagForm.valid) {
      this.submitForm();
    } else {
      this.handleInvalidForm();
    }
  }

  private validateUserForSubmission(): boolean {
    if (!this.currentUser?.id) {
      this.submitError = 'Error: No se pudo obtener la información del usuario actual.';
      return false;
    }
    return true;
  }

  private submitForm(): void {
    this.isSubmitting = true;
    this.resetSubmissionState();

    const formData = this.buildFormData(this.bigbagForm.value);
    this.logFormDataForDebug(this.bigbagForm.value);

    // Usar el método simplificado del servicio
    this.bigbagService.guardarRecepcion(formData).subscribe({
      next: (response) => this.handleSubmissionResponse(response),
      error: (error) => this.handleSubmissionError(error)
    });
  }

  private resetSubmissionState(): void {
    this.submitError = '';
    this.submitSuccess = false;
  }

  private logFormDataForDebug(formData: any): void {
    console.log('Datos del formulario a enviar:', {
      ...formData,
      firma: formData.firma ?
        `data:image/png;base64... (${formData.firma.length} caracteres)` :
        'No hay firma',
      firmaConductor: formData.firmaConductor ?
        `data:image/png;base64... (${formData.firmaConductor.length} caracteres)` :
        'No hay firma conductor'
    });

    // Log adicional para verificar que las firmas son data URLs válidos
    if (formData.firma) {
      console.log('Firma válida:', formData.firma.startsWith('data:image/'));
    }
    if (formData.firmaConductor) {
      console.log('Firma conductor válida:', formData.firmaConductor.startsWith('data:image/'));
    }
  }

  private handleSubmissionResponse(response: BigBagResponse): void {
    this.isSubmitting = false;

    if (response.success) {
      this.submitSuccess = true;
      this.numeroRecepcion = response.datos?.numero_recepcion || 'N/A';
      this.showSuccessModal = true;
    } else {
      this.submitError = response.mensaje || 'Error al guardar la recepción';
    }
  }

  private handleSubmissionError(error: any): void {
    this.isSubmitting = false;
    this.submitSuccess = false;

    this.submitError = error.error?.mensaje || 'Error de conexión. Por favor intente nuevamente.';
    console.error('Error al enviar datos:', error);
  }

  private handleInvalidForm(): void {
    this.markAllFieldsAsTouched();
    this.submitError = 'Por favor complete todos los campos requeridos.';
  }

  // === MODAL Y RESETEO ===
  closeSuccessModal(): void {
    this.showSuccessModal = false;
    this.resetForm();
  }

  onModalBackdropClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.closeSuccessModal();
    }
  }

  resetForm(): void {
    this.bigbagForm.reset();
    this.initializeStepStates();
    this.currentStep = 1;

    // Reset de estados
    this.submitError = '';
    this.submitSuccess = false;
    this.isSubmitting = false;
    this.showSuccessModal = false;
    this.numeroRecepcion = '';

    // Restaurar valores por defecto
    this.bigbagForm.patchValue({
      fechaIngreso: this.getTodayDate(),
      horaIngreso: this.getCurrentTime()
    });

    this.updateStepDisplay();
  }

  // === VALIDACIÓN ===
  private markAllFieldsAsTouched(): void {
    Object.keys(this.bigbagForm.controls).forEach(key => {
      this.bigbagForm.get(key)?.markAsTouched();
    });
  }

  private isCurrentStepValid(): boolean {
    const currentStepFields = this.getFieldsForStep(this.currentStep);
    return currentStepFields.every(field => {
      const control = this.bigbagForm.get(field);
      return !control || control.valid;
    });
  }

  private markCurrentStepFieldsAsTouched(): void {
    const currentStepFields = this.getFieldsForStep(this.currentStep);
    currentStepFields.forEach(field => {
      this.bigbagForm.get(field)?.markAsTouched();
    });
  }

  private getFieldsForStep(step: number): string[] {
    return this.stepFieldsConfig[step] || [];
  }

  // === HELPERS PARA TEMPLATE ===
  isFieldInvalid(fieldName: string): boolean {
    const field = this.bigbagForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string): string {
    const field = this.bigbagForm.get(fieldName);

    if (field?.errors) {
      if (field.errors['required']) return 'Este campo es requerido';
      if (field.errors['min']) return `El valor mínimo es ${field.errors['min'].min}`;
    }

    return '';
  }

  // === UTILIDADES ===
  private getTodayDate(): string {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }

  private getCurrentTime(): string {
    const now = new Date();
    return now.toTimeString().slice(0, 5);
  }

  private updateStepDisplay(): void {
    this.updateStepStyles();
    this.updateStepContent();
  }

  private updateStepStyles(): void {
    for (let i = 1; i <= this.totalSteps; i++) {
      const stepElement = document.getElementById(`cont_paso${i}`);
      const stepCircle = stepElement?.querySelector('.paso');

      if (stepElement && stepCircle) {
        // Limpiar clases
        stepElement.classList.remove('active', 'completed');
        stepCircle.classList.remove('active', 'completed');

        // Aplicar estado actual
        const state = this.stepStates[i];
        if (state.active) {
          stepElement.classList.add('active');
          stepCircle.classList.add('active');
        } else if (state.completed) {
          stepElement.classList.add('completed');
          stepCircle.classList.add('completed');
        }
      }
    }
  }

  private updateStepContent(): void {
    // Ocultar todos los contenidos
    const allStepContents = document.querySelectorAll('.step-content');
    allStepContents.forEach(content => {
      (content as HTMLElement).style.display = 'none';
    });

    // Mostrar el contenido actual
    const currentStepContent = document.getElementById(`step-content-${this.currentStep}`);
    if (currentStepContent) {
      currentStepContent.style.display = 'block';
    }
  }
}