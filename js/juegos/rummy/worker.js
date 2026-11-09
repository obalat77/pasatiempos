// Web Worker: la inteligencia de los rivales piensa aquí, sin bloquear la pantalla.
// Mensaje de entrada: los datos de decidir() (ver ia.js). Respuesta: { id, decision }.
import { decidir } from './ia.js';

self.addEventListener('message', (evento) => {
  const { id, datos } = evento.data;
  let decision;
  try {
    decision = decidir(datos);
  } catch (error) {
    console.error(error);
    decision = { tipo: 'robar' };
  }
  self.postMessage({ id, decision });
});
