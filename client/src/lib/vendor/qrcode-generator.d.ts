// Minimal typings for the vendored qrcode-generator (see qrcode-generator.js).
type Ecl = "L" | "M" | "Q" | "H";
interface QRCodeObject {
  addData(data: string): void;
  make(): void;
  getModuleCount(): number;
  isDark(row: number, col: number): boolean;
}
declare const qrcode: (typeNumber: number, errorCorrectionLevel: Ecl) => QRCodeObject;
export default qrcode;
