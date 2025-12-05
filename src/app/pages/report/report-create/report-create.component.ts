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
    op_reporte: '',
    op_reporte: '',
    item: '',
    prenda: '',
    observacion: '',
    evidencia: '',
    creado_por: 0,
    estado: '',
    cliente: ''
  };

  customers: Customer[] = [];
  itemsOP: any[] = [];

  customers: Customer[] = [];
  itemsOP: any[] = [];
  selectedFile: File | null = null;
  // loadingOP = false;
  // loadingOP = false;

  constructor(
    private reportService: ReportService,
    private authService: AuthService,
    private erpIntegrationService: ErpIntegrationService
  ) { }

  // ==========================
  // CONSULTAR OP
  // ==========================
  buscarOP(): void {
    const op = this.report.op_reporte?.trim();
    if (!op) return;

    this.mostrarLoader();

    this.erpIntegrationService.getItemsByOP(op).subscribe({
      next: (resp) => {
        this.ocultarLoader();

        const data = resp?.data?.[op]?.items || [];
        this.itemsOP = data;

        if (data.length === 0) {
          Swal.fire("Sin resultados", "No se encontraron items para esta OP", "warning");
          return;
        }

        if (data.length === 1) {
          this.asignarItem(data[0]);
        } else {
          this.seleccionarItem(data);
        }
      },
      error: () => {
        this.ocultarLoader();
        Swal.fire("Error", "No fue posible consultar la OP", "error");
      }
    });
  }

  mostrarLoader() {
    Swal.fire({
      title: "Consultando información...",
      html: `
      <div class="spinner" style="
        border: 5px solid #eee;
        border-top: 5px solid #3b82f6;
        border-radius: 50%;
        width: 50px;
        height: 50px;
        margin: 20px auto;
        animation: spin 1s linear infinite;
      "></div>

      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    `,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      backdrop: true
    });
  }


  ocultarLoader() {
    Swal.close();
  }



  // ==========================
  // ASIGNAR ÍTEM
  // ==========================
  asignarItem(item: any) {
    this.report.item = item.codigo_item;
    this.report.prenda = item.descripcion;
    this.report.cliente = item.cliente;

    this.itemsOP = [item];
  }

  asignarItemDesdeLista(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    const item = this.itemsOP.find(i => i.codigo_item == val);

    if (item) {
      this.asignarItem(item);
    }
  }

  seleccionarItem(items: any[]) {

    let html = `
    <input type="text" id="filtroItems" class="swal2-input" placeholder="Filtrar...">

    <div id="listaItems" style="max-height:300px; overflow-y:auto; text-align:left;">
      ${items.map((i, idx) => `
        <div class="item-opcion" data-index="${idx}" 
             style="padding:8px; cursor:pointer; border-bottom:1px solid #ddd;">
          <strong>${i.codigo_item}</strong><br>
          <small>${i.descripcion}</small>
        </div>
      `).join('')}
    </div>
  `;

    Swal.fire({
      title: "Selecciona un ítem",
      html,
      showConfirmButton: false,
      width: 600,
      didOpen: () => {
        const input = document.getElementById("filtroItems") as HTMLInputElement;
        const lista = document.getElementById("listaItems") as HTMLElement;

        // 👉 Filtrar dinamicamente
        input.addEventListener("input", () => {
          const term = input.value.toLowerCase();
          lista.querySelectorAll(".item-opcion").forEach((el: any) => {
            const txt = el.innerText.toLowerCase();
            el.style.display = txt.includes(term) ? "block" : "none";
          });
        });

        // 👉 Capturar clic en item
        lista.querySelectorAll(".item-opcion").forEach((el: any) => {
          el.addEventListener("click", () => {
            const index = Number(el.getAttribute("data-index"));
            this.asignarItem(items[index]);
            Swal.close();
          });
        });
      }
    });
  }


  // ==========================
  // ARCHIVO
  // ==========================
  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) this.selectedFile = file;
  }

  // ==========================
  // CREAR REPORTE
  // ==========================

  // Primero validamos que todos los campos esten diligenciados, solo la Evidencia puede estar vacia.
  camposCompletos(): { ok: boolean, faltantes: string[] } {
    const faltantes: string[] = [];

    if (!this.report.origen) faltantes.push("Origen");
    if (!this.report.tipo_reporte) faltantes.push("Tipo de reporte");
    if (!this.report.op_reporte) faltantes.push("OP");
    if (!this.report.cliente) faltantes.push("Cliente");
    if (!this.report.item) faltantes.push("Item");
    if (!this.report.prenda) faltantes.push("Prenda");
    if (!this.report.observacion) faltantes.push("Observación");
    // evidencia NO es obligatoria

    return { ok: faltantes.length === 0, faltantes };
  }

  crearReporte(): void {
    const val = this.camposCompletos();

    if (!val.ok) {
      Swal.fire({
        icon: 'warning',
        title: 'Campos incompletos',
        html: `
        <p>Debes completar todos los campos obligatorios:</p>
        <ul style="text-align:left;">
          ${val.faltantes.map(f => `<li><strong>${f}</strong></li>`).join('')}
        </ul>
      `
      });
      return;
    }

    this.report.creado_por = this.authService.user.id;

    if (this.selectedFile) {
      this.reportService.uploadEvidence(this.selectedFile).subscribe({
        next: (res) => {
          this.report.evidencia = res.url;
          this.guardarReporte();
          this.report.evidencia = res.url;
          this.guardarReporte();
        },
        error: () => Swal.fire('Error', 'No se pudo subir la evidencia', 'error')
        error: () => Swal.fire('Error', 'No se pudo subir la evidencia', 'error')
      });
    } else {
      this.guardarReporte();
    }
  }

  private guardarReporte(): void {
    this.reportService.createReport(this.report).subscribe({
      next: () => {
        next: () => {
          Swal.fire('Éxito', 'Reporte creado correctamente', 'success');
          this.resetForm();
        },
          error: (err) => {
            Swal.fire('Error', err.error.message || 'No se pudo crear el reporte', 'error');
          }
      });
  }

  private resetForm(): void {
    this.report = {
      id: 0,
      origen: 'calidad',
      tipo_reporte: 'ficha tecnica',
      op_reporte: '',
      op_reporte: '',
      cliente: '',
      item: '',
      prenda: '',
      observacion: '',
      evidencia: '',
      estado: '',
      creado_por: this.authService.user.id
    };

    this.itemsOP = [];

    this.itemsOP = [];
    this.selectedFile = null;
  }

  // ==========================
  // BUSCAR CLIENTE MANUAL
  // ==========================
  searchCustomer(event: Event): void {
    const input = event.target as HTMLInputElement;
    const term = input.value.trim();
    // ==========================
    // BUSCAR CLIENTE MANUAL
    // ==========================
    searchCustomer(event: Event): void {
      const input = event.target as HTMLInputElement;
      const term = input.value.trim();

      if(term.length > 2) {
      this.erpIntegrationService.searchCustomer(term).subscribe({
        next: (resp) => this.customers = resp,
        error: () => (this.customers = [])
      });
    }
  }
  if(term.length > 2) {
  this.erpIntegrationService.searchCustomer(term).subscribe({
    next: (resp) => this.customers = resp,
    error: () => (this.customers = [])
  });
}
  }

assingCustomerValues(event: Event): void {
  const name = (event.target as HTMLInputElement).value.trim();
  const cliente = this.customers.find(c => c.customerName === name);
  if(cliente) this.report.cliente = cliente.customerName;
}
assingCustomerValues(event: Event): void {
  const name = (event.target as HTMLInputElement).value.trim();
  const cliente = this.customers.find(c => c.customerName === name);
  if(cliente) this.report.cliente = cliente.customerName;
}

}
