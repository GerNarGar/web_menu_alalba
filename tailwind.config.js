/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./docs/**/*.{html,js}"],
  theme: {
    extend: {
      colors: {
        tema: {
          fondo: 'var(--color-fondo-principal)',
          tarjeta: 'var(--color-fondo-tarjeta)',
          texto: 'var(--color-texto-principal)',
          suave: 'var(--color-texto-suave)',
          acento: 'var(--color-acento)',
          alerta: 'var(--color-notificacion)',
          add: 'var(--color-fondo-add)'
        }
      },
      borderColor: {
        tema: 'var(--color-borde)'
      },
      borderRadius: {
        tarjeta: 'var(--redondeo-grande)',
        pildora: '9999px',
      },
      backdropBlur: {
        cristal: 'var(--efecto-cristal)',
      }
    },
  },
  plugins: [],
};