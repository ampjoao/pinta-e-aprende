/**
 * Mensagens de erro do servidor em várias línguas. O servidor devolve sempre o código
 * (`code`) e a mensagem traduzida para a língua pedida no cabeçalho Accept-Language.
 * Para acrescentar uma língua: copiar o bloco `en` e traduzir.
 */
export const LANGUAGES = ['en', 'pt-PT', 'pt-BR', 'es', 'fr'] as const
export type Language = (typeof LANGUAGES)[number]

type Catalog = { messages: Record<string, string>; fields: Record<string, string>; list: (items: string[]) => string }

const join = (and: string) => (items: string[]) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} ${and} ${items[items.length - 1]}`

const en: Catalog = {
  list: join('and'),
  messages: {
    forbidden: 'You do not have permission for this action.',
    suspended: 'This account is suspended. Please contact support.',
    identity_required: 'Please verify your identity first.',
    email_invalid: 'Invalid email address.',
    password_short: 'The password needs at least 10 characters.',
    email_taken: 'An account with this email already exists.',
    role_required: 'Choose: I want to help or I need help.',
    login_failed: 'Wrong email or password.',
    session_expired: 'Your session has expired. Please sign in again.',
    identity_already: 'Your identity is already verified.',
    country_unavailable: 'Mão Amiga is not available in this country yet.',
    id_invalid: 'Invalid identification number.',
    birthdate_invalid: 'Invalid date of birth.',
    underage: 'You must be {age} or older.',
    id_duplicate: 'This identification number is already linked to another account.',
    kyc_failed: 'We could not verify your identity: {reason}.',
    invalid_value: '{field}: invalid value.',
    text_length: '{field}: between {min} and {max} characters.',
    application_locked: 'Your request has already been submitted and cannot be changed.',
    category_invalid: 'Invalid category.',
    payout_invalid: 'Check the details of how you want to receive the money.',
    payout_not_allowed: 'This payment method is not available in your country.',
    save_first: 'Save the request details first.',
    doc_kind_invalid: 'Invalid document type.',
    doc_mime_invalid: 'Only PDF, JPEG or PNG files are accepted.',
    doc_empty: 'The file is empty.',
    doc_too_big: 'The file is larger than 5 MB.',
    doc_too_many: 'At most {max} documents.',
    nothing_to_submit: 'There is no request to submit.',
    missing_fields: 'Still missing: {fields}.',
    missing_documents: 'Missing documents: {docs}.',
    payout_duplicate: 'This account is already linked to another person.',
    thanks_after_payout: 'You can leave a message after receiving your first support payment.',
    not_found: 'Not found.',
    already_decided: 'This request has already been decided.',
    already_voted: 'You have already voted on this request.',
    decision_invalid: 'Invalid decision.',
    cycle_min_donors: 'Only {count} new donor(s) this cycle; {min} are needed to protect anonymity.',
    currency_unsupported: 'Currency not supported.',
    donation_range: 'The donation must be between {min} and {max}.',
    too_many_requests: 'Too many attempts. Try again in 15 minutes.',
    too_large: 'Request too large.',
    invalid_json: 'Invalid JSON.',
    internal: 'Internal error. Please try again later.',
  },
  fields: {
    legal_name: 'Full name',
    adults: 'Adults',
    children: 'Children',
    income: 'Income',
    expenses: 'Expenses',
    requested: 'Amount requested',
    description: 'Description',
    category: 'category',
    payout: 'how to receive',
    filename: 'File name',
    note: 'Reason',
    message: 'Message',
    amount: 'Amount',
    income_proof: 'proof of income',
    address_proof: 'proof of address',
  },
}

const ptPT: Catalog = {
  list: join('e'),
  messages: {
    forbidden: 'Sem permissão para esta ação.',
    suspended: 'Conta suspensa. Contacte o apoio.',
    identity_required: 'Precisa de verificar a identidade primeiro.',
    email_invalid: 'Email inválido.',
    password_short: 'A palavra-passe precisa de pelo menos 10 caracteres.',
    email_taken: 'Já existe uma conta com este email.',
    role_required: 'Escolha: quero ajudar ou preciso de ajuda.',
    login_failed: 'Email ou palavra-passe errados.',
    session_expired: 'Sessão expirada. Entre outra vez.',
    identity_already: 'A identidade já está verificada.',
    country_unavailable: 'A Mão Amiga ainda não está disponível neste país.',
    id_invalid: 'Número de identificação inválido.',
    birthdate_invalid: 'Data de nascimento inválida.',
    underage: 'É preciso ter {age} anos ou mais.',
    id_duplicate: 'Este número de identificação já está associado a outra conta.',
    kyc_failed: 'Não foi possível verificar a identidade: {reason}.',
    invalid_value: '{field}: valor inválido.',
    text_length: '{field}: entre {min} e {max} caracteres.',
    application_locked: 'O pedido já foi enviado e não pode ser alterado.',
    category_invalid: 'Categoria inválida.',
    payout_invalid: 'Verifique os dados para receber o dinheiro.',
    payout_not_allowed: 'Esta forma de receber não está disponível no seu país.',
    save_first: 'Guarde primeiro os dados do pedido.',
    doc_kind_invalid: 'Tipo de documento inválido.',
    doc_mime_invalid: 'Só se aceitam PDF, JPEG ou PNG.',
    doc_empty: 'Ficheiro vazio.',
    doc_too_big: 'Ficheiro maior que 5 MB.',
    doc_too_many: 'No máximo {max} documentos.',
    nothing_to_submit: 'Não há nenhum pedido por enviar.',
    missing_fields: 'Falta preencher: {fields}.',
    missing_documents: 'Faltam documentos: {docs}.',
    payout_duplicate: 'Esta conta já está associada a outra pessoa.',
    thanks_after_payout: 'Pode deixar uma mensagem depois de receber o primeiro apoio.',
    not_found: 'Não encontrado.',
    already_decided: 'Este pedido já foi decidido.',
    already_voted: 'Já votou neste pedido.',
    decision_invalid: 'Decisão inválida.',
    cycle_min_donors: 'Ainda só há {count} doador(es) novos neste ciclo; são precisos {min} para proteger o anonimato.',
    currency_unsupported: 'Moeda não suportada.',
    donation_range: 'A doação tem de estar entre {min} e {max}.',
    too_many_requests: 'Demasiadas tentativas. Tente daqui a 15 minutos.',
    too_large: 'Pedido demasiado grande.',
    invalid_json: 'JSON inválido.',
    internal: 'Erro interno. Tente mais tarde.',
  },
  fields: {
    legal_name: 'Nome completo',
    adults: 'Adultos',
    children: 'Crianças',
    income: 'Rendimento',
    expenses: 'Despesas',
    requested: 'Valor pedido',
    description: 'Descrição',
    category: 'categoria',
    payout: 'forma de receber',
    filename: 'Nome do ficheiro',
    note: 'Justificação',
    message: 'Mensagem',
    amount: 'Valor',
    income_proof: 'prova de rendimentos',
    address_proof: 'prova de morada',
  },
}

const ptBR: Catalog = {
  ...ptPT,
  messages: {
    ...ptPT.messages,
    suspended: 'Conta suspensa. Entre em contato com o suporte.',
    identity_required: 'Você precisa verificar sua identidade primeiro.',
    email_invalid: 'E-mail inválido.',
    password_short: 'A senha precisa ter pelo menos 10 caracteres.',
    email_taken: 'Já existe uma conta com este e-mail.',
    login_failed: 'E-mail ou senha incorretos.',
    session_expired: 'Sessão expirada. Entre novamente.',
    country_unavailable: 'A Mão Amiga ainda não está disponível neste país.',
    save_first: 'Salve primeiro os dados do pedido.',
    doc_empty: 'Arquivo vazio.',
    doc_too_big: 'Arquivo maior que 5 MB.',
    payout_invalid: 'Confira os dados para receber o dinheiro.',
    thanks_after_payout: 'Você pode deixar uma mensagem depois de receber o primeiro apoio.',
    already_voted: 'Você já votou neste pedido.',
    too_many_requests: 'Muitas tentativas. Tente de novo em 15 minutos.',
  },
  fields: { ...ptPT.fields, filename: 'Nome do arquivo', income: 'Renda' },
}

const es: Catalog = {
  list: join('y'),
  messages: {
    forbidden: 'No tiene permiso para esta acción.',
    suspended: 'Cuenta suspendida. Contacte con soporte.',
    identity_required: 'Primero tiene que verificar su identidad.',
    email_invalid: 'Correo electrónico no válido.',
    password_short: 'La contraseña necesita al menos 10 caracteres.',
    email_taken: 'Ya existe una cuenta con este correo.',
    role_required: 'Elija: quiero ayudar o necesito ayuda.',
    login_failed: 'Correo o contraseña incorrectos.',
    session_expired: 'La sesión ha caducado. Vuelva a entrar.',
    identity_already: 'La identidad ya está verificada.',
    country_unavailable: 'Mão Amiga todavía no está disponible en este país.',
    id_invalid: 'Número de identificación no válido.',
    birthdate_invalid: 'Fecha de nacimiento no válida.',
    underage: 'Tiene que tener {age} años o más.',
    id_duplicate: 'Este número de identificación ya está asociado a otra cuenta.',
    kyc_failed: 'No se pudo verificar la identidad: {reason}.',
    invalid_value: '{field}: valor no válido.',
    text_length: '{field}: entre {min} y {max} caracteres.',
    application_locked: 'La solicitud ya se envió y no se puede cambiar.',
    category_invalid: 'Categoría no válida.',
    payout_invalid: 'Revise los datos para recibir el dinero.',
    payout_not_allowed: 'Esta forma de cobro no está disponible en su país.',
    save_first: 'Guarde primero los datos de la solicitud.',
    doc_kind_invalid: 'Tipo de documento no válido.',
    doc_mime_invalid: 'Solo se aceptan PDF, JPEG o PNG.',
    doc_empty: 'El archivo está vacío.',
    doc_too_big: 'El archivo supera 5 MB.',
    doc_too_many: 'Como máximo {max} documentos.',
    nothing_to_submit: 'No hay ninguna solicitud por enviar.',
    missing_fields: 'Falta completar: {fields}.',
    missing_documents: 'Faltan documentos: {docs}.',
    payout_duplicate: 'Esta cuenta ya está asociada a otra persona.',
    thanks_after_payout: 'Puede dejar un mensaje después de recibir la primera ayuda.',
    not_found: 'No encontrado.',
    already_decided: 'Esta solicitud ya se decidió.',
    already_voted: 'Ya votó en esta solicitud.',
    decision_invalid: 'Decisión no válida.',
    cycle_min_donors: 'Solo hay {count} donante(s) nuevos en este ciclo; se necesitan {min} para proteger el anonimato.',
    currency_unsupported: 'Moneda no admitida.',
    donation_range: 'La donación debe estar entre {min} y {max}.',
    too_many_requests: 'Demasiados intentos. Inténtelo dentro de 15 minutos.',
    too_large: 'Solicitud demasiado grande.',
    invalid_json: 'JSON no válido.',
    internal: 'Error interno. Inténtelo más tarde.',
  },
  fields: {
    legal_name: 'Nombre completo',
    adults: 'Adultos',
    children: 'Niños',
    income: 'Ingresos',
    expenses: 'Gastos',
    requested: 'Importe solicitado',
    description: 'Descripción',
    category: 'categoría',
    payout: 'forma de cobro',
    filename: 'Nombre del archivo',
    note: 'Justificación',
    message: 'Mensaje',
    amount: 'Importe',
    income_proof: 'justificante de ingresos',
    address_proof: 'justificante de domicilio',
  },
}

const fr: Catalog = {
  list: join('et'),
  messages: {
    forbidden: "Vous n'avez pas la permission pour cette action.",
    suspended: 'Compte suspendu. Contactez le support.',
    identity_required: "Vous devez d'abord vérifier votre identité.",
    email_invalid: 'Adresse e-mail invalide.',
    password_short: 'Le mot de passe doit contenir au moins 10 caractères.',
    email_taken: 'Un compte existe déjà avec cet e-mail.',
    role_required: "Choisissez : je veux aider ou j'ai besoin d'aide.",
    login_failed: 'E-mail ou mot de passe incorrect.',
    session_expired: 'Session expirée. Reconnectez-vous.',
    identity_already: "L'identité est déjà vérifiée.",
    country_unavailable: "Mão Amiga n'est pas encore disponible dans ce pays.",
    id_invalid: "Numéro d'identification invalide.",
    birthdate_invalid: 'Date de naissance invalide.',
    underage: 'Vous devez avoir {age} ans ou plus.',
    id_duplicate: "Ce numéro d'identification est déjà associé à un autre compte.",
    kyc_failed: "Impossible de vérifier l'identité : {reason}.",
    invalid_value: '{field} : valeur invalide.',
    text_length: '{field} : entre {min} et {max} caractères.',
    application_locked: 'La demande a déjà été envoyée et ne peut plus être modifiée.',
    category_invalid: 'Catégorie invalide.',
    payout_invalid: "Vérifiez les informations pour recevoir l'argent.",
    payout_not_allowed: "Ce moyen de paiement n'est pas disponible dans votre pays.",
    save_first: "Enregistrez d'abord les informations de la demande.",
    doc_kind_invalid: 'Type de document invalide.',
    doc_mime_invalid: 'Seuls les fichiers PDF, JPEG ou PNG sont acceptés.',
    doc_empty: 'Le fichier est vide.',
    doc_too_big: 'Le fichier dépasse 5 Mo.',
    doc_too_many: 'Au maximum {max} documents.',
    nothing_to_submit: "Il n'y a aucune demande à envoyer.",
    missing_fields: 'Il manque : {fields}.',
    missing_documents: 'Documents manquants : {docs}.',
    payout_duplicate: 'Ce compte est déjà associé à une autre personne.',
    thanks_after_payout: 'Vous pourrez laisser un message après avoir reçu votre première aide.',
    not_found: 'Introuvable.',
    already_decided: 'Cette demande a déjà été tranchée.',
    already_voted: 'Vous avez déjà voté pour cette demande.',
    decision_invalid: 'Décision invalide.',
    cycle_min_donors: "Seulement {count} nouveau(x) donateur(s) ce cycle ; il en faut {min} pour protéger l'anonymat.",
    currency_unsupported: 'Devise non prise en charge.',
    donation_range: 'Le don doit être compris entre {min} et {max}.',
    too_many_requests: 'Trop de tentatives. Réessayez dans 15 minutes.',
    too_large: 'Requête trop volumineuse.',
    invalid_json: 'JSON invalide.',
    internal: 'Erreur interne. Réessayez plus tard.',
  },
  fields: {
    legal_name: 'Nom complet',
    adults: 'Adultes',
    children: 'Enfants',
    income: 'Revenus',
    expenses: 'Dépenses',
    requested: 'Montant demandé',
    description: 'Description',
    category: 'catégorie',
    payout: 'moyen de réception',
    filename: 'Nom du fichier',
    note: 'Justification',
    message: 'Message',
    amount: 'Montant',
    income_proof: 'justificatif de revenus',
    address_proof: 'justificatif de domicile',
  },
}

const CATALOGS: Record<Language, Catalog> = { en, 'pt-PT': ptPT, 'pt-BR': ptBR, es, fr }

/** Escolhe a língua a partir do cabeçalho Accept-Language (por omissão, inglês). */
export function pickLanguage(header: string | undefined): Language {
  const wanted = (header ?? '')
    .split(',')
    .map((part) => part.split(';')[0].trim())
    .filter(Boolean)
  for (const w of wanted) {
    const exact = LANGUAGES.find((l) => l.toLowerCase() === w.toLowerCase())
    if (exact) return exact
    const base = w.split('-')[0].toLowerCase()
    if (base === 'pt') return 'pt-PT'
    const prefix = LANGUAGES.find((l) => l.split('-')[0] === base)
    if (prefix) return prefix
  }
  return 'en'
}

export type Params = Record<string, string | number | string[]>

/** Traduz um código. Parâmetros `field`/`fields`/`docs` são nomes de campos e também são traduzidos. */
export function translate(lang: Language, code: string, params: Params = {}): string {
  const cat = CATALOGS[lang]
  const template = cat.messages[code] ?? en.messages[code] ?? code
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const v = params[name]
    if (v === undefined) return `{${name}}`
    if (Array.isArray(v)) return cat.list(v.map((x) => cat.fields[x] ?? x))
    if (name === 'field') return cat.fields[String(v)] ?? String(v)
    return String(v)
  })
}
