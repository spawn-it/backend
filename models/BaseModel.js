class BaseModel {
  static fromJSON(json) {
    return new this(json);
  }

  static fromString(str) {
    const obj = JSON.parse(str);
    return this.fromJSON(obj);
  }

  toJSON() {
    return { ...this };
  }

  toString() {
    return JSON.stringify(this.toJSON());
  }
}

module.exports = BaseModel;
