package com.Josecode.SistemdeGestiondeReservasconConcurrencia.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.Josecode.SistemdeGestiondeReservasconConcurrencia.entity.Asiento;

@Repository
public interface AcientoRepository extends JpaRepository<Asiento, String> {

}
