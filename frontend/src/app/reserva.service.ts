import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Asiento, ReservaRequest } from './asiento.model';

@Injectable({ providedIn: 'root' })
export class ReservaService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:8081/api/reservas';

  listarAsientos(): Observable<Asiento[]> {
    return this.http.get<Asiento[]>(`${this.baseUrl}/asientos`);
  }

  reservar(req: ReservaRequest): Observable<string> {
    return this.http.post(`${this.baseUrl}/reservar`, req, { responseType: 'text' });
  }

  inicializarSala(): Observable<string> {
    return this.http.post(`${this.baseUrl}/inicializar-sala`, null, { responseType: 'text' });
  }
}
