/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    // Aquí es donde Tailwind buscará las clases de utilidad
    // para generar el CSS final.
    // La configuración por defecto es bastante buena,
    // y cubre la mayoría de los casos de uso con Next.js.
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    // Puedes extender el tema por defecto de Tailwind aquí.
    // Por ejemplo, puedes añadir tus propios colores, fuentes,
    // espaciados, etc.
    extend: {},
  },
  plugins: [],
};
