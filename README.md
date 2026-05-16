# Carrera-HTML — versión sin grupos

Aplicación estática para GitHub Pages. No usa backend.

URL base configurada:

```txt
https://JuanTamboleoMurciaeduca.github.io/Carrera-HTML/
```

## Archivos

- `index.html`: aplicación del alumnado.
- `style.css`: estilos.
- `script.js`: lógica del juego.
- `data.js`: ruta, pistas, ejercicios y hashes de QR.
- `qr-links.md`: lista de enlaces para generar QR con cualquier generador externo.

## Funcionamiento

Ya no hay código de grupo. El alumnado solo pulsa `Empezar` y comienza el cronómetro.

La ruta es única:

```txt
P01, P02, P03, P04, P05, P06, P07, P08
```

La antigua pista 12 ahora aparece como P08.

## Funcionamiento por estados

Un QR solo produce efecto si corresponde a la pista activa.

- QR correcto de la pista activa: suma puntos y abre el ejercicio.
- Señuelo de la pista activa: resta puntos.
- QR de otra pista: no suma ni resta; muestra aviso de que aún no toca.
- QR escaneado durante un ejercicio: no suma ni resta; deben resolver el ejercicio.

## Enlaces de QR

Los enlaces tienen este formato:

```txt
https://JuanTamboleoMurciaeduca.github.io/Carrera-HTML/index.html?t=TOKEN
```

Los tokens están en `qr-links.md`.

## Puntuación

- QR correcto: +10
- Señuelo de la pista activa: -3
- Ejercicio resuelto: +20
- Cada hueco incorrecto al comprobar: -2
- Bonus por rapidez del ejercicio: `max(0, 10 - floor(segundos / 30))`
- Penalización final por tiempo total: `floor(segundos_totales / 60)`

## Exportación

El botón `Exportar JSON` descarga un archivo con ruta, puntuación, tiempos, eventos, QR incorrectos y respuestas enviadas.
