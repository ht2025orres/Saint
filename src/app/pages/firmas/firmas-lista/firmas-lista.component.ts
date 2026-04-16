import { Component, OnInit } from '@angular/core';
import { FirmasService, FirmaDocumento } from 'src/app/services/firmas.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-firmas-lista',
  templateUrl: './firmas-lista.component.html',
})
export class FirmasListaComponent implements OnInit {
  documentos: FirmaDocumento[] = [];
  loading = false;

  constructor(private firmasService: FirmasService) {}

  ngOnInit(): void {
    this.cargarDocumentos();
  }

  cargarDocumentos(): void {
    this.loading = true;
    this.firmasService.getAll().subscribe({
      next: (resp) => {
        this.documentos = resp.data;
        this.loading = false;
      },
      error: () => {
        Swal.fire('Error', 'No se pudieron cargar los documentos', 'error');
        this.loading = false;
      }
    });
  }

  descargar(doc: FirmaDocumento): void {
    this.firmasService.getDownloadUrl(doc.id).subscribe({
      next: (resp) => {
        window.open(resp.url, '_blank');
      },
      error: () => Swal.fire('Error', 'No se pudo generar el enlace de descarga', 'error')
    });
  }

  eliminar(doc: FirmaDocumento): void {
    Swal.fire({
      title: '¿Estás seguro?',
      text: 'Se eliminará el registro y los archivos asociados',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.firmasService.delete(doc.id).subscribe({
          next: () => {
            Swal.fire('Eliminado', 'El documento ha sido eliminado', 'success');
            this.cargarDocumentos();
          },
          error: () => Swal.fire('Error', 'No se pudo eliminar el documento', 'error')
        });
      }
    });
  }
}
