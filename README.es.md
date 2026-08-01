<p align="center">
  <img src="assets/git_banner.png" alt="Arcgram — human-led design, AI-accelerated execution" width="100%">
</p>

<p align="center">
  <a href="https://arcgram.io"><img src="https://img.shields.io/badge/website-arcgram.io-C69A4C" alt="Website"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache_2.0-6B4E3D" alt="License: Apache 2.0"></a>
  <a href="README.md"><img src="https://img.shields.io/badge/English-lightgrey" alt="English"></a>
  <a href="README.zh-CN.md"><img src="https://img.shields.io/badge/%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-lightgrey" alt="简体中文"></a>
  <img src="https://img.shields.io/badge/Espa%C3%B1ol-5A4632" alt="Español">
  <a href="README.fr.md"><img src="https://img.shields.io/badge/Fran%C3%A7ais-lightgrey" alt="Français"></a>
</p>

# Arcgram

**Arcgram convierte el plan de tu agente de IA en un diagrama que puedes revisar y corregir — antes de que nada se ejecute.**

<p align="center">
  <img src="assets/usage-workflow.svg" alt="El bucle de Arcgram — tu IA propone, dibuja, revisa su propio trabajo, tú señalas el error y ella lo corrige" width="900">
</p>

Tu agente de IA puede entregarte algo que parece correcto — un análisis, un flujo de trabajo, un plan, código — mientras esconde debajo un paso roto o una mala dependencia. Ni siquiera un desarrollador con experiencia puede detectar cada trampa en un muro de contexto, y la IA se inventa cosas sin pestañear, sin dejarte ver cómo razonó.

Arcgram es la herramienta con la que diriges a tu agente: convierte el razonamiento del agente en un diagrama que tú y el agente pueden leer, donde un paso que falta queda colgando en el vacío y una dependencia circular es un bucle infinito que detectas de un vistazo. Su chequeo Audit integrado marca luego los nodos que necesitan trabajo, para que corrijas justo la parte que importa.

Un único archivo de skill. Funciona en Claude, GPT y Gemini — y también en DeepSeek, Kimi (Moonshot) y Zhipu GLM — en herramientas como Cursor, Cline y Aider, hasta modelos locales de tamaño medio. El resultado es un solo archivo HTML sin dependencias: unos 290 KB, con desplazamiento / zoom / hover / filtro, se abre en cualquier navegador. Sin paso de compilación, sin npm, sin CDN, nada que ejecutar.

## Pruébalo en 30 segundos

**Demos en vivo** (GitHub Pages, sin instalar) — abre una y prueba desplazar / hacer zoom / pasar el cursor:

- **[Empieza aquí → el flujo de un sistema de juego](https://jovesun-lab.github.io/arcgram/examples/example.html)** — la demo canónica: tooltips al pasar el cursor, columnas, ruta crítica
- [Un diagrama de decisión](https://jovesun-lab.github.io/arcgram/examples/example-thinkflow.html) — rombos, caminos Sí/No, bucles de retroalimentación
- [Cómo usar Arcgram](https://jovesun-lab.github.io/arcgram/examples/usage-workflow.html) — el bucle central: tu agente propone → tú das feedback → corrige → confirmas
- [Se delata solo](https://jovesun-lab.github.io/arcgram/examples/example-audit.html) — se marca a sí mismo los nodos débiles: tu agente te da varias opciones y no sabes cuál es la mejor o la más mantenible, así que señala sus propios fallos en el diagrama

**Instalación** (Claude Code / Cowork):

```
/plugin marketplace add jovesun-lab/arcgram
/plugin install arcgram
```

Eso le da a tu agente la skill de autoría más tres autochequeos (Checkpoint / Reconcile / Validate). Después solo pídele: *"dibuja este plan como un Arcgram."*

**Obligatorio para agentes:** lee `SKILL.md`, copia `template-v2.html`, rellena el bloque de datos de arriba y entrega el archivo. No toques nada por debajo de `END OF DATA SECTION` — es el motor. Un solo archivo, nada más:

```
curl -O https://raw.githubusercontent.com/jovesun-lab/arcgram/main/template-v2.html
```

> No hagas `git clone` de todo el repositorio en CI ni en un flujo de agente — el único archivo de arriba es suficiente.

## Todo lo que hace, de un vistazo

Cada función agrupada por su propósito — léelo como una ficha de una página:

<p align="center">
  <img src="assets/feature-tree.svg" alt="Árbol de funciones de Arcgram — cada función agrupada por su propósito" width="900">
</p>

<sub>Sigue el [blog](https://arcgram.io/blog/) — de vez en cuando compartimos trucos prácticos y casos de uso.</sub>

## Mermaid frente a Arcgram

Tanto Mermaid como Arcgram se reducen a escribir una especificación que una máquina renderiza — la diferencia no está ahí, sino en **quién la escribe y para qué**: Mermaid es un diagrama que escribes a mano, para que lo lean personas; Arcgram es uno que tu agente escribe a partir de su propio plan, para que tú lo revises. Todo lo demás se deriva de eso:

| | Mermaid | Arcgram |
|---|---|---|
| Quién lo dibuja | tú, a mano | tu agente, a partir de su propio plan |
| Disposición | automática, cambia cada vez | posiciones fijas — cada nodo se queda quieto y se puede señalar |
| Huecos en el plan | se renderizan bien, quedan ocultos | aparecen como una línea rota que se ve |
| Revisa su propio trabajo | no | sí — tres autochequeos que el agente ejecuta antes de que tú veas nada |
| Para compartirlo | necesita un renderizador | un archivo HTML, se abre en cualquier parte |

Dos cosas que conviene saber antes de empezar:

- **Poder señalar un solo nodo es lo que importa.** Cada nodo tiene un nombre y un lugar fijos. Cuando el agente se equivoca, no escribes un párrafo describiendo "el punto en mitad del flujo, justo antes del cobro" — dices "el nodo 'comprobar inventario' tiene mal conectada la rama No", y se corrige en segundos.
- **La skill se afina con el uso.** Cada tropiezo que tenemos se convierte en una regla del archivo de skill. ¿Dos líneas se amontonan en un nodo y no sabes cuál es cuál? Esa lección entra, y el siguiente agente las separa solo. Cuanto más se usa, menos te hace repetir.

## Cómo funciona la autoría en realidad

**El agente escribe los datos. Tú los corriges.** Nunca se espera que coloques cajas a mano.

1. Tu agente lee la skill y escribe un pequeño bloque de datos — las cajas, las líneas entre ellas y una agrupación opcional — en una copia de `template-v2.html`.
2. Ejecuta los autochequeos y corrige lo que marcan.
3. Abres el archivo, echas un vistazo y señalas lo que esté mal — por su nombre, en lenguaje sencillo.
4. El agente edita los datos y vuelves a abrir. Listo.

¿No tienes un agente a mano? También puedes editar los datos a mano — abre `template-v2.html`, el formato está explicado justo encima de la línea `END OF DATA SECTION`. Todo lo que está por debajo es el motor; déjalo en paz. Detalles completos: [`schema.md`](schema.md) · guía para agentes: [`USAGE.md`](USAGE.md) · ayuda de disposición: [`layout-tips.md`](layout-tips.md)

## Qué incluye esta versión

| Archivo | Qué es |
|---|---|
| `template-v2.html` | El motor. Cópialo, deja que tu agente rellene los datos, entrega ese único archivo. |
| `examples/example.html` | **Empieza aquí.** Pequeño bucle de juego: filtro de grupos, columnas, tooltips, ruta crítica. |
| `examples/example-thinkflow.html` | Rombos de decisión, ramas Sí/No, bucles de retroalimentación. |
| `examples/example-workflow.html` | Un flujo de producción real, dispuesto de arriba abajo. |
| `examples/example-workflow-H.html` | El mismo flujo, de izquierda a derecha. |
| `examples/example-bands.html` | Disposición horizontal por "bandas" — léelo antes de usar bandas. |
| `examples/example-audit.html` | Modo auditoría: chinchetas rojas marcan problemas sin resolver, con nota al pasar el cursor. |
| `examples/example-harness.html` | Un diagrama del propio sistema de autochequeo. |
| `schema.md` | Referencia completa del formato de datos. |
| `USAGE.md` | Cómo manejar Arcgram desde agentes de IA. |
| `layout-tips.md` | Guía de disposición y colocación. |
| `themes/` | Los dos archivos CSS, se conservan para referencia y para hacer forks (el motor ya los incluye). |

## Novedades en v2

Disposiciones de izquierda a derecha (no solo de arriba abajo) · nodos de decisión para flujos if/then · haz clic en un nodo para abrir un diagrama anidado · clava una bandera roja en cualquier nodo para marcar un problema sin resolver · un filtro arriba a la izquierda que resalta un grupo a la vez · trazado de conexiones más limpio · temas integrados.

## Licencia y atribución

Apache License 2.0 — úsalo, modifícalo, ponlo en productos comerciales, distribúyelo. Consulta [`LICENSE`](LICENSE) y [`NOTICE`](NOTICE).

Cada diagrama lleva una pequeña marca "Made with Arcgram" (una insignia en la barra superior y una nota en la cabecera del archivo). Conservarla es gratis, y así funciona la atribución aquí (Apache §4(d)). Existe una versión sin marca bajo una licencia comercial aparte — consulta [`WATERMARK-AND-COMMERCIAL-TERMS.md`](WATERMARK-AND-COMMERCIAL-TERMS.md).

"Arcgram" y el logotipo son marcas registradas de Rae Sun. Puedes decir que tu trabajo está "made with Arcgram", pero no pongas el nombre ni el logotipo en tu propio producto.

Las versiones anteriores se distribuían bajo la licencia MIT; esa concesión sigue siendo válida para las copias ya recibidas. Apache 2.0 se aplica a partir de esta versión.
