// user-activity-log.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BigbagService } from 'src/app/services/bigbag.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-user-activity-log',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-activity-log.component.html',
  styleUrls: ['./user-activity-log.component.css']
})
export class UserActivityLogComponent implements OnInit {
  actividades: any[] = [];
  isModalOpen = false;
  selectedActividad: any;

  constructor(private activityLogService: BigbagService) { }

  // OPCIÓN 1: Usar casting (más simple)
  ngOnInit(): void {
    this.activityLogService.getActividades().subscribe({
      next: (response: any) => {
        // Si la respuesta tiene la estructura {success: true, data: [...]}
        if (response && response.data && Array.isArray(response.data)) {
          this.actividades = response.data;
        }
        // Si la respuesta es directamente un array
        else if (Array.isArray(response)) {
          this.actividades = response;
        }
        // Si no es ninguna de las anteriores, asignar array vacío
        else {
          this.actividades = [];
          console.warn('Respuesta inesperada del servidor:', response);
        }
      },
      error: (error) => {
        console.error('Error al cargar actividades:', error);
        this.actividades = []; // Asegurar que sea array vacío en caso de error
      }
    });
  }
  // Propiedades para paginación
  currentPage = 1;
  itemsPerPage = 10;

  // Propiedad para búsqueda
  searchText = '';

  // Getter para registros filtrados
  get filteredActividades() {
    // Asegurar que actividades siempre sea un array
    const actividadesArray = Array.isArray(this.actividades) ? this.actividades : [];

    if (!this.searchText) {
      return actividadesArray;
    }

    return actividadesArray.filter(actividad =>
      actividad.first_name?.toLowerCase().includes(this.searchText.toLowerCase()) ||
      actividad.last_name?.toLowerCase().includes(this.searchText.toLowerCase()) ||
      actividad.accion?.toLowerCase().includes(this.searchText.toLowerCase()) ||
      actividad.num_recepcion?.toString().toLowerCase().includes(this.searchText.toLowerCase())
    );
  }

  // Getter para registros paginados
  get paginatedActividades() {
    const filtered = this.filteredActividades;

    // Validación adicional por si acaso
    if (!Array.isArray(filtered)) {
      console.warn('filteredActividades no es un array:', filtered);
      return [];
    }

    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return filtered.slice(startIndex, endIndex);
  }
  // Getter para total de páginas
  get totalPages() {
    return Math.ceil(this.filteredActividades.length / this.itemsPerPage);
  }

  // Método para ir a la página anterior
  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  // Método para ir a la página siguiente
  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  // Método para cuando cambia el texto de búsqueda
  onSearchChange() {
    this.currentPage = 1; // Resetear a la primera página cuando se busca
  }


  versionActual: any = null;

  // Método para abrir el modal
  openModal(actividad: any) {
  this.selectedActividad = actividad;
  this.versionActual = null;
  this.isModalOpen = true;

  if (actividad.num_recepcion) {
    this.activityLogService.getVersionActual(actividad.num_recepcion).subscribe({
      next: (response) => {
        if (response.success && response.data && response.data.length > 0) {
          this.versionActual = response.data[0];
        }
      },
      error: (error) => {
        console.error('Error al obtener versión actual:', error);
      }
    });
  }

  document.body.style.overflow = 'hidden';
}

  // Método para cerrar el modal
  closeModal() {
    this.isModalOpen = false;
    this.selectedActividad = null;
    this.versionActual = null; // Limpiar versión actual
    document.body.style.overflow = 'auto';
  }

  mostrarComentario(comentario: string) {
    Swal.fire({
      text: comentario || 'No hay comentario disponible',
      confirmButtonText: 'Cerrar',
      confirmButtonColor: '#3085d6',
      showClass: {
        popup: 'animate__animated animate__fadeInDown'
      },
      hideClass: {
        popup: 'animate__animated animate__fadeOutUp'
      }
    });
  }

  // Método para ver historial completo (placeholder)

  // Método para manejar tecla Escape
  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && this.isModalOpen) {
      this.closeModal();
    }
  }
}