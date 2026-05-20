export interface Asiento {
  codigoAsiento: string;
  funcionId: number;
  ocupado: boolean;
  usuarioEmail: string | null;
  version: number;
}

export interface ReservaRequest {
  codigoAsiento: string;
  usuarioEmail: string;
}
