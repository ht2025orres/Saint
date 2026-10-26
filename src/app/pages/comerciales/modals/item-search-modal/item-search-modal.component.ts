import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { ComercialService, ItemSiesa } from '../../../../services/comercial.service';

export interface TallaExtension {
  talla: string;
  rawTalla: string;
  siesa_item_ext_rowid: number | null;
  color?: string;
  seleccionada: boolean;
}

export interface GroupedItemSiesa {
  f120_rowid: number | null;
  referencia: string;
  descripcion: string;
  color?: string;
  veces_pedido?: number;
  total_pedido?: number;
  ultima_pv?: string;
  extensiones: TallaExtension[];
  rawItem: ItemSiesa;
}

@Component({
  selector: 'app-item-search-modal',
  templateUrl: './item-search-modal.component.html',
  styleUrls: ['./item-search-modal.component.css']
})
export class ItemSearchModalComponent implements OnInit {
  @Input() clienteId: number | null = null;
  @Output() onSelect = new EventEmitter<any>();
  @Output() onClose = new EventEmitter<void>();

  rawItems: ItemSiesa[] = [];
  groupedItems: GroupedItemSiesa[] = [];
  filteredGroupedItems: GroupedItemSiesa[] = [];
  searchTerm = '';
  isLoading = false;
  isDeepSearch = false;
  hasTriedNormalSearch = false;

  constructor(private comercialService: ComercialService) {}

  ngOnInit(): void {
    if (this.clienteId) {
      this.loadItems();
    }
  }

  loadItems(deep: boolean = false): void {
    if (!this.clienteId) return;
    this.isLoading = true;
    this.isDeepSearch = deep;
    this.comercialService.itemsCliente(this.clienteId, deep).subscribe({
      next: (res) => {
        this.rawItems = res.data || [];
        this.groupedItems = this.groupItems(this.rawItems);
        this.search();
        this.isLoading = false;
        this.hasTriedNormalSearch = !deep;
      },
      error: () => { this.isLoading = false; }
    });
  }

  cleanTalla(talla: string | null | undefined): string {
    if (!talla) return '';
    const trimmed = talla.trim();
    // Limpia prefijos como "07. /L" -> "L", "/M" -> "M", "08. /32" -> "32"
    const cleaned = trimmed.replace(/^\d+[\.\s\/\-]+/, '').replace(/^\/+/, '').trim();
    return cleaned || trimmed;
  }

  groupItems(rawList: ItemSiesa[]): GroupedItemSiesa[] {
    const map = new Map<string, GroupedItemSiesa>();

    for (const raw of rawList) {
      const ref = raw.f120_referencia || raw.referencia || raw.f120_id || 'SIN_REF';
      const rowid = raw.f120_rowid || null;
      const desc = raw.f120_descripcion || raw.descripcion || raw.f120_descripcion_corta || '';
      const key = `${rowid || ''}___${ref.trim().toLowerCase()}`;

      if (!map.has(key)) {
        map.set(key, {
          f120_rowid: rowid,
          referencia: ref,
          descripcion: desc,
          color: raw.color || '',
          veces_pedido: raw.veces_pedido,
          total_pedido: raw.total_pedido,
          ultima_pv: raw.ultima_pv,
          extensiones: [],
          rawItem: raw
        });
      }

      const item = map.get(key)!;
      if (raw.talla) {
        const cleaned = this.cleanTalla(raw.talla);
        const extRowid = raw.f121_rowid || raw.rowid_item_ext || null;
        const exists = item.extensiones.find(e => e.talla === cleaned && (!extRowid || e.siesa_item_ext_rowid === extRowid));
        if (!exists) {
          item.extensiones.push({
            talla: cleaned,
            rawTalla: raw.talla,
            siesa_item_ext_rowid: extRowid,
            color: raw.color,
            seleccionada: true
          });
        }
      }
    }

    return Array.from(map.values());
  }

  search(): void {
    if (!this.searchTerm.trim()) {
      this.filteredGroupedItems = [...this.groupedItems];
      return;
    }

    const term = this.searchTerm.toLowerCase();
    this.filteredGroupedItems = this.groupedItems.filter(i =>
      i.descripcion.toLowerCase().includes(term) ||
      i.referencia.toLowerCase().includes(term) ||
      (i.color || '').toLowerCase().includes(term) ||
      i.extensiones.some(e => e.talla.toLowerCase().includes(term))
    );

    if (this.filteredGroupedItems.length === 0 && this.searchTerm.length >= 3 && !this.isDeepSearch) {
      this.hasTriedNormalSearch = true;
    }
  }

  toggleTalla(ext: TallaExtension, event: MouseEvent): void {
    event.stopPropagation();
    ext.seleccionada = !ext.seleccionada;
  }

  selectAllTallas(item: GroupedItemSiesa, select: boolean, event: MouseEvent): void {
    event.stopPropagation();
    item.extensiones.forEach(e => e.seleccionada = select);
  }

  deepSearch(): void {
    this.loadItems(true);
  }

  select(item: GroupedItemSiesa): void {
    const selectedExts = item.extensiones.filter(e => e.seleccionada);
    const finalExts = selectedExts.length > 0 ? selectedExts : item.extensiones;

    const payload = {
      ...item.rawItem,
      f120_rowid: item.f120_rowid,
      f120_referencia: item.referencia,
      referencia: item.referencia,
      f120_descripcion: item.descripcion,
      descripcion: item.descripcion,
      extensiones: finalExts,
      todasExtensiones: item.extensiones,
      talla: finalExts.length === 1 ? finalExts[0].talla : (item.rawItem.talla || '')
    };

    this.onSelect.emit(payload);
  }

  close(): void {
    this.onClose.emit();
  }
}
