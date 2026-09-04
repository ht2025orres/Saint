import { Component, Output, EventEmitter } from '@angular/core';
import { SeguimientoProyectosService } from 'src/app/services/seguimiento-proyectos.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-modal-sincronizar-siesa',
  templateUrl: './modal-sincronizar-siesa.component.html'
})
export class ModalSincronizarSiesaComponent {
  @Output() cerrar = new EventEmitter<boolean>();

  sincronizando = false;
  resultado: { total_sincronizados: number; proyectos: string[] } | null = null;

  constructor(private spService: SeguimientoProyectosService) {}

  iniciarSincronizacion(): void {
    this.sincronizando = true;
    this.resultado = null;

    this.spService.sincronizarSiesa().subscribe({
      next: (resp) => {
        this.sincronizando = false;
        if (resp.success) {
          this.resultado = {
            total_sincronizados: resp.total_sincronizados,
            proyectos: resp.proyectos
          };
          Swal.fire({
            title: 'Sincronización Exitosa',
            text: `Se procesaron ${resp.total_sincronizados} proyectos desde las notas de Siesa.`,
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
          });
        }
      },
      error: () => {
        this.sincronizando = false;
        Swal.fire('Error', 'Falló la conexión o la sincronización con Siesa DB', 'error');
      }
    });
  }

  onCerrar(): void {
    this.cerrar.emit(this.resultado !== null);
  }
}
