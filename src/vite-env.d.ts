/// <reference types="vite/client" />

declare module '*.yml' {
  const value: unknown
  export default value
}

declare module '*.yaml' {
  const value: unknown
  export default value
}
