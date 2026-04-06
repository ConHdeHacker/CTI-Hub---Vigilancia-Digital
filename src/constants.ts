export const CATEGORIES = [
  "Exposicion de informacion",
  "Fugas de credenciales",
  "Exposicion de sistemas y vulnerabilidades",
  "Monitorizacion de dominios",
  "Monitorizacion Web / Defacement",
  "Listas de categorizacion",
  "Contenidos ofensivos",
  "Abuso y suplantacion de marca",
  "Fraude de aplicaciones",
  "Exposicion Bancaria y carding"
];

export const STATUS_LABELS = {
  new: "Nuevo",
  in_progress: "En Progreso",
  resolved: "Resuelto",
  false_positive: "Falso Positivo"
};

export const SEVERITY_COLORS = {
  low: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  high: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  critical: "bg-red-500/10 text-red-400 border-red-500/20"
};

export const STATUS_COLORS = {
  new: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  in_progress: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  resolved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  false_positive: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20"
};

export const TAKEDOWN_SCENARIOS = {
  domain: "Dominios fraudulentos o similares",
  phishing: "Sitios web de phishing",
  subdomain: "Subdominios maliciosos",
  impersonation: "Redirecciones o infraestructura de suplantación",
  social: "Perfiles falsos en redes sociales",
  mobile_app: "Aplicaciones móviles fraudulentas",
  post_ad: "Publicaciones o anuncios (Uso indebido de marca)",
  messaging: "Campañas de mensajería maliciosa (Smishing)"
};

export const TAKEDOWN_STATUS_LABELS = {
  validation: "Detección y validación técnica",
  evaluation: "Evaluación y priorización",
  request: "Solicitud formal de retirada",
  follow_up: "Seguimiento hasta resolución",
  resolved: "Resuelto / Despublicado",
  rejected: "Rechazado / No procede"
};

export const TAKEDOWN_STATUS_COLORS = {
  validation: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  evaluation: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  request: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  follow_up: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  resolved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  rejected: "bg-red-500/10 text-red-400 border-red-500/20"
};

export const PUBLIC_REPORT_CATEGORIES = [
  "Tendencias",
  "Sectoriales",
  "Actores Amenaza",
  "Campañas"
];

export const PRIVATE_REPORT_SUBTYPES = [
  "Informe Técnico",
  "Informe Ejecutivo",
  "Alerta Temprana",
  "Sectorial Ad-hoc"
];
