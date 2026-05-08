package com.Josecode.SistemdeGestiondeReservasconConcurrencia.controller;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
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
        Asiento a1 = new Asiento("H-11", 502L, false, null, null);
        Asiento a2 = new Asiento("H-12", 502L, false, null, null); // Nuestro asiento de prueba
        Asiento a3 = new Asiento("H-13", 502L, false, null, null);

        // Al guardar entidades nuevas sin versión, JPA les asigna version: 0 por
        // defecto
        repository.saveAll(List.of(a1, a2, a3));

        return "Sala inicializada con éxito. Asientos listos con versión 0.";
    }

    @GetMapping("/asientos")
    public List<Asiento> listarAsientos() {
        return repository.findAll();
    }

}
