import { MICRO, MILLI } from "./constants.js";

export const toMicro = (hrTime) => {
  return hrTime[0] * MICRO + Math.floor(hrTime[1] / MILLI);
};

export const intToBuf = (int) => {
  if (typeof int !== "number") {
    throw new Error("arg must be a number");
  }

  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(int);

  return buffer;
};

export const wait = (duration) =>
  new Promise((res) => setTimeout(res, duration));
