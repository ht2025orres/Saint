import { Component, Input, Output, EventEmitter } from '@angular/core';
import { SharedOperation } from '../../partes-catalog.component';

@Component({
  selector: 'app-catalog-tab-operaciones',
  templateUrl: './catalog-tab-operaciones.component.html',
  styleUrls: ['./catalog-tab-operaciones.component.css']
})
export class CatalogTabOperacionesComponent {
  @Input() machines: any[] = [];
  @Input() sharedOperationsLibrary: SharedOperation[] = [];
  @Input() categoriesList: string[] = [];
  @Input() machineSearchTerm = '';
  @Input() opSearchTerm = '';
  @Input() opSelectedMachine = 'Todas';
  @Input() opSelectedCategory = 'Todas';
  @Input() opPageSize = 25;
  @Input() opCurrentPage = 1;

  @Output() createMachine = new EventEmitter<void>();
  @Output() editMachine = new EventEmitter<any>();
  @Output() deleteMachine = new EventEmitter<any>();
  @Output() createOp = new EventEmitter<void>();
  @Output() editOp = new EventEmitter<{ op: SharedOperation; index: number }>();
  @Output() deleteOp = new EventEmitter<number>();
  @Output() machineSearchTermChange = new EventEmitter<string>();
  @Output() opSearchTermChange = new EventEmitter<string>();
  @Output() opSelectedMachineChange = new EventEmitter<string>();
  @Output() opSelectedCategoryChange = new EventEmitter<string>();
  @Output() opPageSizeChange = new EventEmitter<number>();
  @Output() opCurrentPageChange = new EventEmitter<number>();

  get filteredMachines(): any[] {
    if (!this.machineSearchTerm) return this.machines;
    const term = this.machineSearchTerm.toLowerCase();
    return this.machines.filter(m =>
      m.name.toLowerCase().includes(term) ||
      (m.code && m.code.toLowerCase().includes(term))
    );
  }

  get filteredSharedOperations(): SharedOperation[] {
    return this.sharedOperationsLibrary.filter(op => {
      const matchMachine = this.opSelectedMachine === 'Todas' || op.machine_name === this.opSelectedMachine;
      const matchCat = this.opSelectedCategory === 'Todas' || op.category === this.opSelectedCategory;
      const matchSearch = !this.opSearchTerm ||
        op.operation_name.toLowerCase().includes(this.opSearchTerm.toLowerCase()) ||
        (op.category && op.category.toLowerCase().includes(this.opSearchTerm.toLowerCase()));
      return matchMachine && matchCat && matchSearch;
    });
  }

  get paginatedSharedOperations(): SharedOperation[] {
    const list = this.filteredSharedOperations;
    if (this.opPageSize === -1) return list;
    const start = (this.opCurrentPage - 1) * this.opPageSize;
    return list.slice(start, start + this.opPageSize);
  }

  get opTotalPages(): number {
    if (this.opPageSize === -1) return 1;
    return Math.ceil(this.filteredSharedOperations.length / this.opPageSize) || 1;
  }

  setOpPage(page: number): void {
    if (page >= 1 && page <= this.opTotalPages) {
      this.opCurrentPageChange.emit(page);
    }
  }

  onOpFilterChange(): void {
    this.opCurrentPageChange.emit(1);
  }
}
