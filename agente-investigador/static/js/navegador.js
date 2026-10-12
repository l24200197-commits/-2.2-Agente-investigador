// Versión para GitHub Pages: hace en el navegador lo mismo que app.py,
// llamando directo a la API de OpenAI con la API Key del visitante.
// Emite los mismos eventos que el servidor Flask (estado, fuente, texto,
// completado, fuera_de_tema, error) para reutilizar toda la interfaz.

const MODELO_NAVEGADOR = "gpt-6-luna";
const URL_OPENAI = "https://api.openai.com/v1/responses";

let promptsCargados = null;


async function cargarPrompts() {
    if (!promptsCargados) {
        const respuesta = await fetch("static/prompts.json");

        if (!respuesta.ok) {
            throw new Error(
                "No se pudieron cargar las instrucciones del agente."
            );
        }

        promptsCargados = await respuesta.json();
    }

    return promptsCargados;
}


function llamarOpenAI(apiKey, cuerpo) {
    return fetch(
        URL_OPENAI,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: MODELO_NAVEGADOR,
                ...cuerpo
            })
        }
    );
}


async function mensajeErrorOpenAI(respuesta) {
    try {
        const datos = await respuesta.json();
        return datos.error?.message || `Error ${respuesta.status}`;
    } catch {
        return `Error ${respuesta.status}`;
    }
}


function textoDeSalida(respuesta) {
    return (respuesta.output || [])
        .filter(item => item.type === "message")
        .flatMap(item => item.content || [])
        .filter(parte => parte.type === "output_text")
        .map(parte => parte.text)
        .join("");
}


async function esPreguntaTicNavegador(pregunta, apiKey, prompts) {
    try {
        const respuesta = await llamarOpenAI(
            apiKey,
            {
                input: [
                    { role: "system", content: prompts.clasificador },
                    { role: "user", content: pregunta }
                ]
            }
        );

        if (!respuesta.ok) {
            throw new Error(await mensajeErrorOpenAI(respuesta));
        }

        const texto = textoDeSalida(await respuesta.json());

        return !texto.trim().toUpperCase().startsWith("NO");

    } catch (err) {
        // Igual que en app.py: si el clasificador falla, se deja continuar
        console.error("ERROR CLASIFICADOR:", err);
        return true;
    }
}


function fuentesDesdeAccion(accion, urlsEmitidas) {
    if (!accion) {
        return [];
    }

    const nuevasFuentes = [];

    if (accion.url && !urlsEmitidas.has(accion.url)) {
        urlsEmitidas.add(accion.url);

        nuevasFuentes.push({
            titulo: accion.url,
            url: accion.url,
            origen: accion.type || "web_search"
        });
    }

    for (const source of accion.sources || []) {
        if (source.url && !urlsEmitidas.has(source.url)) {
            urlsEmitidas.add(source.url);

            nuevasFuentes.push({
                titulo: source.url,
                url: source.url,
                origen: "search"
            });
        }
    }

    return nuevasFuentes;
}


async function investigarEnNavegador(pregunta, apiKey, emitir) {
    const urlsEmitidas = new Set();
    const reporteAcumulado = [];

    emitir("estado", {
        etapa: "analizando",
        mensaje: "Analizando la pregunta de investigación..."
    });

    const prompts = await cargarPrompts();

    if (!await esPreguntaTicNavegador(pregunta, apiKey, prompts)) {
        emitir("fuera_de_tema", {
            mensaje: prompts.mensaje_fuera_de_tema
        });
        return;
    }

    const respuesta = await llamarOpenAI(
        apiKey,
        {
            tools: [
                {
                    type: "web_search",
                    search_context_size: "medium"
                }
            ],
            input: [
                { role: "system", content: prompts.investigador },
                { role: "user", content: pregunta }
            ],
            stream: true
        }
    );

    if (!respuesta.ok) {
        emitir("error", {
            mensaje: "OpenAI rechazó la solicitud.",
            detalle: await mensajeErrorOpenAI(respuesta)
        });
        return;
    }

    const reader = respuesta.body.getReader();
    const decoder = new TextDecoder("utf-8");

    let buffer = "";

    const procesarBloque = bloque => {
        const data = bloque
            .split("\n")
            .filter(linea => linea.startsWith("data:"))
            .map(linea => linea.substring(5).trim())
            .join("");

        if (!data || data === "[DONE]") {
            return;
        }

        let evento;

        try {
            evento = JSON.parse(data);
        } catch {
            return;
        }

        manejarEventoOpenAI(evento);
    };

    const manejarEventoOpenAI = evento => {
        const tipo = evento.type || "";

        if (tipo === "response.web_search_call.in_progress") {
            emitir("estado", {
                etapa: "busqueda",
                mensaje: "Iniciando una búsqueda en Internet..."
            });

        } else if (tipo === "response.web_search_call.searching") {
            emitir("estado", {
                etapa: "busqueda",
                mensaje: "Buscando, contrastando y consultando fuentes..."
            });

        } else if (tipo === "response.web_search_call.completed") {
            emitir("estado", {
                etapa: "revision",
                mensaje: "Búsqueda completada. Revisando la información encontrada..."
            });

        } else if (tipo === "response.output_item.done") {
            if (evento.item?.type === "web_search_call") {
                for (const fuente of fuentesDesdeAccion(
                    evento.item.action,
                    urlsEmitidas
                )) {
                    emitir("fuente", fuente);
                }
            }

        } else if (tipo === "response.output_text.annotation.added") {
            const anotacion = evento.annotation;

            if (
                anotacion?.type === "url_citation" &&
                anotacion.url &&
                !urlsEmitidas.has(anotacion.url)
            ) {
                urlsEmitidas.add(anotacion.url);

                emitir("fuente", {
                    titulo: anotacion.title || anotacion.url,
                    url: anotacion.url,
                    origen: "cita"
                });
            }

        } else if (tipo === "response.output_text.delta") {
            if (evento.delta) {
                reporteAcumulado.push(evento.delta);
                emitir("texto", { delta: evento.delta });
            }

        } else if (tipo === "response.output_text.done") {
            emitir("estado", {
                etapa: "finalizando",
                mensaje: "Sintetizando y organizando el reporte final..."
            });

        } else if (tipo === "response.completed") {
            emitir("completado", {
                mensaje: "Investigación completada.",
                reporte: reporteAcumulado.join(""),
                total_fuentes: urlsEmitidas.size
            });

        } else if (tipo === "error" || tipo === "response.failed") {
            emitir("error", {
                mensaje: evento.message ||
                    evento.response?.error?.message ||
                    "OpenAI devolvió un error durante la investigación."
            });
        }
    };

    while (true) {
        const { value, done } = await reader.read();

        if (done) {
            break;
        }

        buffer += decoder.decode(value, { stream: true });

        const bloques = buffer.split("\n\n");
        buffer = bloques.pop();

        bloques.forEach(procesarBloque);
    }

    if (buffer.trim()) {
        procesarBloque(buffer);
    }
}
