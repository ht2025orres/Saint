import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { MoldService } from '../../../../services/mold.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-modal-category-manager',
  templateUrl: './modal-category-manager.component.html',
  styleUrls: ['./modal-category-manager.component.css']
})
export class ModalCategoryManagerComponent implements OnInit {
  @Output() onClose = new EventEmitter<void>();
  @Output() onCategoriesChanged = new EventEmitter<void>();

  categories: any[] = [];
  loading = false;

  // Form state
  editingCategory: any = null;
  catName = '';
  catDescription = '';
  catKeywords: string[] = [];
  newKeyword = '';

  // Image upload
  uploadingImage = false;

  constructor(private moldService: MoldService) {}

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.loading = true;
    this.moldService.getCategories().subscribe({
      next: (res: any) => {
        this.categories = res.data || [];
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  // ==================== KEYWORDS (Tags) ====================

  addKeyword(): void {
    const kw = this.newKeyword.trim().toLowerCase();
    if (kw && !this.catKeywords.includes(kw)) {
      this.catKeywords.push(kw);
    }
    this.newKeyword = '';
  }

  onKeywordKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.addKeyword();
    }
  }

  removeKeyword(index: number): void {
    this.catKeywords.splice(index, 1);
  }

  // ==================== CRUD ====================

  editCategory(cat: any): void {
    this.editingCategory = cat;
    this.catName = cat.name;
    this.catDescription = cat.description || '';
    this.catKeywords = Array.isArray(cat.keywords) ? [...cat.keywords] : [];
  }

  resetForm(): void {
    this.editingCategory = null;
    this.catName = '';
    this.catDescription = '';
    this.catKeywords = [];
    this.newKeyword = '';
  }

  saveCategory(): void {
    if (!this.catName.trim()) return;
    const data = {
      name: this.catName.trim(),
      description: this.catDescription.trim() || undefined,
      keywords: this.catKeywords.length > 0 ? this.catKeywords : undefined,
    };

    const action = this.editingCategory
      ? this.moldService.updateCategory(this.editingCategory.id, data)
      : this.moldService.createCategory(data);

    action.subscribe({
      next: () => {
        this.loadCategories();
        this.resetForm();
        this.onCategoriesChanged.emit();
        Swal.fire({
          title: this.editingCategory ? 'Categoría actualizada' : 'Categoría creada',
          icon: 'success', toast: true, position: 'top-end',
          timer: 1500, showConfirmButton: false,
        });
      },
      error: (err: any) => {
        Swal.fire('Error', err.error?.error || 'Error al guardar categoría', 'error');
      }
    });
  }

  deleteCategory(cat: any): void {
    Swal.fire({
      title: '¿Eliminar categoría?',
      text: `Se eliminará "${cat.name}". Esta acción no se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
    }).then((result) => {
      if (result.isConfirmed) {
        this.moldService.deleteCategory(cat.id).subscribe({
          next: () => {
            this.loadCategories();
            this.onCategoriesChanged.emit();
            Swal.fire({ title: 'Eliminada', icon: 'success', toast: true, position: 'top-end', timer: 1500, showConfirmButton: false });
          },
          error: (err: any) => {
            Swal.fire('Error', err.error?.error || 'No se pudo eliminar', 'error');
          }
        });
      }
    });
  }

  // ==================== IMAGE UPLOAD ====================

  onImageUpload(event: Event, cat: any): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    if (file.size > 5 * 1024 * 1024) {
      Swal.fire('Error', 'La imagen no puede superar 5MB', 'error');
      return;
    }

    this.uploadingImage = true;
    this.moldService.uploadCategoryImage(cat.id, file).subscribe({
      next: (res: any) => {
        this.uploadingImage = false;
        cat.image_signed_url = res.data?.image_signed_url;
        this.onCategoriesChanged.emit();
        Swal.fire({ title: 'Imagen actualizada', icon: 'success', toast: true, position: 'top-end', timer: 1500, showConfirmButton: false });
      },
      error: () => {
        this.uploadingImage = false;
        Swal.fire('Error', 'Error al subir la imagen', 'error');
      }
    });
  }

  close(): void {
    this.onClose.emit();
  }
}
