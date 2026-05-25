/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FREESOUND_API_KEY: string;
  readonly VITE_FREESOUND_API_BASE: string;
  readonly VITE_MAX_FILE_SIZE: string;
  readonly VITE_SUPPORTED_FORMATS: string;
  readonly VITE_BACKEND_API_BASE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'essentia.js/dist/essentia-wasm.es.js' {
  export const EssentiaWASM: unknown;
}

declare module 'essentia.js/dist/essentia.js-core.es.js' {
  const Essentia: unknown;
  export default Essentia;
}