import htm from 'https://unpkg.com/htm?module';

// Bind htm to React's element builder
export const html = htm.bind(window.React.createElement);
export default html;
