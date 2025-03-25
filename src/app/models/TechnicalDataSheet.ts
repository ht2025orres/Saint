import { ProductCategory } from './ProductCategory';
import { Moment } from 'moment';

export class TechnicalDataSheet{
  public id: number;
  public idItem: string;
  public id_item: string;
  public idItemCustomer: string;
  public itemDescription: string;
  public idCompany: string;
  public companyName: string;
  public userCreated: string;
  public userValidation: string;
  public userApproved: string;
  public dateCreation: Moment;
  public lastUpdate: Moment;
  public date_creation: Moment;
  public last_update: Moment;
  public status: string;
  public file?: File;
  public productImage1?: string;
  public productImage2?: string;
  public characteristicImage1?: string;
  public characteristicImage2?: string;
  public characteristicImage3?: string;
  public characteristicImage4?: string;
  public logoTechnicalDataSheet?: string;
  public productCategory: ProductCategory;
  public technicalDataSheetType;
  public technical_data_sheet_type;
  public gender: string; //Genero
  public mainFabric: string; //Tela principal
  public contrastFabric: string; //Tela contraste
  public waistband: string; //Pretina
  public button: string; //Boton
  public zipper: string; //Cierre
  public figured: string; //Figurado
  public pins: string; //Pasadores
  public sidePulls: string; //Tiros
  public purses: string; //Carteras
  public shoulderUnion: string; //Union de los hombros
  public lining: string; //Forro
  public shirtCollar: string; //Cuello
  public cuffs: string; //Puños
  public pockets: string; //Bolsillos
  public busybody: string; //Cotilla
  public sleeves: string; //Mangas
  public back: string; //Espalda
  public shoulders: string; //Hombros
  public sleeveConnection: string; //Union de las Mangas
  public frontAdjustment: string; //Ajuste del frente
  public neckline: string; //Escote
  public finished: string; //Terminado
  public darts: string; //Pinzas
  public opening: string; //Aberturas
  public straps: string; //Tiras
  public cuts: string; //Cortes
  public closedSides: string; //Cerrado de los Costados
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
  public criticalPoints: string; //Puntos Criticos
  public customerDescription: string; //Descripcion cliente
  public measurementTable: string; //Tabla de medidas
  public editComments: string; //comentarios de edicion
  public qaComments: string; //comentarios de qa
}
