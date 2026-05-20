package com.Josecode.SistemdeGestiondeReservasconConcurrencia.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "reservaAcientoCine")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Asiento {
    @Id
    private String codigoAsiento; // Ej: "H-12"
    private Long funcionId; //
    private boolean ocupado;
    private String usuarioEmail;

    @Version
    private Long version;

}
