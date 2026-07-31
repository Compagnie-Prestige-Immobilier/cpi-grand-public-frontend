declare namespace App {
namespace Dto {
export type ActivityLogData = {
readonly id: number,
readonly logName: string | null,
readonly description: string,
readonly subjectType: string | null,
readonly subjectId: string | null,
readonly causerType: string | null,
readonly causerId: string | null,
readonly causerName: string | null,
readonly causerRole: string | null,
readonly clientId: string | null,
readonly clientName: string | null,
readonly event: string | null,
readonly properties: Record<string, any> | null,
readonly createdAt: string | null,
};
export type BankAssignmentData = {
readonly id: string,
readonly clientId: string,
readonly bankId: string,
readonly bankName: string,
readonly status: string,
};
export type BankData = {
readonly id: string,
readonly name: string,
readonly conventionDate: string | null,
readonly validity: string | null,
readonly products: string[] | null,
readonly rate: string | null,
readonly contact: string | null,
readonly color: string,
readonly assignments: App.Dto.BankAssignmentData[] | null,
};
export type ChantierData = {
readonly id: string,
readonly clientId: string,
readonly projet: string | null,
readonly reference: string | null,
readonly localisation: string | null,
readonly chefChantier: string | null,
readonly entreprise: string | null,
readonly dateDebut: string | null,
readonly dateLivraison: string | null,
readonly progression: number,
readonly etapeActuelle: string,
readonly statut: string,
readonly derniereMaj: string | null,
readonly tranches: App.Dto.ChantierTrancheData[] | null,
readonly publications: App.Dto.ChantierPublicationData[] | null,
readonly medias: App.Dto.ChantierMediaData[] | null,
readonly events: App.Dto.ChantierEventData[] | null,
};
export type ChantierEventData = {
readonly id: string,
readonly chantierId: string,
readonly titre: string,
readonly type: string,
readonly date: string | null,
readonly heure: string | null,
readonly description: string,
readonly statut: string,
readonly visibleClient: boolean,
};
export type ChantierMediaData = {
fileUrl: string | null,
readonly id: string,
readonly chantierId: string,
readonly type: string,
readonly titre: string,
readonly description: string | null,
readonly date: string | null,
readonly phase: number,
readonly auteur: string,
readonly bg: string | null,
readonly visibleClient: boolean,
};
export type ChantierPublicationData = {
readonly id: string,
readonly chantierId: string,
readonly phase: number,
readonly titre: string,
readonly description: string,
readonly date: string | null,
readonly heure: string,
readonly auteur: string,
readonly type: string,
readonly visibleClient: boolean,
};
export type ChantierTrancheData = {
readonly id: string,
readonly chantierId: string,
readonly num: number,
readonly label: string,
readonly description: string | null,
readonly pct: number,
readonly etat: string,
readonly date: string | null,
readonly comment: string | null,
};
export type ClientData = {
readonly id: string,
readonly name: string,
readonly ref: string,
readonly statut: string,
readonly progression: number,
readonly projectNom: string | null,
readonly adresse: string | null,
readonly email: string | null,
readonly phone: string | null,
readonly employer: string | null,
readonly fonction: string | null,
readonly conseiller: string | null,
readonly banque: string | null,
readonly dossierEtape: number,
readonly dateInscription: string | null,
readonly demande: App.Dto.DemandeData | null,
readonly requisDocs: App.Dto.RequisDocData[] | null,
};
export type CpiDocData = {
fileUrl: string | null,
readonly id: string,
readonly clientId: string,
readonly categorie: string,
readonly nom: string,
readonly reference: string | null,
readonly dateCreation: string,
readonly datePublication: string | null,
readonly version: string,
readonly status: string,
readonly auteur: string,
readonly fichier: string | null,
readonly filePath: string | null,
readonly commentaire: string | null,
readonly visibleClient: boolean,
readonly signatureRequise: boolean,
readonly taille: string | null,
readonly format: string | null,
};
export type DecaissementData = {
readonly id: string,
readonly clientId: string,
readonly terrainMontant: number,
readonly terrainDecaisse: boolean,
readonly terrainDate: string | null,
readonly foncier: boolean[],
readonly constructionActive: boolean,
readonly constructionMontant: number,
readonly tranches: Record<string, any>[],
};
export type DemandeData = {
readonly id: string,
readonly clientId: string,
readonly submitted: boolean,
readonly submittedAt: string | null,
readonly typeProjet: string,
readonly natureProjet: string,
readonly montant: number | null,
readonly duree: string,
readonly apport: number,
readonly region: string,
readonly commune: string | null,
readonly adresseProjet: string | null,
readonly description: string | null,
};
export type NotificationData = {
readonly id: string,
readonly userId: string | null,
readonly clientId: string | null,
readonly titre: string,
readonly message: string,
readonly date: string,
readonly heure: string,
readonly lu: boolean,
readonly type: string,
readonly targetPage: string | null,
readonly targetSub: string | null,
};
export type RequisDocData = {
fileUrl: string | null,
readonly id: string,
readonly clientId: string,
readonly docId: string,
readonly label: string,
readonly status: string,
readonly commentaire: string | null,
readonly dateValidation: string | null,
readonly agentName: string | null,
readonly version: number,
readonly submittedLabel: string | null,
readonly date: string | null,
readonly taille: string | null,
readonly filePath: string | null,
};
export type UserData = {
avatarUrl: string | null,
readonly id: string,
readonly name: string,
readonly email: string,
readonly phone: string | null,
readonly employer: string | null,
readonly profileType: string | null,
readonly revenus: string | null,
readonly avatar: string | null,
readonly needsOnboarding: boolean,
readonly role: string | null,
readonly permissions: string[],
readonly clientId: string | null,
};
}
}
declare namespace Illuminate {
export type CursorPaginator<TKey, TValue> = {
data: TKey extends string ? Record<TKey, TValue> : TValue[],
links: {
url: string | null,
label: string,
active: boolean,
}[],
meta: {
path: string,
per_page: number,
next_cursor: string | null,
next_page_url: string | null,
prev_cursor: string | null,
prev_page_url: string | null,
},
};
export type CursorPaginatorInterface<TKey, TValue> = Illuminate.CursorPaginator<TKey, TValue>;
export type LengthAwarePaginator<TKey, TValue> = {
data: TKey extends string ? Record<TKey, TValue> : TValue[],
links: {
url: string | null,
label: string,
active: boolean,
}[],
meta: {
total: number,
current_page: number,
first_page_url: string,
from: number | null,
last_page: number,
last_page_url: string,
next_page_url: string | null,
path: string,
per_page: number,
prev_page_url: string | null,
to: number | null,
},
};
export type LengthAwarePaginatorInterface<TKey, TValue> = Illuminate.LengthAwarePaginator<TKey, TValue>;
}
declare namespace Spatie {
namespace LaravelData {
export type CursorPaginatedDataCollection<TKey, TValue> = Illuminate.CursorPaginator<TKey, TValue>;
export type PaginatedDataCollection<TKey, TValue> = Illuminate.LengthAwarePaginator<TKey, TValue>;
}
}
