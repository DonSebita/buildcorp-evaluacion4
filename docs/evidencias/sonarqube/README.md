# Evidencias SonarQube

| Archivo | Contenido |
|---|---|
| `E16_sonarqube_antes_resumen.png` | Resumen del proyecto (primera corrida, 2026-11-25) |
| `E16_sonarqube_antes_seguridad.png` | Issues filtrados por Security |
| `medidas_antes.json` | Métricas (bugs, vulnerabilidades, notas, LOC) |
| `issues_antes.json` | Todos los issues, con archivo y línea |
| `quality_gate_antes.json` | Estado del Quality Gate |
| `hotspots_antes.json` | Security hotspots (0) |

Nota: esta corrida se hizo en el contenedor de la IA sobre el código del momento,
antes de existir `frontend/src`, con `-Dsonar.sources=apps,buildcorp,static/js,templates`.
Para la defensa conviene repetirla en tu equipo (instrucciones en
`docs/INFORME_SAST_DAST.md`), así tienes SonarQube abierto para mostrarlo en vivo.
Guarda la corrida posterior a las correcciones como `E17_sonarqube_despues_*.png`.
