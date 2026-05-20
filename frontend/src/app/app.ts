import { Component, inject, signal, computed, effect, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ReservaService } from './reserva.service';
import { Asiento } from './asiento.model';
import { Subject, Subscription, forkJoin, of, interval } from 'rxjs';
import { catchError, finalize, switchMap } from 'rxjs/operators';

interface ResultadoSimulacion {
  usuario: string;
  asiento: string;
  exito: boolean;
  mensaje: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="cinema">
      <header class="header">
        <div class="logo">
          <span class="logo-icon">🎬</span>
          <h1>Cine Reserva</h1>
        </div>
        <p class="subtitle">Sistema de reservas con concurrencia</p>
      </header>

      <div class="screen-wrapper">
        <div class="screen">
          <span>Pantalla</span>
          <div class="screen-curve"></div>
        </div>
      </div>

      <div class="controls">
        <div class="control-row">
          <div class="input-group">
            <label for="email">Tu correo electrónico</label>
            <input
              id="email"
              type="email"
              [(ngModel)]="email"
              placeholder="tu@correo.com"
              class="input"
            />
          </div>
          <div class="btn-group">
            <button class="btn btn-primary" (click)="inicializar()" [disabled]="loading()">
              Inicializar Sala
            </button>
            <button class="btn btn-secondary" (click)="cargarAsientos()" [disabled]="loading()">
              Actualizar
            </button>
            <button class="btn btn-ghost" (click)="autoRefresh.set(!autoRefresh())" [class.active]="autoRefresh()">
              Auto {{ autoRefresh() ? 'ON' : 'OFF' }}
            </button>
          </div>
        </div>
      </div>

      @if (mensaje(); as msg) {
        <div class="toast" [class.toast-error]="msg.error" [class.toast-success]="!msg.error" (click)="mensaje.set(null)">
          {{ msg.texto }}
        </div>
      }

      @if (loading() && !simulando()) {
        <div class="loading">
          <div class="spinner"></div>
          <span>Cargando...</span>
        </div>
      }

      <div class="seat-grid">
        @for (fila of filas(); track fila.letra) {
          <div class="row">
            <span class="row-label">{{ fila.letra }}</span>
            <div class="seats">
              @for (asiento of fila.asientos; track asiento.codigoAsiento) {
                <button
                  class="seat"
                  [class.available]="!asiento.ocupado && seleccionado()?.codigoAsiento !== asiento.codigoAsiento"
                  [class.occupied]="asiento.ocupado"
                  [class.selected]="seleccionado()?.codigoAsiento === asiento.codigoAsiento"
                  [disabled]="asiento.ocupado || loading()"
                  (click)="seleccionarAsiento(asiento)"
                  [title]="asiento.codigoAsiento + (asiento.ocupado ? ' - Ocupado por: ' + asiento.usuarioEmail : ' - Disponible')"
                >
                  <span class="seat-number">{{ asiento.codigoAsiento.split('-')[1] }}</span>
                </button>
              }
            </div>
          </div>
        } @empty {
          @if (!loading()) {
            <div class="empty">
              <p>No hay asientos disponibles.</p>
              <p>Haz clic en "Inicializar Sala" para crear la sala de cine.</p>
            </div>
          }
        }
      </div>

      @if (seleccionado(); as sel) {
        <div class="reservation-bar">
          <span>Asiento seleccionado: <strong>{{ sel.codigoAsiento }}</strong></span>
          <button class="btn btn-accent" (click)="reservar()" [disabled]="loading() || !email()">
            Reservar
          </button>
        </div>
      }

      <section class="simulator">
        <div class="simulator-header" (click)="simulatorOpen.set(!simulatorOpen())">
          <span class="simulator-title">Simulador de Concurrencia</span>
          <span class="simulator-toggle">{{ simulatorOpen() ? '▼' : '▶' }}</span>
        </div>

        @if (simulatorOpen()) {
          <div class="simulator-body">
            <div class="simulator-controls">
              <div class="input-group">
                <label for="sim-seat">Asiento a probar</label>
                <input
                  id="sim-seat"
                  type="text"
                  [(ngModel)]="simSeatCode"
                  placeholder="Ej: H-12"
                  class="input"
                />
              </div>
              <div class="input-group">
                <label for="sim-count">Usuarios concurrentes: {{ simCount() }}</label>
                <input
                  id="sim-count"
                  type="range"
                  [min]="2"
                  [max]="50"
                  [step]="1"
                  [value]="simCount()"
                  (input)="actualizarSimCount($event)"
                  class="range"
                />
                <div class="range-labels">
                  <span>2</span>
                  <span>50</span>
                </div>
              </div>
              <div class="input-group">
                <label for="sim-prefix">Prefijo de email</label>
                <input
                  id="sim-prefix"
                  type="text"
                  [(ngModel)]="simPrefix"
                  placeholder="Ej: usuario"
                  class="input"
                />
              </div>
              <button
                class="btn btn-danger"
                (click)="simularConcurrencia()"
                [disabled]="simulando() || !simSeatCode().trim()"
              >
                @if (simulando()) {
                  <span class="btn-loading">
                    <span class="spinner-small"></span>
                    Simulando...
                  </span>
                } @else {
                  Simular Concurrencia
                }
              </button>
            </div>

            <div class="simulator-stats">
              <div class="stat stat-success">
                <span class="stat-value">{{ resultadosExitosos() }}</span>
                <span class="stat-label">Exitosos</span>
              </div>
              <div class="stat stat-fail">
                <span class="stat-value">{{ resultadosFallidos() }}</span>
                <span class="stat-label">Fallidos</span>
              </div>
              <div class="stat stat-total">
                <span class="stat-value">{{ resultados().length }}</span>
                <span class="stat-label">Total</span>
              </div>
            </div>

            @if (resultados().length > 0) {
              <div class="simulator-results">
                <div class="result-header">
                  <span>Usuario</span>
                  <span>Resultado</span>
                </div>
                @for (r of resultados(); track r.usuario + '-' + $index) {
                  <div class="result-row" [class.result-success]="r.exito" [class.result-fail]="!r.exito">
                    <span class="result-user">{{ r.usuario }}</span>
                    <span class="result-msg">{{ r.mensaje }}</span>
                  </div>
                }
              </div>
            }
          </div>
        }
      </section>

      <footer class="footer">
        <div class="legend">
          <div class="legend-item">
            <span class="legend-seat available"></span>
            <span>Disponible</span>
          </div>
          <div class="legend-item">
            <span class="legend-seat selected-legend"></span>
            <span>Seleccionado</span>
          </div>
          <div class="legend-item">
            <span class="legend-seat occupied"></span>
            <span>Ocupado</span>
          </div>
        </div>
      </footer>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background: #0a0a0f;
      color: #e8e8e8;
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    }

    .cinema {
      max-width: 860px;
      margin: 0 auto;
      padding: 2rem 1rem;
    }

    .header {
      text-align: center;
      margin-bottom: 2rem;
    }

    .logo {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
    }

    .logo-icon {
      font-size: 2rem;
    }

    .logo h1 {
      font-size: 1.75rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      background: linear-gradient(135deg, #f5af19, #f12711);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin: 0;
    }

    .subtitle {
      color: #666;
      font-size: 0.85rem;
      margin: 0.25rem 0 0;
    }

    .screen-wrapper {
      display: flex;
      justify-content: center;
      margin-bottom: 2rem;
    }

    .screen {
      position: relative;
      width: 80%;
      text-align: center;
      color: #888;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.3em;
    }

    .screen-curve {
      height: 6px;
      background: linear-gradient(90deg, transparent, #f5af19, #f12711, transparent);
      border-radius: 50%;
      margin-top: 0.5rem;
      box-shadow: 0 0 20px rgba(245, 175, 25, 0.3);
    }

    .controls {
      margin-bottom: 1.5rem;
      padding: 1.25rem;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 12px;
    }

    .control-row {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .input-group {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    .input-group label {
      font-size: 0.8rem;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .input {
      padding: 0.7rem 1rem;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.05);
      color: #e8e8e8;
      font-size: 0.95rem;
      outline: none;
      transition: border-color 0.2s;
    }

    .input:focus {
      border-color: #f5af19;
    }

    .input::placeholder {
      color: #555;
    }

    .btn-group {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .btn {
      padding: 0.6rem 1.25rem;
      border: none;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      letter-spacing: 0.02em;
      white-space: nowrap;
    }

    .btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .btn-primary {
      background: rgba(255, 255, 255, 0.08);
      color: #e8e8e8;
      border: 1px solid rgba(255, 255, 255, 0.12);
    }

    .btn-primary:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.14);
    }

    .btn-secondary {
      background: transparent;
      color: #888;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }

    .btn-secondary:hover:not(:disabled) {
      color: #e8e8e8;
      border-color: rgba(255, 255, 255, 0.2);
    }

    .btn-ghost {
      background: transparent;
      color: #555;
      border: 1px solid rgba(255, 255, 255, 0.06);
    }

    .btn-ghost.active {
      color: #81c784;
      border-color: rgba(76, 175, 80, 0.3);
      background: rgba(76, 175, 80, 0.1);
    }

    .btn-ghost:hover:not(:disabled) {
      color: #e8e8e8;
      border-color: rgba(255, 255, 255, 0.15);
    }

    .btn-accent {
      background: linear-gradient(135deg, #f5af19, #f12711);
      color: #0a0a0f;
    }

    .btn-accent:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 15px rgba(245, 175, 25, 0.3);
    }

    .btn-danger {
      background: linear-gradient(135deg, #ff1744, #d50000);
      color: #fff;
      width: 100%;
      justify-content: center;
      display: flex;
      align-items: center;
      padding: 0.75rem;
    }

    .btn-danger:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 15px rgba(213, 0, 0, 0.3);
    }

    .btn-loading {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .toast {
      padding: 0.75rem 1rem;
      border-radius: 8px;
      margin-bottom: 1rem;
      font-size: 0.9rem;
      text-align: center;
      cursor: pointer;
      animation: slideDown 0.3s ease;
    }

    .toast-success {
      background: rgba(76, 175, 80, 0.15);
      border: 1px solid rgba(76, 175, 80, 0.3);
      color: #81c784;
    }

    .toast-error {
      background: rgba(244, 67, 54, 0.15);
      border: 1px solid rgba(244, 67, 54, 0.3);
      color: #ef9a9a;
    }

    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-12px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      padding: 1rem;
      color: #888;
    }

    .spinner {
      width: 20px;
      height: 20px;
      border: 2px solid rgba(255, 255, 255, 0.1);
      border-top-color: #f5af19;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    .spinner-small {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255, 255, 255, 0.2);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      display: inline-block;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .seat-grid {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin-bottom: 1.5rem;
    }

    .row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .row-label {
      width: 1.5rem;
      text-align: center;
      font-weight: 700;
      color: #555;
      font-size: 0.8rem;
      flex-shrink: 0;
    }

    .seats {
      display: flex;
      gap: 0.4rem;
      flex-wrap: wrap;
    }

    .seat {
      width: 2.5rem;
      height: 2.5rem;
      border: none;
      border-radius: 8px 8px 4px 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 600;
      transition: all 0.15s ease;
      position: relative;
    }

    .seat.available {
      background: rgba(76, 175, 80, 0.2);
      border: 1px solid rgba(76, 175, 80, 0.3);
      color: #81c784;
    }

    .seat.available:hover {
      background: rgba(76, 175, 80, 0.35);
      transform: scale(1.08);
      box-shadow: 0 0 12px rgba(76, 175, 80, 0.2);
    }

    .seat.occupied {
      background: rgba(244, 67, 54, 0.15);
      border: 1px solid rgba(244, 67, 54, 0.2);
      color: #ef9a9a;
      cursor: not-allowed;
      opacity: 0.6;
    }

    .seat.selected {
      background: rgba(245, 175, 25, 0.25);
      border: 2px solid #f5af19;
      color: #f5af19;
      transform: scale(1.08);
      box-shadow: 0 0 16px rgba(245, 175, 25, 0.3);
    }

    .seat:disabled {
      cursor: not-allowed;
    }

    .seat-number {
      pointer-events: none;
    }

    .empty {
      text-align: center;
      padding: 3rem 1rem;
      color: #555;
    }

    .empty p {
      margin: 0.25rem 0;
    }

    .reservation-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 1rem 1.25rem;
      background: rgba(245, 175, 25, 0.08);
      border: 1px solid rgba(245, 175, 25, 0.15);
      border-radius: 12px;
      margin-bottom: 1.5rem;
      font-size: 0.95rem;
      animation: slideDown 0.3s ease;
    }

    .reservation-bar strong {
      color: #f5af19;
    }

    .simulator {
      margin-bottom: 1.5rem;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 12px;
      overflow: hidden;
    }

    .simulator-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.25rem;
      cursor: pointer;
      user-select: none;
      transition: background 0.2s;
    }

    .simulator-header:hover {
      background: rgba(255, 255, 255, 0.03);
    }

    .simulator-title {
      font-weight: 600;
      font-size: 0.95rem;
      color: #f5af19;
    }

    .simulator-toggle {
      color: #666;
      font-size: 0.8rem;
    }

    .simulator-body {
      padding: 0 1.25rem 1.25rem;
      animation: slideDown 0.3s ease;
    }

    .simulator-controls {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .range {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 6px;
      border-radius: 3px;
      background: rgba(255, 255, 255, 0.1);
      outline: none;
    }

    .range::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #f5af19;
      cursor: pointer;
      border: 2px solid #0a0a0f;
    }

    .range-labels {
      display: flex;
      justify-content: space-between;
      font-size: 0.7rem;
      color: #555;
    }

    .simulator-stats {
      display: flex;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }

    .stat {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 0.75rem;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.03);
    }

    .stat-value {
      font-size: 1.5rem;
      font-weight: 700;
    }

    .stat-label {
      font-size: 0.7rem;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .stat-success .stat-value { color: #81c784; }
    .stat-fail .stat-value { color: #ef9a9a; }
    .stat-total .stat-value { color: #e8e8e8; }

    .simulator-results {
      max-height: 300px;
      overflow-y: auto;
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 8px;
    }

    .simulator-results::-webkit-scrollbar {
      width: 6px;
    }

    .simulator-results::-webkit-scrollbar-track {
      background: transparent;
    }

    .simulator-results::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 3px;
    }

    .result-header {
      display: flex;
      justify-content: space-between;
      padding: 0.5rem 0.75rem;
      font-size: 0.7rem;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      position: sticky;
      top: 0;
      background: #0a0a0f;
    }

    .result-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem 0.75rem;
      font-size: 0.85rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.03);
      animation: slideDown 0.2s ease;
    }

    .result-row:last-child {
      border-bottom: none;
    }

    .result-success {
      background: rgba(76, 175, 80, 0.05);
    }

    .result-fail {
      background: rgba(244, 67, 54, 0.05);
    }

    .result-user {
      font-weight: 600;
      color: #ccc;
    }

    .result-msg {
      color: #888;
      font-size: 0.8rem;
      text-align: right;
      max-width: 60%;
    }

    .result-success .result-msg {
      color: #81c784;
    }

    .result-fail .result-msg {
      color: #ef9a9a;
    }

    .footer {
      display: flex;
      justify-content: center;
    }

    .legend {
      display: flex;
      gap: 1.5rem;
      padding: 0.75rem 1.5rem;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 8px;
      flex-wrap: wrap;
      justify-content: center;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.8rem;
      color: #888;
    }

    .legend-seat {
      width: 1rem;
      height: 1rem;
      border-radius: 3px;
      display: inline-block;
    }

    .legend-seat.available {
      background: rgba(76, 175, 80, 0.3);
      border: 1px solid rgba(76, 175, 80, 0.4);
    }

    .legend-seat.selected-legend {
      background: rgba(245, 175, 25, 0.3);
      border: 2px solid #f5af19;
    }

    .legend-seat.occupied {
      background: rgba(244, 67, 54, 0.3);
      border: 1px solid rgba(244, 67, 54, 0.4);
    }

    @media (max-width: 600px) {
      .cinema { padding: 1rem 0.75rem; }
      .seat { width: 2rem; height: 2rem; font-size: 0.65rem; }
      .btn-group { }
      .simulator-stats { flex-direction: column; }
      .result-row { flex-direction: column; align-items: flex-start; gap: 0.25rem; }
      .result-msg { text-align: left; max-width: 100%; }
    }
  `]
})
export class App implements OnDestroy {
  private readonly reservaService = inject(ReservaService);
  private refreshSubscription: Subscription | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  readonly email = signal('');
  readonly asientos = signal<Asiento[]>([]);
  readonly seleccionado = signal<Asiento | null>(null);
  readonly loading = signal(false);
  readonly mensaje = signal<{ texto: string; error: boolean } | null>(null);

  readonly autoRefresh = signal(false);
  readonly simulatorOpen = signal(false);

  readonly simSeatCode = signal('H-12');
  readonly simCount = signal(10);
  readonly simPrefix = signal('usuario');
  readonly simulando = signal(false);
  readonly resultados = signal<ResultadoSimulacion[]>([]);

  readonly resultadosExitosos = computed(() => this.resultados().filter(r => r.exito).length);
  readonly resultadosFallidos = computed(() => this.resultados().filter(r => !r.exito).length);

  readonly filas = computed(() => {
    const agrupados = new Map<string, Asiento[]>();
    for (const a of this.asientos()) {
      const letra = a.codigoAsiento.split('-')[0] || '?';
      if (!agrupados.has(letra)) agrupados.set(letra, []);
      agrupados.get(letra)!.push(a);
    }
    return Array.from(agrupados.entries())
      .map(([letra, asientos]) => ({
        letra,
        asientos: asientos.sort((a, b) => {
          const na = parseInt(a.codigoAsiento.split('-')[1], 10);
          const nb = parseInt(b.codigoAsiento.split('-')[1], 10);
          return na - nb;
        }),
      }))
      .sort((a, b) => a.letra.localeCompare(b.letra));
  });

  constructor() {
    this.cargarAsientos();

    effect(() => {
      if (this.autoRefresh()) {
        this.refreshSubscription?.unsubscribe();
        this.refreshSubscription = interval(3000).pipe(
          switchMap(() => this.reservaService.listarAsientos())
        ).subscribe(data => {
          this.asientos.set(data);
        });
      } else {
        this.refreshSubscription?.unsubscribe();
        this.refreshSubscription = null;
      }
    });
  }

  ngOnDestroy(): void {
    this.refreshSubscription?.unsubscribe();
    this.limpiarToast();
  }

  private mostrarToast(texto: string, error: boolean): void {
    this.limpiarToast();
    this.mensaje.set({ texto, error });
    this.toastTimer = setTimeout(() => this.mensaje.set(null), 4000);
  }

  private limpiarToast(): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
  }

  actualizarSimCount(event: Event): void {
    this.simCount.set(Number((event.target as HTMLInputElement).value));
  }

  cargarAsientos(): void {
    this.loading.set(true);
    this.mensaje.set(null);
    this.reservaService.listarAsientos().subscribe({
      next: (data) => {
        this.asientos.set(data);
        this.seleccionado.set(null);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.mostrarToast('Error al conectar con el servidor. Asegúrate de que el backend esté corriendo en el puerto 8081.', true);
      },
    });
  }

  inicializar(): void {
    this.loading.set(true);
    this.mensaje.set(null);
    this.reservaService.inicializarSala().subscribe({
      next: (msg) => {
        this.mostrarToast(msg, false);
        this.cargarAsientos();
      },
      error: () => {
        this.loading.set(false);
        this.mostrarToast('Error al inicializar la sala.', true);
      },
    });
  }

  seleccionarAsiento(asiento: Asiento): void {
    if (asiento.ocupado) return;
    this.seleccionado.set(
      this.seleccionado()?.codigoAsiento === asiento.codigoAsiento ? null : asiento
    );
  }

  reservar(): void {
    const asiento = this.seleccionado();
    const emailVal = this.email().trim();
    if (!asiento || !emailVal) return;

    this.loading.set(true);
    this.mensaje.set(null);

    this.reservaService.reservar({
      codigoAsiento: asiento.codigoAsiento,
      usuarioEmail: emailVal,
    }).subscribe({
      next: (msg) => {
        this.loading.set(false);
        this.mostrarToast(msg, false);
        this.seleccionado.set(null);
        this.cargarAsientos();
      },
      error: (err) => {
        this.loading.set(false);
        const texto = typeof err.error === 'string' ? err.error : 'Error al realizar la reserva.';
        this.mostrarToast(texto, true);
        this.seleccionado.set(null);
        this.cargarAsientos();
      },
    });
  }

  simularConcurrencia(): void {
    const seatCode = this.simSeatCode().trim();
    const count = this.simCount();
    const prefix = this.simPrefix().trim() || 'usuario';
    if (!seatCode || count < 2) return;

    this.simulando.set(true);
    this.resultados.set([]);
    this.mensaje.set(null);

    const requests = [];
    for (let i = 1; i <= count; i++) {
      const email = `${prefix}${i}@test.com`;
      requests.push(
        this.reservaService.reservar({ codigoAsiento: seatCode, usuarioEmail: email }).pipe(
          catchError((err) => {
            const msg = typeof err.error === 'string' ? err.error : 'Error de conexión';
            return of({ error: true, mensaje: msg, usuario: email });
          }),
        )
      );
    }

    forkJoin(requests).pipe(
      finalize(() => {
        this.simulando.set(false);
        this.cargarAsientos();
      })
    ).subscribe((responses: any[]) => {
      const res: ResultadoSimulacion[] = responses.map((r, i) => {
        const email = `${prefix}${i + 1}@test.com`;
        if (r.error) {
          return { usuario: email, asiento: seatCode, exito: false, mensaje: r.mensaje };
        }
        return { usuario: email, asiento: seatCode, exito: true, mensaje: typeof r === 'string' ? r : 'Reserva exitosa' };
      });
      this.resultados.set(res);
    });
  }
}
