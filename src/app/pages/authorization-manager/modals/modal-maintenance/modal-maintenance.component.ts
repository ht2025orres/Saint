import { Component, Output, EventEmitter } from '@angular/core';
import { MaintenanceService } from '../../../../services/maintenance.service';
import Swal from 'sweetalert2';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-modal-maintenance',
  templateUrl: './modal-maintenance.component.html'
})
export class ModalMaintenanceComponent {
  @Output() onClose = new EventEmitter<void>();

  visible = false;
  maintenanceReason = 'Mantenimiento preventivo';
  maintenanceDuration = 60;
  maintenanceHistory: any[] = [];
  maintenanceLogsLoading = false;

  constructor(private maintenanceService: MaintenanceService) {}

  abrir() {
    this.visible = true;
    this.maintenanceReason = 'Mantenimiento preventivo';
    this.maintenanceDuration = 60;
    this.loadMaintenanceHistory();
  }

  cerrar() {
    this.visible = false;
    this.onClose.emit();
  }

  loadMaintenanceHistory() {
    this.maintenanceLogsLoading = true;
    this.maintenanceService.getHistory()
      .pipe(finalize(() => this.maintenanceLogsLoading = false))
      .subscribe({
        next: (logs) => this.maintenanceHistory = logs,
        error: (err) => console.error(err)
      });
  }

  startMaintenance() {
    if (!this.maintenanceDuration || this.maintenanceDuration <= 0) return;
    
    Swal.fire({
      title: '¿Activar Mantenimiento?',
      text: 'Todos los usuarios que no sean administradores serán expulsados a la pantalla de inicio de sesión inmediatamente al intentar navegar y no podrán volver a entrar hasta que lo desactives.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, encender'
    }).then(res => {
      if (res.isConfirmed) {
        this.maintenanceService.startMaintenance(this.maintenanceReason, this.maintenanceDuration).subscribe({
          next: () => {
            Swal.fire('Activado', 'El sistema ha entrado en modo mantenimiento', 'success');
            this.loadMaintenanceHistory();
          },
          error: (err) => console.error(err)
        });
      }
    });
  }

  stopMaintenance() {
    Swal.fire({
      title: '¿Desactivar Mantenimiento?',
      text: 'Los operarios podrán volver a iniciar sesión y utilizar el sistema con normalidad.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, apagar'
    }).then(res => {
      if (res.isConfirmed) {
        this.maintenanceService.stopMaintenance().subscribe({
          next: () => {
             Swal.fire('Desactivado', 'El modo de mantenimiento se ha detenido', 'success');
             this.loadMaintenanceHistory();
          },
          error: (err) => console.error(err)
        });
      }
    });
  }
}
