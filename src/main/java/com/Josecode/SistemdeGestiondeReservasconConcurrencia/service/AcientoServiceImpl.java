package com.Josecode.SistemdeGestiondeReservasconConcurrencia.service;

import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import com.Josecode.SistemdeGestiondeReservasconConcurrencia.entity.Asiento;
import com.Josecode.SistemdeGestiondeReservasconConcurrencia.repository.AcientoRepository;
import jakarta.transaction.Transactional;
import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
public class AcientoServiceImpl implements AcientoService {
    public final AcientoRepository reservaDeAcientoRepository;

    public AcientoServiceImpl(AcientoRepository reservaDeAcientoRepository) {
        this.reservaDeAcientoRepository = reservaDeAcientoRepository;
    }

    @Override
    @Transactional
    public void ReservarAciento(String codgoAsiento, String usuarioEmail) {
        Asiento reserva = reservaDeAcientoRepository.findById(codgoAsiento)
                .orElseThrow(() -> new RuntimeException("Asiento no encontrado"));
        
        if (reserva.isOcupado()) {
            throw new RuntimeException("Asiento ya ocupado");
        }
        reserva.setOcupado(true);
        reserva.setUsuarioEmail(usuarioEmail);

        try {
            // 2. Cliente A intenta guardar su reserva con version = 0.
            // Spring detecta que la BD ya tiene version = 1 y frena la operación.
            reservaDeAcientoRepository.save(reserva);
            log.info("¡Reserva exitosa para: " + usuarioEmail + " en el asiento: " + codgoAsiento + "!");
        } catch (ObjectOptimisticLockingFailureException e) {
            // 3. Se captura el error para avisar al usuario frustrado
            throw new RuntimeException("Lo sentimos, el asiento fue ganado por otro usuario. Intenta con otra butaca.");
        }
    }

}
