module.exports = function replaceLegacyPixRoute({ types: t }) {
  return {
    name: 'replace-legacy-pix-request-route',
    visitor: {
      StringLiteral(path) {
        if (path.node.value === '/withdrawal/pix-request') {
          path.replaceWith(t.stringLiteral('/payment/pix/redemption'));
        }
      },
    },
  };
};
