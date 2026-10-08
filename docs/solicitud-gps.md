# Acceso a posiciones reales de autobús y metro

Estado comprobado el 8 de octubre de 2026. La aplicación conserva las previsiones oficiales de llegada, pero solo representa vehículos cuando recibe coordenadas publicadas. No convierte tiempos de llegada ni horarios en posiciones.

## AMB / Nitbus

El [catálogo AMB de GTFS-RT](https://www.amb.cat/es/web/area-metropolitana/dades-obertes/cataleg/detall/-/dataset/servicio-gtfs-real-time-autobuses/6332347/11692) describe Trip Updates. El recurso utilizado no ha incluido posiciones en las comprobaciones. El [catálogo SOAP con solicitud de acceso](https://www.amb.cat/es/web/area-metropolitana/dades-obertes/cataleg/detall/-/dataset/informacion-de-companias--lineas-y-recorridos-del-municipio-seleccionado/1027679/11692) describe compañías y recorridos; su autorización no garantiza GPS. Si el enlace antiguo de solicitud no muestra el formulario, utilizar el [contacto oficial de AMB](https://www.amb.cat/es/web/amb/seu-electronica/suggeriments-i-queixes) para pedir que la consulta se derive a AMB Informació i Serveis / datos de movilidad.

Texto preparado para la consulta, pendiente de envío por el titular del proyecto:

**Asunto:** Acceso a posiciones GPS de autobuses para EnRuta

Desarrollo EnRuta, una aplicación de transporte público: https://alejandropico.github.io/TMB/ (código: https://github.com/AlejandroPico/TMB). Ya utilizamos el GTFS estático y las previsiones del GTFS-RT de AMB. Queremos mostrar posiciones reales de los autobuses metropolitanos y de toda la red Nitbus, sin deducirlas de horarios o tiempos de llegada.

¿Existe un servicio reutilizable de posiciones SAE/GPS, GTFS-RT VehiclePositions, SIRI VehicleMonitoring o equivalente? Necesitamos coordenadas, instante de medición, identificador del vehículo y correspondencia con línea, sentido y viaje del GTFS. Solicitamos documentación, cobertura de operadores, frecuencia de actualización, condiciones de reutilización, límites y procedimiento de acceso. Como ejemplo de validación, la N0 (línea AMB 216) y Marina - Monumental, códigos 3262 y 3231, en ambos sentidos; la integración debe cubrir todas las líneas disponibles.

Si no se publica esta información, agradeceríamos confirmación expresa y el contacto competente para solicitarla, incluidos los operadores de Nitbus.

## TMB: autobuses y metro

Consultar primero el canal de soporte disponible en la cuenta del [portal de desarrolladores de TMB](https://developer.tmb.cat/). La cuenta existente ya habilita iBus; no se presupone que una segunda cuenta habilite nuevos servicios. La [especificación iBus](https://developer.tmb.cat/assets/api-docs/v1/ibus/swagger.json) documenta llegadas por parada e identificadores de autobús, pero no coordenadas de vehículos.

Texto breve para la consulta:

**Asunto:** EnRuta: acceso a posiciones GPS y llegadas de metro

Desarrollo EnRuta (https://alejandropico.github.io/TMB/), código público https://github.com/AlejandroPico/TMB. Tenemos app_id/app_key y utilizamos iBus. Queremos mostrar posiciones reales de autobuses y metro, sin interpolar horarios. El contrato público de iBus ofrece llegadas e id_bus, pero no coordenadas. ¿Existe una API autorizable de posiciones SAE/GPS y otra de llegadas de metro? Necesitamos coordenadas, instante de medición, identificador de vehículo/convoy y relación con línea, sentido y viaje. ¿Podéis facilitar documentación, cobertura, frecuencia, límites, condiciones de reutilización y procedimiento de acceso, o confirmar que no están disponibles para terceros?

## Información necesaria para conectar una nueva fuente

- URL y contrato de respuesta, con una muestra sin credenciales.
- Operadores y líneas cubiertos; el GPS de TMB no cubriría automáticamente los autobuses de otros operadores.
- Coordenadas y su sistema de referencia; instante real de medición, distinto de la hora de consulta.
- Identificador del vehículo y relación con línea, sentido y viaje.
- Frecuencia, antigüedad máxima esperada y límites de consultas.
- Autorización de reutilización y forma de guardar credenciales en el servidor.

Una respuesta con previsiones de llegada o última parada no basta para localizar el vehículo entre paradas. Una respuesta que confirme un acceso con coordenadas permitirá implementar y verificar el adaptador. No hay una integración de posiciones de bus Barcelona pendiente de activar con un simple interruptor.
