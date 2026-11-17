import { MAYA_AGENTICS_DISABLED, type MayaAgenticsReadiness } from './agenticsReadiness';
import type { MayaAgenticTask, MayaAgenticStatus } from './agenticsTaskContracts';

/**
 * User-visible Maya text for Agentics, deliberately separate from tools,
 * network and execution. The shipped Maya flows remain untouched.
 */
const taskLabels: Record<MayaAgenticStatus, string> = {
  draft: 'Rascunho preparado para revisão',
  awaiting_approval: 'Aguardando sua aprovação',
  queued: 'Aguardando processamento',
  running: 'Em andamento',
  completed: 'Concluído',
  failed: 'Não foi possível concluir',
  cancelled: 'Cancelado',
};
export type MayaAgenticsCustomerView = {
  title: string;
  detail: string;
  action: 'none' | 'review';
  canClaimExecution: boolean;
};

export function mayaAgenticsAvailabilityView(readiness: MayaAgenticsReadiness = MAYA_AGENTICS_DISABLED): MayaAgenticsCustomerView {
  if (!readiness.available || readiness.mode !== 'review_only' ||
      !readiness.authenticatedByNexa || !readiness.userScopedJobs ||
      readiness.externalEffects !== false || readiness.financialExecution !== false) {
    return {
      title: 'Maya continua disponível',
      detail: 'Você pode continuar usando as funções atuais da Maya. O planejamento com Agentics ainda está em preparação.',
      action: 'none', canClaimExecution: false,
    };
  }
  return {
    title: 'Planeje com a Maya',
    detail: 'Prepare e revise uma tarefa. Nada será executado ou enviado automaticamente.',
    action: 'review', canClaimExecution: false,
  };
}

export function mayaAgenticsTaskView(task: MayaAgenticTask | null): MayaAgenticsCustomerView {
  if (!task) return {title:'Tarefa indisponível', detail:'Não foi possível verificar essa tarefa.', action:'none', canClaimExecution:false};
  if (task.status === 'draft' || task.status === 'awaiting_approval') {
    return {title:taskLabels[task.status], detail:'Revise os detalhes antes de qualquer autorização. Nenhuma ação foi realizada.', action:'review',canClaimExecution:false};
  }
  if (task.mode === 'read_only') {
    return {title:taskLabels[task.status],detail:'Resultado de análise ou planejamento, sem alterações em contas ou serviços externos.',action:'none',canClaimExecution:false};
  }
  return {
    title:taskLabels[task.status],
    detail:'Consulte as evidências verificadas para saber o que foi realizado. O status isolado não comprova execução.',
    action:'none',canClaimExecution:false,
  };
}
