// Bounded Map: otomatis membuang entri tertua agar tidak tumbuh tanpa batas (anti memory leak)
class BoundedMap extends Map {
  constructor(max = 5000) {
    super();
    this.max = Math.max(1, max);
  }
  set(key, value) {
    if (this.size >= this.max && !this.has(key)) {
      super.delete(this.keys().next().value);
    }
    return super.set(key, value);
  }
}

module.exports = { BoundedMap };
