export type EnumProductCategory = 'PHOTO' | 'TSHIRT';

export type EnumTshirtSize = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'XXXL';
export type EnumPrintLocation = 'FRONT' | 'BACK' | 'FRONT_BACK' | 'BY_TZ';

export type EnumStatus =
  | 'LEAD'
  | 'NEW'
  | 'FOLDER_STRUCTURE_CREATED'
  | 'PRINTED'
  | 'READY'
  | 'DONE'
  | 'SENT'
  | 'PAID';

export type EnumSourceOrder = 'AVITO' | 'OZON' | 'WB' | 'LOCAL';

export type EnumCommunication = 'AVITO' | 'TELEGRAM' | 'MAX' | 'OZON';

export type EnumDeliveryMethod =
  | 'YANDEX_PVZ'
  | 'OZON_PVZ'
  | 'PICKUP'
  | 'OZON_SELLER'
  | 'WB_SELLER';

export type EnumTypePaper = 'GLOSS' | 'MATTE';

export interface ItemTshirt {
  id: string;
  createdAt: string;
  updatedAt: string;
  orderId: string;
  color: string;
  size: EnumTshirtSize;
  printLocation: EnumPrintLocation;
  quantity: number;
  price: number;
  pricePosition: number;
  designCost: number;
  designUrl?: string | null;
  designNote?: string | null;
}

export interface ItemPhoto {
  id: string;
  createdAt: string;
  updatedAt: string;
  orderId: string;
  formatPaper: string;
  typePaper: EnumTypePaper;
  quantity: number;
  price: number;
  pricePosition: number;
}

export interface OrderPhoto {
  id: string;
  createdAt: string;
  updatedAt: string;
  numberOrder: string;
  sourceOrder: EnumSourceOrder;
  communicationPlatform: EnumCommunication;
  urlCommunication: string;
  deliveryMethod: EnumDeliveryMethod;
  deliveryCost: number;
  totalOrder: number;
  status: EnumStatus;
  note?: string;
  productCategory: EnumProductCategory;
  deadline?: string | null;
  isUrgent: boolean;
  items: ItemPhoto[];
  tshirtItems: ItemTshirt[];
}

export interface OrdersResponse {
  data: OrderPhoto[];
  meta: {
    page: number;
    limit: number;
    quantityElements: number;
    totalPages: number;
  };
}

export interface CreateItemDto {
  formatPaper: string;
  typePaper: EnumTypePaper;
  quantity: number;
  price: number;
}

export interface CreateTshirtItemDto {
  color: string;
  size: EnumTshirtSize;
  printLocation: EnumPrintLocation;
  quantity: number;
  price: number;
  designCost?: number;
  designUrl?: string;
  designNote?: string;
}

export interface UpdateTshirtItemDto {
  color?: string;
  size?: EnumTshirtSize;
  printLocation?: EnumPrintLocation;
  quantity?: number;
  price?: number;
  designCost?: number;
  designUrl?: string;
  designNote?: string;
}

export interface CreateOrderDto {
  sourceOrder: EnumSourceOrder;
  communicationPlatform: EnumCommunication;
  urlCommunication: string;
  deliveryMethod: EnumDeliveryMethod;
  deliveryCost: number;
  note?: string;
  productCategory?: EnumProductCategory;
  status?: EnumStatus;
  items?: CreateItemDto[];
  tshirtItems?: CreateTshirtItemDto[];
}

export interface UpdateOrderDto {
  sourceOrder?: EnumSourceOrder;
  communicationPlatform?: EnumCommunication;
  urlCommunication?: string;
  deliveryMethod?: EnumDeliveryMethod;
  deliveryCost?: number;
  note?: string;
  status?: EnumStatus;
  isUrgent?: boolean;
}

export interface UpdateStatusDto {
  status: EnumStatus;
}

export interface UpdateItemDto {
  formatPaper?: string;
  typePaper?: EnumTypePaper;
  quantity?: number;
  price?: number;
}

export type EnumRole = 'ADMIN' | 'EXECUTOR';

export interface AuthUser {
  id: string;
  username: string;
  role: EnumRole;
}

export interface LoginResponse {
  access_token: string;
  role: EnumRole;
  username: string;
}

export interface AppUser {
  id: string;
  username: string;
  role: EnumRole;
  createdAt: string;
}

export interface OrdersQuery {
  page?: number;
  limit?: number;
  status?: EnumStatus;
  sourceOrder?: EnumSourceOrder;
  productCategory?: EnumProductCategory;
}

export interface SalaryOrder {
  id: string;
  numberOrder: string;
  createdAt: string;
  updatedAt: string;
  status: EnumStatus;
  totalOrder: number;
  deliveryCost: number;
  cleanTotal: number;
  employeeShare: number;
  ownerShare: number;
}

export interface SalarySummary {
  ratePercent: number;
  toPay: SalaryOrder[];
  paid: SalaryOrder[];
  summary: {
    toPayCount: number;
    toPayClean: number;
    toPayEmployee: number;
    toPayOwner: number;
    paidCount: number;
    paidClean: number;
    paidEmployee: number;
    paidOwner: number;
  };
}
