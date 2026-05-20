package com.Josecode.SistemdeGestiondeReservasconConcurrencia.controller;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.Josecode.SistemdeGestiondeReservasconConcurrencia.dto.ReservaRequest;
import com.Josecode.SistemdeGestiondeReservasconConcurrencia.entity.Asiento;
import com.Josecode.SistemdeGestiondeReservasconConcurrencia.repository.AcientoRepository;
import com.Josecode.SistemdeGestiondeReservasconConcurrencia.service.AcientoService;

@RestController
@RequestMapping("/api/reservas")
public class AcientoReservaController {

    private final AcientoService reservarAcientoService;

    @Autowired
    AcientoRepository repository;

    public AcientoReservaController(AcientoService reservarAcientoService) {
        this.reservarAcientoService = reservarAcientoService;
    }

    @PostMapping("/reservar")
    public ResponseEntity<String> reservarAciento(@RequestBody ReservaRequest request) {
        try {
            reservarAcientoService.ReservarAciento(request.getCodigoAsiento(), request.getUsuarioEmail());
            return ResponseEntity.ok("Reserva exitosa para: " + request.getUsuarioEmail() + " en el asiento: "
                    + request.getCodigoAsiento() + "!");
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/inicializar-sala")
    public String inicializarSala() {
        List<Asiento> asientos = new java.util.ArrayList<>();
        String[] filas = { "A", "B", "C", "D", "E", "F", "G", "H" };
        for (String fila : filas) {
            for (int num = 1; num <= 10; num++) {
                String codigo = fila + "-" + String.format("%02d", num);
                asientos.add(new Asiento(codigo, 502L, false, null, null));
            }
        }
        repository.saveAll(asientos);
        return "Sala inicializada con " + asientos.size() + " asientos para la función 502.";
    }

    @GetMapping("/asientos")
    public List<Asiento> listarAsientos() {
        return repository.findAll();
    }

    @GetMapping("/asientos/{funcionId}")
    public List<Asiento> listarAsientosPorFuncion(@PathVariable Long funcionId) {
        return repository.findByFuncionId(funcionId);
    }

}
