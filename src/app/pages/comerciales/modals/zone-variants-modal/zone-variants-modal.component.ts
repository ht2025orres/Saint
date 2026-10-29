import { Component, Input, Output, EventEmitter } from '@angular/core';
import { LocalItem, AnatomicalColumn } from '../../costeo-form/costeo-form.component';
import { CANONICAL_OPTIONAL_PARTS, OptionalPart, OptionalPartType } from '../canonical-optional-parts';

@Component({
  selector: 'app-zone-variants-modal',
  templateUrl: './zone-variants-modal.component.html',
  styleUrls: ['./zone-variants-modal.component.css']
})
export class ZoneVariantsModalComponent {
  @Input() activeZoneCol: AnatomicalColumn | null = null;
  @Input() activeZoneTitle = '';
  @Input() activeZoneSubtitle = '';
  @Input() activeZoneDisplayParts: any[] = [];
  @Input() activePartInModal: any = null;
  @Input() zoneModalStep: 'select-part' | 'select-variant' | 'select-optional' | 'select-optional-variant' = 'select-part';
  @Input() isLoadingZoneParts = false;
  @Input() item: LocalItem | null = null;
  @Input() observation = '';
  @Input() anchoredGeneralParts: any[] = [];

  availableOptionalParts: OptionalPart[] = CANONICAL_OPTIONAL_PARTS;
  activeOptionalPart: OptionalPart | null = null;

  @Output() onChoosePart = new EventEmitter<any>();
  @Output() onBackToParts = new EventEmitter<void>();
  @Output() onSelectVariant = new EventEmitter<{ part: any; type: any }>();
  @Output() onUnselectVariant = new EventEmitter<any>();
  @Output() onClose = new EventEmitter<void>();
  @Output() onObservationChange = new EventEmitter<string>();
  @Output() onAddOptional = new EventEmitter<void>();
  @Output() onRemoveAnchor = new EventEmitter<any>();
  @Output() onSelectOptionalVariant = new EventEmitter<{ part: OptionalPart; type: OptionalPartType }>();
  @Output() onConfirm = new EventEmitter<void>();

  choosePart(part: any): void {
    this.onChoosePart.emit(part);
  }

  backToParts(): void {
    this.onBackToParts.emit();
  }

  selectVariant(part: any, type: any): void {
    this.onSelectVariant.emit({ part, type });
  }

  unselectVariant(part: any): void {
    this.onUnselectVariant.emit(part);
  }

  close(): void {
    this.onClose.emit();
  }

  onObsChange(val: string): void {
    this.observation = val;
    this.onObservationChange.emit(val);
  }

  addOptional(): void {
    this.zoneModalStep = 'select-optional';
    this.activeOptionalPart = null;
  }

  removeAnchor(gp: any): void {
    this.onRemoveAnchor.emit(gp);
  }

  confirm(): void {
    this.onConfirm.emit();
    this.close();
  }

  // ==================== NAVEGACIÓN APLIQUES OPCIONALES INLINE ====================

  /** Volver de la lista de apliques opcionales a la vista principal de variantes */
  backFromOptionals(): void {
    this.activeOptionalPart = null;
    if (this.activePartInModal) {
      this.zoneModalStep = 'select-variant';
    } else if (this.activeZoneDisplayParts.length === 1) {
      this.activePartInModal = this.activeZoneDisplayParts[0];
      this.zoneModalStep = 'select-variant';
    } else {
      this.zoneModalStep = 'select-part';
    }
  }

  /** Elegir un aplique opcional para ver sus variaciones */
  chooseOptionalPart(part: OptionalPart): void {
    this.activeOptionalPart = part;
    this.zoneModalStep = 'select-optional-variant';
  }

  /** Volver a la lista de apliques opcionales */
  backToOptionalsList(): void {
    this.activeOptionalPart = null;
    this.zoneModalStep = 'select-optional';
  }

  /** Seleccionar una variación de un aplique opcional */
  selectOptionalVariant(part: OptionalPart, type: OptionalPartType): void {
    this.onSelectOptionalVariant.emit({ part, type });
    // Volver a la vista principal tras seleccionar
    this.backFromOptionals();
  }

  /** Remover un aplique opcional seleccionado */
  removeOptionalPart(part: OptionalPart): void {
    this.onRemoveAnchor.emit({ id: part.id, name: part.name, item_type: 'parte_general' });
  }

  /** Verificar si un aplique opcional ya está configurado en el ítem */
  isOptionalPartConfigured(part: OptionalPart): boolean {
    if (!this.item) return false;
    const comps = this.item.draftComponents || [];
    return comps.some((c: any) =>
      c.item_type === 'parte_general' &&
      (c.name || '').toLowerCase().trim() === part.name.toLowerCase().trim()
    );
  }

  /** Obtener el nombre de la variación seleccionada de un aplique opcional */
  getOptionalSelectedTypeName(part: OptionalPart): string {
    if (!this.item) return '';
    const comps = this.item.draftComponents || [];
    const found = comps.find((c: any) =>
      c.item_type === 'parte_general' &&
      (c.name || '').toLowerCase().trim() === part.name.toLowerCase().trim()
    );
    return found?.selected_type_name || '';
  }

  /** Verificar si una variación específica del aplique está seleccionada */
  isOptionalTypeSelected(part: OptionalPart, type: OptionalPartType): boolean {
    if (!this.item) return false;
    const comps = this.item.draftComponents || [];
    const found = comps.find((c: any) =>
      c.item_type === 'parte_general' &&
      (c.name || '').toLowerCase().trim() === part.name.toLowerCase().trim()
    );
    if (!found) return false;
    return (found.selected_type_name || '').toLowerCase().trim() === type.name.toLowerCase().trim();
  }

  isPartConfigured(part: any): boolean {
    if (!this.item) return false;
    const comps = this.item.draftComponents || (this.item as any).technical_spec?.parts || [];
    const pids = [part.id, ...(part.siblingPartIds || [])];
    const pName = (part.name || '').toLowerCase().trim();
    const found = comps.find((c: any) =>
      (c.mold_part_id && pids.includes(Number(c.mold_part_id))) ||
      (pName && c.name && c.name.toLowerCase().trim() === pName)
    );
    return !!(found && found.selected_type_name);
  }

  isTypeSelected(part: any, type: any): boolean {
    if (!this.item || !part || !type) return false;
    const comps = this.item.draftComponents || (this.item as any).technical_spec?.parts || [];
    const pids = [part.id, ...(part.siblingPartIds || [])];
    const pName = (part.name || '').toLowerCase().trim();
    const found = comps.find((c: any) =>
      (c.mold_part_id && pids.includes(Number(c.mold_part_id))) ||
      (pName && c.name && c.name.toLowerCase().trim() === pName)
    );
    if (!found) return false;
    return Number(found.mold_part_type_id) === Number(type.id) ||
           (found.selected_type_name && found.selected_type_name.toLowerCase().trim() === (type.name || '').toLowerCase().trim());
  }

  getSelectedVariantName(part: any): string {
    if (!this.item) return '';
    const comps = this.item.draftComponents || (this.item as any).technical_spec?.parts || [];
    const pids = [part.id, ...(part.siblingPartIds || [])];
    const pName = (part.name || '').toLowerCase().trim();
    const found = comps.find((c: any) =>
      (c.mold_part_id && pids.includes(Number(c.mold_part_id))) ||
      (pName && c.name && c.name.toLowerCase().trim() === pName)
    );
    return found?.selected_type_name || '';
  }
}

