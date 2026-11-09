// Cronómetro de partida: cuenta solo mientras se juega (se para en pausa y cuando
// la app pasa a segundo plano). Sin dependencias del DOM salvo `alPintar`.

export class Reloj {
  /**
   * @param {number} segundosIniciales  tiempo ya jugado (al reanudar)
   * @param {(segundos: number) => void} alPintar  se llama cada segundo mientras cuenta
   * @param {() => number} ahora  para las pruebas
   */
  constructor(segundosIniciales = 0, alPintar = () => {}, ahora = () => Date.now()) {
    this.base = segundosIniciales;
    this.desde = null;
    this.alPintar = alPintar;
    this.ahora = ahora;
    this.intervalo = null;
  }

  get corriendo() {
    return this.desde !== null;
  }

  segundos() {
    return this.base + (this.desde !== null ? (this.ahora() - this.desde) / 1000 : 0);
  }

  arrancar() {
    if (this.desde !== null) return;
    this.desde = this.ahora();
    this.intervalo = setInterval(() => this.alPintar(this.segundos()), 1000);
    this.alPintar(this.segundos());
  }

  parar() {
    if (this.desde === null) return;
    this.base = this.segundos();
    this.desde = null;
    clearInterval(this.intervalo);
    this.intervalo = null;
  }

  /** Para y redondea al segundo (para que el reloj y el tiempo final coincidan). */
  detenerFinal() {
    this.parar();
    this.base = Math.round(this.base);
    this.alPintar(this.base);
    return this.base;
  }
}
