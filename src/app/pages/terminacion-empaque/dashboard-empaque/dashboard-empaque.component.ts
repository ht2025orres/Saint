import { Component, OnInit } from '@angular/core';
import { TerminacionEmpaqueService } from '../../../services/terminacion-empaque.service';
import { UserService } from '../../../services/user.service';
import { AuthService } from '../../../services/auth.service';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { forkJoin, firstValueFrom } from 'rxjs';
import * as bootstrap from 'bootstrap';
import * as QRCode from 'qrcode';
import Swal from 'sweetalert2';

// Interfaces actualizadas
interface User {
  id: number;
  nombre_completo: string;
  email: string;
  roles: { [key: number]: string };
}

interface ApiResponse {
  success: boolean;
  usuarios: User[];
}

interface OP {
  id: number;
  codigo: string;
  estado: string;
  fecha_creacion: string;
  descripcion: string;
  cantidad_total: number;
  progreso: number;
  pvs?: any[];
  pts?: any[];
}

@Component({
  selector: 'app-dashboard-empaque',
  templateUrl: './dashboard-empaque.component.html',
  styleUrls: ['./dashboard-empaque.component.css']
})
export class DashboardEmpaqueComponent implements OnInit {
  // Variables para empaque
  fechaInicio: string | null = null;
  fechaFin: string | null = null;
  empacadorFiltro: string = '';
  kpis: any = {};
  registros: any[] = [];
  empacadoresData: any[] = [];
  empacadoresList: User[] = [];

  // Variables para OPs
  fechaFiltroOP: string = '';
  estadoFiltroOP: string = '';
  numeroOPFiltro: string = '';
  kpisOP: any = {};
  opsData: OP[] = [];
  selectedOP: OP | null = null;
  // qrData: string = '';

  searchTerm: string = '';
  currentPage: number = 1;
  pageSize: number = 10;
  expandedOPs: Set<string> = new Set();
  expandedPVs: Set<string> = new Set();
  filteredOPs: any[] = [];
  paginatedOPs: any[] = [];
  totalPages: number = 0;
  Math = Math;

  costosPorDia: number[] = [];

  selectedItem: any = null;
  selectedItemType: 'OP' | 'PV' = 'OP';

  // Configuración gráfico de barras
  barChartData: ChartData<'bar'> = {
    labels: [],
    datasets: []
  };
  barChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    scales: { y: { beginAtZero: true } }
  };
  barChartType: ChartType = 'bar';

  // Configuración gráfico de pie
  pieChartData: ChartData<'pie'> = {
    labels: [],
    datasets: []
  };
  pieChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    plugins: { legend: { position: 'right' } }
  };
  pieChartType: ChartType = 'pie';

  constructor(
    private empaqueService: TerminacionEmpaqueService, 
    private userService: UserService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.cargarDashboard();
    this.cargarDashboardOPs();
  }

  // 🔹 Normaliza: quita tildes, pasa a minúsculas, conserva caracteres especiales
  normalizeText(value: any): string {
    if (!value) return '';
    return value
      .toString()
      .normalize('NFD')               // separa acentos de letras
      .replace(/[\u0300-\u036f]/g, '') // elimina acentos
      .toLowerCase();
  }

  applyFilter(): void {
    if (!this.searchTerm) {
      this.filteredOPs = [...this.opsData];
    } else {
      const term = this.normalizeText(this.searchTerm);

      this.filteredOPs = this.opsData.filter(op => {
        // Buscar en OP
        const opMatches = 
          this.normalizeText(op.codigo).includes(term) ||
          this.normalizeText(op.estado).includes(term);
        
        // Buscar en PVs e Items
        const pvMatches = op.pvs?.some(pv => {
          const pvCodeMatches = this.normalizeText(pv.codigo).includes(term);
          
          const itemMatches = pv.items?.some(item => 
            this.normalizeText(item.descripcion).includes(term) ||
            this.normalizeText(item.referencia).includes(term) ||
            this.normalizeText(item.id_talla).includes(term) ||
            this.normalizeText(item.id_item).includes(term)
          );
          
          const ptMatches = pv.pts?.some(pt => {
            // Coincidencias directas en la PT
            const ptDirectMatches =
              this.normalizeText(pt.pt_codigo).includes(term) ||
              this.normalizeText(pt.descripcion).includes(term) ||
              this.normalizeText(pt.referencia).includes(term) ||
              this.normalizeText(pt.id_talla).includes(term) ||
              this.normalizeText(pt.id_item).includes(term);

            // Coincidencias en los items dentro de la PT
            const ptItemMatches = pt.items?.some(item =>
              this.normalizeText(item.descripcion).includes(term) ||
              this.normalizeText(item.referencia).includes(term) ||
              this.normalizeText(item.id_talla).includes(term) ||
              this.normalizeText(item.id_item).includes(term)
            );

            return ptDirectMatches || ptItemMatches;
          });
          
          return pvCodeMatches || itemMatches || ptMatches;
        });
        
        return opMatches || pvMatches;
      });
    }

    this.currentPage = 1;
    this.updatePagination();
  }

  updatePagination(): void {
    this.totalPages = Math.ceil(this.filteredOPs.length / this.pageSize);
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.paginatedOPs = this.filteredOPs.slice(startIndex, endIndex);
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePagination();
    }
  }

  getPages(): number[] {
    const pages: number[] = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return pages;
  }

  setPageSize(event: any): void {
    this.pageSize = Number(event.target.value);
    this.updatePagination();
  }

  toggleOP(opCodigo: string): void {
    if (this.expandedOPs.has(opCodigo)) {
      this.expandedOPs.delete(opCodigo);
    } else {
      this.expandedOPs.add(opCodigo);
    }
  }

  togglePV(pvCodigo: string): void {
    if (this.expandedPVs.has(pvCodigo)) {
      this.expandedPVs.delete(pvCodigo);
    } else {
      this.expandedPVs.add(pvCodigo);
    }
  }

  getTotalPTs(op: any): number {
    return op.pvs?.reduce((acc: number, pv: any) => acc + (pv.pts?.length || 0), 0) || 0;
  }

  // Actualiza el método procesarDatosOPs
  procesarDatosOPs(data: any) {
    this.kpisOP = data.kpis;
    this.opsData = data.ops || [];
    this.filteredOPs = [...this.opsData];
    this.updatePagination();
  }

// Actualiza el método verDetalleOP
// verDetalleOP(op: any): void {
//   this.selectedOP = op;
//   const modalElement = document.getElementById('opDetailModal');
//   if (modalElement) {
//     const modal = new bootstrap.Modal(modalElement);
//     modal.show();
//   }
// }

  aplicarFiltros() {
    this.cargarDashboard();
  }

  aplicarFiltrosOP() {
    this.cargarDashboardOPs();
  }

  cargarDashboard() {
    forkJoin({
      empacadores: this.userService.getUserByRoles([16]),
      dashboard: this.empaqueService.getDashboardData({
        fechaInicio: this.fechaInicio,
        fechaFin: this.fechaFin,
        empacador: this.empacadorFiltro
      })
    }).subscribe(({ empacadores, dashboard }) => {
      // Adaptación a la nueva estructura de respuesta
      if (Array.isArray(empacadores)) {
        this.empacadoresList = empacadores.map((u: any) => ({
          ...u,
          roles: Array.isArray(u.roles)
            ? u.roles.reduce((acc: any, role: any) => {
                acc[role.id] = role.nombre || role.name || String(role.id);
                return acc;
              }, {})
            : u.roles
        }));
      } else if (empacadores && typeof empacadores === 'object' && 'usuarios' in empacadores) {
        this.empacadoresList = (empacadores as ApiResponse).usuarios;
      } else {
        this.empacadoresList = [];
      }

      console.log('Empacadores cargados:', this.empacadoresList);
      this.procesarDatosDashboard(dashboard);
    });
  }

  cargarDashboardOPs() {
    // Aquí debes crear un método en tu servicio para obtener datos de OPs
    this.empaqueService.getOPsDashboardData({
      fecha: this.fechaFiltroOP,
      estado: this.estadoFiltroOP,
      numero_op: this.numeroOPFiltro
    }).subscribe((data) => {
      this.procesarDatosOPs(data);
    });
  }

  procesarDatosDashboard(data: any) {
    // 1. KPIs
    this.kpis = data.kpis;
    
    // 2. Gráfico de barras: Actividad últimos 7 días
    this.actualizarGraficoBarras(data.registros_por_dia);
    
    // 3. Filtrar datos de empacadores usando los IDs de la lista actualizada
    const empacadoresIds = this.empacadoresList.map(e => e.id);
    this.empacadoresData = (data.por_empacador || []).filter((emp: any) => 
      empacadoresIds.includes(emp.empacador_id)
    );
    
    // 4. Gráfico de pie: Distribución por Empacador
    this.actualizarGraficoPie();
    
    // 5. Registros detallados
    this.registros = (data.detalle || []).filter((reg: any) => 
      empacadoresIds.includes(reg.empacador_id)
    );
  }

  // procesarDatosOPs(data: any) {
  //   this.kpisOP = data.kpis;
  //   this.opsData = data.ops || [];
  // }

  actualizarGraficoBarras(registrosPorDia: any[]) {
    this.barChartData = {
      labels: [],
      datasets: [
        { 
          label: 'Ítems empacados', 
          data: [],
          backgroundColor: '#007bff' 
        }
      ]
    };

    // Guardo los costos por día en un array paralelo
    this.costosPorDia = [];

    registrosPorDia.forEach(dia => {
      this.barChartData.labels?.push(dia.fecha);
      this.barChartData.datasets[0].data.push(dia.total_items);
      this.costosPorDia.push(dia.total_costo);
    });

    // Configuración de tooltips
    this.barChartOptions = {
      responsive: true,
      plugins: {
        tooltip: {
          callbacks: {
            label: (context: any) => {
              const index = context.dataIndex;
              const items = context.parsed.y;
              const costo = this.costosPorDia[index];
              return `Ítems: ${items} | Costo: $${costo.toLocaleString()}`;
            }
          }
        }
      }
    };
  }

  actualizarGraficoPie() {
    // Limpiar datos anteriores
    this.pieChartData = {
      labels: [],
      datasets: [{
        data: [],
        backgroundColor: this.generarColores(this.empacadoresData.length)
      }]
    };
    
    // Llenar con nuevos datos
    this.empacadoresData.forEach(emp => {
      const nombre = this.getNombreEmpacador(emp.empacador_id);
      this.pieChartData.labels?.push(nombre);
      this.pieChartData.datasets[0].data.push(emp.total_items);
    });
  }

  generarColores(cantidad: number): string[] {
    const colores = [];
    const hueStep = 360 / cantidad;
    
    for (let i = 0; i < cantidad; i++) {
      const hue = i * hueStep;
      colores.push(`hsl(${hue}, 70%, 50%)`);
    }
    
    return colores;
  }

  getNombreEmpacador(id: number): string {
    const empacador = this.empacadoresList.find(e => e.id === id);
    return empacador ? empacador.nombre_completo : `Empacador ${id}`;
  }

  // Métodos para el dashboard de OPs
  // verDetalleOP(opId: number) {
  //   // Implementar lógica para mostrar detalle de OP
  //   console.log('Ver detalle de OP:', opId);
  //   // Aquí podrías abrir un modal o navegar a otra página
  // }

  // 2. Método unificado para ver detalle
  verDetalle(item: any, type: 'OP' | 'PV'): void {
    this.selectedItem = item;
    this.selectedItemType = type;
    
    const modalElement = document.getElementById('detailModal');
    if (modalElement) {
      const modal = new bootstrap.Modal(modalElement);
      modal.show();
    }
  }

  // 3. Métodos específicos para OPs y PVs que llaman al unificado
  verDetalleOP(op: any, type: 'OP' = 'OP'): void {
    this.verDetalle(op, type);
  }

  // verDetallePV(pv: any, type: 'PV' = 'PV', op: any): void {
  //   this.selectedOP = op;
  //   this.verDetalle(pv, type);
  // }

  // Función para generar QR unificado mejorado
  async generarQRUnificado(item: any, type: 'OP' | 'PV') {
    this.selectedItem = item;
    this.selectedItemType = type;
    let qrText = '';

    // Función auxiliar para agrupar items por referencia, talla y color
    const agruparItems = (items: any[]) => {
      const grupos: Record<string, { cantidad_teorica: number; cantidad_empacada: number }> = {};
      items.forEach((item) => {
        const key = `${item.referencia}|${item.id_talla}|${item.id_color}`;
        if (!grupos[key]) {
          grupos[key] = { cantidad_teorica: 0, cantidad_empacada: 0 };
        }
        grupos[key].cantidad_teorica += item.cantidad_teorica;
        grupos[key].cantidad_empacada += item.cantidad_empacada || 0;
      });
      return grupos;
    };

    // Función auxiliar para obtener el nombre del empacador
    const obtenerEmpacador = async (empacadorId: string) => {
      if (!empacadorId) return "No asignado";
      try {
        const user = await firstValueFrom(this.userService.getById(empacadorId));
        return `${user.firstName?.trim() || ""} ${user.lastName?.trim() || ""}`.trim() || "No asignado";
      } catch {
        return "No asignado";
      }
    };

    // Generar texto para OP
    if (type === 'OP') {
      const cantidadTotal = item.pvs?.reduce((total: number, pv: any) => {
        return total + (pv.items?.reduce((sum: number, i: any) => sum + parseFloat(i.cantidad_teorica || "0"), 0) || 0);
      }, 0) || 0;

      qrText = `OP-${item.codigo}\n`;
      qrText += `Estado:${item.estado}|Total:${cantidadTotal}\n`;
      qrText += `Fecha:${item.fecha_creacion}\n`;

      if (item.pvs && item.pvs.length > 0) {
        qrText += `PV(${item.pvs.length}):\n`;
        for (const pv of item.pvs) {
          const empacador = await obtenerEmpacador(pv.empacador);
          const ocId = pv.items?.[0]?.oc_id || "No definida";
          qrText += `-${pv.codigo}|OC:${ocId}|Emp:${empacador}\n`;

          if (pv.items && pv.items.length > 0) {
            const itemsAgrupados = agruparItems(pv.items);
            qrText += ` Items(${Object.keys(itemsAgrupados).length}):\n`;
            for (const [key, value] of Object.entries(itemsAgrupados)) {
              const [referencia, id_talla, id_color] = key.split('|');
              qrText += `  ${referencia}|${id_talla}|${id_color}:T${value.cantidad_teorica}|E${value.cantidad_empacada}\n`;
            }
          }

          if (pv.pts && pv.pts.length > 0) {
            qrText += ` PT(${pv.pts.length}):\n`;
            for (const pt of pv.pts) {
              qrText += `  ${pt.pt_codigo}\n`;
              if (pt.items && pt.items.length > 0) {
                const ptItemsAgrupados = agruparItems(pt.items);
                for (const [key, value] of Object.entries(ptItemsAgrupados)) {
                  const [referencia, id_talla, id_color] = key.split('|');
                  qrText += `   ${referencia}|${id_talla}|${id_color}:T${value.cantidad_teorica}|R${value.cantidad_empacada}\n`;
                }
              }
            }
          }
        }
      }
    }
    // Generar texto para PV
    else if (type === 'PV') {
      const empacador = await obtenerEmpacador(item.empacador);
      const ocId = item.items?.[0]?.oc_id || "No definida";
      qrText = `PV-${item.codigo}\n`;
      qrText += `OP:${this.selectedOP || "No definida"}|OC:${ocId}\n`;
      qrText += `Emp:${empacador}\n`;

      if (item.items && item.items.length > 0) {
        const itemsAgrupados = agruparItems(item.items);
        qrText += `Items(${Object.keys(itemsAgrupados).length}):\n`;
        for (const [key, value] of Object.entries(itemsAgrupados)) {
          const [referencia, id_talla, id_color] = key.split('|');
          qrText += ` ${referencia}|${id_talla}|${id_color}:T${value.cantidad_teorica}|E${value.cantidad_empacada}\n`;
        }
      }

      if (item.pts && item.pts.length > 0) {
        qrText += `PT(${item.pts.length}):\n`;
        for (const pt of item.pts) {
          qrText += ` ${pt.pt_codigo}\n`;
          if (pt.items && pt.items.length > 0) {
            const ptItemsAgrupados = agruparItems(pt.items);
            for (const [key, value] of Object.entries(ptItemsAgrupados)) {
              const [referencia, id_talla, id_color] = key.split('|');
              qrText += `  ${referencia}|${id_talla}|${id_color}:T${value.cantidad_teorica}|R${value.cantidad_empacada}\n`;
            }
          }
        }
      }
    }

    // Generar JSON minificado para uso técnico
    let qrInfo = {};
    if (type === 'OP') {
      // Calcular cantidadTotal antes de usarlo
      const cantidadTotal = item.pvs?.reduce((total: number, pv: any) => {
        return total + (pv.items?.reduce((sum: number, i: any) => sum + i.cantidad_teorica, 0) || 0);
      }, 0) || 0;

      qrInfo = {
        tipo: "Orden de Producción",
        codigo: item.codigo,
        estado: item.estado,
        cantidadTotal: cantidadTotal,
        fecha: item.fecha_creacion,
      };
    } else if (type === 'PV') {
      const empacadorInfo = await obtenerEmpacador(item.empacador);
      qrInfo = {
        tipo: "Pedido de Venta",
        codigo: item.codigo,
        empacador: empacadorInfo,
        op: this.selectedOP || "No definida",
        oc: item.items?.[0]?.oc_id || "No definida",
      };
    }

    // Asignar el texto legible al QR
    this.qrData = qrText.trim();
    console.log('Texto QR generado:', this.qrData); // Verificar el texto generado
    this.mostrarQRModal({ textoLegible: qrText, datosEstructurados: qrInfo });
  }

  mostrarQRModal(qrInfo: { textoLegible: string; datosEstructurados: any }) {
    // Actualizar información en el modal
    document.getElementById('qrTitle').textContent =
      this.selectedItemType === 'OP' ? `OP-${this.selectedItem.codigo}` : `PV-${this.selectedItem.codigo}`;
    document.getElementById('qrSubtitle').textContent =
      this.selectedItemType === 'OP' ? 'Orden de Producción' : 'Pedido de Venta';
    document.getElementById('qrType').textContent = this.selectedItemType;
    document.getElementById('qrCode').textContent = this.selectedItem.codigo;

    // Mostrar el texto legible en el modal
    document.getElementById('qrDataDisplay').textContent = this.qrData;

    // Generar el código QR con nivel de corrección de errores ajustado
    const qrcodeDiv = document.getElementById('qrcode');
    qrcodeDiv.innerHTML = '';
    QRCode.toCanvas(this.qrData, { width: 200, errorCorrectionLevel: 'H' }, (error, canvas) => {
      if (error) {
        console.error('Error generando QR:', error);
        return;
      }
      qrcodeDiv.appendChild(canvas);
    });

    // Mostrar el modal
    const qrModal = new bootstrap.Modal(document.getElementById('qrModal'));
    qrModal.show();
  }

  // 5. Métodos específicos que llaman al unificado
  generarQR(op: any, type: 'OP' = 'OP'): void {
    this.generarQRUnificado(op, type);
  }

  generarQRPV(pv: any, type: 'PV' = 'PV', op: any): void {
    this.selectedOP = op;
    this.generarQRUnificado(pv, type);
  }

  // 6. Método actualizado para mostrar QR modal
  // mostrarQRModal(): void {
  //   const qrContainer = document.getElementById('qrcode');
  //   if (qrContainer) {
  //     qrContainer.innerHTML = '';
  //   }
    
  //   const data = String(this.qrData);

  //   QRCode.toCanvas(
  //     data,
  //     { width: 250, errorCorrectionLevel: 'Q' },
  //     (error, canvas) => {
  //       if (error) {
  //         console.error('Error generando QR:', error);
  //         return;
  //       }

  //       if (qrContainer) {
  //         qrContainer.innerHTML = '';
  //         qrContainer.appendChild(canvas);
  //       }

  //       const modalElement = document.getElementById('qrModal');
  //       if (modalElement) {
  //         const modal = new bootstrap.Modal(modalElement);
  //         modal.show();
  //       }
  //     }
  //   );
  // }

  // 7. Método actualizado para descargar QR
  // descargarQR(): void {
  //   const canvas = document.querySelector('#qrcode canvas') as HTMLCanvasElement;
  //   if (canvas && this.selectedItem) {
  //     const link = document.createElement('a');
  //     const fileName = this.selectedItemType === 'OP' 
  //       ? `QR_OP_${this.selectedItem.codigo}.png`
  //       : `QR_PV_${this.selectedItem.codigo}.png`;
      
  //     link.download = fileName;
  //     link.href = canvas.toDataURL();
  //     link.click();
  //   }
  // }

  // 8. Método unificado para imprimir etiqueta
  imprimirEtiquetaUnificada(item: any, type: 'OP' | 'PV'): void {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      let content = '';
      
      if (type === 'OP') {
        content = `
          <html>
            <head>
              <title>Etiqueta OP - ${item.codigo}</title>
              <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .etiqueta { border: 2px solid #000; padding: 15px; width: 250px; }
                .codigo { font-size: 20px; font-weight: bold; text-align: center; margin-bottom: 10px; }
                .tipo { background: #007bff; color: white; padding: 3px 8px; font-size: 12px; border-radius: 3px; }
                .info { margin: 8px 0; font-size: 14px; }
                .detalle { font-size: 12px; color: #666; }
              </style>
            </head>
            <body>
              <div class="etiqueta">
                <div style="text-align: center; margin-bottom: 10px;">
                  <span class="tipo">ORDEN DE PRODUCCIÓN</span>
                </div>
                <div class="codigo">${item.codigo}</div>
                <div class="info"><strong>Estado:</strong> ${item.estado}</div>
                <div class="info"><strong>Cantidad:</strong> ${item.cantidad_total}</div>
                <div class="info"><strong>Progreso:</strong> ${item.progreso || 0}%</div>
                <div class="info"><strong>Fecha:</strong> ${new Date(item.fecha_creacion).toLocaleDateString()}</div>
                <div class="detalle">${item.descripcion || 'Sin descripción'}</div>
                <div class="detalle"><strong>PVs:</strong> ${item.pvs?.length || 0} | <strong>PTs:</strong> ${this.getTotalPTs(item)}</div>
              </div>
            </body>
          </html>
        `;
      } else if (type === 'PV') {
        content = `
          <html>
            <head>
              <title>Etiqueta PV - ${item.codigo}</title>
              <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .etiqueta { border: 2px solid #000; padding: 15px; width: 250px; }
                .codigo { font-size: 20px; font-weight: bold; text-align: center; margin-bottom: 10px; }
                .tipo { background: #28a745; color: white; padding: 3px 8px; font-size: 12px; border-radius: 3px; }
                .info { margin: 8px 0; font-size: 14px; }
                .detalle { font-size: 12px; color: #666; }
              </style>
            </head>
            <body>
              <div class="etiqueta">
                <div style="text-align: center; margin-bottom: 10px;">
                  <span class="tipo">PAQUETE DE VENTA</span>
                </div>
                <div class="codigo">${item.codigo}</div>
                <div class="info"><strong>Items:</strong> ${item.items?.length || 0}</div>
                <div class="info"><strong>PTs:</strong> ${item.pts?.length || 0}</div>
                <div class="detalle">Código: ${item.codigo}</div>
                ${item.op_id ? `<div class="detalle"><strong>OP:</strong> ${item.op_id}</div>` : ''}
              </div>
            </body>
          </html>
        `;
      }
      
      printWindow.document.write(content);
      printWindow.document.close();
      printWindow.print();
    }
  }

  // 9. Métodos específicos que llaman al unificado
  imprimirEtiqueta(op: any, type: 'OP' = 'OP'): void {
    this.imprimirEtiquetaUnificada(op, type);
  }

  imprimirEtiquetaPV(pv: any, type: 'PV' = 'PV'): void {
    this.imprimirEtiquetaUnificada(pv, type);
  }

  // 10. Helper method para obtener información del item seleccionado
  getSelectedItemInfo(): any {
    if (!this.selectedItem) return {};
    
    if (this.selectedItemType === 'OP') {
      return {
        title: `OP-${this.selectedItem.codigo}`,
        subtitle: 'Orden de Producción',
        details: [
          { label: 'Estado', value: this.selectedItem.estado },
          { label: 'Cantidad Total', value: this.selectedItem.cantidad_total },
          { label: 'Progreso', value: `${this.selectedItem.progreso || 0}%` },
          { label: 'Fecha Creación', value: new Date(this.selectedItem.fecha_creacion).toLocaleDateString() },
          { label: 'Total PVs', value: this.selectedItem.pvs?.length || 0 },
          { label: 'Total PTs', value: this.getTotalPTs(this.selectedItem) }
        ]
      };
    } else {
      return {
        title: `PV-${this.selectedItem.codigo}`,
        subtitle: 'Pedido de Venta',
        details: [
          { label: 'Código PV', value: this.selectedItem.codigo },
          { label: 'Total Items', value: this.selectedItem.items?.length || 0 },
          { label: 'Total PTs', value: this.selectedItem.pts?.length || 0 }
        ]
      };
    }
  }

  // generarQR(op: OP) {
  //   this.selectedOP = op;
    
  //   // Crear datos para el QR con toda la información de la OP
  //   const qrInfo = {
  //     op_id: op.id,
  //     codigo: op.codigo,
  //     estado: op.estado,
  //     descripcion: op.descripcion,
  //     cantidad_total: op.cantidad_total,
  //     fecha_creacion: op.fecha_creacion,
  //     pvs: op.pvs || [],
  //     pts: op.pts || [],
  //     url: `${window.location.origin}/op/${op.id}` // URL para acceder a la OP
  //   };
    
  //   this.qrData = JSON.stringify(qrInfo);
    
  //   // Generar QR usando una librería como qrcode
  //   this.mostrarQRModal();
  // }

  // mostrarQRModal() {
  //   // Limpiar QR anterior
  //   const qrContainer = document.getElementById('qrcode');
  //   if (qrContainer) {
  //     qrContainer.innerHTML = '';
  //   }
    
  //   console.log('Datos para QR:', this.qrData);
  //   // Generar nuevo QR
  //   this.qrData = JSON.stringify(this.qrData);

  //   // IMPORTANTE: asegura que sea string y no objeto
  //   const data = String(this.qrData);

  //   QRCode.toCanvas(
  //     data,
  //     { width: 250, errorCorrectionLevel: 'Q' }, // Q o H dan más robustez
  //     (error, canvas) => {
  //       if (error) {
  //         console.error('Error generando QR:', error);
  //         return;
  //       }

  //       if (qrContainer) {
  //         qrContainer.innerHTML = '';
  //         qrContainer.appendChild(canvas);
  //       }

  //       const modalElement = document.getElementById('qrModal');
  //       if (modalElement) {
  //         const modal = new bootstrap.Modal(modalElement);
  //         modal.show();
  //       }
  //     }
  //   );
  //   console.log("QR final:", typeof data, data);
  // }

  // descargarQR() {
  //   // Implementar descarga del QR como imagen
  //   const canvas = document.querySelector('#qrcode canvas') as HTMLCanvasElement;
  //   if (canvas) {
  //     const link = document.createElement('a');
  //     link.download = `QR_OP_${this.selectedOP?.codigo}.png`;
  //     link.href = canvas.toDataURL();
  //     link.click();
  //   }
  // }

  // imprimirEtiqueta(op: OP) {
  //   // Implementar impresión de etiqueta
  //   console.log('Imprimir etiqueta para OP:', op.codigo);
    
  //   // Podrías crear una ventana de impresión con el formato de etiqueta
  //   const printWindow = window.open('', '_blank');
  //   if (printWindow) {
  //     printWindow.document.write(`
  //       <html>
  //         <head>
  //           <title>Etiqueta OP - ${op.codigo}</title>
  //           <style>
  //             body { font-family: Arial, sans-serif; margin: 20px; }
  //             .etiqueta { border: 2px solid #000; padding: 10px; width: 200px; }
  //             .codigo { font-size: 18px; font-weight: bold; text-align: center; }
  //             .info { margin: 5px 0; font-size: 12px; }
  //           </style>
  //         </head>
  //         <body>
  //           <div class="etiqueta">
  //             <div class="codigo">${op.codigo}</div>
  //             <div class="info"><strong>Estado:</strong> ${op.estado}</div>
  //             <div class="info"><strong>Cantidad:</strong> ${op.cantidad_total}</div>
  //             <div class="info"><strong>Fecha:</strong> ${new Date(op.fecha_creacion).toLocaleDateString()}</div>
  //             <div class="info">${op.descripcion}</div>
  //           </div>
  //         </body>
  //       </html>
  //     `);
  //     printWindow.document.close();
  //     printWindow.print();
  //   }
  // }

  exportarQRs() {
    // Obtener IDs de todas las OPs filtradas
    const opIds = this.opsData.map(op => op.id);
    
    if (opIds.length === 0) {
      console.warn('No hay OPs para exportar');
      return;
    }

    console.log('Exportando QRs de OPs:', opIds);
    
    // Usar tu servicio para exportar múltiples QRs
    this.empaqueService.exportarQRsOPs(opIds).subscribe({
      next: (blob) => {
        // Crear enlace de descarga para el archivo ZIP
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `QRs_OPs_${new Date().toISOString().split('T')[0]}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      },
      error: (error) => {
        console.error('Error exportando QRs:', error);
        // Fallback: generar QRs individuales
        this.exportarQRsIndividuales();
      }
    });
  }

  private exportarQRsIndividuales() {
    // Método alternativo para generar QRs uno por uno si falla la exportación masiva
    console.log('Generando QRs individuales como fallback');
    
    this.opsData.forEach((op, index) => {
      setTimeout(() => {
        this.generarQRParaDescarga(op);
      }, index * 500); // Delay para evitar saturar el navegador
    });
  }

  private generarQRParaDescarga(op: OP) {
    const qrInfo = {
      op_id: op.id,
      codigo: op.codigo,
      estado: op.estado,
      descripcion: op.descripcion,
      cantidad_total: op.cantidad_total,
      fecha_creacion: op.fecha_creacion,
      url: `${window.location.origin}/op/${op.id}`
    };

    const qrData = JSON.stringify(qrInfo);

    console.log('Información QR para OP:', op.codigo, qrData);
    QRCode.toCanvas(qrData, { width: 200 }, (error, canvas) => {
      if (!error && canvas) {
        const link = document.createElement('a');
        link.download = `QR_${op.codigo}.png`;
        link.href = canvas.toDataURL();
        link.click();
      }
    });
  }

  // Calcula el costo total de PTs para una PV específica
  getPVTotalPTsCost(pv: any): number {
    if (!pv.pts || pv.pts.length === 0) return 0;
    return pv.pts.reduce((total: number, pt: any) => {
      return total + (parseFloat(pt.costo_total) || 0);
    }, 0);
  }

  // Calcula el costo real de PTs para una PV específica
  getPVRealPTsCost(pv: any): number {
    if (!pv.pts || pv.pts.length === 0) return 0;
    return pv.pts.reduce((total: number, pt: any) => {
      return total + (parseFloat(pt.costo_real) || 0);
    }, 0);
  }

  // Calcula el costo total de todas las PTs de una OP
  getOPTotalPTsCost(op: any): number {
    if (!op.pvs || op.pvs.length === 0) return 0;
    return op.pvs.reduce((total: number, pv: any) => {
      return total + this.getPVTotalPTsCost(pv);
    }, 0);
  }

  // Calcula el costo real de todas las PTs de una OP
  getOPRealPTsCost(op: any): number {
    if (!op.pvs || op.pvs.length === 0) return 0;
    return op.pvs.reduce((total: number, pv: any) => {
      return total + this.getPVRealPTsCost(pv);
    }, 0);
  }

  getCostoTotal(pv: any): number {
    return parseFloat(pv.costo_real) + this.getPVRealPTsCost(pv);
  }

    // Nuevas propiedades para el toggle
  modoDetallePV: 'recepcionado' | 'empacado' = 'recepcionado';
  empaquesPVDetalle: any[] = [];
  expandedEmpaquesDetalle = new Set<string>();
  editandoCodigo: { [key: string]: boolean } = {};
  codigosEditados: { [key: string]: string } = {};
  
  // QR properties for empaque mode
  qrImageUrl: string | null = null;
  qrTitle = '';
  qrSubtitle = '';
  qrType = '';
  qrCode = '';
  qrCliente = '';
  qrEmpacador = '';
  qrData: any = {};

  // Método existente modificado para cargar empaques cuando sea PV
  verDetallePV(pv: any, type: 'PV' = 'PV', op: any): void {
    this.selectedOP = op;
    this.modoDetallePV = 'recepcionado'; // Reset al modo por defecto
    this.verDetalle(pv, type);
    // Cargar empaques para el modo empacado
    this.cargarEmpaquesPVDetalle(pv);
  }

  // Método para cambiar modo del toggle
  cambiarModoDetallePV(modo: 'recepcionado' | 'empacado'): void {
    this.modoDetallePV = modo;
    if (modo === 'empacado' && this.empaquesPVDetalle.length === 0) {
      this.cargarEmpaquesPVDetalle(this.selectedItem);
    }
  }

  // Cargar empaques para la PV seleccionada
  cargarEmpaquesPVDetalle(pv: any): void {
    if (!pv || !pv.codigo) return;

    this.empaqueService.EmpaquesPorPV(pv.codigo).subscribe({
      next: (res: any) => {
        if (res.success && res.data && res.data.length > 0) {
          this.empaquesPVDetalle = res.data.map(empaque => ({
            ...empaque,
            codigoOriginal: empaque.numero_empaque
          }));
        } else {
          this.empaquesPVDetalle = [];
        }
      },
      error: (error) => {
        console.error('Error al cargar empaques:', error);
        this.empaquesPVDetalle = [];
      }
    });
  }

  // Toggle expand/collapse empaque
  toggleEmpaqueDetalle(numeroEmpaque: string): void {
    if (this.expandedEmpaquesDetalle.has(numeroEmpaque)) {
      this.expandedEmpaquesDetalle.delete(numeroEmpaque);
    } else {
      this.expandedEmpaquesDetalle.add(numeroEmpaque);
    }
  }

  // Iniciar edición de código
  iniciarEdicionCodigo(numeroEmpaque: string): void {
    this.editandoCodigo[numeroEmpaque] = true;
    this.codigosEditados[numeroEmpaque] = numeroEmpaque;
  }

  // Cancelar edición
  cancelarEdicionCodigo(numeroEmpaque: string): void {
    this.editandoCodigo[numeroEmpaque] = false;
    delete this.codigosEditados[numeroEmpaque];
  }

  // Guardar código editado
  guardarCodigoEmpaque(empaque: any, nuevoCodigo: string): void {
    if (!nuevoCodigo.trim()) {
      Swal.fire('Error', 'El código no puede estar vacío', 'error');
      return;
    }

    // Aquí iría la llamada al servicio para actualizar el código en el backend
    // Por ahora solo actualizamos localmente
    const index = this.empaquesPVDetalle.findIndex(e => e.numero_empaque === empaque.numero_empaque);
    if (index !== -1) {
      this.empaquesPVDetalle[index].numero_empaque = nuevoCodigo.trim();
      this.editandoCodigo[empaque.numero_empaque] = false;
      delete this.codigosEditados[empaque.numero_empaque];
      
      Swal.fire({
        title: 'Código actualizado',
        text: `El código se cambió a: ${nuevoCodigo}`,
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });
    }
  }

  // Generar QR para empaque específico
  async generarQREmpaque(empaque: any): Promise<void> {
    try {
      // Consolidar items (sumar cantidades por item_id + id_talla)
      const itemsMap = new Map<string, any>();

      for (const item of empaque.items) {
        const key = `${item.item_id}_${item.id_talla}`;
        if (!itemsMap.has(key)) {
          itemsMap.set(key, {
            descripcion: item.descripcion,
            talla: item.id_talla,
            cantidad: parseFloat(item.cantidad)
          });
        } else {
          itemsMap.get(key).cantidad += parseFloat(item.cantidad);
        }
      }

      const itemsConsolidados = Array.from(itemsMap.values());

      // Obtener nombre del empacador
      let empacadorNombre = 'N/A';
      if (empaque.empacador_id && this.userService) {
        await new Promise<void>((resolve) => {
          this.userService.getById(empaque.empacador_id).subscribe({
            next: (user) => {
              empacadorNombre = (user.firstName && user.lastName)
                ? `${user.firstName} ${user.lastName}`
                : 'N/A';
              resolve();
            },
            error: () => {
              empacadorNombre = 'N/A';
              resolve();
            }
          });
        });
      }

      // Formatear el texto para QR
      let qrText = `OP: ${empaque.op || this.selectedOP?.codigo || 'N/A'}\n`;
      qrText += `PV: ${empaque.pv || this.selectedItem?.codigo || 'N/A'}\n`;
      qrText += `OC: ${empaque.oc || 'N/A'}\n`;
      qrText += `Cliente: ${empaque.cliente || 'N/A'}\n`;
      qrText += `Empacador: ${empacadorNombre}\n`;
      qrText += `Tipo Empaque: ${empaque.tipo_empaque}\n`;
      qrText += `Número Empaque: ${empaque.numero_empaque}\n\n`;
      qrText += `Items:\n`;

      itemsConsolidados.forEach(it => {
        qrText += `- ${it.descripcion} (Talla: ${it.talla}) -> ${it.cantidad}\n`;
      });

      // Generar QR
      const QRCode = (window as any).QRCode || await import('qrcode');
      this.qrImageUrl = await QRCode.toDataURL(qrText, {
        errorCorrectionLevel: 'M',
        margin: 2,
        scale: 8,
        width: 350,
        type: 'image/png',
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      // Configurar datos para el modal QR
      this.qrTitle = empaque.numero_empaque;
      this.qrSubtitle = empaque.tipo_empaque;
      this.qrType = empaque.tipo_empaque;
      this.qrCode = empaque.numero_empaque;
      this.qrCliente = empaque.cliente || 'N/A';
      this.qrEmpacador = empacadorNombre;
      this.qrData = JSON.stringify(itemsConsolidados);

      // Abrir modal QR (asumiendo que tienes el template del QR)
      const modalElement = document.getElementById('qrModal');
      if (modalElement) {
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
      }

    } catch (error) {
      console.error('Error generando QR:', error);
      Swal.fire('Error', 'No se pudo generar el código QR', 'error');
    }
  }

  // Métodos para el QR modal
  descargarQR(): void {
    if (!this.qrImageUrl) return;
    const a = document.createElement('a');
    a.href = this.qrImageUrl;
    a.download = `QR_${this.qrCode}.png`;
    a.click();
  }

  imprimirQR(): void {
    if (!this.qrImageUrl) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <html>
        <head>
          <title>Imprimir QR</title>
        </head>
        <body style="text-align:center; font-family: Arial;">
          <h3>Etiqueta ${this.qrCode}</h3>
          <img src="${this.qrImageUrl}" />
          <script>window.print(); window.close();</script>
        </body>
      </html>
    `);
    w.document.close();
  }
}