# Agente Investigador V4

Cambios principales:

- Se corrigió el parser de Hallazgos principales.
- El nombre ya no mezcla descripción, fuente ni URL.
- Cada hallazgo se muestra como una tarjeta independiente.
- La descripción se presenta en un bloque de lectura.
- La fuente aparece en un panel separado.
- La URL larga se reemplaza visualmente por:
  - nombre de fuente,
  - dominio,
  - botón "Abrir fuente".
- El prompt obliga al modelo a separar:
  - Nombre
  - Descripción
  - Fuente
  - URL
- Mantiene:
  - streaming,
  - fuentes en vivo,
  - tabla comparativa,
  - plan visual,
  - reporte estructurado.

## Estructura

```
agente-investigador/
├── .venv/               # entorno virtual (no se versiona)
├── app.py               # servidor Flask y endpoint /api/investigar
├── config.py            # API key y modelo (no se versiona)
├── config.example.py    # plantilla de config.py
├── requirements.txt
├── templates/
│   └── index.html
└── static/
    ├── css/styles.css
    ├── js/app.js
    └── img/
```

## Ejecutar

macOS / Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Windows (PowerShell):

```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Antes, copia `config.example.py` a `config.py` y escribe tu API Key.

## Publicar en GitHub Pages

GitHub Pages no ejecuta Python, así que la versión publicada funciona
completamente en el navegador (`static/js/navegador.js`): llama directo a
OpenAI y cada visitante escribe su propia API Key en la página.

- El flujo `.github/workflows/pages.yml` publica el sitio en cada `git push` a `main`.
- Una sola vez: en GitHub, **Settings → Pages → Source: GitHub Actions**.
- Los prompts están en `static/prompts.json` y los usan las dos versiones
  (Flask y GitHub Pages).
- El modelo de la versión publicada se cambia en `MODELO_NAVEGADOR`
  (`static/js/navegador.js`).

## V5 - Corrección de alineación

- Se eliminó el scroll horizontal general de la página.
- Todas las secciones del reporte usan el mismo ancho.
- El plan de investigación responde al tamaño de pantalla.
- La tabla comparativa hace scroll únicamente dentro de su tarjeta.
- Se añadieron reglas para textos y URLs largas.
- Coincidencias, tendencias, hallazgos y fuentes ya no desbordan el contenedor.
