package com.Josecode.SistemdeGestiondeReservasconConcurrencia.dto;

public class ReservaRequest {

    private String codigoAsiento;
    private String usuarioEmail;

    public ReservaRequest() {
    }

    public String getCodigoAsiento() {
        return codigoAsiento;
    }

    public void setCodigoAsiento(String codigoAsiento) {
        this.codigoAsiento = codigoAsiento;
    }

    public String getUsuarioEmail() {
        return usuarioEmail;
    }

    public void setUsuarioEmail(String usuarioEmail) {
        this.usuarioEmail = usuarioEmail;
    }
}
