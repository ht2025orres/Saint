import { Component } from '@angular/core';
import { ReportService } from '../../../services/report.service';
import { Report } from './../../../models/report';
import { AuthService } from '../../../services/auth.service';
import Swal from 'sweetalert2';
import { Customer } from 'src/app/models/Customer';
import { ErpIntegrationService } from '../../../services/erp-integration.service';

@Component({
  selector: 'app-report-create',
  templateUrl: './report-create.component.html',
  styleUrls: ['./report-create.component.css']
})
export class ReportCreateComponent {
  report: Report = {
    id: 0,
    origen: 'calidad',
    tipo_reporte: 'ficha tecnica',
    item: '',
    prenda: '',
    observacion: '',
    evidencia: '',
    creado_por: 0,
    estado: '',
    cliente: ''
  };
   customers: Customer[] = [];

  selectedFile: File | null = null;

  constructor(
    private reportService: ReportService,
    private authService: AuthService,
    private erpIntegrationService: ErpIntegrationService
  ) {}

  // ✅ Captura de archivo (solo se guarda en memoria hasta crear reporte)
  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
    }
  }

  // ✅ Proceso principal de creación
  crearReporte(): void {
    if (!this.report.item || !this.report.prenda) {
      Swal.fire('Atención', 'Debes completar todos los campos obligatorios', 'warning');
      return;
    }

    this.report.creado_por = this.authService.user.id;

    // ✅ Si hay archivo, se sube primero a S3
    if (this.selectedFile) {
      this.reportService.uploadEvidence(this.selectedFile).subscribe({
        next: (res) => {
          this.report.evidencia = res.url; // ruta devuelta por el backend
          this.guardarReporte(); // luego guarda el reporte
        },
        error: (err) => {
          console.error('Error subiendo la evidencia:', err);
          Swal.fire('Error', 'No se pudo subir la evidencia', 'error');
        }
      });
    } else {
      // ✅ Si no hay evidencia, se guarda directamente
      this.guardarReporte();
    }
  }

  // ✅ Guardar reporte en la base de datos
  private guardarReporte(): void {
    this.reportService.createReport(this.report).subscribe({
      next: (res) => {
        Swal.fire('Éxito', 'Reporte creado correctamente', 'success');
        this.resetForm();
      },
      error: (err) => {
        Swal.fire('Error', err.error.message || 'No se pudo crear el reporte', 'error');
      }
    });
  }

  // ✅ Reset del formulario
  private resetForm(): void {
    this.report = {
      id: 0,
      origen: 'calidad',
      tipo_reporte: 'ficha tecnica',
      cliente: '',
      item: '',
      prenda: '',
      observacion: '',
      evidencia: '',
      estado: '',
      creado_por: this.authService.user.id
    };
    this.selectedFile = null;
  }

  // obtener clientes desde siesa
  // ✅ Buscar clientes desde Siesa
searchCustomer(event: Event): void {
  const input = event.target as HTMLInputElement;
  const term = input.value.trim();

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

// ✅ Asignar cliente seleccionado
assingCustomerValues(event: Event): void {
  const input = event.target as HTMLInputElement;
  const nombre = input.value.trim();

  if (nombre !== '') {
    const cliente = this.customers.find(c => c.customerName === nombre);
    if (cliente) {
      // ✅ Asignar directamente al modelo vinculado con ngModel
      this.report.cliente = cliente.customerName;
    }
  } else {
    this.report.cliente = '';
  }
}

}
