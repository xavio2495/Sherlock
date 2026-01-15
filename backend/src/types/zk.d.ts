declare module 'snarkjs' {
  export namespace groth16 {
    function fullProve(
      input: any,
      wasmFile: Buffer | string,
      zkeyFile: Buffer | string
    ): Promise<{
      proof: any;
      publicSignals: any[];
    }>;

    function verify(
      vkey: any,
      publicSignals: any[],
      proof: any
    ): Promise<boolean>;

    function exportSolidityCallData(
      proof: any,
      publicSignals: any[]
    ): Promise<string>;

    function setup(
      r1cs: string,
      ptau: string,
      zkeyOut: string
    ): Promise<void>;
  }

  export namespace powersoftau {
    function verify(ptauFile: string): Promise<boolean>;
  }

  export namespace zkey {
    function contribute(
      zkeyIn: string,
      zkeyOut: string,
      name: string,
      entropy: string
    ): Promise<void>;

    function exportVerificationKey(
      zkeyFile: string
    ): Promise<any>;
  }

  export namespace r1cs {
    function info(r1csFile: string): Promise<any>;
  }
}

declare module 'circomlibjs' {
  export function buildPoseidon(): Promise<any>;
  export function buildBabyjub(): Promise<any>;
  export function buildEddsa(): Promise<any>;
  export function buildMimc7(): Promise<any>;
  export function buildMimcsponge(): Promise<any>;
}

declare module 'ffjavascript' {
  export namespace Scalar {
    function fromString(s: string, radix?: number): bigint;
    function toString(s: bigint, radix?: number): string;
    function e(s: string | number | bigint): bigint;
  }

  export function buildBn128(): Promise<any>;
  export function buildBls12381(): Promise<any>;
}
