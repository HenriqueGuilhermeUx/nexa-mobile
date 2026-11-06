/**
 * Onda 04. Prepara uma mensagem que só é compartilhada quando o usuário toca
 * em "Compartilhar". Não usa backend, contatos, e-mail ou automação de envio.
 */
export type MayaCommunicationKind = 'message' | 'email' | 'request';
export type MayaCommunicationDraft = {
  kind: MayaCommunicationKind;
  subject: string;
  body: string;
  shareText: string;
  reviewed: false;
  sent: false;
};

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function createMayaCommunicationDraft(input: {
  kind: MayaCommunicationKind;
  subject?: string;
  body: string;
}): MayaCommunicationDraft {
  const kind = input.kind;
  if (!['message', 'email', 'request'].includes(kind)) {
    throw new Error('Tipo de comunicação inválido.');
  }
  const body = String(input.body || '').replace(CONTROL, '').trim();
  const subject = String(input.subject || '').replace(CONTROL, '').trim();
  if (body.length < 5 || body.length > 3000) {
    throw new Error('Escreva uma mensagem de 5 a 3.000 caracteres.');
  }
  if (subject.length > 120 || (kind !== 'message' && subject.length < 3)) {
    throw new Error('Informe um assunto de 3 a 120 caracteres.');
  }
  return {
    kind,
    subject: kind === 'message' ? '' : subject,
    body,
    shareText: kind === 'message' ? body : `Assunto: ${subject}\n\n${body}`,
    reviewed: false,
    sent: false,
  };
}
