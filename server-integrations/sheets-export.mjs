/**
 * Exportação privada, após encerramento e verificação pelo serviço eleitoral.
 * Não é uma urna, API pública ou mecanismo de anonimização.
 * Execute somente no backend; nunca importe este arquivo no index.html.
 */
import { randomInt } from 'node:crypto';
const COLUMNS = ['eleicao', 'cargo', 'opcao'];
function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value, k));
}
function identifier(value, label) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(value)) {
    throw new Error(`${label}: use apenas identificador aprovado, sem dados pessoais.`);
  }
  return value;
}
/** Recebe escolhas já desvinculadas por um serviço eleitoral validado.
 * Cada registro representa uma escolha por cargo, não uma linha identificável por membro.
 * Rejeita campos extras em vez de descartá-los silenciosamente.
 */
export function prepareRows(batch, allowedOptions, pick = randomInt) {
  if (!exactKeys(batch, ['electionId', 'choices'])) throw new Error('Formato de lote inválido.');
  const election = identifier(batch.electionId, 'Eleição');
  if (!(allowedOptions instanceof Map) || !allowedOptions.size) throw new Error('Catálogo aprovado obrigatório.');
  if (!Array.isArray(batch.choices) || batch.choices.length < 1 || batch.choices.length > 100000) {
    throw new Error('Lote deve conter de 1 a 100000 escolhas.');
  }
  const rows = batch.choices.map(choice => {
    if (!exactKeys(choice, ['positionId', 'optionId'])) throw new Error('Escolha contém campos não permitidos.');
    const position = identifier(choice.positionId, 'Cargo');
    const option = identifier(choice.optionId, 'Opção');
    if (!allowedOptions.get(position)?.has(option)) throw new Error('Cargo ou opção não consta do catálogo aprovado.');
    return [election, position, option];
  });
  // Quebra a ordem do lote para exportação. Não torna anônimo um lote identificado.
  for (let i = rows.length - 1; i > 0; i--) {
    const j = pick(i + 1);
    [rows[i], rows[j]] = [rows[j], rows[i]];
  }
  return [COLUMNS.slice(), ...rows];
}
/** Exporta para uma aba vazia dedicada; não anexa votos um a um.
 * Em falha de rede, inspecionar destino antes de repetir. Não há atomicidade entre sistemas.
 * ID, nome da aba e catálogo vêm da configuração privada, nunca de entrada do navegador.
 * Token precisa ter acesso somente ao destino necessário; não é salvo ou registrado aqui.
 */
export async function exportClosedElection({ spreadsheetId, sheetName, accessToken, batch, allowedOptions, request = fetch }) {
  if (!/^[\w-]{10,200}$/.test(spreadsheetId || '')) throw new Error('ID de planilha inválido.');
  if (typeof sheetName !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(sheetName)) throw new Error('Nome de aba inválido.');
  if (typeof accessToken !== 'string' || !accessToken || /[\r\n]/.test(accessToken)) throw new Error('Credencial privada obrigatória.');
  const values = prepareRows(batch, allowedOptions);
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/`;
  const range = encodeURIComponent(`'${sheetName}'!A:C`);
  const headers = { Authorization: `Bearer ${accessToken}` };
  const existing = await request(base + range, { headers });
  if (!existing.ok) throw new Error(`Não foi possível conferir destino (HTTP ${existing.status}).`);
  const content = await existing.json();
  if (content.values?.some(row => row.some(cell => cell !== ''))) {
    throw new Error('Aba não está vazia. Reconciliar exportação antes de repetir; nenhum dado foi sobrescrito.');
  }
  const write = await request(base + encodeURIComponent(`'${sheetName}'!A1`) + '?valueInputOption=RAW', {
    method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ majorDimension: 'ROWS', values })
  });
  if (!write.ok) throw new Error(`Falha ao exportar (HTTP ${write.status}). Conferir destino antes de repetir.`);
  const check = await request(base + range, { headers });
  if (!check.ok) throw new Error('Escrita pode ter ocorrido; leitura de conferência falhou. Reconciliar antes de repetir.');
  const readback = await check.json();
  if (JSON.stringify(readback.values) !== JSON.stringify(values)) throw new Error('Leitura diverge do lote exportado. Requer reconciliação.');
  return { verified: true, exportedChoices: values.length - 1 };
}
