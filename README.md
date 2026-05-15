# Carrera-HTML — versión con estados

Aplicación estática para GitHub Pages. No usa backend.

URL base configurada:

```txt
https://JuanTamboleoMurciaeduca.github.io/Carrera-HTML/
```

## Archivos

- `index.html`: aplicación del alumnado.
- `style.css`: estilos.
- `script.js`: lógica del juego.
- `data.js`: rutas, pistas, ejercicios y hashes de QR.
- `qr-links.md`: lista de enlaces para generar QR con cualquier generador externo.

No se incluye fichero CSV.

## Funcionamiento por estados

Cada grupo empieza en su primera pista. Un QR solo produce efecto si corresponde a la pista activa de ese grupo.

- QR correcto de la pista activa: suma puntos y abre el ejercicio.
- Señuelo de la pista activa: resta puntos.
- QR de otra pista: no suma ni resta; muestra aviso de que aún no toca.
- QR escaneado durante un ejercicio: no suma ni resta; deben resolver el ejercicio.

Así se evita que un grupo escanee la pista 3 antes de resolver la pista 1 y la 2.

## Código de profesor

Escribe este código en el mismo campo donde se introduce el grupo:

```txt
PROFE2026
```

No hay botón visible de profesor.

## Enlaces de QR

Los enlaces tienen este formato:

```txt
https://JuanTamboleoMurciaeduca.github.io/Carrera-HTML/index.html?t=TOKEN
```

Los tokens están en `qr-links.md`.

## Generar QR

Usa `qr-links.md` con cualquier generador de QR externo.

## Rutas

- G01: P01, P06, P11, P14
- G02: P02, P07, P12, P15
- G03: P03, P08, P13, P01
- G04: P04, P09, P14, P02
- G05: P05, P10, P15, P03

## Puntuación

- QR correcto: +10
- Señuelo de la pista activa: -3
- Ejercicio resuelto: +20
- Cada hueco incorrecto al comprobar: -2
- Bonus por rapidez del ejercicio: `max(0, 10 - floor(segundos / 30))`
- Penalización final por tiempo total: `floor(segundos_totales / 60)`


## Ejercicios

Cada ejercicio muestra ahora una sección llamada `Cómo debe quedar la página`.

Esa sección aclara:

- qué tipo de página o fragmento están construyendo;
- qué partes debe tener;
- qué etiquetas o selectores pueden aparecer;
- qué reglas siguen los huecos.

No indica la respuesta de cada hueco. Sirve como banco de orientación para evitar dudas de interpretación.

## Exportación

Cada grupo puede pulsar `Exportar JSON`. El archivo incluye grupo, ruta, puntuación, tiempos, eventos, QR incorrectos y respuestas enviadas.
