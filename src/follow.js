// Camera position is independent of zoom/bearing and stops with the detail.
export class VehicleFollow {
  constructor() {
    this.stop();
  }
  start(id) {
    this.id = id;
    this.enabled = true;
    this.last = null;
    this.padding = null;
  }
  stop() {
    this.id = null;
    this.enabled = false;
    this.last = null;
  }
  toggle() {
    this.enabled = !this.enabled;
    this.last = null;
    return this.enabled;
  }
  update(map, id, coordinates, padding) {
    if (!this.enabled || id !== this.id || !coordinates?.every(Number.isFinite))
      return false;
    const paddingKey = JSON.stringify(padding);
    const center = map.getCenter?.();
    const cameraCentered =
      !center ||
      coordinates.every(
        (v, i) => Math.abs(v - (i ? center.lat : center.lng)) < 0.0000001,
      );
    if (
      this.last?.every((v, i) => v === coordinates[i]) &&
      this.padding === paddingKey &&
      cameraCentered
    )
      return false;
    this.last = [...coordinates];
    this.padding = paddingKey;
    map.easeTo({
      center: coordinates,
      ...(padding ? { padding } : {}),
      duration: 800,
      easing: (t) => t,
      essential: true,
    });
    return true;
  }
}
