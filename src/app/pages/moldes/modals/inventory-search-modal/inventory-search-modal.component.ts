import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { MoldService } from '../../../../services/mold.service';

export interface SiesaGroupedItem {
  insumo: string;
  referencia_base: string;
  es_tela: boolean;
  grupo?: string;
  colores: SiesaColorVariant[];
  selectedColor?: SiesaColorVariant;
}

export interface SiesaColorVariant {
  id_item: string;
  referencia: string;
  descripcion: string;
  id_color: string;
  color: string;
  total_existencias: number;
  estado_stock: 'DISPONIBLE' | 'SIN_STOCK';
  grupo?: string;
  es_tela?: boolean;
}

@Component({
  selector: 'app-inventory-search-modal',
  templateUrl: './inventory-search-modal.component.html',
  styleUrls: ['./inventory-search-modal.component.css']
})
export class InventorySearchModalComponent implements OnInit {
  @Input() visible = true;
  @Input() partName = '';
  @Input() filterType: 'todos' | 'tela' | 'insumo' = 'todos';
  @Output() onClose = new EventEmitter<void>();
  @Output() onSelect = new EventEmitter<any>();

  searchQuery = '';
  selectedBodega = 'MP001';
  selectedGroup = '';
  soloConStock = false;
  loading = false;
  isLoaded = false;

  bodegas = [
    { id: 'MP001', name: 'Materia Prima' },
    { id: 'PT001', name: 'Producto Terminado' }
  ];

  gruposDisponibles = [
    { id: '', label: 'TODOS', icon: 'bi-grid-fill' },
    { id: 'TELAS', label: 'TELAS', icon: 'bi-droplet-fill' },
    { id: 'BOTONES', label: 'BOTONES', icon: 'bi-record-circle-fill' },
    { id: 'HILOS Y HILAZAS', label: 'HILOS', icon: 'bi-border-style' },
    { id: 'CIERRES', label: 'CIERRES', icon: 'bi-distribute-vertical' },
    { id: 'SESGOS Y CINTAS', label: 'SESGOS Y CINTAS', icon: 'bi-slash-square-fill' },
    { id: 'RESORTES Y ELÁSTICOS', label: 'ELÁSTICOS', icon: 'bi-water' },
    { id: 'OTROS INSUMOS', label: 'OTROS', icon: 'bi-box-seam' }
  ];

  groupedItems: SiesaGroupedItem[] = [];
  filteredGroupedItems: SiesaGroupedItem[] = [];

  constructor(private moldService: MoldService) {}

  ngOnInit(): void {
    if (this.filterType === 'tela') {
      this.selectedGroup = 'TELAS';
    } else if (this.filterType === 'insumo') {
      this.selectedGroup = 'BOTONES';
    }
    this.search();
  }

  setGroup(groupId: string): void {
    this.selectedGroup = groupId;
    this.search();
  }

  toggleStockFilter(): void {
    this.soloConStock = !this.soloConStock;
    this.search();
  }

  search(): void {
    this.loading = true;
    this.moldService.getGroupedInsumos(this.searchQuery, this.selectedGroup, this.soloConStock, this.selectedBodega).subscribe({
      next: (res: any) => {
        const rawGrouped = res.data?.grouped || {};
        const itemsList: SiesaGroupedItem[] = [];

        // Flatten groups to a list of grouped materials
        Object.keys(rawGrouped).forEach(grpKey => {
          const grpItems = rawGrouped[grpKey] || [];
          grpItems.forEach((gi: any) => {
            const colores: SiesaColorVariant[] = (gi.colores || []).map((c: any) => ({
              ...c,
              total_existencias: Number(c.total_existencias) || 0
            }));
            const defaultColor = colores.find(c => c.total_existencias > 0) || colores[0];

            itemsList.push({
              insumo: gi.insumo || gi.referencia_base,
              referencia_base: gi.referencia_base,
              es_tela: !!gi.es_tela,
              grupo: grpKey,
              colores: colores,
              selectedColor: defaultColor
            });
          });
        });

        // Fallback if no grouped response: try flat list
        if (itemsList.length === 0 && res.data?.raw_items) {
          const rawItems = res.data.raw_items || [];
          const mapByName: { [key: string]: SiesaGroupedItem } = {};

          rawItems.forEach((r: any) => {
            const key = r.descripcion || r.referencia;
            if (!mapByName[key]) {
              mapByName[key] = {
                insumo: key,
                referencia_base: r.referencia,
                es_tela: !!r.es_tela,
                grupo: r.grupo || 'OTROS',
                colores: []
              };
            }
            mapByName[key].colores.push({
              ...r,
              total_existencias: Number(r.total_existencias) || 0
            });
          });

          Object.values(mapByName).forEach(gi => {
            gi.selectedColor = gi.colores.find(c => c.total_existencias > 0) || gi.colores[0];
            itemsList.push(gi);
          });
        }

        this.groupedItems = itemsList;
        this.filterResults();
        this.isLoaded = true;
        this.loading = false;
      },
      error: () => {
        // Fallback to regular search if grouped fails
        this.fallbackRegularSearch();
      }
    });
  }

  private fallbackRegularSearch(): void {
    this.moldService.searchInventory(this.searchQuery, this.selectedBodega).subscribe({
      next: (res: any) => {
        const raw = res.data || [];
        const mapByName: { [key: string]: SiesaGroupedItem } = {};

        raw.forEach((r: any) => {
          const key = r.descripcion || r.referencia;
          const isFabric = (r.referencia || '').startsWith('1110');
          if (!mapByName[key]) {
            mapByName[key] = {
              insumo: key,
              referencia_base: r.referencia,
              es_tela: isFabric,
              grupo: isFabric ? 'TELAS' : 'INSUMOS',
              colores: []
            };
          }
          mapByName[key].colores.push({
            id_item: r.id_item || r.referencia,
            referencia: r.referencia,
            descripcion: r.descripcion,
            id_color: r.id_color || '',
            color: r.color || 'ÚNICO',
            total_existencias: Number(r.existencias || r.total_existencias) || 0,
            estado_stock: (Number(r.existencias || r.total_existencias) > 0) ? 'DISPONIBLE' : 'SIN_STOCK',
            es_tela: isFabric
          });
        });

        const itemsList: SiesaGroupedItem[] = Object.values(mapByName);
        itemsList.forEach(gi => {
          gi.selectedColor = gi.colores.find(c => c.total_existencias > 0) || gi.colores[0];
        });

        this.groupedItems = itemsList;
        this.filterResults();
        this.isLoaded = true;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.isLoaded = true;
      }
    });
  }

  filterResults(): void {
    const q = (this.searchQuery || '').toLowerCase().trim();
    this.filteredGroupedItems = this.groupedItems.filter(item => {
      if (this.filterType === 'tela' && !item.es_tela) return false;
      if (this.filterType === 'insumo' && item.es_tela) return false;

      if (this.selectedGroup && item.grupo && item.grupo !== this.selectedGroup) {
        return false;
      }

      if (!q) return true;

      const matchBase = (item.insumo || '').toLowerCase().includes(q) ||
                        (item.referencia_base || '').toLowerCase().includes(q);
      const matchColor = item.colores.some(c => (c.color || '').toLowerCase().includes(q));

      return matchBase || matchColor;
    });
  }

  onColorChange(item: SiesaGroupedItem, colorVariant: SiesaColorVariant): void {
    item.selectedColor = colorVariant;
  }

  selectItem(groupedItem: SiesaGroupedItem): void {
    const selectedVariant = groupedItem.selectedColor || groupedItem.colores[0];
    if (!selectedVariant) return;

    const returnData = {
      id_item: selectedVariant.id_item || selectedVariant.referencia,
      referencia: selectedVariant.referencia,
      descripcion: selectedVariant.descripcion || groupedItem.insumo,
      id_color: selectedVariant.id_color,
      color: selectedVariant.color,
      costo_unitario: 0,
      existencias: selectedVariant.total_existencias,
      is_fabric: groupedItem.es_tela,
      assignment_source: 'siesa'
    };

    this.onSelect.emit(returnData);
  }

  close(): void {
    this.onClose.emit();
  }
}
