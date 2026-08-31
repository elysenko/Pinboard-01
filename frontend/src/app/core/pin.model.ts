export interface Pin {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePinDto {
  title: string;
  body?: string;
}

export type UpdatePinDto = Partial<CreatePinDto>;

export const PIN_TITLE_MAX = 120;
export const PIN_BODY_MAX = 2000;
