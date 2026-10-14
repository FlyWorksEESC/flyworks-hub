// Cargos oficiais informados pela Fly. Candidaturas continuam fictícias.
window.HUB_CONFIG = {
  hostingMode: 'github-pages',
  electionTitle: 'Eleições Diretoria 2027',
  positions: ["Diretor Presidente", "Diretor Administrativo", "Diretor Jurídico-Financeiro", "Diretor de Projetos", "Diretor Comercial"].map((name, i) => ({
    id: 'cargo-' + (i + 1), name,
    candidates: [
      {id: 'exemplo-a', name: 'Pessoa exemplo A', proposal: 'Proposta fictícia: organizar a transição de gestão, documentar processos e ampliar a troca de conhecimento.'},
      {id: 'exemplo-b', name: 'Pessoa exemplo B', proposal: 'Proposta fictícia: acompanhar objetivos da diretoria e fortalecer a colaboração entre as equipes.'}
    ]
  }))
};
