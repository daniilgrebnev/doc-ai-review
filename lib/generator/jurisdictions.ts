/**
 * Jurisdiction profiles for the localized contract generator: language, cities,
 * currency, company forms, registration ids, governing law and court.
 * Everything here ends up in the contract text only as "cues"; which of them
 * appear depends on the visibility setting (see localized.ts).
 */

export const JURISDICTIONS = ["none", "RU", "DE", "EU", "US-NY"] as const;
export type Jurisdiction = (typeof JURISDICTIONS)[number];

export const VISIBILITIES = ["explicit", "indirect", "hidden"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export function isJurisdiction(v: unknown): v is Jurisdiction {
  return typeof v === "string" && (JURISDICTIONS as readonly string[]).includes(v);
}

export function isVisibility(v: unknown): v is Visibility {
  return typeof v === "string" && (VISIBILITIES as readonly string[]).includes(v);
}

/** A country the contract is localized to */
export interface CountryProfile {
  /** ISO 3166 code: RU, DE, US, HU, ... */
  code: string;
  /** Contract language, ISO 639-1 */
  lang: string;
  /** Language name in English, for the translator prompt */
  langName: string;
  /** "the laws of Hungary" */
  law: string;
  cities: string[];
  /** Court for the explicit disputes clause; {city} is replaced */
  court: string;
  /** ISO 4217 code and a multiplier from the EUR base fee */
  currency: string;
  feeFactor: number;
  /** Company form; "prefix" puts it before the name (ООО «…») */
  form: string;
  formPosition: "prefix" | "suffix";
  /** Registration ids; # is a digit drawn from the seed */
  ids: string[];
  /** Region code by city, for {region} in ids (RU tax ids start with it) */
  regions?: Record<string, string>;
  /** Company names typical for the country (clients and contractors are drawn from the same list) */
  names?: string[];
}

const INTL_NAMES = ["Alpha Service", "Kvant Systems", "Bright Line", "North Works", "Vector Trade", "Orion Group", "Delta Retail", "Meridian Partners"];

export const RU: CountryProfile = {
  code: "RU",
  lang: "ru",
  langName: "Russian",
  law: "the laws of the Russian Federation",
  cities: ["Moscow", "Saint Petersburg", "Kazan", "Yekaterinburg"],
  court: "the Arbitrazh Court of {city}",
  currency: "RUB",
  feeFactor: 95,
  form: "ООО",
  formPosition: "prefix",
  ids: ["ОГРН 1##{region}#########", "ИНН {region}########", "КПП {region}##01001"],
  regions: { Moscow: "77", "Saint Petersburg": "78", Kazan: "16", Yekaterinburg: "66" },
  names: ["«Альфа Сервис»", "«Квант Системс»", "«Светлая Линия»", "«Северные Работы»", "«Вектор»", "«Орион Трейд»", "«Дельта Ритейл»", "«Меридиан Групп»"],
};

export const DE: CountryProfile = {
  code: "DE",
  lang: "de",
  langName: "German",
  law: "the laws of the Federal Republic of Germany",
  cities: ["Munich", "Hamburg", "Cologne", "Frankfurt am Main"],
  court: "the Regional Court (Landgericht) of {city}",
  currency: "EUR",
  feeFactor: 1,
  form: "GmbH",
  formPosition: "suffix",
  ids: ["HRB ######, Amtsgericht {city}", "USt-IdNr. DE#########"],
  names: ["Nordwerk", "Kvant Systeme", "Hellweg Service", "Rheinlogik", "Alpenblick Handel", "Elbtor Digital", "Mainfeld Consulting", "Isartal Partner"],
};

export const US_NY: CountryProfile = {
  code: "US",
  lang: "en",
  langName: "English",
  law: "the laws of the State of New York",
  cities: ["New York, NY", "Buffalo, NY", "Rochester, NY", "Albany, NY"],
  court: "the state and federal courts located in {city}",
  currency: "USD",
  feeFactor: 1.1,
  form: "LLC",
  formPosition: "suffix",
  ids: ["EIN ##-#######", "NY DOS ID #######"],
  names: ["Hudson Line", "Empire Works", "Bright Line", "North Works", "Vector Trade", "Lakeside Group", "Meridian Partners", "Catskill Digital"],
};

/** EU member states, one per official language (Irish and English both map to Ireland) */
export const EU_COUNTRIES: CountryProfile[] = [
  eu("HU", "hu", "Hungarian", "Hungary", ["Budapest", "Debrecen", "Szeged"], "HUF", 400, "Kft.", ["Cg. 01-09-######", "adószám ########-2-##"]),
  eu("PL", "pl", "Polish", "Poland", ["Warsaw", "Kraków", "Wrocław"], "PLN", 4.3, "sp. z o.o.", ["KRS 0000######", "NIP ##########"]),
  eu("FR", "fr", "French", "France", ["Lyon", "Paris", "Lille"], "EUR", 1, "SARL", ["RCS {city} ### ### ###", "SIRET ### ### ### #####"]),
  eu("IT", "it", "Italian", "Italy", ["Milan", "Turin", "Bologna"], "EUR", 1, "S.r.l.", ["REA ##-######", "P.IVA ###########"]),
  eu("ES", "es", "Spanish", "Spain", ["Valencia", "Madrid", "Seville"], "EUR", 1, "S.L.", ["CIF B########"]),
  eu("NL", "nl", "Dutch", "the Netherlands", ["Rotterdam", "Utrecht", "Eindhoven"], "EUR", 1, "B.V.", ["KvK ########", "btw NL#########B01"]),
  eu("CZ", "cs", "Czech", "the Czech Republic", ["Brno", "Prague", "Ostrava"], "CZK", 25, "s.r.o.", ["IČO ########", "DIČ CZ########"]),
  eu("RO", "ro", "Romanian", "Romania", ["Cluj-Napoca", "Bucharest", "Iași"], "RON", 5, "S.R.L.", ["J##/####/20##", "CUI RO########"]),
  eu("SE", "sv", "Swedish", "Sweden", ["Gothenburg", "Stockholm", "Malmö"], "SEK", 11, "AB", ["org.nr 556###-####"]),
  eu("PT", "pt", "Portuguese", "Portugal", ["Porto", "Lisbon", "Braga"], "EUR", 1, "Lda.", ["NIPC 5########"]),
  eu("GR", "el", "Greek", "Greece", ["Thessaloniki", "Athens", "Patras"], "EUR", 1, "EPE", ["GEMI ############", "AFM #########"]),
  eu("BG", "bg", "Bulgarian", "Bulgaria", ["Sofia", "Plovdiv", "Varna"], "EUR", 1, "OOD", ["UIC #########"]),
  eu("FI", "fi", "Finnish", "Finland", ["Tampere", "Helsinki", "Turku"], "EUR", 1, "Oy", ["Business ID #######-#"]),
  eu("DK", "da", "Danish", "Denmark", ["Aarhus", "Copenhagen", "Odense"], "DKK", 7.5, "ApS", ["CVR ########"]),
  eu("SK", "sk", "Slovak", "Slovakia", ["Bratislava", "Košice", "Žilina"], "EUR", 1, "s.r.o.", ["IČO ########", "IČ DPH SK##########"]),
  eu("SI", "sl", "Slovenian", "Slovenia", ["Ljubljana", "Maribor", "Celje"], "EUR", 1, "d.o.o.", ["matična št. #######000", "ID za DDV SI########"]),
  eu("HR", "hr", "Croatian", "Croatia", ["Zagreb", "Split", "Rijeka"], "EUR", 1, "d.o.o.", ["OIB ###########", "MBS #########"]),
  eu("LT", "lt", "Lithuanian", "Lithuania", ["Vilnius", "Kaunas", "Klaipėda"], "EUR", 1, "UAB", ["įmonės kodas #########"]),
  eu("LV", "lv", "Latvian", "Latvia", ["Riga", "Daugavpils", "Liepāja"], "EUR", 1, "SIA", ["reģ. Nr. 4000#######"]),
  eu("EE", "et", "Estonian", "Estonia", ["Tartu", "Tallinn", "Pärnu"], "EUR", 1, "OÜ", ["registrikood 1#######"]),
  eu("IE", "ga", "Irish", "Ireland", ["Cork", "Galway", "Dublin"], "EUR", 1, "Teoranta", ["CRO ######"]),
  eu("MT", "mt", "Maltese", "Malta", ["Valletta", "Birkirkara", "Sliema"], "EUR", 1, "Ltd", ["C #####", "VAT MT########"]),
  eu("AT", "de", "German", "the Republic of Austria", ["Vienna", "Graz", "Linz"], "EUR", 1, "GmbH", ["FN ######x", "UID ATU########"]),
  eu("IE", "en", "English", "Ireland", ["Dublin", "Limerick", "Cork"], "EUR", 1, "Ltd", ["CRO ######"]),
];

function eu(
  code: string,
  lang: string,
  langName: string,
  country: string,
  cities: string[],
  currency: string,
  feeFactor: number,
  form: string,
  ids: string[]
): CountryProfile {
  return { code, lang, langName, law: `the laws of ${country}`, cities, court: "the competent court in {city}", currency, feeFactor, form, formPosition: "suffix", ids, names: INTL_NAMES };
}

/** Neutral profile for jurisdiction "none" (and for wording that must not point anywhere) */
export const NEUTRAL: CountryProfile = {
  code: "",
  lang: "en",
  langName: "English",
  law: "",
  cities: [],
  court: "the competent court",
  currency: "",
  feeFactor: 1,
  form: "",
  formPosition: "suffix",
  ids: [],
  names: INTL_NAMES,
};

/** Picks the country profile; for the EU the language (and with it the member state) comes from the seed */
export function countryFor(jurisdiction: Jurisdiction, r: () => number): CountryProfile {
  switch (jurisdiction) {
    case "RU":
      return RU;
    case "DE":
      return DE;
    case "US-NY":
      return US_NY;
    case "EU":
      return EU_COUNTRIES[Math.floor(r() * EU_COUNTRIES.length)];
    default:
      return NEUTRAL;
  }
}

/** Languages the EU directives are loaded in (law_slots ids eu:<act>@<lang>:...) */
export const EU_SLOT_LANGS = ["en", "de"];
