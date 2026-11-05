/**
 * Maya Web Actions 10: preparation of a user-reviewed web form only.
 * The browser agent is separate; this helper never transmits personal data.
 */
export type MayaWebFormStage = 'draft' | 'awaiting_review' | 'blocked';

export type MayaWebFormField = {
  id: string;
  label: string;
  type: 'text' | 'email' | 'number' | 'date' | 'selection';
  value: string;
  required: boolean;
};

export type MayaWebFormReview = {
  stage: 'awaiting_review';
  targetUrl: string;
  organization: string;
  purpose: string;
  fields: MayaWebFormField[];
  warnings: string[];
  submitted: false;
};

const SECRETS = /(?:passw(?:ord)?|senha|c(?:o|ó)digo\s*(?:sms|de\s*verifica[cç][aã]o)|otp|cvv|cvc|pin|token\s*de\s*acesso)/i;

export function prepareWebFormReview(input: {
  targetUrl: string;
  organization: string;
  purpose: string;
  fields: MayaWebFormField[];
}): MayaWebFormReview {
  const url = new URL(input.targetUrl);
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || !host.includes('.') ||
      host === 'localhost' || host.endsWith('.local') || /^\d+(?:\.\d+){3}$/.test(host) || host.includes(':')) {
    throw new Error('Use um endereço HTTPS público e verificável.');
  }
  const organization = input.organization.trim();
  const purpose = input.purpose.trim();
  if (organization.length < 2 || organization.length > 120 || purpose.length < 5 || purpose.length > 400) {
    throw new Error('Informe a instituição e a finalidade do formulário.');
  }
  if (!input.fields.length || input.fields.length > 50) {
    throw new Error('O formulário deve ter entre 1 e 50 campos.');
  }
  const ids = new Set<string>();
  const fields = input.fields.map(field => {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(field.id) || ids.has(field.id)) {
      throw new Error('Identificação de campo inválida ou repetida.');
    }
    ids.add(field.id);
    if (!field.label.trim() || field.label.length > 100 || field.value.length > 5000) {
      throw new Error('Campo muito longo ou sem identificação.');
    }
    if (SECRETS.test(field.id) || SECRETS.test(field.label)) {
      throw new Error('Senhas, códigos temporários e dados de cartão devem ser informados diretamente no site.');
    }
    return { ...field, label: field.label.trim() };
  });
  return {
    stage: 'awaiting_review',
    targetUrl: url.toString(),
    organization,
    purpose,
    fields,
    warnings: [
      'Revise o endereço da instituição e todos os dados antes de enviar.',
      'Esta etapa não envia o formulário e não cria inscrições.',
      'Autenticação, CAPTCHA, assinatura e verificação em duas etapas ficam com você.',
    ],
    submitted: false,
  };
}
