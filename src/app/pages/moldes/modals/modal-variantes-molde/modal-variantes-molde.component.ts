import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';

@Component({
  selector: 'app-modal-variantes-molde',
  templateUrl: './modal-variantes-molde.component.html',
  styleUrls: ['./modal-variantes-molde.component.css']
})
export class ModalVariantesMoldeComponent implements OnInit {
  @Input() mold: any = null;

  @Output() confirmSelection = new EventEmitter<{
    selectedParts: any[];
    totalEstimatedTime: number;
    combinedTechnicalDescription: string;
  }>();
  @Output() cancel = new EventEmitter<void>();

  selectedTypesMap: { [partId: number]: any } = {};
  totalEstimatedTime: number = 0;
  combinedTechnicalDescription: string = '';

  ngOnInit(): void {
    if (this.mold && this.mold.parts) {
      // Inicializar cada parte con su variante por defecto
      this.mold.parts.forEach((part: any) => {
        if (part.types && part.types.length > 0) {
          const defaultType = part.types.find((t: any) => t.is_default) || part.types[0];
          this.selectedTypesMap[part.id] = defaultType;
        }
      });
      this.calculateSummary();
    }
  }

  onSelectTypeForPart(partId: number, type: any): void {
    this.selectedTypesMap[partId] = type;
    this.calculateSummary();
  }

  calculateSummary(): void {
    if (!this.mold) return;

    // 1. Tiempo de operaciones globales
    let globalTime = 0;
    if (this.mold.globalOperations) {
      globalTime = this.mold.globalOperations.reduce((acc: number, gOp: any) => acc + (parseFloat(gOp.execution_time) || 0), 0);
    }

    // 2. Tiempo de variantes de parte seleccionadas
    let partsTime = 0;
    const descParts: string[] = [];

    if (this.mold.parts) {
      this.mold.parts.forEach((part: any) => {
        const selectedType = this.selectedTypesMap[part.id];
        if (selectedType) {
          const typeTime = parseFloat(selectedType.total_time) || 0;
          partsTime += typeTime;

          if (selectedType.technical_description) {
            descParts.push(`${part.name}: ${selectedType.technical_description}`);
          }
        }
      });
    }

    this.totalEstimatedTime = globalTime + partsTime;
    this.combinedTechnicalDescription = descParts.join("\n");
  }

  onConfirm(): void {
    const selectedPartsPayload: any[] = [];

    if (this.mold && this.mold.parts) {
      this.mold.parts.forEach((part: any) => {
        const selectedType = this.selectedTypesMap[part.id];
        selectedPartsPayload.push({
          mold_part_id: part.id,
          mold_part_type_id: selectedType ? selectedType.id : null,
          name: part.name,
          item_type: part.item_type || 'parte',
          technical_spec: selectedType ? selectedType.technical_description : '',
          estimated_time: selectedType ? selectedType.total_time : 0,
          position_x: part.position_x,
          position_y: part.position_y
        });
      });
    }

    this.confirmSelection.emit({
      selectedParts: selectedPartsPayload,
      totalEstimatedTime: this.totalEstimatedTime,
      combinedTechnicalDescription: this.combinedTechnicalDescription
    });
  }

  onCancel(): void {
    this.cancel.emit();
  }
}
