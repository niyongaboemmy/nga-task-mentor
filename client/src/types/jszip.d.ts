// Type shim for jszip until the package is installed via npm
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare module "jszip" {
  interface JSZipObject {
    dir: boolean;
    name: string;
    async(type: "string"): Promise<string>;
    async(type: "uint8array"): Promise<Uint8Array>;
    async(type: "arraybuffer"): Promise<ArrayBuffer>;
    async(type: "blob"): Promise<Blob>;
  }

  interface JSZip {
    files: Record<string, JSZipObject>;
    loadAsync(
      data: File | Blob | ArrayBuffer | Uint8Array | string,
    ): Promise<JSZip>;
  }

  const JSZip: {
    new (): JSZip;
    loadAsync(
      data: File | Blob | ArrayBuffer | Uint8Array | string,
    ): Promise<JSZip>;
  };

  export default JSZip;
}
