/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_VALIDATOR_URL?: string
  readonly VITE_ENVIRONMENT?: string
  readonly VITE_NETWORK?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module "*.png" {
  const value: string;
  export default value;
}

declare module "*.jpg" {
  const value: string;
  export default value;
}

declare module "*.jpeg" {
  const value: string;
  export default value;
}

declare module "*.svg" {
  const value: string;
  export default value;
}

declare module "*.gif" {
  const value: string;
  export default value;
}

declare module "*.webp" {
  const value: string;
  export default value;
}