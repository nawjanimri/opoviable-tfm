# OpoViable TFM

OpoViable ayuda a valorar cuánto tiempo de estudio puede dedicar una persona a preparar una oposición. El simulador calcula las horas efectivas y propone un ajuste según lo que se deba mantener: la dedicación semanal, el plazo o ambos. La explicación con IA presenta ese resultado en lenguaje natural.

La [demo de GitHub Pages](https://nawjanimri.github.io/opoviable-tfm/) muestra el simulador y su recomendación basada en reglas. El botón «Explícame mi resultado» está disponible cuando se ejecuta la aplicación con el servidor local.

## Arranque local con Groq

Necesitas Node.js, una conexión a internet y una [clave de Groq](https://console.groq.com/keys). El servidor utiliza los módulos incluidos en Node.js. Desde la carpeta del repositorio, en zsh (la shell predeterminada de macOS), ejecuta:

```zsh
read -rs 'GROQ_API_KEY?Clave de Groq: ' && {
  echo
  GROQ_API_KEY="$GROQ_API_KEY" node servidor-tfm.mjs
  unset GROQ_API_KEY
}
```

Pega la clave cuando se solicite. El servidor la lee de la variable de entorno. Abre [OpoViable en local](http://127.0.0.1:8000/) y deja Terminal en ejecución. Puedes detener el servidor con Ctrl+C.

## Repetición de las pruebas

Mantén los valores iniciales del simulador salvo las horas semanales y el plazo indicados. En cada caso selecciona la restricción y pulsa «Explícame mi resultado». Comprueba las cifras, las unidades, el límite elegido y el ajuste sugerido.

| Horas semanales | Plazo | Restricción | Ajuste esperado |
| --- | --- | --- | --- |
| 12 | 12 meses | Mi plazo de preparación | Unas 57 h semanales en total o un objetivo parcial si ese ritmo es inasumible. |
| 12 | 12 meses | Mis horas semanales | Ampliar a unos 57 meses en total, con la misma regularidad. |
| 12 | 12 meses | Mis horas semanales y mi plazo | Fijar un objetivo parcial dentro del plazo. |
| 20 | 36 meses | Mis horas semanales y mi plazo | Mantener el plan según la estimación y revisar el progreso. |

En los tres primeros casos se obtienen 468 horas efectivas frente a 2.200 de referencia. En el último se obtienen 2.340 frente a 2.200. Estas cifras son estimaciones de planificación. El texto de Groq puede variar entre solicitudes.
