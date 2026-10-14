// Deterministic interpretation of VERIFIED aggregate results, not a ballot box
// or a cryptographic verifier. No individual ballots or identities are accepted.
export function evaluateOfficialResult(config, input) {
  const fail = message => { throw new Error(message); };
  const integer = n => Number.isSafeInteger(n) && n >= 0;
  if (config?.revotingAllowed !== false || config?.ballotRule !== 'one-candidate-or-blank-per-position' ||
      config?.approval?.percentage !== 50 || config?.approval?.comparison !== 'greater-than-or-equal' ||
      config?.quorum?.minimumVoters !== 2 || config?.electorateCount !== 33 ||
      config?.approval?.blankTreatment !== 'incluído no denominador; não conta a favor do candidato') fail('Configuração eleitoral não suportada.');
  if (!Array.isArray(config.positions) || config.positions.length !== 5 || new Set(config.positions.map(p=>p.id)).size !== 5) fail('Catálogo de cargos inválido.');
  if (!input || Object.keys(input).sort().join(',') !== 'closed,participants,positions' || input.closed !== true) fail('Encerre a urna antes da apuração.');
  if (!integer(input.participants) || input.participants > config.electorateCount) fail('Participação inválida.');
  if (!Array.isArray(input.positions) || input.positions.length !== config.positions.length) fail('Apuração incompleta.');
  const byId = new Map();
  for (const p of input.positions) {
    if (!p || Object.keys(p).sort().join(',') !== 'blankVotes,candidateVotes,id' || !config.positions.some(c=>c.id===p.id) || byId.has(p.id)) fail('Cargo inválido ou repetido.');
    if (!integer(p.candidateVotes) || !integer(p.blankVotes) || p.candidateVotes + p.blankVotes !== input.participants) fail('Totais não correspondem à participação.');
    byId.set(p.id,p);
  }
  const quorumMet = input.participants >= config.quorum.minimumVoters;
  return {
    participants:input.participants, quorumMet,
    // Deliberately explicit: mathematical output does not certify its input.
    requiresIndependentCryptographicVerification:true,
    positions:config.positions.map(p=>{
      const count=byId.get(p.id);
      return {id:p.id,candidate:p.candidate,...count, percentage:input.participants ? 100*count.candidateVotes/input.participants : null,
        outcome:!quorumMet ? 'sem-quorum' : 2*count.candidateVotes >= input.participants ? 'eleito' : 'nao-eleito'};
    })
  };
}
