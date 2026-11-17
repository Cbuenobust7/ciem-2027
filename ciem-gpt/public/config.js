/* CIEM GPT — configuración de ejecución. Sin secretos: la API key vive en el servidor. */
window.CIEM_CONFIG = {
  chat: {
    endpoint: '/api/ciem-gpt',
    quota: '/api/ciem-gpt/quota',
  },
  quota: {
    limit: 500,
    contactUrl: 'https://ciem.pe',
    message: 'Se quedó sin tokens, consulte a CIEM para comprar más.',
  },
  ui: {
    maxTokens: 1024,
    greeting: 'Habla causita!',
  },
};
