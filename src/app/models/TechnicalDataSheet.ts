import { ProductCategory } from './ProductCategory';
import { Moment } from 'moment';

export class TechnicalDataSheet{
  public id: number;
  public id_item: string;
  public id_item_customer: string;
  public item_description: string;
  public id_company: string;
  public company_name: string;
  public user_created: string;
  public user_validation: string;
  public user_approved: string;
  public date_creation: Moment;
  public last_update: Moment;
  public status: string;
  public file?: File;
  public product_image_1?: string;
  public product_image_2?: string;
  public characteristic_image_1?: string;
  public characteristic_image_2?: string;
  public characteristic_image_3?: string;
  public characteristic_image_4?: string;
  public logo_technical_data_sheet?: string;
  public id_product_category: number;
  public technical_data_sheet_type: string;
  public gender: string; //Genero
  public main_fabric: string; //Tela principal
  public contrast_fabric: string; //Tela contraste
  public waistband: string; //Pretina
  public button: string; //Boton
  public zipper: string; //Cierre
  public figured: string; //Figurado
  public pins: string; //Pasadores
  public side_pulls: string; //Tiros
  public purses: string; //Carteras
  public shoulder_union: string; //Union de los hombros
  public lining: string; //Forro
  public shirt_collar: string; //Cuello
  public cuffs: string; //Puños
  public pockets: string; //Bolsillos
  public busybody: string; //Cotilla
  public sleeves: string; //Mangas
  public back: string; //Espalda
  public shoulders: string; //Hombros
  public sleeve_connection: string; //Union de las Mangas
  public front_adjustment: string; //Ajuste del frente
  public neckline: string; //Escote
  public finished: string; //Terminado
  public darts: string; //Pinzas
  public opening: string; //Aberturas
  public straps: string; //Tiras
  public cuts: string; //Cortes
  public closed_sides: string; //Cerrado de los Costados
  public hem: string; //Dobladillo
  public hood: string; //Capucha
  public crotch: string; //Entrepierna
  public reflective: string; //Reflectivo
  public boot: string; //Bota
  public additional: string; //Adicionales
  public composition: string; //Composicion
  public buttonhole: string; //Ojal
  public loops: string; //Presillas
  public stitches: string; //Puntadas
  public prewash: string; //Prelavado
  public embroidery: string; //Descripción del bordado
  public stamped: string; //Descripción del estampado
  public ironing: string; //Descripción del planchado
  public packaging: string; //Descripción del empaque
  public stitching: string; //Pespuntes
  public critical_points: string; //Puntos Criticos
  public customer_description: string; //Descripcion cliente
  public measurement_table: string; //Tabla de medidas
  public edit_comments: string; //comentarios de edicion
  public qa_comments: string; //comentarios de qa
  public version: string;
  public logo_description: string;
  public observations: string;
  public rib: string;
  public side_stand: string;
  public bill_materials: string;
}
